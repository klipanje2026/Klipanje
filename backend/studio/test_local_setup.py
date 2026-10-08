import json
import os
from io import StringIO
from tempfile import TemporaryDirectory
from unittest.mock import patch

import httpx
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from django.test import Client, TestCase, override_settings

from .models import Membership, Workspace


class LocalEditorTests(TestCase):
    @patch.dict(os.environ, {'DJANGO_SUPERUSER_PASSWORD': 'LocalTest!Only73Pass'})
    def test_bootstrap_creates_admin_and_one_private_workspace(self):
        for _ in range(2):
            call_command('bootstrap_local_admin', username='LocalAdmin', noinput=True, stdout=StringIO())
        user = get_user_model().objects.get(username='LocalAdmin')
        self.assertTrue(user.is_superuser and user.is_staff)
        self.assertTrue(user.check_password('LocalTest!Only73Pass'))
        self.assertEqual(Membership.objects.filter(user=user, role='owner').count(), 1)
        self.assertEqual(Workspace.objects.count(), 1)

    def test_login_requires_csrf_and_accepts_existing_admin(self):
        get_user_model().objects.create_superuser(username='LocalAdmin', password='LocalTest!Only73Pass')
        client = Client(enforce_csrf_checks=True)
        body = json.dumps({'username': 'localadmin', 'password': 'LocalTest!Only73Pass'})
        self.assertEqual(client.post('/api/auth/login', body, content_type='application/json').status_code, 403)
        token = client.get('/api/auth/csrf').json()['csrfToken']
        response = client.post('/api/auth/login', body, content_type='application/json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['user']['isStaff'])
        self.assertEqual(client.get('/api/auth/me').json()['user']['username'], 'LocalAdmin')

    def test_foreign_services_and_business_routes_are_not_available(self):
        for route in ['/api/plans', '/api/payments/checkout', '/api/leads', '/api/admin/affiliates', '/api/auth/social/providers', '/api/admin/resources', '/api/auth/register']:
            self.assertEqual(self.client.get(route).status_code, 404, route)

    def test_media_is_saved_on_local_disk(self):
        with TemporaryDirectory() as directory:
            with override_settings(MEDIA_ROOT=directory):
                name = default_storage.save('test/source.txt', ContentFile(b'local editor media'))
                with default_storage.open(name) as saved:
                    self.assertEqual(saved.read(), b'local editor media')
                self.assertTrue(default_storage.path(name).startswith(directory))

    @override_settings(OPENAI_API_KEY='test-openai', ELEVENLABS_API_KEY='test-elevenlabs')
    def test_provider_check_requires_admin_and_never_exposes_keys(self):
        self.assertEqual(self.client.get('/api/integrations').status_code, 403)
        admin = get_user_model().objects.create_superuser(username='LocalAdmin', password='LocalTest!Only73Pass')
        self.client.force_login(admin)
        with patch('studio.integrations.httpx.get', return_value=httpx.Response(200, json={})) as upstream:
            response = self.client.post('/api/integrations')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(upstream.call_count, 2)
        self.assertTrue(response.json()['providers']['openai']['ready'])
        self.assertTrue(response.json()['providers']['elevenlabs']['ready'])
        self.assertNotIn('test-openai', response.content.decode())
        self.assertNotIn('test-elevenlabs', response.content.decode())
