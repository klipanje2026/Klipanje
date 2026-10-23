"""Deterministic project continuity expansion; never calls a provider."""
import re
import unicodedata


def normalize(text):
    return ''.join(c for c in unicodedata.normalize('NFD', str(text).casefold()) if not unicodedata.combining(c))


def mentioned(name, text):
    return bool(name and re.search(r'(?<!\w)'+re.escape(normalize(name))+r'(?!\w)', normalize(text)))


def continuity(brief, direction, narration=''):
    characters=brief.get('characters', [])
    scenes=brief.get('scenes', [])
    tokens=re.findall(r'\[Lik:\s*([^;\]]+)(?:;\s*Odjeća:\s*([^\]]+))?\]', direction, re.I)
    explicit={normalize(name.strip()):(outfit or '').strip() for name,outfit in tokens}
    for name in explicit:
        if not any(normalize(c.get('name',''))==name for c in characters):
            raise ValueError('Lik iz prečice više ne postoji. Ponovo ga odaberi u promptu.')
    result=[];references=[]
    for c in characters:
        name=c.get('name','');aliases=[name]+str(c.get('aliases','')).split(',')
        if name and ' ' not in name:
            aliases += [name[:-1]+suffix for suffix in ('e','i','u','om')] if name.endswith('a') else [name+suffix for suffix in ('a','u','om')]
        if not (normalize(name) in explicit or any(mentioned(a.strip(),direction+' '+narration) for a in aliases)):
            continue
        requested=explicit.get(normalize(name))
        outfit=None
        if requested:
            outfit=next((o for o in c.get('outfits',[]) if normalize(o.get('name',''))==normalize(requested)),None)
            if not outfit:raise ValueError('Odjevna kombinacija za '+name+' više ne postoji. Ponovo je odaberi.')
        elif requested is None:
            # Associate an outfit only with a clause naming this character.
            clauses=re.split(r'[.!?\n;,]', direction)
            # When several people share a clause, use the explicit shortcut instead
            # of transferring one person's wardrobe to the other.
            clauses=[part for part in clauses if not any(other is not c and (mentioned(other.get('name',''),part) or any(mentioned(alias.strip(),part) for alias in str(other.get('aliases','')).split(',') if alias.strip())) for other in characters)]
            matches=[o for o in c.get('outfits',[]) if any(any(mentioned(a.strip(),part) for a in aliases) and (mentioned(o.get('name',''),part) or (len([v for v in c.get('outfits',[]) if normalize(v.get('name','')).split()[:1]==normalize(o.get('name','')).split()[:1]])==1 and mentioned(o.get('name','').split()[0] if o.get('name','').split() else '',part))) for part in clauses)]
            if len(matches)==1:outfit=matches[0]
        result.append({'name':name,'appearance':c.get('appearance') or c.get('description',''),'personality':c.get('personality',''),'permanentPrompt':c.get('prompt',''),'clothing':outfit.get('description','') if outfit else c.get('clothing',''),'outfit':outfit.get('name','') if outfit else 'default'})
        references.extend(filter(None,[c.get('referenceId'),c.get('views',{}).get('body-front'),outfit.get('views',{}).get('body-front') if outfit else None]))
    selected=re.findall(r'\[Scena:\s*([^\]]+)\]',direction,re.I)
    if selected:
        scene=None if normalize(selected[-1].strip())=='bez' else next((s for s in scenes if normalize(s.get('name',''))==normalize(selected[-1].strip())),None)
        if scene is None and normalize(selected[-1].strip())!='bez':raise ValueError('Scena iz prečice više ne postoji. Ponovo je odaberi.')
    else:
        named=[s for s in scenes if mentioned(s.get('name',''),direction)]
        scene=named[0] if len(named)==1 else next((s for s in scenes if s.get('isDefault')),None)
    if scene and scene.get('referenceId'):references.append(scene['referenceId'])
    return result,scene,list(dict.fromkeys(references))
