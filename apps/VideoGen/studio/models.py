import uuid
from django.db import models

class Budget(models.Model):
    name = models.CharField(max_length=20, unique=True)
    limit_usd = models.DecimalField(max_digits=9, decimal_places=4, default=15)

class BudgetReconciliation(models.Model):
    budget = models.ForeignKey(Budget, on_delete=models.PROTECT)
    amount_usd = models.DecimalField(max_digits=9, decimal_places=4)
    note = models.CharField(max_length=250)
    created_at = models.DateTimeField(auto_now_add=True)

class VideoProject(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    context = models.JSONField(default=dict, blank=True)
    draft = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ScenePlan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(VideoProject, on_delete=models.PROTECT)
    direction = models.TextField()
    description = models.TextField()
    prompt = models.TextField()
    title = models.CharField(max_length=120)
    style = models.CharField(max_length=30)
    aspect = models.CharField(max_length=10)
    duration = models.PositiveSmallIntegerField(default=5)
    reference_mode = models.CharField(max_length=20, default='text')
    character = models.ImageField(upload_to='scene-inputs/', blank=True)
    scene = models.ImageField(upload_to='scene-inputs/', blank=True)
    end_reference = models.ImageField(upload_to='scene-inputs/', blank=True)
    reference = models.ImageField(upload_to='prepared-scenes/', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ModalAccount(models.Model):
    profile = models.CharField(max_length=80, unique=True)
    label = models.CharField(max_length=120)
    workspace_name = models.CharField(max_length=120, blank=True)
    monthly_credit = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)

class ModalSelection(models.Model):
    account = models.ForeignKey(ModalAccount, null=True, on_delete=models.PROTECT)

class BillingSnapshot(models.Model):
    account = models.ForeignKey(ModalAccount, null=True, blank=True, on_delete=models.PROTECT)
    cycle = models.CharField(max_length=7)
    payload = models.JSONField(default=dict)
    synced_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['account','cycle'], name='account_billing_cycle')]

class GenerationBatch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request_key = models.UUIDField(unique=True)
    project = models.ForeignKey(VideoProject, on_delete=models.PROTECT)
    account = models.ForeignKey(ModalAccount, on_delete=models.PROTECT)
    fingerprint = models.CharField(max_length=64)
    status = models.CharField(max_length=24, default='queued')
    error = models.TextField(blank=True)
    cancel_requested = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)


class Job(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=120)
    project = models.ForeignKey(VideoProject, null=True, blank=True, on_delete=models.PROTECT)
    scene_plan = models.ForeignKey(ScenePlan, null=True, blank=True, on_delete=models.PROTECT)
    batch = models.ForeignKey(GenerationBatch, null=True, blank=True, on_delete=models.PROTECT)
    batch_order = models.PositiveIntegerField(default=0)
    modal_account = models.ForeignKey(ModalAccount, null=True, blank=True, on_delete=models.PROTECT)
    prompt = models.TextField()
    negative_prompt = models.TextField(blank=True)
    model_id = models.CharField(max_length=60)
    gpu = models.CharField(max_length=40, blank=True, default='')
    placement = models.CharField(max_length=20, default='offload')
    metrics = models.JSONField(default=dict, blank=True)
    style = models.CharField(max_length=30, default='3d')
    mode = models.CharField(max_length=10, default='demo')
    budget = models.ForeignKey(Budget, on_delete=models.PROTECT)
    reconciliation = models.ForeignKey(BudgetReconciliation, null=True, blank=True, on_delete=models.PROTECT)
    duration = models.PositiveSmallIntegerField(default=5)
    aspect = models.CharField(max_length=10, default='16:9')
    seed = models.PositiveIntegerField(default=42)
    steps = models.PositiveSmallIntegerField(default=30)
    status = models.CharField(max_length=24, default='queued')
    reference = models.ImageField(upload_to='references/', blank=True)
    end_reference = models.ImageField(upload_to='references/', blank=True)
    video = models.FileField(upload_to='videos/', blank=True)
    processed_video = models.FileField(upload_to='videos/processed/', blank=True)
    processing_status = models.CharField(max_length=16, blank=True, default='')
    processing_speed = models.FloatField(default=1)
    processing_error = models.TextField(blank=True)
    processing_info = models.JSONField(default=dict, blank=True)
    in_gallery = models.BooleanField(default=False)
    modal_call_id = models.CharField(max_length=200, blank=True)
    reserved_usd = models.DecimalField(max_digits=9, decimal_places=4, default=0)
    estimated_usd = models.DecimalField(max_digits=9, decimal_places=4, default=0)
    billed_usd = models.DecimalField(max_digits=9, decimal_places=4, null=True, blank=True)
    cost_note = models.CharField(max_length=250, blank=True)
    error = models.TextField(blank=True)
    elapsed_seconds = models.FloatField(default=0)
    preparation_seconds = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
