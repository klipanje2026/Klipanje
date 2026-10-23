from urllib.parse import urlencode
from django.core.cache import cache
from rest_framework.decorators import api_view
from rest_framework.response import Response
import httpx
from .ai import json_request, missing_key

# Public Voice Library IDs checked 2026-10-23. No samples or credentials are tracked.
CHOICES=[('VB7D8zswiztJjyl8LI3a','Balkanika','Balkanika'),('j96cp162VcYdsYfSp1nc','Ivan','Ivan · muški regionalni'),('7IVTG9LKLYndnFiFDLU2','Milena','Milena · ženski regionalni'),('bduxjXAljl1GoqxNnLeF','Amila','Amila · Calm, Kind, Warm'),('uWuA4P0UhkL94Z85GkOz','Amila','Amila · Warm, Calm, Deep'),('mP6GNwIkel9neaN9zZIg','Jusuf','Jusuf · Calm, Narrative')]
CHOICES += [
    ('ej3cSsqkJiJFs2EuW9st','Emir','Emir · Patient, Calm'),
    ('J3mLAF5Siv0gqbDWQr7R','Emir','Emir · Warm, Confident, Deep'),
    ('izdZx7ZhhnhAltJvFWWr','Emir','Emir · Upbeat, Amused, Bright'),
    ('oDGXruwpxGwpvhGIPylp','Lejla','Lejla · Calm, Kind, Warm'),
    ('bGquYfYhTFhd5P9qAccA','Adnan','Adnan · Upbeat, Amused, Bright'),
    ('i3Sopi5uaJ7ZbHrMbDdc','Nermin','Nermin · Dry, Direct, Deep'),
    ('0jvpZ98RZwx5FBOSZAc3','Maja','Maja · Engaging, Narrative'),
    ('g8TYYIFt2Qo27yGQmTYq','Jovana','Jovana · Warm Serbian Narrator'),
    ('ih4fthN0aVU5Vs9NMwgk','Milica','Milica · Warm, Calm, Narrator'),
    ('mcVGxV1BuvLf8VfWWB55','Tamara','Tamara · Warm Conversational Friend'),
    ('DAGnQ7r9sMtV0Q44g1Mi','Nikola','Nikola · Balkan Pro'),
    ('LmECtQKlHFHPX4psgBT1','Nikola','Nikola · Deep, Serious Narrator'),
    ('ocaele7kOTNS1wQzhbSM','Marko','Marko · Deep, Calm and Narrative'),
    ('VnqrcpsIQtSAwCasY5CP','Anja','Anja · Engaging Narration, Audiobooks'),
    ('4vkn1E85GfXGoH86xgU7','Sara','Sara · Sharp & Professional'),
    ('CgDf4YS1Sotf0h6n2vtV','Martin','Martin · Conversational'),
    ('ee4SYVdD1aAhcjOJPZdt','Ana','Ana · Warm, Patient Friend'),
    ('YSnb83dlGetP8Umttfqs','Filip','Filip · Upbeat Ad'),
    ('sI840Q4fwRxSs9TeMlIX','Zoran','Zoran · Firm Commercial'),
    ('NvCaXAtgUyp0d9zSgPg5','Dragan','Dragan · Confident Ad'),
    ('PcQ1oUfPHim3ZuyULxyk','Marko','Marko · Upbeat, Punchy Creator'),
    ('XOqEcEeTZy5lYgLrY3MI','Aleksandar','Aleksandar · Bright, Amused Creator'),
    ('5lDS2fR0uHPW5ShjjPzv','Stefan','Stefan · Bright, Playful Creator'),
]

@api_view(['GET'])
def regional(request):
    missing=missing_key()
    if missing is not None:return missing
    try:
        account=json_request('GET','/v1/user/subscription')
        tier=account.json().get('tier') if account.is_success else None
        voices=[]
        choices=CHOICES
        search_query=request.query_params.get('search','').strip()[:100]
        if search_query:
            response=json_request('GET','/v1/shared-voices?'+urlencode({'search':search_query,'page_size':100}))
            if not response.is_success:
                from .ai import failure
                return failure(response,'pretragu glasova')
            choices=[]
            for voice in response.json().get('voices',[]):
                if not voice.get('voice_id'):continue
                cache.set('regional-voice-'+voice['voice_id'],voice,300)
                choices.append((voice['voice_id'],search_query,voice.get('name','Glas')))
        for identifier,search,name in choices:
            voice=cache.get('regional-voice-'+identifier)
            if voice is None:
                response=json_request('GET','/v1/shared-voices?'+urlencode({'search':search,'page_size':100}))
                if not response.is_success:continue
                matches=response.json().get('voices',[])
                for match in matches:
                    if match.get('voice_id'):cache.set('regional-voice-'+match['voice_id'],match,300)
                voice=next((v for v in matches if v.get('voice_id')==identifier),None)
                if not voice:continue
                cache.set('regional-voice-'+identifier,voice,300)
            preview=next((v.get('preview_url') for v in voice.get('verified_languages',[]) if v.get('language') in ['hr','sr','bs'] and v.get('preview_url')),None) or voice.get('preview_url','')
            paid=tier is not None and tier!='free'
            language=voice.get('language','hr')
            label={'bs':'bosanski','hr':'regionalni · hrvatski','sr':'regionalni · srpski'}.get(language,language)
            voices.append({'id':identifier,'name':f'{name} · {label}','gender':voice.get('gender','voice'),'language':language,'description':voice.get('description',''),'previewUrl':preview,'available':paid,'reason':'' if paid else 'Za Voice Library preko API-ja potrebna je plaćena pretplata.' if tier=='free' else 'Status plana nije potvrđen. Ponovo učitaj glasove.'})
        return Response({'voices':voices,'tier':tier},headers={'Cache-Control':'no-store'})
    except (httpx.HTTPError,ValueError,TypeError,AttributeError):return Response({'error':'Regionalni glasovi trenutno nisu dostupni.'},status=502)
