import json
from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase
from types import SimpleNamespace
from .diagnostics import RequestDiagnosticsMiddleware


class DiagnosticTests(SimpleTestCase):
    def test_logs_status_id_and_route_without_secrets(self):
        request = RequestFactory().get('/api/assets/private-id?token=SECRET', HTTP_AUTHORIZATION='Bearer SECRET')
        request.resolver_match = SimpleNamespace(route='api/assets/<uuid:pk>')
        middleware = RequestDiagnosticsMiddleware(lambda _: HttpResponse(status=503))
        with self.assertLogs('edita.requests', level='INFO') as logs:
            response = middleware(request)
        payload = json.loads(logs.records[0].message)
        self.assertEqual(payload['id'], response['X-Request-ID'])
        self.assertEqual(payload['status'], 503)
        self.assertNotIn('SECRET', logs.output[0])
        self.assertNotIn('private-id', logs.output[0])

    def test_exception_values_are_not_logged(self):
        request = RequestFactory().get('/api/health')
        request.diagnostic_id = 'test'
        middleware = RequestDiagnosticsMiddleware(lambda _: HttpResponse())
        try:
            raise ValueError('SECRET in exception')
        except ValueError as error:
            with self.assertLogs('edita.requests', level='ERROR') as logs:
                middleware.process_exception(request, error)
        self.assertIn('ValueError', logs.output[0])
        self.assertNotIn('SECRET', logs.output[0])
