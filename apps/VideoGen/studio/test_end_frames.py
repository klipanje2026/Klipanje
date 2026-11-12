from unittest.mock import patch
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from . import test_creative_workspace as creative_tests
from . import test_batch_queue as batch_tests
from .models import ScenePlan, Job, GenerationBatch
from .batch_queue import group_key, step


class EndFrameTests(TestCase):
    setUp=creative_tests.CreativeTests.setUp
    image=creative_tests.CreativeTests.image
    plan=creative_tests.CreativeTests.plan
    post=creative_tests.CreativeTests.post
    balance=creative_tests.CreativeTests.balance

    def fields(self):
        return {'project':str(self.project.pk),'direction':'Junak polako sjeda i podize ruku.',
                'style':'cinematic','reference_mode':'combined','model_id':'ltx23-22b','end_enabled':'1'}

    @patch('studio.creative_workspace.plan_scene',return_value={'title':'Pokret','description':'Lik se pomjera do zavrsne poze.','prompt':'Move continuously from the start pose to the final pose.'})
    def test_planner_receives_both_frames_and_saved_plan_reuses_or_clears_end(self,planner):
        result=self.client.post('/api/creative/prepare/',{**self.fields(),'scene':self.image('first.png'),'end_reference':self.image('last.png')})
        self.assertEqual(result.status_code,201);self.assertTrue(result.json()['has_end_frame'])
        plan=ScenePlan.objects.get(pk=result.json()['id']);self.assertTrue(plan.end_reference.storage.exists(plan.end_reference.name))
        files=planner.call_args.args[2];self.assertIn('START',files[1][0]);self.assertIn('END FRAME',files[2][0]);self.assertTrue(files[2][1])
        reused=self.client.post('/api/creative/prepare/',{**self.fields(),'previous_plan':str(plan.pk)})
        self.assertEqual(reused.status_code,201);self.assertTrue(reused.json()['has_end_frame'])
        detail=self.client.get(f'/api/creative/plans/{plan.pk}/').json()
        self.assertTrue(detail['form']['useEndFrame'])
        cleared=self.client.post('/api/creative/prepare/',{**self.fields(),'previous_plan':str(plan.pk),'end_enabled':'0'})
        self.assertEqual(cleared.status_code,201);self.assertFalse(cleared.json()['has_end_frame'])

    @patch('studio.creative_workspace.plan_scene')
    def test_missing_invalid_or_incompatible_end_never_calls_openai(self,planner):
        for extra in [{},{'model_id':'wan22-5b','end_reference':self.image()},
                      {'end_reference':SimpleUploadedFile('bad.png',b'not an image',content_type='image/png')}]:
            result=self.client.post('/api/creative/prepare/',{**self.fields(),'scene':self.image(),**extra})
            self.assertEqual(result.status_code,400)
        planner.assert_not_called();self.assertFalse(Job.objects.exists())

    @override_settings(VIDEOGEN_ALLOW_PAID=True)
    @patch('studio.creative_workspace.submit_modal')
    def test_single_generation_passes_original_final_image_to_gpu_job(self,submit):
        self.balance();plan=self.plan();plan.end_reference.save('last.png',self.image(),save=True)
        result=self.post('generate/',{'plan':str(plan.pk),'model_id':'ltx23-22b','gpu':'RTX-PRO-6000','placement':'native','steps':8})
        self.assertEqual(result.status_code,201);job=Job.objects.get();self.assertTrue(job.end_reference)
        with plan.end_reference.open('rb') as source,job.end_reference.open('rb') as copy:self.assertEqual(source.read(),copy.read())
        submit.assert_called_once()

    @patch('studio.creative_workspace.submit_modal')
    def test_switching_to_non_ltx_model_cannot_silently_discard_end(self,submit):
        plan=self.plan();plan.end_reference.save('last.png',self.image(),save=True)
        result=self.post('generate/',{'plan':str(plan.pk),'model_id':'wan22-5b','gpu':'RTX-PRO-6000','placement':'resident','steps':15})
        self.assertEqual(result.status_code,400);submit.assert_not_called()


class EndFrameBatchTests(TestCase):
    setUp=batch_tests.BatchTests.setUp
    plan=batch_tests.BatchTests.plan
    payload=batch_tests.BatchTests.payload
    post=batch_tests.BatchTests.post

    @patch('studio.batch_queue.check_modal_worker')
    @patch('studio.batch_queue.submit_modal')
    def test_endpoints_grouping_and_cpu_preparation_see_the_end_image(self,submit,check):
        first=self.plans[0]
        with first.scene.open('rb') as image:first.end_reference.save('end.png',SimpleUploadedFile('end.png',image.read(),content_type='image/png'),save=True)
        self.post(self.payload());batch=GenerationBatch.objects.get()
        jobs=list(batch.job_set.select_related('scene_plan').order_by('batch_order'))
        self.assertNotEqual(group_key(jobs[0]),group_key(jobs[1]))
        step(batch)
        self.assertTrue(submit.call_args.args[0].end_reference)
        self.assertEqual(batch.job_set.get(batch_order=1).status,'batch_waiting')
