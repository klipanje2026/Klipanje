"""Build Edita's Bosnian ArtBrush extension using only the supplied font outlines."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
root=Path(__file__).resolve().parents[1]
f=TTFont(root/'frontend/public/fonts/artbrush.ttf');gs=f.getGlyphSet();order=f.getGlyphOrder();cmap=f.getBestCmap();upm=f['head'].unitsPerEm

def bounds(name):
 p=BoundsPen(gs);gs[name].draw(p);return p.bounds

for char,base,accent in [('č','c','v'),('Č','C','v'),('ć','c',"'"),('Ć','C',"'"),('š','s','v'),('Š','S','v'),('ž','z','v'),('Ž','Z','v'),('đ','d','-'),('Đ','D','-')]:
 base=cmap[ord(base)];mark=cmap[ord(accent)];name='uni%04X'%ord(char)
 p=TTGlyphPen(gs);gs[base].draw(p);x0,y0,x1,y1=bounds(base);a0,b0,a1,b1=bounds(mark)
 target=(x1-x0)*(.42 if accent=='v' else .23 if accent=="'" else .65)
 scale=target/max(1,a1-a0);sy=min(scale,.28) if accent=='v' else scale
 dx=(x0+x1-(a0+a1)*scale)/2;dy=y1+upm*.035-b0*sy
 if accent=='-':dy=y0+(y1-y0)*.58-b0*sy
 gs[mark].draw(TransformPen(p,(scale,0,0,sy,dx,dy)));f['glyf'][name]=p.glyph();f['hmtx'][name]=f['hmtx'][base]
 if name not in order:order.append(name)
 for table in f['cmap'].tables:
  if table.isUnicode():table.cmap[ord(char)]=name
f.setGlyphOrder(order);f['maxp'].numGlyphs=len(order)
for rec in f['name'].names:
 if rec.nameID in [1,4,6]:
  value='ArtBrush Edita' if rec.nameID!=6 else 'ArtBrushEdita'
  rec.string=value.encode(rec.getEncoding())
f.save(root/'frontend/public/fonts/artbrush-bosnian.ttf')
print('Created ArtBrush Bosnian extension: 10 glyphs')
