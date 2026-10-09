"""Local image workspace. Provider calls happen only on an explicit generate POST."""
import base64
import binascii
import json
import re
import subprocess
import imageio_ffmpeg
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
from .image_spend import record_image

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
    aspect = serializers.ChoiceField(choices=['9:16','16:9','1:1'],required=False)
    quality = serializers.ChoiceField(choices=['low','medium','high'],default='medium')
    references = serializers.ListField(child=serializers.UUIDField(),max_length=16,default=list)

def prepare(request):
    form=ImageRequest(data=request.data); form.is_valid(raise_exception=True)
    data=form.validated_data
    script=get_object_or_404(LocalScript,pk=data['script'],owner=request.user,project__created_by=request.user)
    segment=next((s for s in script.segments if s['id']==data['segment']),None)
    if data['segment'] and not segment:
        raise serializers.ValidationError('Odabrani interval više ne postoji.')
    context_text=((segment or {}).get('text',script.content)+' '+data['prompt']).casefold()
    characters=script.project.brief.get('characters',[])
    identities=[]
    for character in characters:
        name=character.get('name','').strip()
        if name and re.search(r'(?<!\w)'+re.escape(name.casefold())+r'(?!\w)',context_text):
            identities.append(character)
            if character.get('referenceId'):
                identifier=serializers.UUIDField().run_validation(character['referenceId'])
                if identifier not in data['references']: data['references'].append(identifier)
    if len(data['references'])>16: raise serializers.ValidationError('Odabrani kadar koristi više od 16 referenci. Smanji izbor za taj kadar.')
    found={a.pk:a for a in script.project.assets.filter(pk__in=data['references'],content_type__in=['image/png','image/jpeg','image/webp'])}
    refs=[found[identifier] for identifier in data['references'] if identifier in found]
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
        'Wanted: '+str(brief.get('desired','')),
        'Avoid: '+str(brief.get('avoid','')),
        'Storytelling rules: '+str(brief.get('storyRules','')),
        'Project notes: '+json.dumps(brief.get('notes',[]),ensure_ascii=False),
        'Framing: '+data.get('aspect','original')+' aspect ratio. Keep all essential subjects centered with room for cropping.',
        'Characters: '+json.dumps(brief.get('characters',[]),ensure_ascii=False),
        'Characters present in this scene: '+json.dumps(identities,ensure_ascii=False),
        'Reference identity mapping: '+json.dumps([{'image':i+1,'characters':[c.get('name') for c in characters if c.get('referenceId')==str(a.pk)]} for i,a in enumerate(refs)],ensure_ascii=False),
        'Preserve the exact identities, facial features, proportions, hair and established clothing of named characters. Change only the requested pose, action and scene; do not invent replacements.',
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
        result=response.json()
        spend=record_image(request.user,data['model'],result.get('usage',{}))
        raw=base64.b64decode(result['data'][0]['b64_json'],validate=True)
        if not raw.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError('Invalid image')
    except (httpx.HTTPError,ValueError,KeyError,IndexError,binascii.Error):
        return Response({'error':'Slika nije preuzeta. Provjeri vezu i galeriju prije ponovnog generisanja.'},status=502)
    # Preserve the requested output ratio without relying on unsupported provider sizes.
    if data.get('aspect') in ['9:16','16:9']:
        crop='crop=864:1536' if data['aspect']=='9:16' else 'crop=1536:864'
        try:
            converted=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-i','pipe:0','-vf',crop,'-frames:v','1','-f','image2pipe','-vcodec','png','pipe:1'],input=raw,capture_output=True,timeout=30,check=True)
            raw=converted.stdout
        except (subprocess.SubprocessError,OSError):
            return Response({'error':'Slika je generisana, ali priprema odabranog formata nije uspjela. Provjeri servis prije ponovnog generisanja.'},status=502)
    asset=MediaAsset(project=script.project,name=f'kadar-{uuid4().hex[:8]}.png',content_type='image/png',size=len(raw),metadata={
        'gallery':False,'estimatedUsd':float(spend.estimated_usd) if spend.estimated_usd is not None else None,'purpose':'image','scriptId':str(script.pk),'segmentId':data['segment'],'prompt':data['prompt'],'fullPrompt':prompt,'model':data['model'],'style':data['style'],'aspect':data.get('aspect'),'references':[str(a.pk) for a in refs],
    })
    asset.file.save(asset.name,ContentFile(raw),save=False)
    try: asset.save()
    except Exception:
        asset.file.delete(save=False)
        raise
    return Response(asset_payload(asset),status=201)

@api_view(['POST'])
def generate_script(request):
    class ScriptRequest(serializers.Serializer):
        script=serializers.UUIDField()
        direction=serializers.CharField(max_length=6000)
    form=ScriptRequest(data=request.data);form.is_valid(raise_exception=True)
    script=get_object_or_404(LocalScript,pk=form.validated_data['script'],owner=request.user,project__created_by=request.user)
    if not settings.OPENAI_API_KEY:return Response({'error':'OpenAI ključ nije postavljen.'},status=503)
    instructions='Write a narration script in Bosnian Latin script. Return only the narration text. Treat the project context below as creative constraints: preserve character names, established appearances and personalities, continuity, wanted/avoided content and storytelling rules. Do not invent changes to canonical characters. User direction defines this episode.\nProject: '+script.project.name+'\nProject context: '+json.dumps(script.project.brief,ensure_ascii=False)
    if len(instructions)>90000:raise serializers.ValidationError('Skrati projektne bilješke prije generisanja.')
    try:
        with httpx.Client(timeout=120,headers={'Authorization':'Bearer '+settings.OPENAI_API_KEY}) as client:
            response=client.post('https://api.openai.com/v1/responses',json={'model':settings.OPENAI_MODEL,'instructions':instructions,'input':form.validated_data['direction'],'max_output_tokens':4000,'store':False})
        if not response.is_success:return Response({'error':'AI skripta nije generisana. Provjeri API sredstva i pokušaj ponovo.'},status=502)
        text='\n'.join(item['text'] for output in response.json().get('output',[]) for item in output.get('content',[]) if item.get('type')=='output_text').strip()
        if not text or len(text)>100000:raise ValueError('Invalid script')
        return Response({'text':text,'project':str(script.project_id)})
    except (httpx.HTTPError,ValueError,KeyError,TypeError):return Response({'error':'AI skripta nije preuzeta. Pokušaj ponovo.'},status=502)
