import tempfile
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.test import TestCase, override_settings
from studio.models import Workspace, Project, MediaAsset, PendingMediaDeletion
from studio.media_cleanup import process_deletion

class MediaCleanupTests(TestCase):
    def setUp(self):
        directory=tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        settings=override_settings(MEDIA_ROOT=directory.name, STORAGE_BACKEND='local')
        settings.enable(); self.addCleanup(settings.disable)
        user=get_user_model().objects.create_user(username='cleanup-test')
        workspace=Workspace.objects.create(name='Cleanup test')
        self.project=Project.objects.create(workspace=workspace,created_by=user,name='Test',kind='video')
        self.asset=MediaAsset.objects.create(project=self.project,file=ContentFile(b'test',name='test.mp4'),name='test.mp4',content_type='video/mp4',size=4)
        self.name=self.asset.file.name

    def test_failed_storage_delete_remains_queued_and_retry_cleans_it(self):
        with patch('studio.media_cleanup.default_storage.delete',side_effect=OSError('offline')):
            with self.captureOnCommitCallbacks(execute=True):
                self.project.delete()
        item=PendingMediaDeletion.objects.get(name=self.name)
        self.assertEqual(item.attempts,1)
        self.assertTrue(default_storage.exists(self.name))
        process_deletion(item.pk)
        self.assertFalse(default_storage.exists(self.name))
        self.assertFalse(PendingMediaDeletion.objects.exists())

    def test_shared_file_is_kept_until_last_reference_is_deleted(self):
        other=MediaAsset.objects.create(project=self.project,file=self.name,name='copy',content_type='video/mp4',size=4)
        with self.captureOnCommitCallbacks(execute=True): self.asset.delete()
        self.assertTrue(default_storage.exists(self.name))
        with self.captureOnCommitCallbacks(execute=True): other.delete()
        self.assertFalse(default_storage.exists(self.name))

    def test_rollback_does_not_delete_file_or_enqueue_work(self):
        with self.captureOnCommitCallbacks(execute=True):
            try:
                with transaction.atomic():
                    self.project.delete()
                    raise ValueError('rollback')
            except ValueError: pass
        self.assertTrue(default_storage.exists(self.name))
        self.assertTrue(MediaAsset.objects.filter(file=self.name).exists())
        self.assertFalse(PendingMediaDeletion.objects.exists())

    def test_workspace_cascade_also_cleans_storage(self):
        with self.captureOnCommitCallbacks(execute=True): self.project.workspace.delete()
        self.assertFalse(default_storage.exists(self.name))
