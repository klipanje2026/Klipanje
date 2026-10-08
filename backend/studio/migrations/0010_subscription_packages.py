from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('studio', '0009_multipartmediaupload')]
    operations = [
        migrations.AddField(model_name='subscription', name='paid_until', field=models.DateTimeField(null=True, blank=True)),
        migrations.AddField(model_name='subscription', name='loyalty_months', field=models.PositiveIntegerField(default=0)),
        migrations.AddField(model_name='subscription', name='cancelled', field=models.BooleanField(default=False)),
        migrations.AddField(model_name='subscription', name='last_price', field=models.PositiveIntegerField(default=0)),
    ]
