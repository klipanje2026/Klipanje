from unittest.mock import Mock, patch
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

@override_settings(ELEVENLABS_API_KEY='test', STORAGE_BACKEND='r2')
class ResourceTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.force_authenticate(get_user_model().objects.create_user(username='admin', is_staff=True))

    @patch('studio.resources.default_storage')
    @patch('studio.resources.json_request')
    def test_refresh_bypasses_cache_and_reports_usage(self, request, storage):
        request.return_value = Mock(json=lambda: {'character_count': 12, 'character_limit': 100})
        storage.connection.meta.client.list_objects_v2.return_value = {'Contents': [{'Size': 42}]}
        cache.set('admin-provider-resources', {'stale': True}, 300)
        result = self.client.get('/api/admin/resources?refresh=1').json()
        self.assertEqual(result['elevenlabs']['remaining'], 88)
        self.assertEqual(result['storage']['bytes'], 42)
        self.assertEqual(result['storage']['objects'], 1)

    @patch('studio.resources.default_storage')
    @patch('studio.resources.json_request', side_effect=RuntimeError('private-key-do-not-expose'))
    def test_provider_failure_is_explained_without_secrets(self, request, storage):
        storage.connection.meta.client.list_objects_v2.return_value = {'Contents': []}
        result = self.client.get('/api/admin/resources').json()
        self.assertFalse(result['elevenlabs']['available'])
        self.assertIn('error', result['elevenlabs'])
        self.assertNotIn('private-key', str(result))
        self.assertTrue(result['storage']['available'])

    def test_regular_user_cannot_refresh_provider_balances(self):
        self.client.force_authenticate(get_user_model().objects.create_user(username='regular'))
        self.assertEqual(self.client.get('/api/admin/resources?refresh=1').status_code, 403)
