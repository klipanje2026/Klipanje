from rest_framework.decorators import api_view
from rest_framework.response import Response
from .projects import accessible_project


@api_view(['POST'])
def begin(request, pk):
    accessible_project(request, pk)
    # The React uploader falls back to the authenticated local asset endpoint.
    return Response({'multipart': False})


def cleanup_expired():
    # Remote multipart sessions do not exist in this local application.
    return None
