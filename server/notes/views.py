from pathlib import Path
import json
import time
from django.core.cache import cache
from django.http import FileResponse, JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from .models import Note

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent


@ensure_csrf_cookie
def index(_request):
    return FileResponse(open(ROOT_DIR / "index.html", "rb"))


def serialize_note(note):
    return {
        "id": note.id,
        "text": note.text,
        "created_at": note.created_at.isoformat()
    }


@require_http_methods(["GET", "POST"])
def notes_endpoint(request):
    if request.method == "GET":
        notes = Note.objects.order_by("-created_at")[:200]
        return JsonResponse([serialize_note(note) for note in notes], safe=False)

    ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or request.META.get("REMOTE_ADDR", "")
    if ip:
        key = f"rl:{ip}"
        count = cache.get(key, 0)
        if count >= 8:
            return JsonResponse({"error": "Too many requests. Please wait."}, status=429)
        cache.set(key, count + 1, timeout=60)

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    text = (payload.get("text") or "").strip()
    if len(text) < 3 or len(text) > 280:
        return JsonResponse({"error": "Text must be 3-280 characters"}, status=400)
    if "http://" in text or "https://" in text:
        return JsonResponse({"error": "Links are not allowed"}, status=400)

    note = Note.objects.create(text=text)
    return JsonResponse(serialize_note(note), status=201)


def stream_notes(_request):
    def event_stream():
        last_id = None
        while True:
            latest = Note.objects.order_by("-created_at").values_list("id", flat=True).first()
            if latest and latest != last_id:
                last_id = latest
                yield "data: new\n\n"
            time.sleep(5)

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    return response
