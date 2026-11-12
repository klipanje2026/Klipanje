from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('studio', '0005_job_end_reference')]
    operations = [migrations.AddField(model_name='job', name='in_gallery', field=models.BooleanField(default=False))]
