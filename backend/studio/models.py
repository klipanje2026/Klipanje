import uuid
from pathlib import Path
from django.conf import settings
from django.db import models

class LocalAccount(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='local_account')
    must_change_password = models.BooleanField(default=True)


class LocalScript(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='local_scripts')
    title = models.CharField(max_length=160, default='Nova skripta')
    content = models.TextField(blank=True)
    project = models.ForeignKey('Project', on_delete=models.CASCADE, related_name='scripts')
    segments = models.JSONField(default=list)
    image_prompt = models.TextField(blank=True)
    photo_settings = models.JSONField(default=dict)
    storyboard = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']


class UserFeedback(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    category = models.CharField(max_length=24)
    message = models.TextField(max_length=2000)
    status = models.CharField(max_length=16, default='new')
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='+')
    reviewed_at = models.DateTimeField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

class Subscription(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='subscription')
    plan = models.CharField(max_length=16, default='free')
    allowance = models.PositiveIntegerField(default=5)
    remaining = models.PositiveIntegerField(default=5)
    used = models.PositiveIntegerField(default=0)
    period_start = models.DateTimeField(auto_now_add=True)
    period_end = models.DateTimeField(null=True, blank=True)
    paid_until = models.DateTimeField(null=True, blank=True)
    loyalty_months = models.PositiveIntegerField(default=0)
    cancelled = models.BooleanField(default=False)
    last_price = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

class StripeAccount(models.Model):
    """Local test checkout binding. Never share this ledger with live billing."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    customer_id = models.CharField(max_length=100, unique=True, null=True)
    subscription_id = models.CharField(max_length=100, unique=True, null=True)
    status = models.CharField(max_length=32, blank=True)
    checkout_key = models.UUIDField(default=uuid.uuid4)
    checkout_id = models.CharField(max_length=100, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

class StripeInvoice(models.Model):
    invoice_id = models.CharField(max_length=100, primary_key=True)
    account = models.ForeignKey(StripeAccount, on_delete=models.PROTECT)
    subscription_id = models.CharField(max_length=100)
    amount_paid = models.PositiveIntegerField()
    currency = models.CharField(max_length=3)
    period_start = models.DateTimeField()
    period_end = models.DateTimeField()
    granted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class StripeEvent(models.Model):
    event_id = models.CharField(max_length=100, primary_key=True)
    kind = models.CharField(max_length=100)
    processed_at = models.DateTimeField(auto_now_add=True)

class TokenEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='token_entries')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='+')
    kind = models.CharField(max_length=24)
    amount = models.IntegerField()
    balance_after = models.PositiveIntegerField()
    detail = models.CharField(max_length=240, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reference = models.UUIDField(null=True, unique=True)

class PlanRequest(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='plan_requests')
    plan = models.CharField(max_length=16)
    status = models.CharField(max_length=16, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user'], condition=models.Q(status='pending'), name='one_pending_plan_request')]

class TokenOperation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    key = models.UUIDField()
    capability = models.CharField(max_length=32)
    tokens = models.PositiveIntegerField()
    status = models.CharField(max_length=16, default='reserved')
    period_start = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'key'], name='unique_user_operation')]

class TransferUsage(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    key = models.UUIDField(default=uuid.uuid4)
    kind = models.CharField(max_length=10)
    size = models.PositiveBigIntegerField()
    period_start = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'key', 'kind'], name='unique_transfer_usage')]

class Workspace(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self):
        return self.name

class Membership(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=10, choices=[('owner', 'Owner'), ('editor', 'Editor')], default='editor')
    class Meta:
        constraints = [models.UniqueConstraint(fields=['workspace', 'user'], name='unique_workspace_member')]

class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='projects')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    name = models.CharField(max_length=160)
    kind = models.CharField(max_length=16, choices=[('subtitles', 'Subtitles'), ('video', 'Video'), ('production', 'Production')])
    state = models.JSONField(default=dict)
    brief = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ['-updated_at']

def media_path(instance, filename):
    from django.utils.text import slugify
    project = instance.project
    user = project.created_by
    clean_name = Path(filename.replace('\\', '/')).name
    extension = Path(clean_name).suffix.lower()[:12]
    username = slugify(user.get_username())[:60] or 'korisnik'
    title = slugify(project.name)[:70] or 'video'
    basename = slugify(Path(clean_name).stem)[:90] or 'video'
    editor = 'titlovi' if project.kind == 'subtitles' else 'video-editor'
    project_tag = str(project.pk).replace('-', '')[:12]
    asset_tag = str(instance.pk).replace('-', '')
    return f"{getattr(settings, 'MEDIA_KEY_PREFIX', '')}workspaces/{username}-{user.pk}/{editor}/{title}--{project_tag}/{basename}--{asset_tag}{extension}"

class MediaAsset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='assets')
    file = models.FileField(upload_to=media_path, max_length=500)
    name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size = models.PositiveBigIntegerField()
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

class PendingMediaDeletion(models.Model):
    name = models.CharField(max_length=500)
    backend = models.CharField(max_length=20)
    attempts = models.PositiveIntegerField(default=0)
    next_attempt_at = models.DateTimeField(auto_now_add=True)
    last_error = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['backend', 'name'], name='unique_pending_media_deletion')]

class Lead(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    locale = models.CharField(max_length=5, default='en')
    source = models.CharField(max_length=30, default='website_form')
    service = models.CharField(max_length=80)
    status = models.CharField(max_length=20, default='new')
    name = models.CharField(max_length=120)
    email = models.EmailField(max_length=180)
    company = models.CharField(max_length=160)
    phone = models.CharField(max_length=80, blank=True)
    message = models.TextField(blank=True)
    landing_page = models.CharField(max_length=500, blank=True)
    gclid = models.CharField(max_length=300, blank=True)
    utm_source = models.CharField(max_length=160, blank=True)
    utm_medium = models.CharField(max_length=160, blank=True)
    utm_campaign = models.CharField(max_length=240, blank=True)
    consent = models.BooleanField(default=False)

class Booking(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lead = models.OneToOneField(Lead, on_delete=models.CASCADE, related_name='booking')
    created_at = models.DateTimeField(auto_now_add=True)
    start_at = models.DateTimeField(unique=True)
    time_zone = models.CharField(max_length=100)
    status = models.CharField(max_length=20, default='pending')
    notes = models.TextField(blank=True)

class LeadEvent(models.Model):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='events')
    created_at = models.DateTimeField(auto_now_add=True)
    event_type = models.CharField(max_length=40)
    detail = models.TextField(blank=True)
    actor_email = models.EmailField(blank=True)


class AccessApproval(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='access_approval')
    approved = models.BooleanField(default=False)
    requested_at = models.DateTimeField(auto_now_add=True)
    notified_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='approved_accounts')


class AffiliateProfile(models.Model):
    is_demo = models.BooleanField(default=False)
    discount_percent = models.PositiveSmallIntegerField(default=0)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='affiliate')
    code = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    active = models.BooleanField(default=True)
    visits = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

class AffiliateSettings(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    enabled = models.BooleanField(default=False)
    bonus_tokens = models.PositiveIntegerField(default=10)
    attribution_days = models.PositiveIntegerField(default=30)

class Referral(models.Model):
    campaign = models.CharField(max_length=48, blank=True)
    link_slug = models.CharField(max_length=40, blank=True)
    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.PROTECT, related_name='referrals')
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='referral')
    created_at = models.DateTimeField(auto_now_add=True)

class AffiliateReward(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referral = models.ForeignKey(Referral, on_delete=models.PROTECT, related_name='rewards')
    purchase = models.OneToOneField(TokenEntry, on_delete=models.PROTECT, related_name='affiliate_reward')
    tokens = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

class SocialIdentity(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    provider = models.CharField(max_length=20)
    subject = models.CharField(max_length=255)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['provider','subject'],name='unique_social_identity')]


class MultipartMediaUpload(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    asset_id = models.UUIDField(default=uuid.uuid4, unique=True)
    name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size = models.PositiveBigIntegerField()
    key = models.CharField(max_length=500)
    upload_id = models.TextField()
    parts = models.JSONField(default=dict)
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class CaptionPreset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=80)
    style = models.CharField(max_length=40)
    settings = models.JSONField(default=dict)
    portrait = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(max_length=12, default='private', choices=[('private','Private'),('proposed','Proposed'),('published','Published'),('rejected','Rejected')])
    created_at = models.DateTimeField(auto_now_add=True)


class EditorFailure(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    kind = models.CharField(max_length=40)
    code = models.PositiveSmallIntegerField(null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)


class AffiliateLink(models.Model):
    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.PROTECT, related_name='links')
    slug = models.CharField(max_length=40, unique=True)
    is_primary = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['affiliate'], condition=models.Q(is_primary=True), name='one_primary_affiliate_link')]


class AffiliateVisit(models.Model):
    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.PROTECT, related_name='visit_events')
    visitor = models.UUIDField()
    campaign = models.CharField(max_length=48, blank=True)
    link_slug = models.CharField(max_length=40, blank=True)
    day = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['affiliate', 'visitor', 'campaign', 'day'], name='affiliate_visit_daily_unique')]


class AffiliateAudit(models.Model):
    changes = models.JSONField(default=dict)
    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.PROTECT, related_name='audit')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=32)
    detail = models.CharField(max_length=160)
    created_at = models.DateTimeField(auto_now_add=True)


class ProductEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    visitor = models.UUIDField(db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    name = models.CharField(max_length=32, db_index=True)
    page = models.CharField(max_length=24)
    section = models.CharField(max_length=24, blank=True)
    style = models.CharField(max_length=80, blank=True, db_index=True)
    campaign = models.CharField(max_length=48, blank=True)
    affiliate_id_value = models.PositiveBigIntegerField(null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)


class AffiliateCorrection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.PROTECT, related_name='corrections')
    day = models.DateField()
    campaign = models.CharField(max_length=48, blank=True)
    metric = models.CharField(max_length=16, choices=[('visits','Visits'),('registrations','Registrations'),('purchases','Purchases')])
    delta = models.IntegerField()
    reason = models.CharField(max_length=500)
    status = models.CharField(max_length=12, default='pending', choices=[('pending','Pending'),('approved','Approved'),('rejected','Rejected')])
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)


class ProviderUsage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    provider = models.CharField(max_length=24)
    action = models.CharField(max_length=40)
    operation_key = models.UUIDField(null=True)
    status = models.CharField(max_length=16, default='pending')
    http_status = models.PositiveSmallIntegerField(null=True)
    input_chars = models.PositiveIntegerField(default=0)
    input_seconds = models.FloatField(default=0)
    input_bytes = models.PositiveBigIntegerField(default=0)
    output_bytes = models.PositiveBigIntegerField(default=0)
    elapsed_ms = models.PositiveIntegerField(default=0)
    is_staff = models.BooleanField(default=False)
    is_test = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    class Meta:
        indexes = [models.Index(fields=['provider','created_at'])]


class VisitorPresence(models.Model):
    visitor = models.UUIDField()
    tab = models.UUIDField()
    sequence = models.PositiveBigIntegerField(default=0)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    page = models.CharField(max_length=24, default='other')
    section = models.CharField(max_length=24, blank=True)
    source = models.CharField(max_length=24, default='direct')
    affiliate = models.ForeignKey(AffiliateProfile, null=True, on_delete=models.SET_NULL)
    campaign = models.CharField(max_length=48, blank=True)
    visible = models.BooleanField(default=False)
    active = models.BooleanField(default=False)
    is_test = models.BooleanField(default=False)
    seen_at = models.DateTimeField(db_index=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['visitor','tab'], name='unique_presence_tab')]


class AffiliateRequest(models.Model):
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    kind = models.CharField(max_length=16, choices=[('application', 'Application'), ('tokens', 'Tokens')])
    message = models.TextField(max_length=2000)
    amount = models.PositiveIntegerField(default=0)
    granted = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=16, default='pending')
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='+')
    internal_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'kind'], condition=models.Q(status='pending'), name='one_pending_affiliate_request')]


class UserControls(models.Model):
    avatar = models.TextField(blank=True, default='')
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    upload_limit = models.PositiveBigIntegerField(null=True, blank=True)
    download_limit = models.PositiveBigIntegerField(null=True, blank=True)
    verified_email = models.EmailField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class AffiliateCoupon(models.Model):
    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE, related_name='coupons')
    code = models.CharField(max_length=32, unique=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class AccountEmail(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    recipient = models.EmailField()
    kind = models.CharField(max_length=32)
    subject = models.CharField(max_length=180)
    body = models.TextField()
    status = models.CharField(max_length=16, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True)


class UserControlAudit(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='+')
    detail = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class Announcement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=100)
    message = models.CharField(max_length=400)
    tone = models.CharField(max_length=16, choices=[('info', 'Info'), ('update', 'Update'), ('maintenance', 'Maintenance')], default='info')
    active = models.BooleanField(default=False)
    version = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class AnnouncementDismissal(models.Model):
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    version = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['announcement', 'user', 'version'], name='unique_announcement_dismissal')]


class AffiliateDemoDay(models.Model):
    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.CASCADE)
    day = models.DateField()
    visits = models.PositiveIntegerField(default=0)
    registrations = models.PositiveIntegerField(default=0)
    purchases = models.PositiveIntegerField(default=0)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['affiliate','day'],name='unique_affiliate_demo_day')]
