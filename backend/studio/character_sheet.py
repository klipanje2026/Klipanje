"""A single generated sheet; all five reference crops are made locally."""
import struct
import subprocess
from uuid import uuid4
import imageio_ffmpeg
from django.core.files.base import ContentFile
from django.db import transaction
from .models import MediaAsset

# Rectangles on a 1536 x 1024 landscape sheet; bodies are exactly 9:16.
SHEET_BOXES = {
    'head-front': [96, 24, 384, 384],
    'head-side': [576, 24, 384, 384],
    'head-back': [1056, 24, 384, 384],
    'body-front': [372, 432, 324, 576],
    'body-back': [840, 432, 324, 576],
}
SHEET_LAYOUT = ('Generate ONE 1536x1024 landscape character reference sheet, exactly five isolated views of the SAME character. '
    'Plain neutral background, no text, no borders or decorations. Use the following exact pixel regions (x,y,width,height): '
    'head front (96,24,384,384), head strict side profile (576,24,384,384), head back (1056,24,384,384), '
    'full body front (372,432,324,576), full body back (840,432,324,576). '
    'Keep every head including ears/hair/hat inside its square, every full body including feet/tail/accessories inside its tall rectangle, '
    'with 8% clear margin within each region. Regions outside these boxes stay blank. '
    'Same identity, clothing, proportions, rendering and scale across matching views. No additional characters or views.')

def png_size(raw):
    if len(raw)<24 or raw[:8]!=b'\x89PNG\r\n\x1a\n':
        raise ValueError('Izvorni list nije ispravan PNG.')
    width,height=struct.unpack('>II',raw[16:24])
    if min(width,height)<32 or width*height>16777216:
        raise ValueError('Dimenzije lista nisu podržane.')
    return width,height

def default_boxes(width,height):
    result={}
    for view,(x,y,w,h) in SHEET_BOXES.items():
        unit=max(1,int(min(w*width/1536/(9 if view.startswith('body') else 1),h*height/1024/(16 if view.startswith('body') else 1))))
        cw,ch=(unit*9,unit*16) if view.startswith('body') else (unit,unit)
        result[view]=[round(x*width/1536),round(y*height/1024),cw,ch]
    return result

def crop_sheet(sheet,boxes=None):
    with sheet.file.open('rb') as source: raw=source.read()
    width,height=png_size(raw)
    boxes=boxes or default_boxes(width,height)
    if set(boxes)!=set(SHEET_BOXES): raise ValueError('Potrebno je svih pet izreza.')
    for view,box in boxes.items():
        if not isinstance(box,list) or len(box)!=4 or any(type(v)!=int for v in box): raise ValueError('Neispravan okvir izreza.')
        x,y,w,h=box
        if min(x,y)<0 or min(w,h)<16 or x+w>width or y+h>height: raise ValueError('Izrez mora ostati unutar slike.')
        if (view.startswith('head') and w!=h) or (view.startswith('body') and w*16!=h*9): raise ValueError('Glava mora biti 1:1, tijelo 9:16.')
    images=[]
    for view,(x,y,w,h) in boxes.items():
        result=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-threads','1','-i','pipe:0','-vf',f'crop={w}:{h}:{x}:{y}','-frames:v','1','-threads','1','-f','image2pipe','-vcodec','png','pipe:1'],input=raw,capture_output=True,timeout=30,check=True)
        if png_size(result.stdout)!=(w,h):raise ValueError('Izrez nema očekivane dimenzije.')
        images.append((view,result.stdout))
    saved=[]
    try:
        with transaction.atomic():
            for view,image in images:
                asset=MediaAsset(project=sheet.project,name=f'lik-{view}-{uuid4().hex[:8]}.png',content_type='image/png',size=len(image),metadata={
                    'purpose':'reference','characterId':sheet.metadata['characterId'],'outfitId':'','view':view,
                    'sheetId':str(sheet.pk),'cropBox':boxes[view],'aspect':'1:1' if view.startswith('head') else '9:16',
                    'model':sheet.metadata.get('model'),'estimatedUsd':0,'localCrop':True})
                asset.file.save(asset.name,ContentFile(image),save=False);saved.append(asset);asset.save()
            sheet.metadata={**sheet.metadata,'cropBoxes':boxes,'sheetWidth':width,'sheetHeight':height}
            sheet.save(update_fields=['metadata'])
    except Exception:
        for asset in saved:asset.file.delete(save=False)
        raise
    return saved,boxes,width,height
