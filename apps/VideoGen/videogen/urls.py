from django.conf import settings
from django.conf.urls.static import static
from django.urls import path
from studio import views, creative_workspace as creative
from studio import batch_queue
from studio import local_downloads

urlpatterns = [
    path('api/creative/download-directory/', local_downloads.directory),
    path('api/creative/videos/<uuid:job_id>/save/', local_downloads.save_video),
    path('api/creative/videos/<uuid:job_id>/', creative.play_video),
    path('api/creative/videos/<uuid:job_id>/process/', creative.process_video),
    path('api/creative/accounts/', creative.accounts),
    path('api/creative/accounts/select/', creative.select_account),
    path('api/creative/accounts/connect/', creative.connect_account),
    path('api/creative/accounts/login/', creative.account_login_status),
    path('api/creative/accounts/<int:account_id>/', creative.update_account),
    path('api/creative/accounts/<int:account_id>/renew/', creative.renew_account),
    path('api/creative/bootstrap/', creative.bootstrap),
    path('api/creative/projects/', creative.projects),
    path('api/creative/projects/<uuid:project_id>/', creative.project_detail),
    path('api/creative/prepare/', creative.prepare),
    path('api/creative/scenes/', creative.save_scene),
    path('api/creative/plans/<uuid:plan_id>/', creative.plan_detail),
    path('api/creative/plans/<uuid:plan_id>/scene-image/', creative.scene_image),
    path('api/creative/generate/', creative.generate),
    path('api/creative/batches/', batch_queue.create_batch),
    path('api/creative/batches/<uuid:batch_id>/cancel/', batch_queue.cancel_batch),
    path('api/creative/billing/sync/', creative.refresh_billing),
    path('api/creative/costs/', creative.costs),
    path('api/creative/costs.csv', creative.cost_csv),
    path('api/creative/gallery/', creative.gallery),
    path('api/creative/gallery/<uuid:job_id>/video/', creative.gallery_video),
    path('api/bootstrap/', views.bootstrap),
    path('api/estimate/', views.estimate),
    path('api/jobs/', views.jobs),
    path('api/jobs/<uuid:job_id>/', views.job_detail),
    path('api/jobs/<uuid:job_id>/cancel/', views.cancel_job),
    path('api/billing/', views.billing),
    path('api/billing/reconcile/', views.reconcile_budget),
    path('api/connection/', views.connection),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
