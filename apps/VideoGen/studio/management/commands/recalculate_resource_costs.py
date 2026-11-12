from django.core.management.base import BaseCommand
from django.db import transaction
from studio.models import Job
from studio.resource_costs import set_resource_cost


class Command(BaseCommand):
    help = 'Recalculate recorded local resource estimates; never changes invoices, media or historical imports.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        changed = 0
        for job in Job.objects.filter(mode='modal', status__in=['completed', 'failed', 'cancelled']):
            before = (job.estimated_usd, job.cost_note, dict(job.metrics))
            if not set_resource_cost(job) or before == (job.estimated_usd, job.cost_note, job.metrics):
                continue
            if options['apply']:
                job.save(update_fields=['estimated_usd', 'cost_note', 'metrics'])
            changed += 1
        self.stdout.write(f'{"Updated" if options["apply"] else "Would update"}: {changed}')
