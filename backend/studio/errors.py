from rest_framework.views import exception_handler
def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None and isinstance(response.data, dict):
        def messages(value):
            if isinstance(value, dict):
                return [f'{key}: {text}' for key, child in value.items() for text in messages(child)]
            if isinstance(value, (list, tuple)):
                return [text for child in value for text in messages(child)]
            return [str(value)]
        response.data.setdefault('error', str(response.data['detail']) if 'detail' in response.data else '; '.join(messages(response.data)) or 'Provjeri unesene podatke.')
    return response
