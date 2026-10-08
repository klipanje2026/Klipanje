import base64
import binascii
import struct
import zlib

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import UserControls


def avatar_png(value):
    # Receive a fixed-size RGBA thumbnail, never executable/uploaded file content.
    if not isinstance(value, str) or len(value) > 88000:
        raise ValueError('Invalid thumbnail')
    pixels = base64.b64decode(value, validate=True)
    if len(pixels) != 128 * 128 * 4:
        raise ValueError('Invalid thumbnail size')

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))

    rows = b''.join(b'\x00' + pixels[y * 512:(y + 1) * 512] for y in range(128))
    png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 128, 128, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b''))
    return 'data:image/png;base64,' + base64.b64encode(png).decode('ascii')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def avatar(request):
    value = request.data.get('pixels')
    try:
        image = '' if value == '' else avatar_png(value)
    except (ValueError, binascii.Error):
        return Response({'error': 'Slika nije ispravna. Odaberi drugu fotografiju.'}, status=400)
    row, _ = UserControls.objects.get_or_create(user=request.user)
    row.avatar = image
    row.save(update_fields=['avatar', 'updated_at'])
    return Response({'avatar': image})
