from types import SimpleNamespace
from unittest.mock import patch
from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase
from .staging_access import StagingAccessMiddleware, review_access


class StagingAccessTests(SimpleTestCase):
    def response(self, path, logged_in=False, method='get'):
        request=getattr(RequestFactory(), method)(path)
        request.user=SimpleNamespace(is_authenticated=logged_in)
        return StagingAccessMiddleware(lambda req: HttpResponse('ok'))(request)

    def test_anonymous_uses_login_without_browser_auth_challenge(self):
        response=self.response('/')
        self.assertEqual(response.status_code,302)
        self.assertEqual(response['Location'],'/login')
        self.assertNotIn('WWW-Authenticate',response)
        self.assertEqual(self.response('/api/admin/usage/providers').status_code,403)
        self.assertEqual(self.response('/login').status_code,200)
        self.assertEqual(self.response('/api/auth/login',method='post').status_code,200)

    def test_existing_users_can_enter_but_registration_stays_closed(self):
        self.assertEqual(self.response('/titlovi',True).status_code,200)
        for logged_in in [False,True]:
            self.assertEqual(self.response('/api/auth/register',logged_in,'post').status_code,403)

    def test_only_signed_in_testers_can_link_social_accounts(self):
        for provider in ['google', 'facebook']:
            for suffix, method in [('start', 'post'), ('callback', 'get')]:
                path=f'/api/auth/social/{provider}/{suffix}'
                self.assertEqual(self.response(path,False,method).status_code,403)
                self.assertEqual(self.response(path,True,method).status_code,200)
        self.assertEqual(self.response('/api/auth/social/providers').status_code,403)
        self.assertEqual(self.response('/api/auth/social/providers',True).status_code,200)

    def test_ci_does_not_get_api_or_write_access(self):
        request=RequestFactory().post('/')
        self.assertFalse(review_access(request))
        request=RequestFactory().get('/api/admin/usage/providers')
        self.assertFalse(review_access(request))
        with patch('studio.staging_access.review_access',return_value=True):
            self.assertEqual(self.response('/').status_code,200)
