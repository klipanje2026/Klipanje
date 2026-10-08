from types import SimpleNamespace
from unittest.mock import patch
from django.test import SimpleTestCase, RequestFactory
from .editor_diagnostics import failures

class EditorDiagnosticsTests(SimpleTestCase):
    def request(self, method='post', data=None, staff=False):
        factory = RequestFactory()
        req = factory.post('/api/editor/diagnostics', data=data or {'kind':'video','code':3}, content_type='application/json') if method=='post' else factory.get('/api/editor/diagnostics')
        req.user = SimpleNamespace(is_authenticated=False, is_staff=staff)
        return req

    def test_private_dashboard(self):
        self.assertEqual(failures(self.request('get')).status_code,403)

    def test_invalid_payload(self):
        self.assertEqual(failures(self.request(data={'kind':'video','code':'bad'})).status_code,400)
        self.assertEqual(failures(self.request(data={'kind':'arbitrary'})).status_code,400)

    @patch('studio.editor_diagnostics.EditorFailure.objects.create')
    @patch('studio.editor_diagnostics.cache.add', return_value=True)
    def test_only_safe_fields_saved(self, rate, create):
        response=failures(self.request(data={'kind':'video','code':3,'filename':'private.mp4','error':'private text'}))
        self.assertEqual(response.status_code,201)
        create.assert_called_once_with(user=None,kind='video',code=3)

    @patch('studio.editor_diagnostics.EditorFailure.objects.create')
    @patch('studio.editor_diagnostics.cache.add', return_value=False)
    def test_rate_limit(self, rate, create):
        self.assertEqual(failures(self.request()).status_code,200)
        create.assert_not_called()
