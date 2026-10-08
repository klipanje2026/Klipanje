from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('studio', '0023_affiliateprofile_is_demo_affiliatedemoday')]
    operations = [migrations.AddField(
        model_name='usercontrols', name='avatar',
        field=models.TextField(blank=True, default=''),
    )]
