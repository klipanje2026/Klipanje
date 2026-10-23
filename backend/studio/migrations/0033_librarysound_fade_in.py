from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [("studio", "0032_librarysound_category")]
    operations = [migrations.AddField(model_name="librarysound", name="fade_in", field=models.FloatField(default=0))]
