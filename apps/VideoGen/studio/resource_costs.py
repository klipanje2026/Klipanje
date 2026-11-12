"""Resource estimates from recorded worker times, without invented overhead."""
from decimal import Decimal
from .catalog import CPU_RATE, RAM_RATE, get_model, rate

RESOURCE_COST_VERSION = 'recorded-duration-v1'
COST_NOTE = ('Izračun iz zabilježenog GPU posla i CPU pripreme, bez paušalnih dodataka. '
             'Učitavanje unutar posla je uključeno. Pokretanje izvan mjerenja, mirovanje, '
             'mreža i OpenAI nisu uključeni. Službena Modal naplata prikazana je odvojeno.')


def resource_cost(job):
    model = get_model(job.model_id)
    gpu_seconds = Decimal(str(job.elapsed_seconds))
    preparation_seconds = Decimal(str(job.preparation_seconds))
    if not model or job.mode != 'modal' or job.metrics.get('historical'):
        return None
    if job.status not in ['completed', 'failed', 'cancelled'] or gpu_seconds < 0 or preparation_seconds < 0:
        return None
    if not gpu_seconds and not preparation_seconds:
        return None
    preparation_rate = Decimal(str(2 * CPU_RATE + model.get('preparation_ram', 8) * RAM_RATE))
    gpu_cost = rate(model, job.gpu or model['gpu']) * gpu_seconds
    preparation_cost = preparation_rate * preparation_seconds
    return {'version': RESOURCE_COST_VERSION, 'gpu_seconds': float(gpu_seconds),
            'preparation_seconds': float(preparation_seconds), 'gpu_usd': float(gpu_cost),
            'preparation_usd': float(preparation_cost),
            'total_usd': (gpu_cost + preparation_cost).quantize(Decimal('.0001'))}


def set_resource_cost(job):
    cost = resource_cost(job)
    if cost is None:
        return False
    audit = job.metrics.get('resource_cost_correction', {})
    if not audit and job.estimated_usd > 0 and job.estimated_usd != cost['total_usd']:
        audit = {'previous_estimate_usd': str(job.estimated_usd)}
    job.estimated_usd = cost.pop('total_usd')
    job.metrics = {**job.metrics, 'resource_cost': cost}
    if audit:
        job.metrics['resource_cost_correction'] = audit
    job.cost_note = COST_NOTE
    return True
