from decimal import Decimal, ROUND_UP

# Public list prices checked 2026-10-26. Estimates are NOT Modal invoices.
GPU_RATES = {'L4': 0.000222, 'A10': 0.000306, 'L40S': 0.000542, 'A100-40GB':0.000583, 'A100-80GB': 0.000694, 'RTX-PRO-6000': 0.000842, 'B200':0.001736,'H100-SXM5':0.001097}
GPU_VRAM = {'L4': 24, 'A10': 24, 'L40S': 48, 'A100-40GB':40, 'A100-80GB': 80, 'RTX-PRO-6000': 96, 'B200':180,'H100-SXM5':80}
CPU_RATE = 0.0000131
RAM_RATE = 0.00000222
TIMEOUT_SECONDS = 900
OVERHEAD_SECONDS = 180
MODELS = [
    {'id': 'wan21-1.3b', 'name': 'Wan 2.1', 'variant': '1.3B · Economy', 'label': 'Najštedljiviji početak', 'gpu': 'L4', 'vram': 24, 'ram': 48, 'cpu': 2, 'resolution': '832 × 480', 'fps': 16, 'steps': 30, 'enabled': True, 'image': False, 'audio': False, 'quality': 'Skice pokreta i kratke animirane scene. Manji model; detalji mogu biti slabiji.', 'repo': 'Wan-AI/Wan2.1-T2V-1.3B-Diffusers', 'source': 'https://github.com/Wan-Video/Wan2.1', 'runtime_hint': 'Brzina se mjeri prvim GPU testom.'},
    {'id': 'wan22-5b', 'name': 'Wan 2.2', 'variant': '5B · Balanced', 'label': 'Za tvoje likove', 'gpu': 'L40S', 'vram': 48, 'ram': 64, 'cpu': 2, 'resolution': '1280 × 704', 'fps': 24, 'steps': 30, 'enabled': True, 'image': True, 'audio': False, 'quality': 'Tekst ili početna slika. Dobar kandidat za zadržavanje izgleda animiranog lika.', 'repo': 'Wan-AI/Wan2.2-TI2V-5B-Diffusers', 'source': 'https://github.com/Wan-Video/Wan2.2', 'runtime_hint': 'Na testnom kadru od 5 s: A100 sa 15 koraka oko 3 min, sa 30 oko 5 min GPU posla. Pokretanje i čekanje dolaze dodatno.'},
    {'id': 'ltx-2b', 'name': 'LTX-Video', 'variant': '2B · Distilled 0.9.6', 'label': 'Brze probe iz slike', 'gpu': 'L40S', 'vram': 48, 'ram': 32, 'preparation_ram': 48, 'cpu': 2, 'resolution': '1280 × 704', 'fps': 24, 'steps': 8, 'enabled': True, 'image': True, 'audio': False, 'quality': 'Brze probe iz početne slike, uz 8 propisanih koraka. Novi I2V profil testiran je na hodanju i zagrljaju; početna poza i kadriranje su važni.', 'source': 'https://github.com/Lightricks/LTX-Video', 'runtime_hint': 'Nove scene od 5 s: L40S I2V oko 24–28 s GPU posla. Raniji A10 profil: 73 s. Pokretanje i priprema dolaze dodatno.'},
    {'id':'hunyuan15-step','name':'HunyuanVideo 1.5','variant':'8.3B · Step Distilled','label':'Eksperimentalno · 480p', 'gpu':'RTX-PRO-6000','vram':96,'ram':64,'preparation_ram':96,'cpu':2,'resolution':'832 × 480','fps':24,'steps':8,'min_steps':8,'max_steps':12,'step_options':[8,12],'enabled':True,'image':True,'audio':False,'quality':'Eksperimentalni image-to-video profil, 8 ili 12 koraka. Kvalitet i cijena se provjeravaju na tvojim scenama.','source':'https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5','runtime_hint':'Isti 5 s zagrljaj: RTX PRO 6000 / 8 koraka oko 155 s i $0.159; L40S 239 s / $0.164; A10 577 s / $0.275. RTX drži model u GPU memoriji.'},
    {'id':'lightx-wan22','name':'Wan 2.2 + LightX2V','variant':'A14B · 4-step LoRA','label':'Eksperimentalno · 480p','gpu':'RTX-PRO-6000','vram':96,'ram':96,'preparation_ram':96,'cpu':2,'resolution':'848 × 480','fps':24,'steps':4,'min_steps':4,'max_steps':4,'step_options':[4],'enabled':True,'image':True,'audio':False,'quality':'Wan A14B sa službenim LightX2V adapterima za 4 koraka, preko Diffusersa. Ovo ne koristi native LightX2V engine.','source':'https://huggingface.co/lightx2v/Wan2.2-Distill-Loras','runtime_hint':'Pripremljen 5 s profil: RTX PRO 6000 oko 115 s i $0.123 resursa; L40S 192 s / $0.154. RTX drži oba eksperta u GPU memoriji. Prva CPU priprema je zasebna.'},
    {'id':'ltx23-22b','name':'LTX-2.3','variant':'22B · Distilled 1.1 · 8+3','label':'Za kratke scene','gpu':'H100-SXM5','vram':80,'ram':128,'preparation_ram':128,'cpu':2,'resolution':'1024 × 576','fps':24,'steps':8,'min_steps':8,'max_steps':8,'step_options':[8],'enabled':True,'image':True,'audio':True,'quality':'Novi native image-to-video profil sa zvukom. Osam osnovnih koraka i tri koraka dorade u većoj rezoluciji. Testiran na realističnim, akcijskim i anime scenama.','source':'https://huggingface.co/Lightricks/LTX-2.3','runtime_hint':'Ista scena pucanja 5 s: RTX PRO 6000 91.5 s / $0.109, H100 102 s / $0.146 izmjerenih resursa, bez svih troškova pokretanja. Native 8+3 koraka. Detaljan pregled je u Analizi testova.'},
    {'id': 'ltx25-dev', 'name': 'LTX-2.5 Dev', 'variant': '22B · Guided Dev', 'label': 'Pripremljen · čeka test', 'gpu': 'RTX-PRO-6000', 'vram': 96, 'ram': 128, 'preparation_ram': 128, 'cpu': 2, 'resolution': '1024 × 576', 'fps': 24, 'steps': 30, 'min_steps': 20, 'max_steps': 40, 'step_options': [20, 30, 40], 'enabled': True, 'image': True, 'audio': True, 'quality': 'Početna i opcionalna završna slika. BF16 i CPU offload. Kvalitet kontakta i brzina još nisu izmjereni.', 'source': 'https://huggingface.co/Lightricks/LTX-2.5', 'runtime_hint': 'Za prvu generaciju potreban je Hugging Face pristup. Priprema težina je zasebna; cijena po videu još nije izmjerena.'},
    {'id': 'ltx25-distilled', 'name': 'LTX-2.5 Distilled', 'variant': '22B · Distilled · 8+3', 'label': 'Pripremljen · čeka test', 'gpu': 'RTX-PRO-6000', 'vram': 96, 'ram': 128, 'preparation_ram': 128, 'cpu': 2, 'resolution': '1024 × 576', 'fps': 24, 'steps': 8, 'min_steps': 8, 'max_steps': 8, 'step_options': [8], 'enabled': True, 'image': True, 'audio': True, 'quality': 'Početna i opcionalna završna slika. BF16 i CPU offload. Kvalitet kontakta i brzina još nisu izmjereni.', 'source': 'https://huggingface.co/Lightricks/LTX-2.5', 'runtime_hint': 'Za prvu generaciju potreban je Hugging Face pristup. Priprema težina je zasebna; cijena po videu još nije izmjerena.'},
    {'id': 'h3', 'name': 'MiniMax H3', 'variant': 'Base · 768p', 'label': 'Kasniji test · jedan GPU', 'gpu': 'RTX-PRO-6000', 'vram': 96, 'ram': 128, 'cpu': 4, 'resolution': '768p', 'fps': 24, 'steps': 30, 'enabled': False, 'image': True, 'audio': True, 'quality': 'Veći model sa zvukom. Jedan RTX PRO 6000 je kandidat za optimiziranu konfiguraciju, još nije potvrđen ovdje.', 'source': 'https://github.com/MiniMax-AI/MiniMax-H3', 'runtime_hint': 'Zahtijeva zasebno podešavanje i test memorije.'},
]

def get_model(model_id):
    return next((m for m in MODELS if m['id'] == model_id), None)

def allowed_gpus(model):
    if model['id'] in ['ltx25-dev','ltx25-distilled']:return ['RTX-PRO-6000']
    if model['id']=='ltx23-22b':return ['H100-SXM5','RTX-PRO-6000','B200']
    if model['id']=='lightx-wan22':return ['A10','L40S','A100-40GB','RTX-PRO-6000']
    if model['id']=='hunyuan15-step':return ['A100-80GB','L40S','A10','RTX-PRO-6000']
    return ['L4', 'A10', 'L40S'] if model['id'] == 'ltx-2b' else ['A10', 'L40S', 'A100-80GB', 'RTX-PRO-6000'] if model['id'] == 'wan22-5b' else [model['gpu']]

def gpu_ram(model,gpu=None):
    gpu=gpu or model['gpu']
    if model['id']=='hunyuan15-step' and gpu=='L40S':return 48
    return 80 if model['id']=='lightx-wan22' and gpu in ['A10','A100-40GB','RTX-PRO-6000'] else model['ram']

def rate(model, gpu=None):
    return Decimal(str(GPU_RATES[gpu or model['gpu']] + model['cpu'] * CPU_RATE + gpu_ram(model,gpu) * RAM_RATE))

def reserve(model, gpu=None):
    return (rate(model, gpu) * (TIMEOUT_SECONDS + OVERHEAD_SECONDS) * Decimal('1.15')).quantize(Decimal('.0001'), rounding=ROUND_UP)

def duration_options(model):
    if model['id'].startswith('ltx25-'):return list(range(1,11))
    if model['id'] in ['ltx23-22b','hunyuan15-step','lightx-wan22']:return [3,5,7,10]
    return [2,3,4,5,7,10]

def catalog():
    return [{**m, 'duration_options':duration_options(m), 'duration_note':'7 i 10 s su podržani brojem frejmova; duži profili nisu mjereni na ovoj kartici.', 'gpu_hourly': round(GPU_RATES[m['gpu']] * 3600, 4), 'resource_hourly': round(float(rate(m)) * 3600, 4), 'reservation': float(reserve(m)),
             'gpu_options': [{'id': gpu, 'vram': GPU_VRAM[gpu], 'ram':gpu_ram(m,gpu), 'gpu_hourly': round(GPU_RATES[gpu] * 3600, 4),
                              'resource_hourly': round(float(rate(m, gpu)) * 3600, 4), 'reservation': float(reserve(m, gpu))}
                             for gpu in allowed_gpus(m)]} for m in MODELS]
