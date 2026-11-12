import ast
import io
import json
import tempfile
from pathlib import Path
from uuid import uuid4
from unittest.mock import patch
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, SimpleTestCase, override_settings, Client
from PIL import Image
from .models import VideoProject, ScenePlan, GenerationBatch, Job, BillingSnapshot, ModalSelection
from .modal_accounts import ensure_accounts
from .provider_billing import current_cycle
from .batch_queue import step


class BatchTests(TestCase):
    def setUp(self):
        self.profiles={'test':{'token_id':'test','token_secret':'test','active':True}}
        for target in ['studio.modal_accounts.configured_profiles','studio.batch_queue.configured_profiles']:
            mock=patch(target,return_value=self.profiles);mock.start();self.addCleanup(mock.stop)
        runner=patch('studio.batch_queue.ensure_runner');runner.start();self.addCleanup(runner.stop)
        client=patch('studio.modal_accounts.job_client',return_value=None);client.start();self.addCleanup(client.stop)
        self.account=ensure_accounts()
        BillingSnapshot.objects.create(account=self.account,cycle=current_cycle(),payload={'monthly_credit_usd':'30','summary':{'adjustments':{'credits':'-1'}}})
        self.project=VideoProject.objects.create(name='Batch')
        self.temp=tempfile.TemporaryDirectory(dir=Path(settings.BASE_DIR)/'.runtime');self.addCleanup(self.temp.cleanup)
        local=override_settings(MEDIA_ROOT=self.temp.name,VIDEOGEN_ALLOW_PAID=True);local.enable();self.addCleanup(local.disable)
        self.plans=[self.plan('First',5),self.plan('Second',3)]

    def plan(self,title,seconds):
        image=io.BytesIO();Image.new('RGB',(8,8),'red').save(image,format='PNG')
        return ScenePlan.objects.create(project=self.project,title=title,direction='Waves move slowly.',
            description='Waves move slowly.',prompt='Waves move slowly along the coast.',style='cinematic',
            aspect='16:9',duration=seconds,reference_mode='combined',scene=SimpleUploadedFile('scene.png',image.getvalue(),content_type='image/png'))

    def payload(self):
        return {'request_key':str(uuid4()),'account':self.account.pk,'project':str(self.project.pk),
                'scenes':[{'plan':str(p.pk),'model_id':'ltx-2b','gpu':'L40S','steps':8,'placement':'resident','scene_key':f'slot-{i}'} for i,p in enumerate(self.plans)]}

    def post(self,data):return self.client.post('/api/creative/batches/',json.dumps(data),content_type='application/json')

    def test_batch_creates_independent_jobs_and_request_is_idempotent(self):
        data=self.payload();first=self.post(data)
        self.assertEqual(first.status_code,201)
        self.assertEqual([j['duration'] for j in first.json()['jobs']],[5,3])
        self.assertEqual([j['scene_key'] for j in first.json()['jobs']],['slot-0','slot-1'])
        self.assertTrue(all(j.modal_account_id==self.account.pk and j.reserved_usd==0 for j in Job.objects.all()))
        self.assertEqual(self.post(data).status_code,200);self.assertEqual(Job.objects.count(),2)
        data['scenes'][0]['seed']=900
        self.assertEqual(self.post(data).status_code,400);self.assertEqual(Job.objects.count(),2)
        self.assertEqual(self.post(self.payload()).status_code,409)

    def test_all_settings_validated_before_any_job_is_created(self):
        data=self.payload();data['scenes'][1]['steps']=100
        self.assertEqual(self.post(data).status_code,400);self.assertFalse(Job.objects.exists())
        self.assertFalse(GenerationBatch.objects.exists())

    def test_stale_account_or_foreign_project_plan_cannot_be_submitted(self):
        data=self.payload();data['account']=999
        self.assertEqual(self.post(data).status_code,400)
        data=self.payload();data['project']=str(uuid4())
        self.assertEqual(self.post(data).status_code,404);self.assertFalse(Job.objects.exists())

    @patch('studio.batch_queue.check_modal_worker')
    @patch('studio.batch_queue.poll_modal')
    @patch('studio.batch_queue.submit_modal')
    def test_images_prepared_before_one_cpu_prepare_then_gpu_queue(self,submit,poll,check):
        self.post(self.payload());batch=GenerationBatch.objects.get();calls=[]
        def fake_submit(job,prepared=False):
            calls.append((str(job.pk),prepared))
            self.assertTrue(all(j.reference for j in batch.job_set.all()))
            Job.objects.filter(pk=job.pk).update(status='running' if prepared else 'preparing',modal_call_id=f'call-{job.pk}')
        submit.side_effect=fake_submit
        step(batch);self.assertEqual([prepared for _,prepared in calls],[False])
        leader=batch.job_set.order_by('batch_order').first()
        Job.objects.filter(pk=leader.pk).update(status='running',metrics={**leader.metrics,'batch_prepared':True})
        step(batch);step(batch)
        self.assertEqual([prepared for _,prepared in calls],[False,True])
        self.assertEqual(check.call_count,1)
        self.assertTrue(all(j.status=='running' for j in batch.job_set.all()))
        self.assertTrue(all(j.modal_account_id==self.account.pk for j in batch.job_set.all()))

    @patch('studio.batch_queue.check_modal_worker')
    @patch('studio.batch_queue.poll_modal')
    @patch('studio.batch_queue.submit_modal')
    def test_mixed_gpu_groups_do_not_start_together(self,submit,poll,check):
        data=self.payload();data['scenes'][1]['gpu']='A10';data['scenes'][1]['placement']='offload'
        self.post(data);batch=GenerationBatch.objects.get()
        def fake(job,prepared=False):Job.objects.filter(pk=job.pk).update(status='preparing',modal_call_id='first')
        submit.side_effect=fake
        step(batch);step(batch);self.assertEqual(submit.call_count,1)
        first=batch.job_set.order_by('batch_order').first()
        Job.objects.filter(pk=first.pk).update(status='completed')
        step(batch);self.assertEqual(submit.call_count,2)

    @patch('studio.batch_queue.submit_modal')
    def test_unknown_submission_is_never_retried(self,submit):
        self.post(self.payload());batch=GenerationBatch.objects.get()
        batch.job_set.order_by('batch_order').filter(batch_order=0).update(status='submission_unknown')
        step(batch);batch.refresh_from_db()
        self.assertEqual(batch.status,'attention');submit.assert_not_called()
        self.assertEqual(batch.job_set.filter(status='batch_waiting').count(),1)

    @patch('studio.services.submit_modal')
    @patch('modal.FunctionCall.from_id')
    def test_successful_cpu_preparation_pins_group_ready_without_charging_followers(self,lookup,submit):
        from .services import poll_modal
        self.post(self.payload());leader=Job.objects.order_by('batch_order').first()
        leader.status='preparing';leader.modal_call_id='cpu-call';leader.save()
        lookup.return_value.get.return_value={'ok':True,'elapsed_seconds':7}
        poll_modal(leader);leader.refresh_from_db()
        self.assertTrue(leader.metrics['batch_prepared'])
        self.assertEqual(leader.preparation_seconds,7)
        self.assertEqual(Job.objects.get(batch_order=1).preparation_seconds,0)
        submit.assert_called_once()
        self.assertTrue(submit.call_args.kwargs['prepared'])

    @patch('studio.batch_queue.poll_modal')
    @patch('studio.batch_queue.submit_modal')
    def test_attention_collects_known_gpu_results_without_new_submissions(self,submit,poll):
        self.post(self.payload());batch=GenerationBatch.objects.get();batch.status='attention';batch.save()
        batch.job_set.filter(batch_order=0).update(status='running',modal_call_id='known-call')
        step(batch);self.assertEqual(poll.call_count,1);submit.assert_not_called()

    @patch('studio.batch_queue.submit_modal')
    def test_cancel_waiting_batch_does_not_start_gpu(self,submit):
        result=self.post(self.payload());batch=GenerationBatch.objects.get()
        self.assertEqual(self.client.post(f'/api/creative/batches/{batch.pk}/cancel/').status_code,200)
        batch.refresh_from_db();step(batch);batch.refresh_from_db()
        self.assertEqual(batch.status,'cancelled');self.assertEqual(batch.job_set.filter(status='cancelled').count(),2)
        submit.assert_not_called()

    def test_batch_writes_require_csrf(self):
        client=Client(enforce_csrf_checks=True)
        self.assertEqual(client.post('/api/creative/batches/').status_code,403)
        self.assertEqual(client.post(f'/api/creative/batches/{uuid4()}/cancel/').status_code,403)

    @patch('modal.FunctionCall.from_id')
    def test_each_result_is_saved_to_its_own_scene_video(self,lookup):
        from .creative_workspace import job_data
        self.post(self.payload());batch=GenerationBatch.objects.get()
        jobs=list(batch.job_set.order_by('batch_order'))
        for i,job in enumerate(jobs):
            job.status='running';job.modal_call_id=f'gpu-{i}';job.save()
        results=[{'ok':True,'elapsed_seconds':4,'video':b'first-scene-video'},
                 {'ok':True,'elapsed_seconds':6,'video':b'second-scene-video'}]
        from unittest.mock import MagicMock
        lookup.side_effect=[MagicMock(get=MagicMock(return_value=result)) for result in results]
        step(batch);batch.refresh_from_db();self.assertEqual(batch.status,'completed')
        for job,result in zip(jobs,results):
            job.refresh_from_db();self.assertEqual(job.status,'completed')
            with job.video.open('rb') as file:self.assertEqual(file.read(),result['video'])
            self.assertEqual(job_data(job)['scene_plan'],str(job.scene_plan_id))
            self.assertIsNone(job_data(job)['video_url'])
            self.assertEqual(job.processing_status,'pending')
            self.assertEqual(job_data(job)['original_url'],f'/api/creative/videos/{job.pk}/?original=1')
        self.assertNotEqual(jobs[0].video.name,jobs[1].video.name)


class WorkerReuseTests(SimpleTestCase):
    def test_worker_pipeline_is_loaded_once_for_compatible_inputs(self):
        for name in ['modal_app.py','lab_app.py','realism_app.py']:
            tree=ast.parse((Path(settings.BASE_DIR)/'gpu'/name).read_text(encoding='utf-8'))
            function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='cached_pipeline')
            scope={'_PIPELINE_CACHE':{}}
            exec(compile(ast.fix_missing_locations(ast.Module(body=[function],type_ignores=[])),name,'exec'),scope)
            made=[]
            def build():made.append(object());return made[-1]
            a,reused=scope['cached_pipeline'](('model','gpu'),build);self.assertFalse(reused)
            b,reused=scope['cached_pipeline'](('model','gpu'),build);self.assertTrue(reused);self.assertIs(a,b);self.assertEqual(len(made),1)
            c,reused=scope['cached_pipeline'](('other','gpu'),build);self.assertFalse(reused);self.assertIsNot(a,c)

    def test_volume_is_not_reloaded_while_compatible_weights_are_open(self):
        from unittest.mock import MagicMock
        for name in ['modal_app.py','lab_app.py','realism_app.py']:
            tree=ast.parse((Path(settings.BASE_DIR)/'gpu'/name).read_text(encoding='utf-8'))
            function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='reload_models')
            volume=MagicMock();pipeline=object();scope={'_PIPELINE_CACHE':{'same':pipeline},'cache':volume}
            exec(compile(ast.fix_missing_locations(ast.Module(body=[function],type_ignores=[])),name,'exec'),scope)
            scope['reload_models']('same');volume.reload.assert_not_called()
            self.assertIs(scope['_PIPELINE_CACHE']['same'],pipeline)
            scope['reload_models']('different');volume.reload.assert_called_once();self.assertEqual(scope['_PIPELINE_CACHE'],{})
