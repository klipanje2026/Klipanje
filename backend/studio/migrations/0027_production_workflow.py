from django.db import migrations, models
import django.db.models.deletion


def group_existing_scripts(apps, schema_editor):
    Script = apps.get_model('studio', 'LocalScript')
    Project = apps.get_model('studio', 'Project')
    Workspace = apps.get_model('studio', 'Workspace')
    Membership = apps.get_model('studio', 'Membership')
    for owner_id in Script.objects.values_list('owner_id', flat=True).distinct():
        membership = Membership.objects.filter(user_id=owner_id).first()
        if membership:
            workspace_id = membership.workspace_id
        else:
            workspace = Workspace.objects.create(name='Moji projekti')
            Membership.objects.create(user_id=owner_id, workspace=workspace, role='owner')
            workspace_id = workspace.pk
        project = Project.objects.create(workspace_id=workspace_id, created_by_id=owner_id, name='Moje prve skripte', kind='production')
        Script.objects.filter(owner_id=owner_id).update(project=project)


class Migration(migrations.Migration):
    dependencies = [('studio', '0026_local_accounts_and_scripts')]
    operations = [
        migrations.AlterField(model_name='project', name='kind', field=models.CharField(max_length=16, choices=[('subtitles','Subtitles'),('video','Video'),('production','Production')])),
        migrations.AddField(model_name='project', name='brief', field=models.JSONField(default=dict)),
        migrations.AddField(model_name='mediaasset', name='metadata', field=models.JSONField(default=dict)),
        migrations.AddField(model_name='localscript', name='segments', field=models.JSONField(default=list)),
        migrations.AddField(model_name='localscript', name='image_prompt', field=models.TextField(blank=True)),
        migrations.AddField(model_name='localscript', name='storyboard', field=models.JSONField(default=dict)),
        migrations.AddField(model_name='localscript', name='project', field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='scripts', to='studio.project')),
        migrations.RunPython(group_existing_scripts, migrations.RunPython.noop),
        migrations.AlterField(model_name='localscript', name='project', field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='scripts', to='studio.project')),
    ]
