import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
class Migration(migrations.Migration):
    dependencies = [('studio','0028_script_photo_settings'), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(name='ProjectChapter', fields=[('id',models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False,serialize=False)),('title',models.CharField(max_length=160)),('created_at',models.DateTimeField(auto_now_add=True)),('project',models.ForeignKey(to='studio.project',on_delete=django.db.models.deletion.CASCADE,related_name='chapters'))], options={'ordering':['created_at']}),
        migrations.AddField(model_name='localscript', name='chapter', field=models.ForeignKey(to='studio.projectchapter',null=True,blank=True,on_delete=django.db.models.deletion.SET_NULL,related_name='scripts')),
        migrations.CreateModel(name='ImageSpend',fields=[('id',models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False,serialize=False)),('model',models.CharField(max_length=80)),('usage',models.JSONField(default=dict)),('estimated_usd',models.DecimalField(max_digits=14,decimal_places=8,null=True)),('created_at',models.DateTimeField(auto_now_add=True)),('user',models.ForeignKey(to=settings.AUTH_USER_MODEL,on_delete=django.db.models.deletion.CASCADE))]),
    ]
