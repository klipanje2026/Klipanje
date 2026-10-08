from django.test import TestCase,override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from .models import CaptionPreset,AffiliateProfile
from .billing import account
from django.utils import timezone
from datetime import timedelta

@override_settings(ACCESS_APPROVAL_REQUIRED=False)
class CaptionPresetTests(TestCase):
 def setUp(self):
  self.user=get_user_model().objects.create_user('creator')
  self.other=get_user_model().objects.create_user('other')
  self.admin=get_user_model().objects.create_user('admin',is_staff=True)
  self.client=APIClient();self.client.force_authenticate(self.user)
 def create(self):
  response=self.client.post('/api/caption-presets',{'name':'Moj stil','style':'clean','settings':{'fontScale':140,'textColor':'#ffffff','secondaryStyle':{'fontScale':120}}},format='json')
  self.assertEqual(response.status_code,201);return response.data['id']
 def test_private_ownership_and_persistent_portrait(self):
  pk=self.create();p=CaptionPreset.objects.get(pk=pk);self.assertIn(p.portrait,range(7))
  self.assertEqual(self.client.get('/api/caption-presets').data['presets'][0]['portrait'],p.portrait)
  self.client.force_authenticate(self.other)
  self.assertEqual(self.client.get('/api/caption-presets').data['presets'],[])
  self.assertEqual(self.client.post(f'/api/caption-presets/{pk}/propose').status_code,404)
 def test_neon_riot_collection_settings_round_trip(self):
  from .caption_presets import STYLES
  styles=[style for style in STYLES if style.startswith('neonRiot')]
  self.assertEqual(len(styles),20)
  settings={'riotColor2':'#ff4fc8','riotColor3':'#40edff','riotColor4':'#ffab47','riotColor5':'#a88bff','riotWords':3,'riotLetterDelay':.025,'riotMotion':'spring','riotMotionStrength':100,'riotParticles':True,'riotBoxes':True,'riotUnderline':True}
  for style in styles:
   with self.subTest(style=style):
    response=self.client.post('/api/caption-presets',{'name':style,'style':style,'settings':settings},format='json')
    self.assertEqual(response.status_code,201)
    saved=CaptionPreset.objects.get(pk=response.data['id'])
    self.assertEqual(saved.style,style)
    self.assertEqual(saved.settings,settings)
  response=self.client.post('/api/caption-presets',{'name':'Bad motion','style':'neonRiot','settings':{'riotMotion':'unknown'}},format='json')
  self.assertEqual(response.status_code,400)
 def test_proposal_review_and_publication(self):
  pk=self.create()
  self.assertEqual(self.client.post(f'/api/caption-presets/{pk}/propose').status_code,403)
  AffiliateProfile.objects.create(user=self.user)
  sub=account(self.user);sub.paid_until=timezone.now()+timedelta(days=10);sub.save()
  self.assertEqual(self.client.post(f'/api/caption-presets/{pk}/propose').status_code,200)
  self.assertEqual(self.client.get('/api/admin/caption-presets').status_code,403)
  self.assertEqual(self.client.post(f'/api/admin/caption-presets/{pk}/review',{'action':'publish'},format='json').status_code,403)
  self.client.force_authenticate(self.admin)
  self.assertEqual(len(self.client.get('/api/admin/caption-presets').data['presets']),1)
  self.assertEqual(self.client.post(f'/api/admin/caption-presets/{pk}/review',{'action':'publish','name':'Zajednički stil'},format='json').status_code,200)
  self.client.force_authenticate(self.other)
  self.assertEqual(self.client.get('/api/caption-presets').data['presets'][0]['name'],'Zajednički stil')
 def test_imported_collection_settings_round_trip(self):
  from .caption_presets import STYLES
  styles=[style for style in STYLES if style.startswith('collection')]
  self.assertGreaterEqual(len(styles),22)
  self.assertEqual(len(styles),len(set(styles)))
  settings={'collectionPalette':'mango','collectionFont':'bubble','collectionMark':'underline','collectionMaterial':'copper','collectionSpeed':1.2,'collectionDepth':1.35,'collectionPower':.8,'collectionDetail':1.1,'collectionDecorations':False,'collectionBackdrop':True}
  for style in styles:
   with self.subTest(style=style):
    response=self.client.post('/api/caption-presets',{'name':style,'style':style,'settings':settings},format='json')
    self.assertEqual(response.status_code,201,response.data)
    saved=CaptionPreset.objects.get(pk=response.data['id'])
    self.assertEqual(saved.style,style)
    self.assertEqual(saved.settings,settings)
  for invalid in ({'collectionDepth':'deep'},{'collectionBackdrop':'yes'}):
   response=self.client.post('/api/caption-presets',{'name':'Invalid','style':styles[0],'settings':invalid},format='json')
   self.assertEqual(response.status_code,400)
 def test_prism_fold_and_reusable_motion_round_trip(self):
  settings={'foldSlices':4,'foldWords':3,'foldStrength':100,'foldStagger':.045,'foldColor2':'#a98aff','foldBeamSpeed':1,'foldBeam':True,'foldEcho':True,'foldRim':True,'accentMotion':'flip','accentStrength':80,'accentDuration':.56,'accentTrails':True,'accentParticles':True,'accentColor':'#40edff','accentColor2':'#ff4fc8','accentTrailDistance':17,'accentParticleCount':18}
  response=self.client.post('/api/caption-presets',{'name':'Prism Fold','style':'prismFold','settings':settings},format='json')
  self.assertEqual(response.status_code,201)
  self.assertEqual(CaptionPreset.objects.get(pk=response.data['id']).settings,settings)
  response=self.client.post('/api/caption-presets',{'name':'Motion','style':'clean','settings':{'accentMotion':'unknown'}},format='json')
  self.assertEqual(response.status_code,400)
 def test_ink_impact_settings_round_trip(self):
  settings={'inkWords':3,'inkImpact':100,'inkGrain':60,'inkRoughness':65,'inkDrops':16,'inkSpread':100,'inkTilt':100,'inkRowGap':5,'inkExitDuration':.2,'inkBrush':True,'inkSplatter':True,'inkUnderline':True,'inkColor2':'#ff6e49','inkBrushTextColor':'#19151a'}
  response=self.client.post('/api/caption-presets',{'name':'Ink Impact','style':'inkImpact','settings':settings},format='json')
  self.assertEqual(response.status_code,201)
  self.assertEqual(CaptionPreset.objects.get(pk=response.data['id']).settings,settings)
  response=self.client.post('/api/caption-presets',{'name':'Wrong switch','style':'inkImpact','settings':{'inkBrush':'yes'}},format='json')
  self.assertEqual(response.status_code,400)
 def test_signature_styles_settings_round_trip(self):
  cases={
   'orbitSignal':{'orbitWords':3,'orbitEntry':100,'orbitSpeed':1,'orbitRadius':100,'orbitSatellites':2,'orbitGlow':50,'orbitRings':True,'orbitDashes':True,'orbitLeader':True,'orbitColor2':'#ffb573'},
   'velvetScript':{'velvetWords':3,'velvetFlourishWidth':105,'velvetWrite':True,'velvetPenGlow':True,'velvetFlourish':True,'velvetShadowColor':'#342034','scriptDrawDuration':.65},
  }
  for style,settings in cases.items():
   with self.subTest(style=style):
    response=self.client.post('/api/caption-presets',{'name':style,'style':style,'settings':settings},format='json')
    self.assertEqual(response.status_code,201,response.data)
    saved=CaptionPreset.objects.get(pk=response.data['id'])
    self.assertEqual(saved.style,style)
    self.assertEqual(saved.settings,settings)
  response=self.client.post('/api/caption-presets',{'name':'Invalid switch','style':'orbitSignal','settings':{'orbitRings':'yes'}},format='json')
  self.assertEqual(response.status_code,400)
 def test_admin_direct_publish_and_reject(self):
  self.client.force_authenticate(self.admin);pk=self.create()
  self.assertEqual(self.client.post(f'/api/admin/caption-presets/{pk}/review',{'action':'publish'},format='json').status_code,200)
  self.assertEqual(CaptionPreset.objects.get(pk=pk).status,'published')
 def test_invalid_settings_and_anonymous_access(self):
  for config in ({'fontScale': 'big'},{'fontScale':[]},{'unknown':1}):
   self.assertEqual(self.client.post('/api/caption-presets',{'name':'Test','style':'clean','settings':config},format='json').status_code,400)
  self.client.force_authenticate(None)
  self.assertEqual(self.client.get('/api/caption-presets').status_code,200)
  self.assertEqual(self.client.get('/api/caption-presets').data['presets'],[])
  self.assertIn(self.client.post('/api/caption-presets',{'name':'Guest','style':'clean','settings':{}},format='json').status_code,[401,403])

 def test_light_effect_settings_round_trip(self):
  settings={'shadowMode':'multiple','shadowColor':'#123456','shadowSecondColor':'#ff3344','shadowX':-12,'shadowY':8,'shadowBlur':4,'shadowOpacity':65,'shadowLength':75,'glowMode':'pulsing','glowColor':'#33ffaa','glowOpacity':80,'glowBlur':20,'glowSpeed':1.5,'textBlur':3,'secondaryStyle':{'shadowMode':'inner','glowMode':'inner'},'titleAppearance':{'glowMode':'rgb'}}
  response=self.client.post('/api/caption-presets',{'name':'Sjene i sjaj','style':'clean','settings':settings},format='json')
  self.assertEqual(response.status_code,201)
  self.assertEqual(CaptionPreset.objects.get(pk=response.data['id']).settings,settings)
  for field in ('shadowMode','glowMode'):
   response=self.client.post('/api/caption-presets',{'name':'Neispravan efekat','style':'clean','settings':{field:'unsupported'}},format='json')
   self.assertEqual(response.status_code,400)

 def test_texture_layout_settings_round_trip(self):
  settings={'fillTexture':'satin','fillTextureColor':'#223344','fillTextureColor2':'#ffaa33','fillTextureScale':150,'displayScale':125,'displaySkew':12,'displayArc':30,'displayWarp':10,'displayBend':15,'displayDistort':20,'displayPerspective':25,'displayStretch':110,'displayCompress':80,'tracking':2,'kerning':'normal','wordsPerLine':2,'displayWordCount':-1,'alignment':'justify','verticalAlignment':'top','secondaryStyle':{'fillTexture':'wood'},'titleAppearance':{'displayScale':150}}
  response=self.client.post('/api/caption-presets',{'name':'Advanced','style':'clean','settings':settings},format='json')
  self.assertEqual(response.status_code,201)
  self.assertEqual(CaptionPreset.objects.get(pk=response.data['id']).settings,settings)

 def test_reference_effects_and_backgrounds_round_trip(self):
  settings={'fillTexture':'goldReference','backgroundScope':'line','backgroundLook':'sketch','backgroundTexture':'paper','backgroundPaddingX':17,'backgroundBorderStyle':'triple','backgroundBorderWave':6,'backgroundDepth':12,'backgroundGlow':25,'captionFrame':True,'frameColor':'#88ccaa','frameCount':3,'frameWave':4,'scriptLineMode':'right','textUnderlineStyle':'script','secondaryStyle':{'fillTexture':'prism'}}
  response=self.client.post('/api/caption-presets',{'name':'Reference surfaces','style':'captionsScript','settings':settings},format='json')
  self.assertEqual(response.status_code,201,response.data)
  self.assertEqual(CaptionPreset.objects.get(pk=response.data['id']).settings,settings)
