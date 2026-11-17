from urllib.parse import urlencode
from django.core.cache import cache
from rest_framework.decorators import api_view
from rest_framework.response import Response
import httpx
from .ai import json_request, missing_key

# Public Voice Library IDs checked 2026-10-29. No samples or credentials are tracked.
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

# Additional male regional narrators verified in the public catalog on 2026-10-29.
CHOICES += [
    ('jJ1MUnCKtrOI23TlUUHc', 'Ivan - Clear Croatian Narrator', 'Ivan - Clear Croatian Narrator'),
    ('ErUfHRm63bBA07FTUPZG', 'Marko - Energetic and lively', 'Marko - Energetic and lively'),
    ('olecVpv03asgm9w2Vs6l', 'Luka - Pleasant and approachable', 'Luka - Pleasant and approachable'),
    ('WxQSzlR1UORgKEiMk1n4', 'Branimir - Professional Croatian Studio', 'Branimir - Professional Croatian Studio'),
    ('jVBTQrP67HZEE22UqQGF', 'Mihael - Croatian Radio TV host', 'Mihael - Croatian Radio TV host'),
    ('FEuh1dGiuX8Don6bZygL', 'Luka', 'Luka'),
    ('7rIwwKpExfJ59KPHgRnT', 'Sini - Calm, Clear & Narrative', 'Sini - Calm, Clear & Narrative'),
    ('pTD8166KADi6ZFJ5FEXi', 'Karlo - Calm, Clear & Friendly ', 'Karlo - Calm, Clear & Friendly '),
    ('O9XgmQnaZveORWl6mTHm', 'Tomislav - Calm, Clear and Narrative', 'Tomislav - Calm, Clear and Narrative'),
    ('peXmQaCErbfrWCM5FqjH', 'Marko -  Conversational, Detached', 'Marko -  Conversational, Detached'),
    ('F2kYsMGahtg8auErVXgY', 'Dylan - Profesional, Warm', 'Dylan - Profesional, Warm'),
    ('TRnNlYQWHAJwo9K75wNE', 'Fran - Calm, Narrative', 'Fran - Calm, Narrative'),
    ('kpx2bGcCm6NK1UJ5jxMH', 'Davor - Conversational, Casual', 'Davor - Conversational, Casual'),
    ('FXFcxnjikw0naYO1PPrU', 'Adnan - Energetic, Educational', 'Adnan - Energetic, Educational'),
    ('yphrIdMc2DLlL0Ux5uvG', 'Christian - Smooth and Laid-back', 'Christian - Smooth and Laid-back'),
    ('ZLYZToA7aDsMbHwM9AOr', 'Luka - Calm, Narrative', 'Luka - Calm, Narrative'),
    ('vFQACl5nAIV0owAavYxE', 'Ivan - Informative, Educational', 'Ivan - Informative, Educational'),
    ('adxhr4Ei7ASJ3Cz7fxwX', 'Slobodan - Persuasive, Narrative', 'Slobodan - Persuasive, Narrative'),
]

# American young-adult narration candidates verified in Voice Library, 2026-11-15.
AMERICAN_CHOICES = [
    ('G7bJ0cnNDezf2z9EA3FB', 'Joel - Smooth & Natural', 'Joel - Smooth & Natural'),
    ('Exv6tD1bSqqEOJlb8Ez7', 'Ben Chamsou - Narrator & Storyteller', 'Ben Chamsou - Narrator & Storyteller'),
    ('jnqK4oKgAruCsCiylRIB', 'Matt Marlow - Easygoing American', 'Matt Marlow - Easygoing American'),
    ('AgWmGPmoY5bWqnxOVd0j', 'Hurker - Confident, Playful & Warm', 'Hurker - Confident, Playful & Warm'),
    ('WkcegOqOPWAl2ZRFBEaw', 'Dime - Conversational', 'Dime - Conversational'),
    ('5vDXugCfjV5wh807ijcC', 'Shelby - Warm, Calm & Magnetic', 'Shelby - Warm, Calm & Magnetic'),
]
CHOICES += AMERICAN_CHOICES

# Requested WoW character voices verified in Voice Library, 2026-11-16.
WOW_CHOICES = [
    ('NOpBlnGInO9m6vDvFkFC', 'Spuds Oxley - Grandpa', 'Spuds Oxley - Grandpa'),
    ('e0K1gavG8dJdPZiwQ7Np', 'Matthew Schmitz', 'Matthew Schmitz'),
    ('j9qIyycr9PcZ7d4yj21f', 'Grimble – Twitchy & Sneaky creature', 'Grimble – Twitchy & Sneaky creature'),
    ('KFcKSkKkWqMVhCbLkuvh', 'Kassandra  - Strange and Tricky', 'Kassandra  - Strange and Tricky'),
    ('chQx45TGebwefgePtdqT', 'Matthew Schmitz - Creepy Liminal Entity', 'Matthew Schmitz - Creepy Liminal Entity'),
    ('0SpgpJ4D3MpHCiWdyTg3', 'Matthew Schmitz - Elitist, Arrogant, Conniving Tyrant', 'Matthew Schmitz - Elitist, Arrogant, Conniving Tyrant'),
]
CHOICES += WOW_CHOICES

# Additional Matthew Schmitz variants requested 2026-11-16.
MATTHEW_CHOICES = [
    ('4Vl3K2x290GidNvuaLm7', 'Matthew Schmitz', 'Matthew Schmitz - Old Pirate Captain'),
    ('Ho7fjSHAC1BzucANXMRy', 'Matthew Schmitz', 'Matthew Schmitz - African Tribal Warrior'),
    ('dWi43pgmQOjZTMYtl9lg', 'Matthew Schmitz', 'Matthew Schmitz - Old Outlaw Cowboy'),
    ('4QLC5fepxZkYmdD2IGRU', 'Matthew Schmitz', 'Matthew Schmitz - Scriptures, Bible & Religious readings'),
    ('HAvvFKatz0uu0Fv55Riy', 'Matthew Schmitz', 'Matthew Schmitz - Ancient Sage Dragon Wizard'),
    ('xYWUvKNK6zWCgsdAK7Wi', 'Matthew Schmitz', 'Matthew Schmitz - Hissing and Sinister'),
    ('FYZl5JbWOAm6O1fPKAOu', 'Matthew Schmitz', 'Matthew Schmitz - Casual, Chill and Deep'),
    ('Tj9l48J9AJbry5yCP5eW', 'Matthew Schmitz', 'Matthew Schmitz - Ancient Vampire Lord'),
    ('Q4oILuo4P8VeXtE6FMLI', 'Matthew Schmitz', 'Matthew Schmitz - Warm Mountain Man'),
    ('JlPfrZoXeAKnNaogINHc', 'Matthew Schmitz', 'Matthew Schmitz - Robotic and Deadpan'),
    ('uCAKWh24Y93ESUjKwRGP', 'Matthew Schmitz', 'Matthew Schmitz - The Whispering Spirit of the Gentle Calm'),
    ('rCYFsCX2waxtHCgVD0e8', 'Matthew Schmitz', 'Matthew Schmitz - Unholy, Wicked Demon'),
    ('bwCXcoVxWNYMlC6Esa8u', 'Matthew Schmitz', 'Matthew Schmitz - Gravel, Deep Anti-Hero'),
    ('dWlo9A8YyLspmlvHk1dB', 'Matthew Schmitz', 'Matthew Schmitz - Late Night Mystic'),
    ('B52raBK48m23qWYbwchQ', 'Matthew Schmitz', 'Matthew Schmitz - Rich,Old Storyteller'),
    ('3nDq4c7a9Pk3q5rxbMJH', 'Matthew Schmitz', 'Matthew - Friendly, Warm and Resonant'),
    ('RDSy0QN68yhrjuOgqzQ4', 'Matthew Schmitz', 'Dr. Quibble - Nerdy Cartoon Scientist'),
]
CHOICES += MATTHEW_CHOICES

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
            preview=next((v.get('preview_url') for v in voice.get('verified_languages',[]) if v.get('language') in ([voice['language']] if voice.get('language') in ['en','de'] else ['hr','sr','bs']) and v.get('preview_url')),None) or voice.get('preview_url','')
            paid=tier is not None and tier!='free'
            language=voice.get('language','hr')
            label={'de':'njemački','bs':'bosanski','hr':'regionalni · hrvatski','sr':'regionalni · srpski','en':'američki · engleski' if voice.get('accent') == 'american' else 'engleski'}.get(language,language)
            voices.append({'id':identifier,'name':f'{name} · {label}','gender':voice.get('gender','voice'),'language':language,'description':voice.get('description',''),'previewUrl':preview,'available':paid,'reason':'' if paid else 'Za Voice Library preko API-ja potrebna je plaćena pretplata.' if tier=='free' else 'Status plana nije potvrđen. Ponovo učitaj glasove.'})
        return Response({'voices':voices,'tier':tier},headers={'Cache-Control':'no-store'})
    except (httpx.HTTPError,ValueError,TypeError,AttributeError):return Response({'error':'Regionalni glasovi trenutno nisu dostupni.'},status=502)
