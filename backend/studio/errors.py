from rest_framework.views import exception_handler
def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None and isinstance(response.data, dict):
        response.data.setdefault('error', str(response.data.get('detail', 'Provjeri unesene podatke.')))
    return response
