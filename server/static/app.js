const form = document.getElementById("noteForm");
const noteBody = document.getElementById("noteBody");
const wall = document.getElementById("wall");
const charCount = document.getElementById("charCount");
const clearDraft = document.getElementById("clearDraft");
const jumpToForm = document.getElementById("jumpToForm");
const jumpToWall = document.getElementById("jumpToWall");
const submitBtn = document.getElementById("submitBtn");
const statusEl = document.getElementById("status");
const emptyState = document.getElementById("emptyState");

const DRAFT_KEY = "heartspace.draft";
const RATE_KEY = "heartspace.rate";
const API_BASE = "";
let knownNoteIds = new Set();
let liveSource = null;

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function updateCount() {
  const length = noteBody.value.length;
  charCount.textContent = `${length}/280`;
}

function loadDraft() {
  const draft = localStorage.getItem(DRAFT_KEY);
  if (draft) {
    noteBody.value = draft;
    updateCount();
  }
}

function renderNotes(notes) {
  wall.innerHTML = "";

  notes.forEach((note) => {
    const card = document.createElement("article");
    card.className = "note";
    if (!knownNoteIds.has(note.id)) {
      card.classList.add("note-new");
    }

    const body = document.createElement("p");
    body.textContent = note.text;

    const time = document.createElement("div");
    time.className = "time";
    time.textContent = formatTime(note.created_at);

    card.appendChild(body);
    card.appendChild(time);
    wall.appendChild(card);
    knownNoteIds.add(note.id);
  });

  const hasNotes = notes.length > 0;
  emptyState.style.display = hasNotes ? "none" : "block";
}

async function fetchNotes() {
  setStatus("Loading notes...");
  try {
    const response = await fetch(`${API_BASE}/api/notes`);
    if (!response.ok) {
      throw new Error(`Server responded ${response.status}`);
    }
    const data = await response.json();
    setStatus("");
    const notes = data || [];
    if (knownNoteIds.size === 0) {
      knownNoteIds = new Set(notes.map((note) => note.id));
    }
    renderNotes(notes);
  } catch (error) {
    console.error("Failed to load notes:", error.message);
    setStatus("Unable to load notes right now. Please refresh.", true);
  }
}

function subscribeToRealtime() {
  if (!window.EventSource) return;
  if (liveSource) liveSource.close();

  liveSource = new EventSource(`${API_BASE}/api/notes/stream`);
  liveSource.onmessage = () => {
    fetchNotes();
  };
  liveSource.onerror = () => {
    setStatus("Live updates disconnected. Reconnecting...", true);
  };
  liveSource.onopen = () => {
    setStatus("Live updates enabled.");
    setTimeout(() => setStatus(""), 2000);
  };
}

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status${isError ? " error" : ""}`;
}

function isRateLimited() {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxPerWindow = 4;

  const raw = localStorage.getItem(RATE_KEY);
  const timestamps = raw ? JSON.parse(raw) : [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= maxPerWindow) {
    localStorage.setItem(RATE_KEY, JSON.stringify(recent));
    return true;
  }

  recent.push(now);
  localStorage.setItem(RATE_KEY, JSON.stringify(recent));
  return false;
}

function validateText(text) {
  if (text.length < 3) return "Please write a little more.";
  if (text.length > 280) return "Please keep it under 280 characters.";
  if (/https?:\/\//i.test(text)) return "Please avoid links.";
  return "";
}

noteBody.addEventListener("input", () => {
  updateCount();
  localStorage.setItem(DRAFT_KEY, noteBody.value);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = noteBody.value.trim();
  if (!text) return;

  const validationMessage = validateText(text);
  if (validationMessage) {
    setStatus(validationMessage, true);
    return;
  }

  if (isRateLimited()) {
    setStatus("You're sending too fast. Please wait a moment.", true);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Posting...";

  try {
    const response = await fetch(`${API_BASE}/api/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error(`Server responded ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to save note:", error.message);
    setStatus("Could not post right now. Please try again.", true);
    submitBtn.disabled = false;
    submitBtn.textContent = "Post to the wall";
    return;
  }

  noteBody.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCount();
  setStatus("Posted. Thank you for sharing.");
  await fetchNotes();
  wall.scrollIntoView({ behavior: "smooth" });

  submitBtn.disabled = false;
  submitBtn.textContent = "Post to the wall";
});

clearDraft.addEventListener("click", () => {
  noteBody.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCount();
});

jumpToForm.addEventListener("click", () => {
  document.getElementById("formPanel").scrollIntoView({ behavior: "smooth" });
});

jumpToWall.addEventListener("click", () => {
  document.getElementById("wallPanel").scrollIntoView({ behavior: "smooth" });
});

fetchNotes();
subscribeToRealtime();
loadDraft();
updateCount();
