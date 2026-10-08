from unittest.mock import patch
from uuid import uuid4
from django.contrib.auth.models import AnonymousUser
from django.middleware.csrf import get_token
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIRequestFactory
from studio import ai, media_compatibility
from studio.guest_access import editor_identity
from django.urls import resolve

@override_settings(ELEVENLABS_API_KEY='test-only', CACHES={'default': {'BACKEND':'django.core.cache.backends.locmem.LocMemCache','LOCATION':'guest-access-checks'}})
class GuestEditingTests(SimpleTestCase):
    def request(self, csrf=True, guest='guest-a'):
        request=APIRequestFactory(enforce_csrf_checks=True).post('/api/transcribe',{})
        request.session={'editor_guest':guest}
        if csrf:
            token=get_token(request)
            from django.conf import settings
            request.COOKIES[settings.CSRF_COOKIE_NAME]=request.META['CSRF_COOKIE']
            request.META['HTTP_X_CSRFTOKEN']=token
        return request

    def test_guest_writes_require_csrf(self):
        self.assertEqual(ai.transcribe(self.request(False)).status_code,403)

    def test_guest_gets_proxy_not_provider_token(self):
        with patch('studio.ai.json_request') as provider:
            result=ai.transcribe(self.request())
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.data,{'proxy':True})
        provider.assert_not_called()

    def test_guest_voice_access_does_not_read_account(self):
        request=self.request();request.user=AnonymousUser()
        with patch('studio.ai.paid_access') as account:
            self.assertIsNone(ai.voice_guard(request))
        account.assert_not_called()

    def test_media_jobs_are_isolated_between_guests(self):
        first=self.request(guest='one');first.user=AnonymousUser()
        second=self.request(guest='two');second.user=AnonymousUser()
        key=str(uuid4())
        a=media_compatibility.job_for(editor_identity(first),key)
        b=media_compatibility.job_for(editor_identity(second),key)
        a['cancel'].set()
        self.assertFalse(b['cancel'].is_set())

    def test_private_endpoints_remain_locked(self):
        for path,method in [('/api/projects','get'),('/api/subscription','get'),('/api/subscription/export','post'),('/api/admin/users','get')]:
            match=resolve(path)
            request=getattr(APIRequestFactory(),method)(path,{})
            response=match.func(request,**match.kwargs)
            self.assertIn(response.status_code,(401,403),path)
