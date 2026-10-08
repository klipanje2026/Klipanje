from pathlib import PurePosixPath
from types import SimpleNamespace
from django.test import SimpleTestCase, override_settings
from .models import media_path

class MediaPathTests(SimpleTestCase):
    def test_readable_unique_path_is_scoped_to_user_and_project(self):
        user = SimpleNamespace(pk=42, get_username=lambda: 'Naghun')
        project = SimpleNamespace(pk='project-id', created_by=user, name='Moj video', kind='subtitles')
        asset = SimpleNamespace(project=project, pk='asset-id')
        first = media_path(asset, '../../Moj snimak.MP4')
        self.assertTrue(first.startswith('workspaces/naghun-42/titlovi/moj-video--projectid/moj-snimak--'))
        self.assertEqual(PurePosixPath(first).suffix, '.mp4')
        self.assertNotIn('..', first)
        self.assertEqual(first, media_path(asset, '../../Moj snimak.MP4'))
        asset.pk = 'another-asset'
        self.assertNotEqual(first, media_path(asset, '../../Moj snimak.MP4'))

    @override_settings(MEDIA_KEY_PREFIX='staging/')
    def test_staging_path_cannot_collide_with_live_upload(self):
        user=SimpleNamespace(pk=42,get_username=lambda:'admin')
        project=SimpleNamespace(pk='same-project',created_by=user,name='Video',kind='subtitles')
        asset=SimpleNamespace(project=project,pk='same-asset')
        staged=media_path(asset,'video.mp4')
        with self.settings(MEDIA_KEY_PREFIX=''):
            live=media_path(asset,'video.mp4')
        self.assertEqual(staged,'staging/'+live)
