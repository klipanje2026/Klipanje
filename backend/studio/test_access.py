import json
from unittest.mock import patch
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from rest_framework.test import APIClient
from .models import AccessApproval

@override_settings(ACCESS_APPROVAL_REQUIRED=True,EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',ACCESS_APPROVAL_EMAIL='kontakt@edita.ba')
class ApprovalTests(TestCase):
    def setUp(self):
        cache.clear()
        self.member=get_user_model().objects.create_user(username='pending',password='Long-Tests-Password!73')
        self.admin=get_user_model().objects.create_user(username='owner',password='Long-Tests-Password!73',is_staff=True)
        self.client=APIClient()
    def test_login_denied_and_owner_notified_once(self):
        for _ in range(2):
            response=self.client.post('/api/auth/login',{'username':'pending','password':'Long-Tests-Password!73'},format='json')
            self.assertEqual(response.status_code,403)
        self.assertEqual(len(mail.outbox),1)
        self.assertEqual(mail.outbox[0].to,['kontakt@edita.ba'])
    def test_old_session_cannot_spend_or_read_projects(self):
        self.client.force_login(self.member)
        for path in ['/api/transcribe','/api/narration','/api/projects']:
            self.assertEqual(self.client.post(path,{},format='json').status_code,403)
        self.assertIsNone(self.client.get('/api/auth/me').json()['user'])
    def test_only_admin_can_approve_and_revoke(self):
        self.client.force_login(self.member)
        path=f'/api/admin/users/{self.member.pk}/access'
        self.assertEqual(self.client.post(path,{'approved':True},format='json').status_code,403)
        self.client.force_login(self.admin)
        self.assertEqual(self.client.post(path,{'approved':True},format='json').status_code,200)
        self.client.force_login(self.member)
        self.assertEqual(self.client.get('/api/subscription').status_code,200)
        self.assertEqual(self.client.get('/api/admin/resources').status_code,403)
        self.client.force_login(self.admin)
        self.client.post(path,{'approved':False},format='json')
        self.client.force_login(self.member)
        self.assertEqual(self.client.get('/api/subscription').status_code,403)
    def test_registration_creates_pending_without_session(self):
        response=self.client.post('/api/auth/register',{'username':'newtester','name':'Tester','email':'test@example.com','password':'Unique!River73Password'},format='json')
        self.assertEqual(response.status_code,201)
        self.assertTrue(response.json()['approvalPending'])
        self.assertNotIn('_auth_user_id',self.client.session)
        self.assertFalse(AccessApproval.objects.get(user__username='newtester').approved)
    def test_mail_failure_still_blocks_access(self):
        with patch('studio.access.send_mail',side_effect=OSError):
            self.assertEqual(self.client.post('/api/auth/login',{'username':'pending','password':'Long-Tests-Password!73'},format='json').status_code,403)
        self.assertFalse(AccessApproval.objects.get(user=self.member).approved)
