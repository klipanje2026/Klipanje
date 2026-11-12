import io
from decimal import Decimal
from django.core.management import call_command
from django.test import TestCase
from .models import Budget, Job
from .resource_costs import resource_cost
from .creative_workspace import job_data, averages


class ResourceCostTests(TestCase):
    def setUp(self):
        self.budget = Budget.objects.create(name='creative', limit_usd=30)

    def job(self, **overrides):
        return Job.objects.create(**dict(budget=self.budget, title='Scene', mode='modal',
            model_id='ltx-2b', gpu='L40S', status='completed', duration=5, steps=8,
            elapsed_seconds=58.817500113, preparation_seconds=9.139261873,
            estimated_usd=Decimal('.1539'), **overrides))

    def test_recorded_times_only_includes_loading_once(self):
        job = self.job(metrics={'load_seconds':45.545, 'pipeline_seconds':11.947})
        cost = resource_cost(job)
        self.assertEqual(cost['total_usd'], Decimal('.0388'))
        self.assertAlmostEqual(cost['gpu_usd'], .037598498772, places=10)
        self.assertAlmostEqual(cost['preparation_usd'], .001213328406, places=10)
        self.assertEqual(cost['gpu_seconds'], job.elapsed_seconds)

    def test_recalculation_preserves_invoices_and_is_idempotent(self):
        job = self.job(billed_usd=Decimal('.05'), metrics={'provider_billed_usd':.052, 'load_seconds':45.545})
        output = io.StringIO()
        call_command('recalculate_resource_costs', stdout=output)
        job.refresh_from_db()
        self.assertEqual(job.estimated_usd, Decimal('.1539'))
        call_command('recalculate_resource_costs', apply=True, stdout=output)
        job.refresh_from_db()
        self.assertEqual(job.estimated_usd, Decimal('.0388'))
        self.assertEqual(job.billed_usd, Decimal('.05'))
        self.assertEqual(job.metrics['provider_billed_usd'], .052)
        self.assertEqual(job.metrics['resource_cost_correction']['previous_estimate_usd'], '0.1539')
        data = job_data(job)
        self.assertEqual(data['measured_usd'], .0388)
        self.assertEqual(data['actual_usd'], .052)
        self.assertEqual(averages()[0]['mean_usd'], .0388)
        again = io.StringIO()
        call_command('recalculate_resource_costs', apply=True, stdout=again)
        self.assertIn('Updated: 0', again.getvalue())

    def test_historical_active_and_unknown_jobs_are_not_rewritten(self):
        jobs = [self.job(metrics={'historical':True, 'archive_cost':.0192})]
        for changes in [{'status':'running'}, {'mode':'demo'}, {'elapsed_seconds':0, 'preparation_seconds':0}]:
            values=dict(budget=self.budget, title='Skip', model_id='ltx-2b', gpu='L40S',
                        mode='modal', status='completed', elapsed_seconds=30, estimated_usd=Decimal('.15'))
            values.update(changes)
            jobs.append(Job.objects.create(**values))
        original=[job.estimated_usd for job in jobs]
        call_command('recalculate_resource_costs', apply=True, stdout=io.StringIO())
        for job, amount in zip(jobs, original):
            job.refresh_from_db()
            self.assertEqual(job.estimated_usd, amount)
            self.assertIsNone(resource_cost(job))
