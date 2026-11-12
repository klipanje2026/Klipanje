import re
import unicodedata


def video_filename(title, model_id, original=False):
    name = str(title).replace('đ', 'd').replace('Đ', 'D').strip()
    if name.lower().endswith('.mp4'):
        name = name[:-4]
    name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()
    name = re.sub(r'[^a-z0-9_.]+', '_', name).strip('_.')[:150] or 'scena'
    if '_video_' not in name:
        model = {'ltx25-dev': 'ltx2.5', 'ltx25-distilled': 'ltx2.5',
                 'ltx23-22b': 'ltx2.3', 'ltx-2b': 'ltx'}.get(model_id, model_id.replace('-', '_'))
        name += '_video_' + model
    return name + ('_original' if original else '') + '.mp4'
