"""Compose missing Bosnian C accents from the font's own outlines. Requires fontTools."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.transformPen import TransformPen

root = Path(__file__).resolve().parents[1]
font = TTFont(root / 'frontend/public/fonts/black-slabbath.otf')
glyphs = font.getGlyphSet()
top = font['CFF '].cff.topDictIndex[0]
order = font.getGlyphOrder()

def bounds(name):
    pen = BoundsPen(glyphs)
    glyphs[name].draw(pen)
    return pen.bounds

for char, base, accent, name in [('č','c','caron','ccaron'),('Č','C','caron','Ccaron'),
                                  ('ć','c','acute','cacute'),('Ć','C','acute','Cacute')]:
    bx0, by0, bx1, by1 = bounds(base)
    ax0, ay0, ax1, ay1 = bounds(accent)
    width, bearing = font['hmtx'][base]
    pen = T2CharStringPen(width - top.Private.nominalWidthX, glyphs)
    glyphs[base].draw(pen)
    dx = (bx0 + bx1 - ax0 - ax1) / 2
    dy = by1 + font['head'].unitsPerEm * .035 - ay0
    glyphs[accent].draw(TransformPen(pen, (1, 0, 0, 1, dx, dy)))
    charstring = pen.getCharString(private=top.Private, globalSubrs=font['CFF '].cff.GlobalSubrs)
    if top.CharStrings.charStringsAreIndexed:
        top.CharStrings.charStrings[name] = len(top.CharStrings.charStringsIndex)
        top.CharStrings.charStringsIndex.append(charstring)
    else:
        top.CharStrings[name] = charstring
    order.append(name)
    font['hmtx'][name] = (width, bearing)
    for table in font['cmap'].tables:
        if table.isUnicode():
            table.cmap[ord(char)] = name
# Inherit original c/C kerning for the added accented forms.
from copy import deepcopy
aliases = {'c':['ccaron','cacute'], 'C':['Ccaron','Cacute']}
for table in font['kern'].kernTables:
    for (left,right),value in list(table.kernTable.items()):
        for a in [left]+aliases.get(left,[]):
            for b in [right]+aliases.get(right,[]):
                table.kernTable[a,b]=value
for lookup in font['GPOS'].table.LookupList.Lookup:
    if lookup.LookupType != 2:
        continue
    for table in lookup.SubTable:
        if table.Format == 2:
            for base, names in aliases.items():
                for name in names:
                    if base in table.Coverage.glyphs:
                        table.Coverage.glyphs.append(name)
                    for classes in [table.ClassDef1.classDefs,table.ClassDef2.classDefs]:
                        if base in classes:
                            classes[name]=classes[base]
        elif table.Format == 1:
            for pairset in table.PairSet:
                for pair in list(pairset.PairValueRecord):
                    for name in aliases.get(pair.SecondGlyph,[]):
                        copy=deepcopy(pair);copy.SecondGlyph=name;pairset.PairValueRecord.append(copy)
                pairset.PairValueCount=len(pairset.PairValueRecord)
            for base,names in aliases.items():
                if base in table.Coverage.glyphs:
                    pairset=table.PairSet[table.Coverage.glyphs.index(base)]
                    for name in names:
                        table.Coverage.glyphs.append(name);table.PairSet.append(deepcopy(pairset))
            table.PairSetCount=len(table.PairSet)
for lookup in font['GPOS'].table.LookupList.Lookup:
    if lookup.LookupType != 2:
        continue
    for table in lookup.SubTable:
        if table.Format == 1:
            pairs = sorted(zip(table.Coverage.glyphs, table.PairSet), key=lambda item: order.index(item[0]))
            table.Coverage.glyphs = [item[0] for item in pairs]
            table.PairSet = [item[1] for item in pairs]
            for pairset in table.PairSet:
                pairset.PairValueRecord.sort(key=lambda pair: order.index(pair.SecondGlyph))
        else:
            table.Coverage.glyphs.sort(key=order.index)
font.setGlyphOrder(order)
top.charset = order
font['maxp'].numGlyphs = len(order)
font.save(root / 'frontend/public/fonts/black-slabbath-latin.otf')
