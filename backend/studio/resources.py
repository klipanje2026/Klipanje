import logging
from django.conf import settings
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.db.models import Sum
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from .models import MediaAsset
from .ai import json_request

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def resources(request):
    cached=None if request.query_params.get('refresh') == '1' else cache.get('admin-provider-resources')
    if cached: return Response(cached,headers={'Cache-Control':'no-store'})
    data={'checkedAt':timezone.now().isoformat(),'elevenlabs':{'available':False},'storage':{'available':False,'trackedBytes':MediaAsset.objects.aggregate(total=Sum('size'))['total'] or 0,'provider':settings.STORAGE_BACKEND}}
    if settings.ELEVENLABS_API_KEY:
        try:
            response=json_request('GET','/v1/user/subscription')
            response.raise_for_status(); row=response.json()
            used=max(0,int(row['character_count'])); limit=max(0,int(row['character_limit']))
            data['elevenlabs']={'available':True,'used':used,'limit':limit,'remaining':max(0,limit-used),'resetAt':row.get('next_character_count_reset_unix')}
        except Exception as exc:
            logger.warning('ElevenLabs usage unavailable (%s)', type(exc).__name__)
            data['elevenlabs']['error']='ElevenLabs trenutno ne vraća stanje kredita. Pokušaj osvježiti.'
    else:
        data['elevenlabs']['error']='ElevenLabs ključ nije podešen na serveru.'
    if settings.STORAGE_BACKEND=='r2':
        try:
            client=default_storage.connection.meta.client
            total=count=0; token=None; partial=False
            for _ in range(20):
                page=client.list_objects_v2(Bucket=default_storage.bucket_name,MaxKeys=1000,**({'ContinuationToken':token} if token else {}))
                total+=sum(o['Size'] for o in page.get('Contents',[])); count+=len(page.get('Contents',[]))
                partial=page.get('IsTruncated',False)
                if not partial:break
                token=page['NextContinuationToken']
            data['storage'].update(available=True,bytes=total,objects=count,partial=partial)
        except Exception as exc:
            logger.warning('R2 usage unavailable (%s)', type(exc).__name__)
            data['storage']['error']='R2 trenutno ne vraća stanje pohrane. Pokušaj osvježiti.'
    else:
        data['storage']['error']='Cloudflare R2 nije podešen na serveru.'
    cache.set('admin-provider-resources',data,300 if data['elevenlabs']['available'] and data['storage']['available'] else 15)
    return Response(data,headers={'Cache-Control':'no-store'})
