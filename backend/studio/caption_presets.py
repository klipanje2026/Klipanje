import json, math, secrets
from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from .models import CaptionPreset
from .billing import paid_access

STYLES = ['scriptVerbatim','underlinedEditorial','curvyBackdrop','prismWords','trackingStack','metallicCompactV2','premiumOrangeV4','waveWords','terminalType','goldMesh','orbitGlow','tripleGothic','testSerif','captionsScript','smokeSerif','dynamicGlass','comicLetterBounce','sketchNote','lensFrame','vistaRise','popCollage','aeArtbrushSticker', 'goldBold', 'depthText', 'hightech', 'cyberTrack', 'brushTitle', 'slideFall', 'blurReading', 'editorialHeader', 'boldHeader', 'prismPop', 'mistWords', 'newsHighlight', 'bigKeyword', 'prism', 'verticalTitle', 'sweepTitle', 'readingFade', 'primeFrame', 'stackedHeadlines', 'paperCut', 'editorialLight', 'revealPop', 'revealRise', 'revealFade', 'revealLetters', 'wordUnderline', 'mixedFocus', 'behindPerson', 'clean', 'focus', 'word', 'karaoke', 'box', 'bounce', 'minimal', 'news', 'glow', 'marker', 'comic', 'cinema', 'retro', 'gradient', 'outline', 'bubble', 'neon', 'neonPink', 'cyber', 'threeD', 'sticker', 'chrome', 'fire', 'ice', 'typewriter', 'elegant', 'gaming', 'urgent', 'pastel', 'social', 'shadow', 'captionCard', 'duoElectric', 'duoSunshine', 'duoCherry', 'duoStrawberry', 'duoGrape', 'duoMint', 'duoTangerine', 'duoArctic', 'duoPink', 'duoPeach', 'duoContrast', 'duoBeat']
SETTING_TYPES = {'effectPlayback': ['hold', 'repeat'], 'effectIdle': ['float', 'shimmer', 'zoom', 'tilt', 'gradient', 'none'], 'effectIdleColor': 'string', 'allowOverflow': 'boolean', 'prismStrength': 'number', 'backgroundTitles': 'number', 'textDepth': 'number', 'textDepthColor': 'string', 'secondaryFontFamily': 'string', 'secondaryFontScale': 'number', 'reveal': ['slideLeft', 'zoom', 'softBlur', 'slideFall', 'none', 'pop', 'rise', 'fade', 'letters'], 'revealDuration': 'number', 'fadeFrom': 'number', 'underline': 'boolean', 'underlineColor': 'string', 'emphasisWord': 'number', 'behindPerson': 'boolean', 'textColor': 'string', 'highlightColor': 'string', 'fontFamily': 'string', 'fontScale': 'number', 'position': ['bottom', 'middle', 'top'], 'uppercase': 'boolean', 'alignment': ['left', 'center', 'right', 'justify'], 'outlineWidth': 'number', 'backgroundColor': 'string', 'backgroundOpacity': 'number', 'x': 'number', 'y': 'number', 'rotation': 'number', 'glowIntensity': 'number', 'glowRadius': 'number', 'effectDepth': 'number', 'outlineColor': 'string', 'outerOutlineColor': 'string', 'outerOutlineWidth': 'number', 'outlineGlow': 'boolean', 'outlineGlowColor': 'string', 'wordColorMode': ['solid', 'alternate', 'active', 'lines'], 'gradientAngle': 'number', 'letterSpacing': 'number', 'wordMode': ['template', 'single', 'all', 'spoken', 'highlight'], 'animation': ['none', 'pop', 'fade', 'pulse']}
SETTING_TYPES.update({'metallicMaterial':['auto','silver','red','orange'],'metallicZone':['mixed','top','bottom'],'metallicPhraseWords':'number','metallicHoldEnd':'boolean','metallicRed':'string','metallicSilver':'string','metallicShine':'number'})
SETTING_TYPES.update({'premiumEntrance':['mixed','upright','italic'],'premiumPhraseWords':'number'})
SETTING_TYPES.update({**{key:'number' for key in ['scriptWidth','scriptDrawDuration','sketchPen','sketchEllipseWidth','sketchMarkerOpacity','lensMotion','lensShotInterval','popSize','popInset','captionSoundVolume']},'fontWeight':'number','borderMist':'boolean','sketchMarker':'boolean','captionSound':['none','whoosh','pop','tick']})
SETTING_TYPES.update({'glassCamera':'boolean','glassIntensity':'number','glassAccentColor':'string','revealGroupSize':'number','textMaterial':['matte','metal','brushed','stone','satin'],'surfaceColor':'string','surfaceOpacity':'number','surfaceStrength':'number','surfaceBevel':'number','surfaceLightAngle':'number'})
SETTING_TYPES.update({'surfaceHighlight':'number','surfaceShadow':'number','shineMode':['none','sweep','double','diagonal','ripple'],'shineStrength':'number','shineSpeed':'number','shineWidth':'number','motionCurve':['linear','smooth','softStop','spring'],'textureBackground':'boolean','textureOpacity':'number','frostWidth':'number','frostHeight':'number','smokeSpread':'number','smokeDuration':'number'})
SETTING_TYPES.update({'typingUnit':['letters','words'],'waveStrength':'number'})
SETTING_TYPES.update({'glyphSmokeScale':'number','orbitBend':'number','faceTexture':['goldMesh']})
SETTING_TYPES.update({'textGradient':'boolean','textGradientStart':'string','textGradientEnd':'string'})
SETTING_TYPES.update({'fontWeight':'number','fontSizePx':'number','italic':'boolean','textUnderline':'boolean','textUnderlineStyle':['solid','dashed','dotted','double','marker','pencil'],'textUnderlineColor':'string','textUnderlineOffset':'number','textUnderlineWidth':'number','textOpacity':'number','customOutline':'boolean','outlineGradient':'boolean','outlineGradientEnd':'string','textGradientMiddle':'string','textGradientMode':['linear','radial','wave','rainbow'],'lineHeight':'number','wordSpacing':'number'})
SETTING_TYPES.update({'displayWordCount':'number','outlineStyle':['solid','double','dashed','dotted','neon','glow']})
SETTING_TYPES.update({'textStrike':'boolean','textStrikeStyle':['solid','dashed','dotted','double','marker','pencil'],'textStrikeColor':'string','textStrikeOffset':'number','textStrikeWidth':'number'})
SETTING_TYPES.update({'textUnderlineSkew':'number','textStrikeSkew':'number'})
SETTING_TYPES.update({'shadowMode':['none','drop','long','inner','soft','hard','colored','multiple'],'shadowColor':'string','shadowSecondColor':'string','shadowOpacity':'number','shadowX':'number','shadowY':'number','shadowBlur':'number','shadowLength':'number','glowMode':['none','outer','inner','neon','rgb','pulsing'],'glowColor':'string','glowOpacity':'number','glowBlur':'number','glowSpeed':'number','textBlur':'number'})
SETTING_TYPES.update({'shadowDirection':['same','opposed']})
SETTING_TYPES.update({'specialEffect':['none','glitch','distortion','melt','liquid','ink','paint','spray','graffiti','explosion','lightning','plasma','energy'],'specialEffectStrength':'number','specialEffectSpeed':'number','specialEffectColor':'string'})
SETTING_TYPES.update({**{key:'number' for key in ['depthLightStrength','depthLightAngle','depthTiltX','depthTiltY','depthShadow','depthShadowSoftness','depthRoughness','depthFocus','depthMotion']},**{key:'string' for key in ['depthFaceColor','depthSideColor','depthLightColor']}})
SETTING_TYPES.update({'textureAmount':'number','textureDetail':'number','textureSpeed':'number','depthMaterial':['plastic','glossyPlastic','mattePlastic','rubber','ceramic','glass','metal','gold','chrome'],'depthMode':['none','extrude','bevel','emboss','isometric','perspective','floating','metallic','glass'],'depthSize':'number','depthAngle':'number','depthReflection':'number'})
SETTING_TYPES.update({'fillTexture':['none', 'gold', 'silver', 'chrome', 'neonColor', 'duotone', 'glass', 'frostedGlass', 'crystalText', 'transparent', 'acrylic', 'iceGlass', 'pattern', 'texture', 'matte', 'metal', 'brushed', 'satin', 'marble', 'granite', 'stone', 'concrete', 'brick', 'wood', 'carbon', 'leather', 'denim', 'fabric', 'paper', 'vintagePaper', 'water', 'ocean', 'fire', 'lava', 'ice', 'snow', 'smoke', 'cloud', 'sand', 'mud', 'moss', 'grass', 'luxuryGold', 'blackGold', 'diamond', 'crystal', 'pearl', 'jewel', 'emerald', 'sapphire', 'ruby', 'hologram', 'cyberpunk', 'matrix', 'rgbSplit', 'digitalNoise', 'techGrid', 'scifiMetal', 'aiGlow', 'image', 'video','meshGradient','liquidGlass','holographicFoil','iridescent','oilSlick','aurora','chromeGradient','rgbShift','glassNeon','liquidMetal'],'fillTextureScale':'number','fillTextureColor':'string','fillTextureColor2':'string','fillTextureUrl':'string','fillTextureName':'string'})
SETTING_TYPES.update({**{key:'number' for key in ['displayScale','displaySkew','displayWarp','displayBend','displayArc','displayDistort','displayPerspective','displayStretch','displayCompress','tracking']},'kerning':['auto','normal','none']})
SETTING_TYPES.update({'wordsPerLine':'number','verticalAlignment':['top','middle','bottom']})
# Authored Neon Riot styles share the same saved-preset and project contract.
STYLES.extend(['neonRiot', 'neonRiotElectric', 'neonRiotAcid', 'neonRiotCandy', 'neonRiotFire', 'neonRiotIce', 'neonRiotLaser', 'neonRiotViolet', 'neonRiotSunset', 'neonRiotChrome', 'neonRiotRetro', 'neonRiotToxic', 'neonRiotOcean', 'neonRiotBubble', 'neonRiotSolar', 'neonRiotCyber', 'neonRiotMint', 'neonRiotInferno', 'neonRiotAurora', 'neonRiotPrism'])
SETTING_TYPES.update({
    **{key:'string' for key in ['riotColor2','riotColor3','riotColor4','riotColor5']},
    **{key:'number' for key in ['riotWords','riotLetterDelay','riotMotionStrength']},
    **{key:'boolean' for key in ['riotParticles','riotBoxes','riotUnderline']},
    'riotMotion':['spring','slide','wave','flip','zoom','glitch'],
})
SETTING_TYPES.update({'foldEntryOrder':['phrase','spoken']})
STYLES.append('prismFold')
SETTING_TYPES.update({
    **{key:'number' for key in ['foldWords','foldSlices','foldStrength','foldStagger','foldBeamSpeed']},
    'foldColor2':'string', **{key:'boolean' for key in ['foldBeam','foldRim','foldEcho']},
})
SETTING_TYPES.update({**{key:'number' for key in ['riotDamping', 'riotFrequency', 'riotTilt', 'riotFloat', 'riotTrailStrength', 'riotParticleCount', 'riotSpread', 'riotParticleDuration', 'riotExitDuration', 'riotUnderlineWidth', 'riotUnderlineDuration', 'riotBoxRadius', 'riotGlow', 'accentStrength', 'accentDuration', 'accentTrailDistance', 'accentParticleCount']},**{key:'boolean' for key in ['riotTrails', 'riotGradient', 'accentTrails', 'accentParticles']},**{key:'string' for key in ['riotTrailColor1', 'riotTrailColor2', 'accentColor', 'accentColor2']},'accentMotion':['none','spring','slide','wave','flip','zoom','glitch']})
STYLES.append('inkImpact')
SETTING_TYPES.update({**{key:'number' for key in ['inkWords', 'inkImpact', 'inkGrain', 'inkRoughness', 'inkDrops', 'inkSpread', 'inkTilt', 'inkRowGap', 'inkExitDuration']},**{key:'boolean' for key in ['inkBrush', 'inkSplatter', 'inkUnderline']},**{key:'string' for key in ['inkColor2', 'inkBrushTextColor']}})
STYLES.extend(['orbitSignal','velvetScript'])
SETTING_TYPES.update({**{key:'number' for key in ['orbitWords', 'orbitEntry', 'orbitSpeed', 'orbitRadius', 'orbitSatellites', 'orbitGlow', 'velvetWords', 'velvetFlourishWidth']},**{key:'boolean' for key in ['orbitRings', 'orbitDashes', 'orbitLeader', 'velvetWrite', 'velvetPenGlow', 'velvetFlourish']},**{key:'string' for key in ['orbitColor2', 'velvetShadowColor']}})
STYLES.extend(['collectionHyperMarks', 'collectionHyperPop', 'collectionJuiceJam', 'collectionPrismBloom', 'collectionInkRiot', 'collectionForged', 'collectionAtelierNoir', 'collectionRealityRift', 'collectionTitaniumEdge', 'collectionMagmaCore', 'collectionAbyssalPearl', 'collectionPaperSculpt', 'collectionVelvetPulse', 'collectionPorcelainFlow', 'collectionLaserTrace', 'collectionFusionCaps', 'collectionDepth', 'collectionKaraoke', 'collectionCinema', 'collectionNeon', 'collectionPopPunch', 'collectionGlass'])
SETTING_TYPES.update({**{key:"string" for key in ["collectionPalette","collectionFont","collectionMark","collectionMaterial"]},**{key:"number" for key in ["collectionSpeed","collectionDepth","collectionPower","collectionDetail"]},**{key:"boolean" for key in ["collectionDecorations","collectionBackdrop"]}})
STYLES.extend(['collectionSatinImpact', 'collectionSlateFold', 'collectionStrata', 'collectionContourRecoil', 'collectionMosaicCurrent', 'collectionWaterform', 'collectionLavaflow', 'collectionSilkTorsion', 'collectionCrystalFlux'])
SETTING_TYPES['collectionColors']='string'
# Studio collection imported from the 2026-10-05 source folder.
STYLES.extend(['collectionStudioChromaLoop', 'collectionStudioFlipcore', 'collectionStudioWarpJam', 'collectionStudioParallax', 'collectionStudioPleat', 'collectionStudioQuanta', 'collectionStudioUnwind', 'collectionStudioRicochet', 'collectionStudioShutter', 'collectionStudioSwerve', 'collectionStudioFolio', 'collectionStudioSplice', 'collectionStudioOpticPoetry', 'collectionStudioNewWorld', 'collectionStudioLustreCut', 'collectionStudioPowerForge', 'collectionStudioPowerOpal', 'collectionStudioPowerArmor', 'collectionStudioPowerGel', 'collectionStudioPowerPrism', 'collectionStudioFormHalo', 'collectionStudioFormTalk', 'collectionStudioFormFold', 'collectionStudioFormChain', 'collectionStudioFormSketch', 'collectionStudioChromaEdge', 'collectionStudioChromaVelvet', 'collectionStudioChromaMono', 'collectionStudioChromaTidal', 'collectionStudioChromaPulp', 'collectionStudioMotionPass', 'collectionStudioMotionSun', 'collectionStudioMotionWoven', 'collectionStudioMotionBridge', 'collectionStudioMotionTicket', 'collectionStudioKineticAnchor', 'collectionStudioKineticOffset', 'collectionStudioKineticOrbit', 'collectionStudioKineticStep', 'collectionStudioKineticInk', 'collectionStudioAmplifyFlex', 'collectionStudioAmplifyRiso', 'collectionStudioAmplifyFold', 'collectionStudioAmplifyGlass', 'collectionStudioAmplifyDrive', 'collectionStudioAmplifyPunch', 'collectionStudioAmplifyRelay', 'collectionStudioAmplifyDouble', 'collectionStudioAmplifyTrace', 'collectionStudioAmplifyWild', 'collectionStudioSpeakerCutline', 'collectionStudioSpeakerEcho', 'collectionStudioSpeakerMarker', 'collectionStudioSpeakerSidenote', 'collectionStudioSpeakerFrame', 'collectionStudioColorDuotone', 'collectionStudioColorPigment', 'collectionStudioColorLuma', 'collectionStudioFinishRipline', 'collectionStudioFinishUpshift', 'collectionStudioFinishCarbon', 'collectionStudioFinishReel', 'collectionStudioFinishStacktrace', 'collectionStudioFinishSidewinder', 'collectionStudioFinishStamp', 'collectionStudioFinishGlasswire', 'collectionStudioFinishSpeednote', 'collectionStudioFinishPinstripe', 'collectionStudioCutRipline', 'collectionStudioCutUpshift', 'collectionStudioCutCarbon', 'collectionStudioCutReel', 'collectionStudioCutStacktrace', 'collectionStudioCutSidewinder', 'collectionStudioCutStamp', 'collectionStudioCutGlasswire', 'collectionStudioCutSpeednote', 'collectionStudioCutPinstripe', 'collectionStudioPortraitSlash', 'collectionStudioPortraitBloom', 'collectionStudioPortraitSwitch', 'collectionStudioPortraitAfterimage', 'collectionStudioPortraitScribble', 'collectionStudioLiquidImpact', 'collectionStudioMegaGloss', 'collectionStudioMegaPixel', 'collectionStudioMegaAcid', 'collectionStudioMegaJelly', 'collectionStudioMegaHolo', 'collectionStudioQuietSubframe', 'collectionStudioQuietPostmark', 'collectionStudioQuietOrbit', 'collectionStudioQuietTape', 'collectionStudioQuietGarden', 'collectionStudioQuietChat', 'collectionStudioQuietContour', 'collectionStudioQuietFocus', 'collectionStudioQuietTideline', 'collectionStudioQuietPulse', 'collectionStudioBusinessBoardroom', 'collectionStudioBusinessEditorial', 'collectionStudioBusinessMemo', 'collectionStudioBusinessLedger', 'collectionStudioBusinessPivot', 'collectionStudioCrystalGlass', 'collectionStudioLuxuryStone', 'collectionStudioLuxurySilk', 'collectionStudioLuxuryPaper', 'collectionStudioLuxuryWood', 'collectionStudioLuxuryGlass', 'collectionStudioMeadowType'])
SETTING_TYPES.update({key:'number' for key in ['collectionTexture','collectionShine','collectionEffects','collectionBlur']})
# Editable prototypes in the Test library use the same caption settings schema.
STYLES.extend(["testTypeIvory","testTypeTerminal","testTypeRibbon","testNeonCyan","testNeonRose","testNeonLime","testGlowHoney","testGlowArctic","testGlowLavender","testCinemaIvory","testCinemaNoir","testCinemaGold","testElectricLemon","testCherryBubble","testMintBubble","testInkCard","testCobaltMarker","testCoralPaper","testPopCoral","testRiseTeal","testWordPulse","testUnderlineGold","testKaraokeMango","testRetroPeach","testFocusIce"])
STYLES.extend(['testSlateLabel','testTangerineStamp','testGlassPearl','testMarginNote','testCyanOutline'])
class PresetInput(serializers.Serializer):
    name = serializers.CharField(max_length=80)
    style = serializers.ChoiceField(choices=STYLES)
    settings = serializers.JSONField()
    def validate_settings(self, value):
        if not isinstance(value, dict) or len(json.dumps(value)) > 16000:
            raise serializers.ValidationError('Postavke predloška nisu ispravne.')
        def check(data, depth=0):
            for key, item in data.items():
                if key in ('secondaryStyle', 'titleAppearance') and depth == 0 and isinstance(item, dict):
                    check(item, 1)
                elif key == 'outlineLayers':
                    if not isinstance(item, list) or len(item) > 6:
                        raise serializers.ValidationError('Najviše šest obruba.')
                    for layer in item:
                        if not isinstance(layer, dict) or not {'color','width'} <= set(layer) or set(layer) - {'color','width','gradient','endColor','style'} or not isinstance(layer['color'], str) or len(layer['color']) > 40 or isinstance(layer['width'], bool) or not isinstance(layer['width'], (int,float)) or not math.isfinite(layer['width']) or not 0 <= layer['width'] <= 48 or ('style' in layer and layer['style'] not in ['solid','double','dashed','dotted','neon','glow']) or ('gradient' in layer and not isinstance(layer['gradient'],bool)) or ('endColor' in layer and (not isinstance(layer['endColor'],str) or len(layer['endColor']) > 40)):
                            raise serializers.ValidationError('Neispravan obrub.')
                elif key not in SETTING_TYPES:
                    raise serializers.ValidationError('Nepoznata postavka.')
                elif (isinstance(SETTING_TYPES[key],list) and item not in SETTING_TYPES[key]) or (SETTING_TYPES[key]=='number' and (isinstance(item,bool) or not isinstance(item,(int,float)))) or (SETTING_TYPES[key]=='boolean' and not isinstance(item,bool)) or (SETTING_TYPES[key]=='string' and not isinstance(item,str)):
                    raise serializers.ValidationError('Neispravan tip postavke.')
                elif not isinstance(item, (str, int, float, bool)) or (isinstance(item, str) and len(item)>500) or (isinstance(item, (int,float)) and not math.isfinite(item)):
                    raise serializers.ValidationError('Neispravna vrijednost postavke.')
        check(value)
        return value

def payload(p):
    return {'id':str(p.id),'name':p.name,'style':p.style,'settings':p.settings,'portrait':p.portrait,'status':p.status,'owner':p.owner_id,'username':p.owner.username}

@api_view(['GET','POST'])
@permission_classes([IsAuthenticatedOrReadOnly])
def presets(request):
    if request.method == 'POST':
        checked=PresetInput(data=request.data);checked.is_valid(raise_exception=True)
        p=CaptionPreset.objects.create(owner=request.user,portrait=secrets.randbelow(7),**checked.validated_data)
        return Response(payload(p),status=201)
    rows=CaptionPreset.objects.filter((Q(owner=request.user)|Q(status='published')) if request.user.is_authenticated else Q(status='published')).select_related('owner').order_by('-created_at')
    return Response({'presets':[payload(p) for p in rows]})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def propose(request, pk):
    p=get_object_or_404(CaptionPreset,pk=pk,owner=request.user)
    affiliate=getattr(request.user,'affiliate',None)
    if not (request.user.is_staff or (affiliate and affiliate.active and paid_access(request.user))):
        return Response({'error':'Predlaganje je dostupno affiliatorima i administratorima.'},status=403)
    if p.status not in ('private','rejected'):
        return Response({'error':'Predložak je već poslan ili objavljen.'},status=400)
    p.status='proposed';p.save(update_fields=['status'])
    return Response(payload(p))

@api_view(['GET'])
@permission_classes([IsAdminUser])
def proposed(request):
    rows=CaptionPreset.objects.filter(status='proposed').select_related('owner').order_by('created_at')
    return Response({'presets':[payload(p) for p in rows]})

@api_view(['POST'])
@permission_classes([IsAdminUser])
def review(request, pk):
    p=get_object_or_404(CaptionPreset,pk=pk)
    action=request.data.get('action')
    if action not in ('publish','reject'):
        return Response({'error':'Nepoznata radnja.'},status=400)
    if p.status!='proposed' and p.owner_id!=request.user.id:
        return Response({'error':'Predložak nije predložen za pregled.'},status=403)
    name=request.data.get('name',p.name)
    if not isinstance(name,str) or not name.strip() or len(name)>80:
        return Response({'error':'Upiši naziv do 80 znakova.'},status=400)
    p.name=name.strip();p.status='published' if action=='publish' else 'rejected';p.save(update_fields=['name','status'])
    return Response(payload(p))

SETTING_TYPES.update({'backgroundScope':['none','caption','line','active'],'backgroundPaddingX':'number','backgroundPaddingY':'number','backgroundRadius':'number'})

SETTING_TYPES.update({'backgroundLook':['solid','gradient','glass','marker','outline','raised'],'backgroundTexture':SETTING_TYPES['fillTexture'],**{key:'string' for key in ['backgroundColor2','backgroundGlowColor','backgroundBorderColor','backgroundDepthColor']},**{key:'number' for key in ['backgroundAngle','backgroundTextureScale','backgroundTextureAmount','backgroundShadow','backgroundShadowBlur','backgroundGlow','backgroundBorderWidth','backgroundDepth']}})

SETTING_TYPES['fillTexture'] += ['goldReference','prism']
SETTING_TYPES['scriptLineMode']=['full','right']

SETTING_TYPES['textUnderlineStyle'].append('script')
SETTING_TYPES['textStrikeStyle'].append('script')

SETTING_TYPES['backgroundLook']+=['sketch','paperCut']
SETTING_TYPES.update({'backgroundBorderStyle':['single','double','triple'],'backgroundBorderWave':'number'})

SETTING_TYPES.update({'captionFrame':'boolean',**{key:'number' for key in ['frameCount','frameWidth','frameInset','frameWave']}})

SETTING_TYPES['frameColor']='string'
