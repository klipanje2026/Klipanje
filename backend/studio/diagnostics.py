"""Request diagnostics without bodies, cookies, query strings or exception values."""
import json
import logging
import time
import traceback
from uuid import uuid4

logger = logging.getLogger('edita.requests')


class RequestDiagnosticsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.diagnostic_id = uuid4().hex
        started = time.monotonic()
        response = self.get_response(request)
        response['X-Request-ID'] = request.diagnostic_id
        if request.path.startswith('/api/'):
            match = getattr(request, 'resolver_match', None)
            logger.info(json.dumps({
                'id': request.diagnostic_id, 'method': request.method,
                'route': str(match.route) if match else 'unresolved',
                'status': response.status_code,
                'durationMs': round((time.monotonic() - started) * 1000),
                'secure': request.is_secure(),
            }))
        return response

    def process_exception(self, request, exception):
        logger.error(json.dumps({
            'id': request.diagnostic_id, 'exception': type(exception).__name__,
            'frames': [{'file': frame.filename.rsplit('/', 1)[-1].rsplit('\\', 1)[-1],
                        'line': frame.lineno, 'function': frame.name}
                       for frame in traceback.extract_tb(exception.__traceback__)[-12:]],
        }))
