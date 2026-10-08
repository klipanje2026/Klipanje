from django.conf import settings
from django.db import migrations

def seed(apps,schema_editor):
    User=apps.get_model(settings.AUTH_USER_MODEL)
    Subscription=apps.get_model('studio','Subscription')
    Entry=apps.get_model('studio','TokenEntry')
    for user in User.objects.all().iterator():
        sub,created=Subscription.objects.get_or_create(user_id=user.pk)
        if created: Entry.objects.create(user_id=user.pk,kind='grant',amount=5,balance_after=5,detail='Free · početnih 5 tokena')

class Migration(migrations.Migration):
    dependencies=[('studio','0002_subscription_tokenentry_planrequest_tokenoperation')]
    operations=[migrations.RunPython(seed,migrations.RunPython.noop)]
