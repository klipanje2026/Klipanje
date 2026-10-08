from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import SimpleRouter
from studio import accounts, ai, caption_presets, editor_diagnostics, integrations, scripts, creative
from studio import media_compatibility, multipart_upload, projects, billing

router = SimpleRouter(trailing_slash=False)
router.register('projects', projects.ProjectViewSet, basename='projects')
router.register('scripts', scripts.ScriptViewSet, basename='scripts')
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health', lambda request: JsonResponse({'ok': True, 'service': 'klipanje-django'})),
    path('api/creative/options', creative.options),
    path('api/creative/prompt', creative.prompt_preview),
    path('api/creative/generate', creative.generate),
    path('api/auth/csrf', accounts.csrf),
    path('api/auth/me', accounts.me),
    path('api/auth/login', accounts.sign_in),
    path('api/auth/logout', accounts.sign_out),
    path('api/auth/password', accounts.change_password),
    path('api/integrations', integrations.status),
    path('api/caption-presets', caption_presets.presets),
    path('api/caption-presets/<uuid:pk>/propose', caption_presets.propose),
    path('api/editor/diagnostics', editor_diagnostics.failures),
    path('api/projects/<uuid:pk>/uploads', multipart_upload.begin),
    path('api/projects/<uuid:pk>/assets', projects.assets),
    path('api/assets/<uuid:pk>/content', projects.asset_content),
    path('api/assets/<uuid:pk>', projects.asset_delete),
    path('api/media/prepare', media_compatibility.prepare_video),
    path('api/media/prepare/<uuid:key>', media_compatibility.preparation_status),
    path('api/transcribe', ai.transcribe),
    path('api/voices', ai.voices),
    path('api/elevenlabs-status', ai.status),
    path('api/audio/clean', ai.clean_audio),
    path('api/narration', ai.narration),
    path('api/voice-change', ai.voice_change),
    # Retain the original renderer's accounting API for upload/export compatibility.
    path('api/subscription', billing.mine),
    path('api/subscription/export', billing.export_usage),
    path('api/', include(router.urls)),
]
