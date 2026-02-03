from django.urls import path
from . import views

urlpatterns = [
    path("notes", views.notes_endpoint),
    path("notes/stream", views.stream_notes),
    path("csrf", views.csrf_token_view),
]
