"""Local image workspace. Provider calls happen only on an explicit generate POST."""
import base64
import binascii
import json
from contextlib import ExitStack
from uuid import uuid4
import httpx
from django.conf import settings
from django.core.files.base import ContentFile
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import LocalScript, MediaAsset
from .projects import asset_payload

MODELS = [
    {'id':'gpt-image-2.5-flare','name':'GPT Image 2.5 Flare','description':'Brze ideje, novi kadrovi i svakodnevno generisanje.'},
    {'id':'gpt-image-2.5-sunburst','name':'GPT Image 2.5 Sunburst','description':'Precizne izmjene i rad s referencama likova.'},
]
STYLES = [
    ('realistic','Fotorealistično','Photorealistic photography, natural textures and believable lighting.'),
    ('cinematic','Filmski','Cinematic still, deliberate composition, atmospheric lighting and film color grading.'),
    ('cartoon3d','3D cartoon','Expressive 3D animated cartoon, rounded forms and soft cinematic lighting.'),
    ('cartoon2d','2D cartoon','Hand-drawn 2D cartoon, clean outlines and expressive characters.'),
    ('anime','Anime','Anime illustration, detailed environments and expressive line work.'),
    ('watercolor','Akvarel','Watercolor illustration with paper texture and delicate pigment washes.'),
    ('comic','Strip','Graphic novel illustration, bold ink lines and dramatic composition.'),
    ('clay','Plastelin','Handcrafted clay stop-motion look, tactile surfaces and miniature sets.'),
]

class ImageRequest(serializers.Serializer):
    script = serializers.UUIDField()
    segment = serializers.CharField(required=False, allow_blank=True, max_length=64, default='')
    prompt = serializers.CharField(max_length=10000, allow_blank=True, default='')
    model = serializers.ChoiceField(choices=[m['id'] for m in MODELS])
    style = serializers.ChoiceField(choices=[s[0] for s in STYLES], default='cinematic')
    size = serializers.ChoiceField(choices=['1024x1024','1536x1024','1024x1536'],default='1536x1024')
    quality = serializers.ChoiceField(choices=['low','medium','high'],default='medium')
    references = serializers.ListField(child=serializers.UUIDField(),max_length=5,default=list)

def prepare(request):
    form=ImageRequest(data=request.data); form.is_valid(raise_exception=True)
    data=form.validated_data
    script=get_object_or_404(LocalScript,pk=data['script'],owner=request.user,project__created_by=request.user)
    segment=next((s for s in script.segments if s['id']==data['segment']),None)
    if data['segment'] and not segment:
        raise serializers.ValidationError('Odabrani interval više ne postoji.')
    refs=list(script.project.assets.filter(pk__in=data['references'],content_type__in=['image/png','image/jpeg','image/webp']))
    if len(refs)!=len(set(data['references'])):
        raise serializers.ValidationError('Reference moraju biti slike iz ovog projekta.')
    if sum(a.size for a in refs)>40*1024*1024:
        raise serializers.ValidationError('Reference zajedno mogu imati najviše 40 MB.')
    brief=script.project.brief
    style=next(s for s in STYLES if s[0]==data['style'])
    prompt='\n\n'.join(filter(None,[
        'Create one image for a video scene. Maintain consistent character identity across the series.',
        'Project: '+script.project.name,
        'Project background: '+str(brief.get('description','')),
        'Series and continuity: '+str(brief.get('series','')),
        'Characters: '+json.dumps(brief.get('characters',[]),ensure_ascii=False),
        'Visual style: '+style[2],
        'Shared direction: '+script.image_prompt,
        'Narration context: '+(segment['text'] if segment else script.content[:10000]),
        'Scene direction: '+data['prompt'],
        'Use the attached reference images to preserve appearance, clothing and environment.' if refs else '',
    ]))
    if len(prompt)>32000:
        raise serializers.ValidationError('Skrati zajednički opis ili opise likova (prompt prelazi 32.000 znakova).')
    return data,script,refs,prompt

@api_view(['GET'])
def options(request):
    return Response({'models':MODELS,'styles':[{'id':s[0],'name':s[1]} for s in STYLES]})

@api_view(['POST'])
def prompt_preview(request):
    _,_,refs,prompt=prepare(request)
    return Response({'prompt':prompt,'references':[asset_payload(a) for a in refs]})

@api_view(['POST'])
def generate(request):
    data,script,refs,prompt=prepare(request)
    if not settings.OPENAI_API_KEY:
        return Response({'error':'OpenAI ključ nije postavljen u lokalnom .env fajlu.'},status=503)
    payload={'model':data['model'],'prompt':prompt,'size':data['size'],'quality':data['quality'],'output_format':'png'}
    try:
        with httpx.Client(timeout=httpx.Timeout(300,connect=20),headers={'Authorization':'Bearer '+settings.OPENAI_API_KEY}) as client, ExitStack() as stack:
            if refs:
                files=[('image[]',(a.name,stack.enter_context(a.file.open('rb')),a.content_type)) for a in refs]
                response=client.post('https://api.openai.com/v1/images/edits',data=payload,files=files)
            else:
                response=client.post('https://api.openai.com/v1/images/generations',json=payload)
        if response.status_code!=200:
            messages={401:'OpenAI ključ nije prihvaćen.',403:'Račun nema pristup ovom modelu. Provjeri pristup i verifikaciju organizacije.',404:'Model nije dostupan ovom API projektu.',429:'OpenAI limit ili sredstva nisu dovoljni. Provjeri API stanje računa.',400:'OpenAI nije prihvatio opis ili reference. Prilagodi ih i pokušaj ponovo.'}
            return Response({'error':messages.get(response.status_code,'OpenAI trenutno nije vratio sliku. Pokušaj kasnije.')},status=502)
        raw=base64.b64decode(response.json()['data'][0]['b64_json'],validate=True)
        if not raw.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError('Invalid image')
    except (httpx.HTTPError,ValueError,KeyError,IndexError,binascii.Error):
        return Response({'error':'Slika nije preuzeta. Provjeri vezu i galeriju prije ponovnog generisanja.'},status=502)
    asset=MediaAsset(project=script.project,name=f'kadar-{uuid4().hex[:8]}.png',content_type='image/png',size=len(raw),metadata={
        'purpose':'image','scriptId':str(script.pk),'segmentId':data['segment'],'prompt':data['prompt'],'fullPrompt':prompt,'model':data['model'],'style':data['style'],'references':[str(a.pk) for a in refs],
    })
    asset.file.save(asset.name,ContentFile(raw),save=False)
    try: asset.save()
    except Exception:
        asset.file.delete(save=False)
        raise
    return Response(asset_payload(asset),status=201)
