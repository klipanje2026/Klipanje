from datetime import timedelta
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Announcement, AnnouncementDismissal


class AnnouncementTests(TestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_user('notice-admin', is_staff=True)
        self.member = get_user_model().objects.create_user('notice-member')
        self.other = get_user_model().objects.create_user('notice-other')
        self.client = APIClient()
        self.body = {'title': 'Nova Edita', 'message': 'Novi stilovi su dostupni.', 'tone': 'update'}

    def test_staff_only_drafts_publish_and_withdraw(self):
        self.assertIn(self.client.post('/api/admin/announcements', self.body).status_code, (401, 403))
        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.get('/api/admin/announcements').status_code, 403)
        self.assertEqual(self.client.post('/api/admin/announcements', self.body).status_code, 403)
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/admin/announcements', {**self.body, 'active': True}, format='json')
        self.assertEqual(response.status_code, 201)
        row = Announcement.objects.get()
        self.assertFalse(row.active)
        self.assertEqual(self.client.get('/api/announcements').data['items'], [])
        url = f'/api/admin/announcements/{row.pk}/action'
        self.assertEqual(self.client.post(url, {'action': 'publish'}).status_code, 200)
        self.client.post(url, {'action': 'publish'})  # Retry cannot produce a new revision.
        row.refresh_from_db()
        self.assertEqual(row.version, 1)
        self.assertEqual(row.published_by, self.admin)
        self.client.force_authenticate(None)
        item = self.client.get('/api/announcements').data['items'][0]
        self.assertEqual(item['title'], self.body['title'])
        self.assertNotIn('published_by', item)
        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.post(url, {'action': 'hide'}).status_code, 403)
        self.client.force_authenticate(self.admin)
        self.client.post(url, {'action': 'hide'})
        self.assertEqual(self.client.get('/api/announcements').data['items'], [])

    def test_dismissal_is_user_and_revision_scoped(self):
        row = Announcement.objects.create(**self.body, active=True, version=1, published_at=timezone.now())
        url = f'/api/announcements/{row.pk}/dismiss'
        self.assertIn(self.client.post(url, {'version': 1}, format='json').status_code, (401, 403))
        self.client.force_authenticate(self.member)
        for _ in range(2):
            self.assertEqual(self.client.post(url, {'version': 1, 'user_id': self.other.pk}, format='json').status_code, 200)
        self.assertEqual(AnnouncementDismissal.objects.count(), 1)
        self.assertEqual(self.client.get('/api/announcements').data['items'], [])
        self.client.force_authenticate(self.other)
        self.assertEqual(len(self.client.get('/api/announcements').data['items']), 1)
        self.client.force_authenticate(self.admin)
        actions = f'/api/admin/announcements/{row.pk}/action'
        self.client.post(actions, {'action': 'hide'})
        self.client.post(actions, {'action': 'publish'})
        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.post(url, {'version': 1}, format='json').status_code, 409)
        self.assertEqual(self.client.get('/api/announcements').data['items'][0]['version'], 2)

    def test_expiry_and_validation(self):
        row = Announcement.objects.create(**self.body, active=True, version=1, expires_at=timezone.now()-timedelta(seconds=1))
        self.assertEqual(self.client.get('/api/announcements').data['items'], [])
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(f'/api/admin/announcements/{row.pk}/action', {'action': 'publish'}).status_code, 400)
        for invalid in ({'title': ' '}, {'message': 'x'*401}, {'tone': 'unknown'}, {'expires_at': '2020-01-01T00:00:00Z'}):
            self.assertEqual(self.client.post('/api/admin/announcements', {**self.body, **invalid}, format='json').status_code, 400)
