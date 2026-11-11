from pathlib import Path
from django.conf import settings
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import LibrarySound

TYPES = {'.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.m4a':'audio/mp4','.aac':'audio/aac','.flac':'audio/flac'}
def payload(item):
    return {'id':str(item.pk),'name':item.name,'url':f'/api/sounds/{item.pk}/content','category':item.category,'fadeIn':item.fade_in,'contentType':item.content_type,'size':item.size}

@api_view(['GET','POST'])
@permission_classes([IsAuthenticated])
def sounds(request):
    if not settings.LOCAL_APP: return Response(status=404)
    if request.method == 'GET':
        return Response([payload(s) for s in LibrarySound.objects.filter(owner=request.user,archived=False)], headers={'Cache-Control':'private, no-store'})
    category=request.data.get('category','sound')
    if category not in ('sound','music'):
        return Response({'error':'Odaberi zvučni efekat ili BG muziku.'},status=400)
    upload=request.FILES.get('file')
    if not upload or Path(upload.name).suffix.lower() not in TYPES:
        return Response({'error':'Odaberi WAV, MP3, OGG, M4A, AAC ili FLAC zvuk.'},status=400)
    if not upload.size or upload.size>settings.MAX_PROJECT_UPLOAD_BYTES:
        return Response({'error':'Datoteka je prazna ili prevelika.'},status=413)
    item=LibrarySound.objects.create(owner=request.user,category=category,name=Path(upload.name).name[:255],file=upload,content_type=TYPES[Path(upload.name).suffix.lower()],size=upload.size)
    return Response(payload(item),status=201)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def content(request,pk):
    if not settings.LOCAL_APP: return Response(status=404)
    item=get_object_or_404(LibrarySound,pk=pk,owner=request.user)
    response=FileResponse(item.file.open('rb'),content_type=item.content_type)
    response['Cache-Control']='private, no-store'
    response['X-Content-Type-Options']='nosniff'
    return response

@api_view(['PATCH','DELETE'])
@permission_classes([IsAuthenticated])
def detail(request,pk):
    if not settings.LOCAL_APP: return Response(status=404)
    item=get_object_or_404(LibrarySound,pk=pk,owner=request.user)
    if request.method=='DELETE':
        item.archived=True
        item.save(update_fields=['archived'])
        return Response(status=204)
    name=request.data.get('name')
    if not isinstance(name,str) or not name.strip() or len(name.strip())>255:
        return Response({'error':'Unesi naziv zvuka do 255 znakova.'},status=400)
    name=name.strip()
    suffix=Path(item.name).suffix
    if Path(name).suffix.lower() not in TYPES:
        name=name[:255-len(suffix)]+suffix
    item.name=name
    item.save(update_fields=['name'])
    return Response(payload(item))
