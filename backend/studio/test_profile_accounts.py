import base64
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from .models import UserControls, Membership, AccessApproval, AffiliateProfile


class ProfileAccountsTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('profile-owner')
        self.admin = get_user_model().objects.create_user('profile-admin', is_staff=True)
        self.client = APIClient()

    def test_avatar_requires_login_and_updates_only_self(self):
        pixels = base64.b64encode(bytes([20, 100, 120, 255]) * 128 * 128).decode()
        self.assertIn(self.client.post('/api/account/avatar', {'pixels': pixels}, format='json').status_code, (401, 403))
        self.client.force_authenticate(self.user)
        response = self.client.post('/api/account/avatar', {'pixels': pixels, 'user_id': self.admin.pk}, format='json')
        self.assertEqual(response.status_code, 200)
        image = UserControls.objects.get(user=self.user).avatar
        self.assertTrue(image.startswith('data:image/png;base64,'))
        self.assertFalse(UserControls.objects.filter(user=self.admin).exists())
        self.assertEqual(self.client.post('/api/account/avatar', {'pixels': 'invalid'}, format='json').status_code, 400)
        self.assertEqual(UserControls.objects.get(user=self.user).avatar, image)
        self.assertEqual(self.client.post('/api/account/avatar', {'pixels': ''}, format='json').status_code, 200)
        self.assertEqual(UserControls.objects.get(user=self.user).avatar, '')

    def test_admin_account_creation_permissions_and_roles(self):
        data = {'username': 'new-member', 'name': 'New Member', 'email': 'member@example.com', 'password': 'R4ndom!Long-Private#92', 'is_staff': True}
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post('/api/admin/users/create', data, format='json').status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post('/api/admin/users/create', data, format='json').status_code, 201)
        created = get_user_model().objects.get(username='new-member')
        self.assertFalse(created.is_staff)
        self.assertTrue(created.check_password(data['password']))
        self.assertTrue(Membership.objects.filter(user=created, role='owner').exists())
        self.assertTrue(AccessApproval.objects.get(user=created).approved)
        self.assertFalse(AffiliateProfile.objects.filter(user=created).exists())
        self.assertEqual(self.client.post('/api/admin/users/create', {**data, 'username': 'NEW-MEMBER'}, format='json').status_code, 409)
        self.assertEqual(self.client.post('/api/admin/affiliates/create', {**data, 'username': 'new-partner'}, format='json').status_code, 201)
        self.assertTrue(AffiliateProfile.objects.filter(user__username='new-partner', active=True).exists())
