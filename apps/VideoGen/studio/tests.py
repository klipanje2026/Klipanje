import io
import json
import tempfile
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch
from django.test import TestCase, Client, override_settings
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from .models import Budget, Job
from .catalog import get_model, reserve
from .services import budget_summary, render_demo, poll_modal, submit_modal

class StudioTests(TestCase):
    def setUp(self):
        # Never inherit a user's paid-enabled .env into a test run.
        local_only = override_settings(VIDEOGEN_ALLOW_PAID=False)
        local_only.enable()
        self.addCleanup(local_only.disable)
        cloud_guard = patch('studio.views.submit_modal', side_effect=AssertionError('Tests must explicitly mock paid submission.'))
        cloud_guard.start()
        self.addCleanup(cloud_guard.stop)
        self.tests_budget = Budget.objects.create(name='tests', limit_usd=15)
        self.creative_budget = Budget.objects.create(name='creative', limit_usd=15)
        self.payload = {'prompt': 'A tiny animated robot waves to a friendly fox.', 'model_id': 'wan21-1.3b', 'mode': 'demo', 'budget': 'tests'}

    def post(self, payload=None):
        return self.client.post('/api/jobs/', data=json.dumps(payload or self.payload), content_type='application/json')

    def make_job(self, **kwargs):
        values = dict(title='Test', prompt=self.payload['prompt'], model_id='wan21-1.3b', budget=self.tests_budget, mode='modal', status='completed', reserved_usd=Decimal('.5'))
        values.update(kwargs)
        return Job.objects.create(**values)

    def test_bootstrap_has_separate_budgets_and_honest_model_availability(self):
        data = self.client.get('/api/bootstrap/').json()
        self.assertEqual({b['id']: b['remaining'] for b in data['budgets']}, {'tests':15,'creative':15})
        self.assertFalse(next(m for m in data['models'] if m['id']=='h3')['enabled'])
        self.assertTrue(data['csrf_token'])

    @patch('studio.views.start_demo')
    def test_demo_never_reserves_credit(self, start):
        response = self.post()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['reserved_usd'],0)
        self.assertEqual(budget_summary(self.tests_budget)['remaining'],15)
        start.assert_called_once()

    def test_paid_is_disabled_by_default(self):
        self.assertEqual(self.post({**self.payload,'mode':'modal'}).status_code,403)
        self.assertEqual(Job.objects.count(),0)

    @override_settings(VIDEOGEN_ALLOW_PAID=True)
    @patch('studio.views.submit_modal')
    def test_paid_reservation_and_global_one_job_rule(self, submit):
        response=self.post({**self.payload,'mode':'modal'})
        self.assertEqual(response.status_code,201)
        self.assertGreater(response.json()['reserved_usd'],0)
        self.assertEqual(self.post({**self.payload,'budget':'creative'}).status_code,409)
        submit.assert_called_once()

    @override_settings(VIDEOGEN_ALLOW_PAID=True)
    @patch('studio.views.submit_modal')
    def test_over_budget_rejected_without_using_creative_fund(self, submit):
        self.make_job(reserved_usd=Decimal('14.99'))
        response=self.post({**self.payload,'mode':'modal'})
        self.assertEqual(response.status_code,409)
        submit.assert_not_called()
        self.assertEqual(budget_summary(self.creative_budget)['remaining'],15)

    def test_failed_and_cancelled_keep_reservations(self):
        self.make_job(status='failed',reserved_usd=1)
        self.make_job(status='cancelled',reserved_usd=2)
        self.assertEqual(budget_summary(self.tests_budget)['remaining'],12)

    def test_manual_invoice_replaces_reservation(self):
        job=self.make_job()
        response=self.client.patch(f'/api/jobs/{job.id}/',data=json.dumps({'billed_usd':'.1234'}),content_type='application/json')
        self.assertEqual(response.status_code,200)
        self.assertEqual(budget_summary(self.tests_budget)['held'],0)
        self.assertEqual(budget_summary(self.tests_budget)['confirmed'],.1234)
        for amount in ['NaN','Infinity','-1']:
            self.assertEqual(self.client.patch(f'/api/jobs/{job.id}/',data=json.dumps({'billed_usd':amount}),content_type='application/json').status_code,400)

    def test_active_job_cannot_release_credit(self):
        job=self.make_job(status='running')
        self.assertEqual(self.client.patch(f'/api/jobs/{job.id}/',data='{"billed_usd":0}',content_type='application/json').status_code,400)

    def test_server_rejects_unavailable_model_and_invalid_parameters(self):
        for update in [{'model_id':'h3'},{'duration':500},{'steps':100},{'mode':'free-gpu'},{'seed':-1},{'aspect':'4:3'},{'style':'bad'},{'budget':'other'},{'prompt':'x'}]:
            self.assertEqual(self.post({**self.payload,**update}).status_code,400,update)
        self.assertEqual(self.client.post('/api/jobs/',data='[]',content_type='application/json').status_code,400)

    def test_upload_is_validated_server_side(self):
        fake=SimpleUploadedFile('fake.png',b'not an image',content_type='image/png')
        response=self.client.post('/api/jobs/',{**self.payload,'model_id':'wan22-5b','reference':fake})
        self.assertEqual(response.status_code,400)

    @patch('studio.views.start_demo')
    def test_reference_image_is_saved(self, start):
        with tempfile.TemporaryDirectory(dir=settings.BASE_DIR / '.runtime') as folder, override_settings(MEDIA_ROOT=folder):
            image=io.BytesIO();Image.new('RGB',(64,64),'orange').save(image,format='PNG')
            upload=SimpleUploadedFile('character.png',image.getvalue(),content_type='image/png')
            response=self.client.post('/api/jobs/',{**self.payload,'model_id':'wan22-5b','reference':upload})
            self.assertEqual(response.status_code,201)
            self.assertTrue(response.json()['reference_url'])

    def test_csrf_rejects_other_site_submission(self):
        client=Client(enforce_csrf_checks=True)
        self.assertEqual(client.post('/api/jobs/',data=json.dumps(self.payload),content_type='application/json').status_code,403)
        boot=client.get('/api/bootstrap/').json()
        with patch('studio.views.start_demo'):
            self.assertEqual(client.post('/api/jobs/',data=json.dumps(self.payload),content_type='application/json',HTTP_X_CSRFTOKEN=boot['csrf_token']).status_code,201)

    def test_local_demo_produces_decodable_mp4_without_budget_charge(self):
        with tempfile.TemporaryDirectory(dir=settings.BASE_DIR / '.runtime') as folder, override_settings(MEDIA_ROOT=folder):
            import imageio.v2 as imageio
            job=self.make_job(mode='demo',status='queued',reserved_usd=0,duration=2)
            render_demo(job.id)
            job.refresh_from_db()
            self.assertEqual(job.status,'completed',job.error)
            self.assertGreater(Path(job.video.path).stat().st_size,1000)
            with imageio.get_reader(job.video.path) as reader:
                self.assertEqual(reader.count_frames(),32)
            self.assertEqual(budget_summary(self.tests_budget)['remaining'],15)

    def test_cancelled_demo_cannot_restart(self):
        job=self.make_job(mode='demo',status='cancelled',reserved_usd=0)
        render_demo(job.id)
        job.refresh_from_db()
        self.assertEqual(job.status,'cancelled')

    @patch('modal.FunctionCall.from_id')
    def test_gpu_failure_keeps_reservation(self, lookup):
        job=self.make_job(status='running',modal_call_id='test-call')
        lookup.return_value.get.return_value={'ok':False,'error':'CUDA out of memory','elapsed_seconds':30}
        result=poll_modal(job)
        self.assertEqual(result.status,'failed')
        self.assertEqual(result.reserved_usd,Decimal('.5'))
        self.assertEqual(budget_summary(self.tests_budget)['remaining'],14.5)

    @patch('modal.FunctionCall.from_id')
    def test_transport_error_does_not_claim_gpu_stopped(self, lookup):
        job=self.make_job(status='running',modal_call_id='test-call')
        lookup.return_value.get.side_effect=ConnectionError('temporary outage')
        with self.assertLogs('studio.services',level='ERROR'):
            self.assertEqual(poll_modal(job).status,'running')

    @patch('modal.FunctionCall.from_id')
    def test_modal_poll_timeout_is_pending_without_releasing_reservation(self, lookup):
        import modal
        job=self.make_job(status='running',modal_call_id='test-call')
        lookup.return_value.get.side_effect=modal.exception.TimeoutError('not ready')
        self.assertEqual(poll_modal(job).status,'running')
        self.assertEqual(budget_summary(self.tests_budget)['held'],.5)

    @patch('modal.FunctionCall.from_id')
    def test_gpu_execution_timeout_is_terminal_but_still_accounted(self, lookup):
        import modal
        job=self.make_job(status='running',modal_call_id='test-call')
        lookup.return_value.get.side_effect=modal.exception.FunctionTimeoutError('execution ended')
        self.assertEqual(poll_modal(job).status,'failed')
        self.assertEqual(budget_summary(self.tests_budget)['held'],.5)

    @patch('studio.services.submit_modal')
    @patch('modal.FunctionCall.from_id')
    def test_cpu_preparation_transitions_once_to_gpu(self, lookup, submit):
        job=self.make_job(status='preparing',modal_call_id='prepare-call')
        lookup.return_value.get.return_value={'ok':True,'elapsed_seconds':50}
        result=poll_modal(job)
        self.assertEqual(result.status,'submitting')
        self.assertEqual(result.preparation_seconds,50)
        self.assertEqual(result.modal_call_id,'')
        submit.assert_called_once()
        self.assertTrue(submit.call_args.kwargs['prepared'])
        # Polling an old prepare handle may not spawn a second paid call.
        poll_modal(job)
        submit.assert_called_once()

    @patch('studio.services.submit_modal')
    @patch('modal.FunctionCall.from_id')
    def test_cpu_preparation_failure_never_starts_gpu(self, lookup, submit):
        job=self.make_job(status='preparing',modal_call_id='prepare-call')
        lookup.return_value.get.return_value={'ok':False,'error':'Import error','elapsed_seconds':30}
        result=poll_modal(job)
        self.assertEqual(result.status,'failed')
        self.assertEqual(result.elapsed_seconds,0)
        self.assertEqual(result.preparation_seconds,30)
        self.assertLess(result.estimated_usd,Decimal('.01'))
        submit.assert_not_called()

    @patch('modal.FunctionCall.from_id')
    def test_cancel_locks_transition_before_remote_request(self, lookup):
        job=self.make_job(status='preparing',modal_call_id='prepare-call')
        def assert_cancel_locked(**kwargs):
            job.refresh_from_db()
            self.assertEqual(job.status,'cancelling')
        lookup.return_value.cancel.side_effect=assert_cancel_locked
        response=self.client.post(f'/api/jobs/{job.id}/cancel/')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['status'],'cancelled')
        self.assertEqual(budget_summary(self.tests_budget)['held'],.5)

    @patch('modal.FunctionCall.from_id')
    def test_cancel_during_submission_cannot_lose_remote_handle(self, lookup):
        job=self.make_job(status='submitting',modal_call_id='')
        self.assertEqual(self.client.post(f'/api/jobs/{job.id}/cancel/').status_code,409)
        lookup.assert_not_called()

    @override_settings(VIDEOGEN_ALLOW_PAID=True)
    @patch('studio.views.submit_modal')
    def test_a100_selection_reserves_a100_price(self, submit):
        data={**self.payload,'mode':'modal','model_id':'wan22-5b','gpu':'A100-80GB','duration':5}
        response=self.post(data)
        self.assertEqual(response.status_code,201)
        self.assertEqual(response.json()['gpu'],'A100-80GB')
        self.assertEqual(Decimal(str(response.json()['reserved_usd'])),reserve(get_model('wan22-5b'),'A100-80GB'))
        self.assertGreater(response.json()['reserved_usd'],float(reserve(get_model('wan22-5b'),'L40S')))

    def test_unapproved_gpu_or_residency_rejected(self):
        for update in [{'gpu':'H100'},{'gpu':'A100-80GB'},{'placement':'resident'},{'placement':'invalid'}]:
            self.assertEqual(self.post({**self.payload,**update}).status_code,400)

    def test_old_jobs_keep_original_gpu_in_history(self):
        job=self.make_job(model_id='wan22-5b')
        self.assertEqual(self.client.get(f'/api/jobs/{job.id}/').json()['gpu'],'L40S')

    def test_wan_a10_requires_offload_and_uses_its_own_rate(self):
        from .views import validate
        data={**self.payload,'model_id':'wan22-5b','gpu':'A10','placement':'offload','steps':20}
        values,model,_=validate(data)
        self.assertEqual(values['gpu'],'A10')
        self.assertLess(reserve(model,'A10'),reserve(model,'L40S'))
        with self.assertRaises(ValueError): validate({**data,'placement':'resident'})

    @patch('modal.Function.from_name')
    def test_wan_a10_routes_to_prepare_then_a10_worker(self, lookup):
        lookup.return_value.spawn.return_value.object_id='test-call'
        job=self.make_job(model_id='wan22-5b',gpu='A10',steps=20,placement='offload')
        submit_modal(job)
        lookup.assert_called_once_with(settings.VIDEOGEN_MODAL_APP,'prepare_model')
        lookup.reset_mock()
        submit_modal(job,prepared=True)
        lookup.assert_called_once_with(settings.VIDEOGEN_MODAL_APP,'generate_balanced_a10')

    @patch('modal.FunctionCall.from_id')
    def test_metrics_and_a100_cost_are_saved(self, lookup):
        job=self.make_job(model_id='wan22-5b',gpu='A100-80GB',status='running',modal_call_id='call')
        lookup.return_value.get.return_value={'ok':False,'error':'test','elapsed_seconds':100,'metrics':{'load_seconds':10,'gpu_name':'A100'}}
        result=poll_modal(job)
        self.assertEqual(result.metrics['gpu_name'],'A100')
        from .catalog import rate
        self.assertEqual(result.estimated_usd,(rate(get_model('wan22-5b'),'A100-80GB')*100).quantize(Decimal('.0001')))

    def test_completed_measured_job_releases_maximum_reserve(self):
        self.make_job(elapsed_seconds=100, estimated_usd=Decimal('.12'), reserved_usd=1)
        summary = budget_summary(self.tests_budget)
        self.assertEqual(summary['held'], 0)
        self.assertEqual(summary['estimated'], .12)
        self.assertEqual(summary['confirmed'], 0)
        self.assertEqual(summary['remaining'], 14.88)

    def test_total_reconciliation_covers_old_jobs_without_fake_invoices(self):
        completed = self.make_job()
        failed = self.make_job(status='failed')
        response = self.client.post('/api/billing/reconcile/', data=json.dumps({'budget':'tests','amount_usd':'1.12','note':'Modal usage overview for all tests to date.'}),content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['remaining'], 13.88)
        self.assertEqual(response.json()['held'], 0)
        completed.refresh_from_db(); failed.refresh_from_db()
        self.assertIsNotNone(completed.reconciliation_id)
        self.assertEqual(completed.reconciliation_id, failed.reconciliation_id)
        self.assertIsNone(completed.billed_usd)
        self.assertEqual(budget_summary(self.creative_budget)['remaining'], 15)
        self.make_job(elapsed_seconds=100, estimated_usd=Decimal('.2'))
        self.assertEqual(budget_summary(self.tests_budget)['remaining'], 13.68)
        self.assertEqual(self.client.patch(f'/api/jobs/{completed.id}/',data='{"billed_usd":0}',content_type='application/json').status_code,400)

    def test_reconciliation_rejects_active_jobs_and_invalid_totals(self):
        job = self.make_job(status='submission_unknown')
        data = {'budget':'tests','amount_usd':1,'note':'Modal usage overview'}
        self.assertEqual(self.client.post('/api/billing/reconcile/',data=json.dumps(data),content_type='application/json').status_code,400)
        job.status='completed'; job.save()
        for amount in ['NaN', '-1', 'Infinity']:
            self.assertEqual(self.client.post('/api/billing/reconcile/',data=json.dumps({**data,'amount_usd':amount}),content_type='application/json').status_code,400)
        self.assertEqual(self.client.post('/api/billing/reconcile/',data=json.dumps(data),content_type='application/json').status_code,200)
        corrected=self.client.post('/api/billing/reconcile/',data=json.dumps({**data,'amount_usd':.5,'note':'Modal corrected the cumulative usage estimate.'}),content_type='application/json')
        self.assertEqual(corrected.status_code,200)
        self.assertEqual(corrected.json()['confirmed'],.5)
        self.assertEqual(corrected.json()['remaining'],14.5)
        self.assertEqual(self.tests_budget.budgetreconciliation_set.count(),2)

    @patch('studio.views.start_demo')
    def test_wan_l40s_resident_and_15_steps_are_valid(self, start):
        response=self.post({**self.payload,'model_id':'wan22-5b','gpu':'L40S','placement':'resident','steps':15})
        self.assertEqual(response.status_code,201)
        self.assertEqual(response.json()['placement'],'resident')

    def test_ltx_uses_its_distilled_step_schedule_and_requires_image(self):
        from .views import validate
        data={**self.payload,'model_id':'ltx-2b','steps':8,'gpu':'L40S','placement':'resident'}
        values,model,_=validate(data)
        self.assertEqual(values['steps'],8)
        self.assertEqual(model['ram'],32)
        self.assertEqual(self.post(data).status_code,400)  # missing reference
        for update in [{'steps':15},{'steps':4},{'gpu':'A100-80GB'},{'gpu':'L4','placement':'resident'}]:
            with self.assertRaises(ValueError): validate({**data,**update})

    def test_experimental_models_enforce_matching_steps_and_placement(self):
        from .views import validate
        for model_id,steps,placement,gpu in [('hunyuan15-step',12,'resident','A100-80GB'),('lightx-wan22',4,'offload','L40S')]:
            data={**self.payload,'model_id':model_id,'steps':steps,'placement':placement,'gpu':gpu,'duration':5}
            self.assertEqual(validate(data)[0]['steps'],steps)
            for update in [{'steps':20},{'duration':2},{'gpu':'A10'}]:
                with self.assertRaises(ValueError): validate({**data,**update})
        self.assertEqual(validate({**self.payload,'model_id':'lightx-wan22','steps':4,'gpu':'L40S','placement':'merged','duration':5})[0]['placement'],'merged')
        with self.assertRaises(ValueError):validate({**self.payload,'placement':'merged'})

    @patch('studio.views.start_demo')
    def test_ltx_endpoint_images_are_validated_and_saved(self,start):
        def picture():
            buffer=io.BytesIO();Image.new('RGB',(64,64),'green').save(buffer,'PNG')
            return SimpleUploadedFile('frame.png',buffer.getvalue(),content_type='image/png')
        with tempfile.TemporaryDirectory(dir=settings.BASE_DIR/'.runtime') as folder,override_settings(MEDIA_ROOT=folder):
            data={**self.payload,'model_id':'ltx-2b','steps':8,'gpu':'L40S','placement':'resident',
                  'reference':picture(),'end_reference':picture()}
            response=self.client.post('/api/jobs/',data=data)
            self.assertEqual(response.status_code,201)
            self.assertTrue(response.json()['end_reference_url'])
            job=Job.objects.get(pk=response.json()['id']);job.status='completed';job.save()
            for update in [{'model_id':'wan22-5b','steps':20},{'reference':''}]:
                self.assertEqual(self.client.post('/api/jobs/',data={**self.payload,'model_id':'ltx-2b','steps':8,
                    'reference':picture(),'end_reference':picture(),**update}).status_code,400)

    @patch('modal.Function.from_name')
    def test_experimental_models_use_separate_runtime(self,lookup):
        lookup.return_value.spawn.return_value.object_id='test-call'
        for model,worker,gpu in [('hunyuan15-step','generate_hunyuan','A100-80GB'),('lightx-wan22','generate_lightx','L40S')]:
            job=self.make_job(model_id=model,gpu=gpu)
            lookup.reset_mock();submit_modal(job)
            lookup.assert_called_once_with('videogen-lab','prepare_lab')
            lookup.reset_mock();submit_modal(job,prepared=True)
            lookup.assert_called_once_with('videogen-lab',worker)
        job=self.make_job(model_id='lightx-wan22',gpu='L40S',placement='merged',steps=4)
        lookup.reset_mock();submit_modal(job)
        lookup.assert_called_once_with('videogen-lab','prepare_light_merged')
        lookup.reset_mock();submit_modal(job,prepared=True)
        lookup.assert_called_once_with('videogen-lab','generate_lightx_merged')

    @patch('modal.Function.from_name')
    def test_lightx_smaller_gpu_profiles_and_hunyuan8_are_bounded(self,lookup):
        from .views import validate
        from .catalog import gpu_ram,rate
        lookup.return_value.spawn.return_value.object_id='test-call'
        for gpu,placement,worker in [('A10','merged-blocks','generate_lightx_a10'),('A100-40GB','merged','generate_lightx_a10040')]:
            values,model,_=validate({**self.payload,'model_id':'lightx-wan22','gpu':gpu,'placement':placement,'steps':4})
            self.assertEqual(gpu_ram(model,gpu),80)
            job=self.make_job(model_id='lightx-wan22',gpu=gpu,placement=placement,steps=4)
            lookup.reset_mock();submit_modal(job,prepared=True)
            lookup.assert_called_once_with('videogen-lab',worker)
        for gpu,placement in [('A10','merged'),('A100-40GB','offload'),('L40S','merged-blocks')]:
            with self.assertRaises(ValueError):validate({**self.payload,'model_id':'lightx-wan22','gpu':gpu,'placement':placement,'steps':4})
        job=self.make_job(model_id='hunyuan15-step',gpu='A100-80GB',placement='resident',steps=8)
        lookup.reset_mock();submit_modal(job,prepared=True)
        lookup.assert_called_once_with('videogen-lab','generate_hunyuan8')
        values,model,_=validate({**self.payload,'model_id':'hunyuan15-step','gpu':'L40S','placement':'offload','steps':8})
        self.assertEqual(gpu_ram(model,'L40S'),48)
        with self.assertRaises(ValueError):validate({**values,'steps':12})
        with self.assertRaises(ValueError):validate({**values,'placement':'resident'})
        job=self.make_job(model_id='hunyuan15-step',gpu='L40S',placement='offload',steps=8)
        lookup.reset_mock();submit_modal(job,prepared=True)
        lookup.assert_called_once_with('videogen-lab','generate_hunyuan_l40s')

    @patch('modal.Function.from_name')
    def test_final_a10_and_rtx_profiles_validate_and_route(self,lookup):
        from .views import validate
        from .catalog import gpu_ram
        lookup.return_value.spawn.return_value.object_id='test-call'
        for model,gpu,placement,steps,worker,app in [
            ('hunyuan15-step','A10','merged-blocks',8,'generate_hunyuan_a10','videogen-lab'),
            ('hunyuan15-step','RTX-PRO-6000','resident',8,'generate_hunyuan_rtx','videogen-lab'),
            ('lightx-wan22','RTX-PRO-6000','merged-resident',4,'generate_lightx_rtx','videogen-lab'),
            ('wan22-5b','RTX-PRO-6000','resident',25,'generate_balanced_rtx',settings.VIDEOGEN_MODAL_APP),
            ('wan22-5b','RTX-PRO-6000','resident',30,'generate_balanced_rtx',settings.VIDEOGEN_MODAL_APP),
        ]:
            values,meta,_=validate({**self.payload,'model_id':model,'gpu':gpu,'placement':placement,'steps':steps})
            self.assertEqual(gpu_ram(meta,gpu),80 if model=='lightx-wan22' else 64)
            job=self.make_job(model_id=model,gpu=gpu,placement=placement,steps=steps)
            lookup.reset_mock();submit_modal(job,prepared=True)
            lookup.assert_called_once_with(app,worker)
        for model,gpu,placement,steps in [
            ('hunyuan15-step','A10','resident',8),('hunyuan15-step','A10','merged-blocks',12),
            ('lightx-wan22','RTX-PRO-6000','merged',4),('lightx-wan22','L40S','merged-resident',4),
            ('wan22-5b','RTX-PRO-6000','merged-resident',25),
        ]:
            with self.assertRaises(ValueError):
                validate({**self.payload,'model_id':model,'gpu':gpu,'placement':placement,'steps':steps})

    @patch('modal.Function.from_name')
    def test_user_gpu_ceiling_and_realistic_prompt_route_without_cartoon_prefix(self,lookup):
        from .views import validate
        lookup.return_value.spawn.return_value.object_id='test-call'
        for model,steps,worker,app in [
            ('hunyuan15-step',8,'generate_hunyuan_rtx','videogen-lab'),
            ('wan22-5b',30,'generate_balanced_rtx',settings.VIDEOGEN_MODAL_APP),
        ]:
            values,_,_=validate({**self.payload,'model_id':model,'gpu':'RTX-PRO-6000','placement':'resident','steps':steps,'style':'realistic'})
            job=self.make_job(model_id=model,gpu='RTX-PRO-6000',placement='resident',steps=steps,style='realistic')
            lookup.reset_mock();submit_modal(job,prepared=True)
            lookup.assert_called_once_with(app,worker)
            self.assertTrue(lookup.return_value.spawn.call_args.args[0]['prompt'].startswith('Photorealistic live-action'))
            with self.assertRaises(ValueError):validate({**values,'gpu':'B200'})
        with self.assertRaises(ValueError):
            validate({**self.payload,'model_id':'hunyuan15-step','gpu':'B200','placement':'resident','steps':12})
        with self.assertRaises(ValueError):
            validate({**self.payload,'model_id':'lightx-wan22','gpu':'B200','placement':'merged-resident','steps':4})

    @patch('modal.Function.from_name')
    def test_ltx23_native_h100_profile_routes_and_rejects_wrong_recipes(self,lookup):
        from .views import validate
        lookup.return_value.spawn.return_value.object_id='test-call'
        data={**self.payload,'model_id':'ltx23-22b','gpu':'H100-SXM5','placement':'native','steps':8,'duration':5,'style':'realistic'}
        values,_,_=validate(data)
        job=self.make_job(model_id='ltx23-22b',gpu='H100-SXM5',placement='native',steps=8,style='realistic')
        submit_modal(job)
        lookup.assert_called_once_with('videogen-realism','prepare_ltx23')
        lookup.reset_mock();submit_modal(job,prepared=True)
        lookup.assert_called_once_with('videogen-realism','generate_ltx23_h100')
        validate({**data,'gpu':'RTX-PRO-6000'})
        job.gpu='RTX-PRO-6000';job.save(update_fields=['gpu'])
        lookup.reset_mock();submit_modal(job,prepared=True)
        lookup.assert_called_once_with('videogen-realism','generate_ltx23_rtx')
        for update in [{'gpu':'A100-80GB'},{'placement':'offload'},{'steps':15},{'duration':4}]:
            with self.assertRaises(ValueError):validate({**data,**update})

    @patch('modal.Function.from_name')
    def test_ltx23_b200_routes_the_same_native_payload(self,lookup):
        lookup.return_value.spawn.return_value.object_id='test-b200'
        job=self.make_job(model_id='ltx23-22b',gpu='B200',placement='native',steps=8,duration=10,
                          metrics={'requested_render_profile':'standard'})
        submit_modal(job,prepared=True)
        lookup.assert_called_once_with('videogen-realism','generate_ltx23_b200')
        payload=lookup.return_value.spawn.call_args.args[0]
        self.assertEqual((payload['seconds'],payload['render_profile'],payload['gpu']),(10,'standard','B200'))

    def test_ltx23_duration_and_detail_limits_are_enforced(self):
        from .views import validate
        data={**self.payload,'model_id':'ltx23-22b','gpu':'RTX-PRO-6000','placement':'native','steps':8,'duration':5,'aspect':'9:16','render_profile':'detail'}
        self.assertEqual(validate(data)[0]['render_profile'],'detail')
        self.assertEqual(validate({**data,'render_profile':'ultra'})[0]['render_profile'],'ultra')
        self.assertEqual(validate({**data,'duration':10,'render_profile':'standard'})[0]['duration'],10)
        for update in [{'duration':10},{'duration':4},{'aspect':'16:9'},{'gpu':'H100-SXM5'},{'render_profile':'unbounded'},{'gpu':'B300'}]:
            with self.assertRaises(ValueError):validate({**data,**update})
        self.assertEqual(validate({**self.payload,'model_id':'wan22-5b','duration':10})[0]['duration'],10)

    @patch('studio.views.submit_modal')
    def test_ltx23_endpoint_request_keeps_detail_setting_and_images(self,submit):
        def picture():
            buffer=io.BytesIO();Image.new('RGB',(64,64),'green').save(buffer,'PNG')
            return SimpleUploadedFile('keyframe.png',buffer.getvalue(),content_type='image/png')
        with tempfile.TemporaryDirectory(dir=settings.BASE_DIR/'.runtime') as folder,override_settings(MEDIA_ROOT=folder,VIDEOGEN_ALLOW_PAID=True):
            data={**self.payload,'mode':'modal','model_id':'ltx23-22b','gpu':'RTX-PRO-6000','placement':'native',
                  'steps':8,'duration':5,'aspect':'9:16','render_profile':'detail','reference':picture(),'end_reference':picture()}
            response=self.client.post('/api/jobs/',data=data)
            self.assertEqual(response.status_code,201,response.content)
            job=Job.objects.get(pk=response.json()['id'])
            self.assertEqual(job.metrics['requested_render_profile'],'detail')
            self.assertEqual(response.json()['render_profile'],'detail')
            self.assertTrue(job.end_reference)
            submit.assert_called_once()

    @patch('modal.Function.from_name')
    def test_dollar_round_bounds_remote_runtime_and_requires_cached_preparation(self,lookup):
        lookup.return_value.with_options.return_value=lookup.return_value
        lookup.return_value.spawn.return_value.object_id='bounded-test'
        for model,timeout in [('ltx23-22b',140),('hunyuan15-step',210)]:
            job=self.make_job(model_id=model,gpu='RTX-PRO-6000',duration=5,steps=8,
                 placement='native' if model=='ltx23-22b' else 'resident',metrics={'runtime_budget':'dollar-v1'})
            lookup.reset_mock();submit_modal(job)
            lookup.return_value.with_options.assert_called_once_with(timeout=25,retries=0,scaledown_window=2,max_containers=1)
            self.assertTrue(lookup.return_value.spawn.call_args.args[0]['cached_only'])
            lookup.reset_mock();submit_modal(job,prepared=True)
            lookup.return_value.with_options.assert_called_once_with(timeout=timeout,retries=0,scaledown_window=2,max_containers=1)
            job.metrics={'runtime_budget':'evening-v1'}
            lookup.reset_mock();submit_modal(job)
            lookup.return_value.with_options.assert_called_once_with(timeout=25,retries=0,scaledown_window=2,max_containers=1)
            self.assertTrue(lookup.return_value.spawn.call_args.args[0]['cached_only'])
            lookup.reset_mock();submit_modal(job,prepared=True)
            lookup.return_value.with_options.assert_called_once_with(timeout=480 if model=='hunyuan15-step' else 180,retries=0,scaledown_window=2,max_containers=1)

    def test_dollar_round_rejects_unbounded_or_expensive_recipes(self):
        from .views import validate
        data={**self.payload,'model_id':'ltx23-22b','gpu':'RTX-PRO-6000','placement':'native','steps':8,'duration':5,'runtime_budget':'dollar-v1'}
        self.assertEqual(validate(data)[0]['runtime_budget'],'dollar-v1')
        self.assertEqual(validate({**data,'runtime_budget':'evening-v1'})[0]['runtime_budget'],'evening-v1')
        for update in [{'gpu':'B200'},{'duration':10},{'runtime_budget':'anything'},{'render_profile':'ultra','aspect':'9:16'}]:
            with self.assertRaises(ValueError):validate({**data,**update})

    @patch('modal.FunctionCall.from_id')
    def test_queue_limit_cancels_only_confirmed_unassigned_input(self,lookup):
        from datetime import timedelta
        from types import SimpleNamespace
        from django.utils import timezone
        job=self.make_job(status='running',model_id='hunyuan15-step',gpu='RTX-PRO-6000',steps=8,
             modal_call_id='test-queue',metrics={'gpu_submitted_at':(timezone.now()-timedelta(seconds=601)).isoformat()})
        lookup.return_value.get.side_effect=TimeoutError
        lookup.return_value.get_call_graph.return_value=[SimpleNamespace(task_id='')]
        with patch('studio.services.submit_modal') as submit:
            result=poll_modal(job);submit.assert_not_called()
        self.assertEqual(result.status,'cancelled')
        self.assertEqual(result.reserved_usd,job.reserved_usd)
        lookup.return_value.cancel.assert_called_once_with(terminate_containers=True)

    @patch('modal.FunctionCall.from_id')
    def test_queue_limit_does_not_stop_allocated_gpu_or_early_queue(self,lookup):
        from datetime import timedelta
        from types import SimpleNamespace
        from django.utils import timezone
        lookup.return_value.get.side_effect=TimeoutError
        job=self.make_job(status='running',modal_call_id='test-active',
             metrics={'gpu_submitted_at':(timezone.now()-timedelta(seconds=601)).isoformat()})
        lookup.return_value.get_call_graph.return_value=[SimpleNamespace(task_id='assigned-container')]
        result=poll_modal(job)
        self.assertEqual(result.status,'running');self.assertTrue(result.metrics['gpu_task_assigned'])
        lookup.return_value.cancel.assert_not_called()
        lookup.reset_mock()
        job.metrics={'gpu_submitted_at':(timezone.now()-timedelta(seconds=590)).isoformat()};job.save(update_fields=['metrics'])
        self.assertEqual(poll_modal(job).status,'running')
        lookup.return_value.get_call_graph.assert_not_called();lookup.return_value.cancel.assert_not_called()

    @patch('modal.FunctionCall.from_id')
    def test_uncertain_queue_cancellation_keeps_reservation_and_blocks_new_work(self,lookup):
        from datetime import timedelta
        from types import SimpleNamespace
        from django.utils import timezone
        job=self.make_job(status='running',modal_call_id='test-cancel',
             metrics={'gpu_submitted_at':(timezone.now()-timedelta(seconds=601)).isoformat()})
        lookup.return_value.get.side_effect=TimeoutError
        lookup.return_value.get_call_graph.return_value=[SimpleNamespace(task_id='')]
        lookup.return_value.cancel.side_effect=RuntimeError('Transport unavailable')
        result=poll_modal(job)
        self.assertEqual(result.status,'cancelling');self.assertEqual(result.reserved_usd,job.reserved_usd)

    def test_recommended_hunyuan_default_matches_its_memory_and_rate(self):
        from .views import validate
        from .catalog import gpu_ram,rate
        model=get_model('hunyuan15-step')
        self.assertEqual((model['gpu'],model['steps']),('RTX-PRO-6000',8))
        self.assertEqual(gpu_ram(model),64)
        self.assertEqual(rate(model),rate(model,'RTX-PRO-6000'))
        values,_,_=validate({**self.payload,'model_id':'hunyuan15-step'})
        self.assertEqual((values['gpu'],values['steps'],values['placement']),('RTX-PRO-6000',8,'resident'))

    @patch('modal.Function.from_name')
    def test_ltx_routes_to_separate_cpu_prepare_and_selected_gpu(self, lookup):
        lookup.return_value.spawn.return_value.object_id='test-call'
        job=self.make_job(model_id='ltx-2b',gpu='L4',steps=8)
        submit_modal(job)
        lookup.assert_called_once_with(settings.VIDEOGEN_MODAL_APP,'prepare_ltx')
        lookup.reset_mock()
        submit_modal(job,prepared=True)
        lookup.assert_called_once_with(settings.VIDEOGEN_MODAL_APP,'generate_ltx_l4')

    @patch('modal.FunctionCall.from_id')
    def test_ltx_cost_accounts_for_larger_cpu_preparation(self, lookup):
        job=self.make_job(model_id='ltx-2b',gpu='L4',status='running',modal_call_id='test',preparation_seconds=50)
        lookup.return_value.get.return_value={'ok':False,'error':'test','elapsed_seconds':100}
        result=poll_modal(job)
        from .catalog import rate, CPU_RATE, RAM_RATE
        expected=rate(get_model('ltx-2b'),'L4')*100+Decimal(str(2*CPU_RATE+48*RAM_RATE))*50
        self.assertEqual(result.estimated_usd,expected.quantize(Decimal('.0001')))
