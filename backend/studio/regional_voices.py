from urllib.parse import urlencode
from django.core.cache import cache
from rest_framework.decorators import api_view
from rest_framework.response import Response
import httpx
from .ai import json_request, missing_key

# Public Voice Library IDs verified 2026-10-09. No samples or credentials are tracked.
CHOICES=[('VB7D8zswiztJjyl8LI3a','Balkanika','Balkanika'),('j96cp162VcYdsYfSp1nc','Ivan','Ivan · muški regionalni'),('7IVTG9LKLYndnFiFDLU2','Milena','Milena · ženski regionalni')]

@api_view(['GET'])
def regional(request):
    missing=missing_key()
    if missing is not None:return missing
    try:
        account=json_request('GET','/v1/user/subscription')
        tier=account.json().get('tier') if account.is_success else None
        voices=[]
        for identifier,search,name in CHOICES:
            voice=cache.get('regional-voice-'+identifier)
            if voice is None:
                response=json_request('GET','/v1/shared-voices?'+urlencode({'search':search,'page_size':100}))
                if not response.is_success:continue
                voice=next((v for v in response.json().get('voices',[]) if v.get('voice_id')==identifier),None)
                if not voice:continue
                cache.set('regional-voice-'+identifier,voice,300)
            preview=next((v.get('preview_url') for v in voice.get('verified_languages',[]) if v.get('language') in ['hr','sr','bs'] and v.get('preview_url')),None) or voice.get('preview_url','')
            paid=tier is not None and tier!='free'
            voices.append({'id':identifier,'name':name,'gender':voice.get('gender','voice'),'language':voice.get('language','hr'),'description':voice.get('description',''),'previewUrl':preview,'available':paid,'reason':'' if paid else 'Za Voice Library preko API-ja potrebna je plaćena pretplata.' if tier=='free' else 'Status plana nije potvrđen. Ponovo učitaj glasove.'})
        return Response({'voices':voices,'tier':tier},headers={'Cache-Control':'no-store'})
    except (httpx.HTTPError,ValueError,TypeError,AttributeError):return Response({'error':'Regionalni glasovi trenutno nisu dostupni.'},status=502)
