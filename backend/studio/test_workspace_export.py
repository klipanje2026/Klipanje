import json
from pathlib import Path
from tempfile import TemporaryDirectory
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.db import transaction
from django.test import TestCase, override_settings
from .local_workspace import sync_project, project_folder_name
from .models import Project, Workspace, LocalScript, MediaAsset


class WorkspaceExportTests(TestCase):
    def test_export_and_committed_updates_preserve_sources(self):
        with TemporaryDirectory() as root, TemporaryDirectory() as media, override_settings(LOCAL_WORKSPACE_ROOT=root, MEDIA_ROOT=media):
            user = get_user_model().objects.create_user(username='Naghun')
            project = Project.objects.create(created_by=user, workspace=Workspace.objects.create(name='Local'), name='../Test', kind='production')
            script = LocalScript.objects.create(owner=user, project=project, title='Ep1', content='Zdravo')
            asset = MediaAsset(project=project, name='test.png', content_type='image/png', size=5)
            asset.file.save('test.png', ContentFile(b'image'))
            sync_project(project.pk)
            folder = Path(root) / 'Abdullah' / 'Test'
            exported = json.loads((folder / 'projekat.json').read_text(encoding='utf-8'))
            self.assertEqual((folder / exported['assets'][0]['file']).read_bytes(), b'image')
            self.assertTrue(asset.file.storage.exists(asset.file.name))
            with self.captureOnCommitCallbacks(execute=True):
                script.content = 'Novo'; script.save()
            self.assertEqual(json.loads((folder / 'skripte.json').read_text(encoding='utf-8'))[0]['content'], 'Novo')
            with self.captureOnCommitCallbacks(execute=True):
                try:
                    with transaction.atomic():
                        script.content = 'Rollback'; script.save()
                        raise ValueError()
                except ValueError:
                    pass
            self.assertEqual(json.loads((folder / 'skripte.json').read_text(encoding='utf-8'))[0]['content'], 'Novo')
            with self.captureOnCommitCallbacks(execute=True):
                project.delete()
            self.assertTrue(json.loads((folder / 'projekat.json').read_text(encoding='utf-8'))['deleted'])

    def test_named_folders_migrate_rename_and_keep_duplicate_titles_separate(self):
        with TemporaryDirectory() as root, override_settings(LOCAL_WORKSPACE_ROOT=root):
            user = get_user_model().objects.create_user(username='Rijad')
            workspace = Workspace.objects.create(name='Local')
            first = Project.objects.create(created_by=user, workspace=workspace, name='Sarajevska priča', kind='production')
            second = Project.objects.create(created_by=user, workspace=workspace, name='Sarajevska priča', kind='production')
            third = Project.objects.create(created_by=user, workspace=workspace, name='SARAJEVSKA PRIČA', kind='production')
            owner_root = Path(root) / 'Rijad'
            legacy = owner_root / str(first.pk)
            legacy.mkdir(parents=True)
            (legacy / 'projekat.json').write_text(json.dumps({'id': str(first.pk)}), encoding='utf-8')
            (legacy / 'saved.txt').write_text('Sačuvano', encoding='utf-8')
            for project in (first, second, third, second):
                sync_project(project.pk)
            self.assertFalse(legacy.exists())
            self.assertEqual((owner_root / 'Sarajevska priča' / 'saved.txt').read_text(encoding='utf-8'), 'Sačuvano')
            for project, title in ((first, 'Sarajevska priča'), (second, 'Sarajevska priča (2)'), (third, 'SARAJEVSKA PRIČA (3)')):
                data = json.loads((owner_root / title / 'projekat.json').read_text(encoding='utf-8'))
                self.assertEqual(data['id'], str(project.pk))
            with self.captureOnCommitCallbacks(execute=True):
                first.name = 'Novo ime'; first.save()
            self.assertFalse((owner_root / 'Sarajevska priča').exists())
            self.assertEqual((owner_root / 'Novo ime' / 'saved.txt').read_text(encoding='utf-8'), 'Sačuvano')
            self.assertEqual(Project.objects.get(pk=second.pk).name, 'Sarajevska priča')

    def test_windows_titles_stay_inside_the_owner_folder(self):
        for name, expected in [('../Test', 'Test'), ('..\\Test', 'Test'), ('<>:"/\\|?*', 'Projekat'),
                               ('CON', 'Projekat CON'), ('nul.txt', 'Projekat nul.txt'), ('COM¹', 'Projekat COM¹'),
                               ('Priča. ', 'Priča'), ('   ', 'Projekat')]:
            with self.subTest(name=name):
                self.assertEqual(project_folder_name(name), expected)
        with TemporaryDirectory() as root, override_settings(LOCAL_WORKSPACE_ROOT=root):
            user = get_user_model().objects.create_user(username='Rijad')
            project = Project.objects.create(created_by=user, workspace=Workspace.objects.create(name='Local'), name='../../Nihad/Priča', kind='production')
            sync_project(project.pk)
            folders = list((Path(root) / 'Rijad').iterdir())
            self.assertEqual(len(folders), 1)
            self.assertEqual(folders[0].resolve().parent, (Path(root) / 'Rijad').resolve())
            self.assertFalse((Path(root) / 'Nihad').exists())
