from uuid import uuid4
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from .models import UserFeedback, TokenOperation, TransferUsage

@override_settings(ACCESS_APPROVAL_REQUIRED=False)
class UserInsightsTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user('pilot')
        self.other=get_user_model().objects.create_user('other')
        self.admin=get_user_model().objects.create_user('admin',is_staff=True)
        self.client=APIClient();self.client.force_authenticate(self.user)
    def test_feedback_retry_and_private_access(self):
        body={'id':str(uuid4()),'category':'export','message':'Izvoz nije uspio.'}
        self.assertEqual(self.client.post('/api/feedback',body,format='json').status_code,201)
        self.assertEqual(self.client.post('/api/feedback',body,format='json').status_code,200)
        self.assertEqual(UserFeedback.objects.count(),1)
        self.assertEqual(self.client.get('/api/admin/feedback').status_code,403)
        self.assertEqual(self.client.post('/api/admin/feedback/'+body['id'],{'status':'resolved'},format='json').status_code,403)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/feedback').data['rows'],[])
        self.assertEqual(self.client.post('/api/feedback',body,format='json').status_code,409)
        self.client.force_authenticate(self.admin)
        self.assertEqual(len(self.client.get('/api/admin/feedback').data['rows']),1)
        self.assertEqual(self.client.post('/api/admin/feedback/'+body['id'],{'status':'resolved'},format='json').status_code,200)
        self.client.force_authenticate(self.user)
        row=self.client.get('/api/feedback').data['rows'][0]
        self.assertEqual(row['status'],'resolved')
        self.assertNotIn('reviewed_by__username',row)
    def test_history_ownership_and_pagination(self):
        for user in [self.user,self.other]:
            for i in range(26):
                TokenOperation.objects.create(user=user,key=uuid4(),capability='transcription',tokens=1,status='completed',period_start=timezone.now())
            TransferUsage.objects.create(user=user,kind='upload',size=123,period_start=timezone.now())
        page=self.client.get('/api/usage/history').data
        self.assertEqual(len(page['rows']),25);self.assertTrue(page['hasNext'])
        second=self.client.get('/api/usage/history?page=2').data
        self.assertEqual(len(second['rows']),1);self.assertFalse(second['hasNext'])
        self.assertEqual(len(self.client.get('/api/usage/history?kind=transfers').data['rows']),1)
    def test_feedback_validation_rate_and_auth(self):
        self.assertEqual(self.client.post('/api/feedback',{'id':str(uuid4()),'category':'bad','message':'x'},format='json').status_code,400)
        for i in range(10):UserFeedback.objects.create(user=self.user,category='other',message='Testna poruka')
        self.assertEqual(self.client.post('/api/feedback',{'id':str(uuid4()),'category':'other','message':'Testna poruka'},format='json').status_code,429)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get('/api/usage/history').status_code,[401,403])
    def test_session_post_requires_csrf(self):
        client=APIClient(enforce_csrf_checks=True);client.force_login(self.user)
        self.assertEqual(client.post('/api/feedback',{'id':str(uuid4()),'category':'other','message':'Testna poruka'},format='json').status_code,403)
