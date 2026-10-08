from django.db import migrations,models
class Migration(migrations.Migration):
    dependencies=[('studio','0027_production_workflow')]
    operations=[migrations.AddField(model_name='localscript',name='photo_settings',field=models.JSONField(default=dict))]
