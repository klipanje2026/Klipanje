from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('studio','0035_preeditorversion')]
    operations = [migrations.AddField(model_name='librarysound',name='archived',field=models.BooleanField(default=False))]
