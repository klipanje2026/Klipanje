import hashlib
from unittest.mock import patch

from django.test import Client, TestCase
from .models import Job, ScenePlan, VideoProject
from .scene_planner import compose_reference
from .test_creative_workspace import CreativeTests


class DirectSceneTests(TestCase):
    setUp = CreativeTests.setUp
    image = CreativeTests.image

    def fields(self, **changes):
        return {'project': str(self.project.pk), 'title': 'leon_kusa_vodu_video_ltx2.5',
                'direction': 'Leon polako prilazi vodi.\nPotom zastane i pogleda ulijevo.',
                'model_id': 'ltx25-distilled', 'style': 'comic', 'duration': 5, 'aspect': '16:9',
                'image_role': 'start', **changes}

    def save(self, **changes):
        return self.client.post('/api/creative/scenes/', self.fields(**changes))

    @patch('studio.scene_planner.provider')
    @patch('studio.creative_workspace.plan_scene')
    def test_ready_prompt_and_one_image_need_no_ai_planning_or_generation(self, planner, provider):
        response = self.save(image=self.image())
        self.assertEqual(response.status_code, 201)
        plan = ScenePlan.objects.get(pk=response.json()['id'])
        self.assertEqual(plan.prompt, self.fields()['direction'])
        self.assertEqual(plan.description, plan.prompt)
        self.assertEqual(plan.title, self.fields()['title'])
        self.assertEqual(plan.reference_mode, 'combined')
        compose_reference(plan)
        with plan.scene.open('rb') as source, plan.reference.open('rb') as result:
            self.assertEqual(hashlib.sha256(source.read()).digest(), hashlib.sha256(result.read()).digest())
        self.assertFalse(Job.objects.exists())
        planner.assert_not_called()
        provider.assert_not_called()

    @patch('studio.scene_planner.provider')
    def test_reference_is_separate_from_start_and_saved_end_can_be_reused(self, provider):
        response = self.save(image=self.image(), image_role='reference', end_enabled='1', end_reference=self.image('end.png'))
        self.assertEqual(response.status_code, 201)
        plan = ScenePlan.objects.get(pk=response.json()['id'])
        self.assertEqual(plan.reference_mode, 'keyframe')
        self.assertEqual(response.json()['image_role'], 'reference')
        self.assertTrue(response.json()['end_url'])
        end = self.client.get(response.json()['end_url'])
        self.assertEqual(end.status_code, 200)
        end.close()
        reused = self.save(previous_plan=str(plan.pk), image_role='reference', end_enabled='1')
        self.assertEqual(reused.status_code, 201)
        self.assertTrue(reused.json()['has_end_frame'])
        cleared = self.save(previous_plan=str(plan.pk))
        self.assertEqual(cleared.status_code, 201)
        self.assertFalse(cleared.json()['has_end_frame'])
        plan.refresh_from_db()
        self.assertTrue(plan.end_reference)
        compose_reference(plan)
        provider.assert_not_called()

    def test_other_models_keep_reference_semantics_and_reject_unsupported_end(self):
        result = self.save(image=self.image(), model_id='wan22-5b', image_role='reference')
        self.assertEqual(result.status_code, 201)
        self.assertEqual(ScenePlan.objects.get(pk=result.json()['id']).reference_mode, 'reference')
        failed = self.save(image=self.image(), model_id='wan22-5b', end_enabled='1', end_reference=self.image())
        self.assertEqual(failed.status_code, 400)

    def test_validation_happens_before_saving_and_preserves_projects(self):
        original = self.project.draft
        for changes in [{'title': ''}, {'direction': 'short'}, {'image_role': 'unknown'}, {'end_enabled': '1'}]:
            response = self.save(image=self.image(), **changes)
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.save().status_code, 400)
        self.assertFalse(ScenePlan.objects.exists())
        self.assertFalse(Job.objects.exists())
        self.project.refresh_from_db()
        self.assertEqual(self.project.draft, original)
        foreign = VideoProject.objects.create(name='Other')
        plan = ScenePlan.objects.create(project=foreign, title='Other', prompt='Other prompt', duration=5)
        self.assertEqual(self.save(previous_plan=str(plan.pk)).status_code, 404)

    def test_direct_scene_requires_csrf(self):
        response = Client(enforce_csrf_checks=True).post('/api/creative/scenes/', self.fields())
        self.assertEqual(response.status_code, 403)

    def test_image_is_saved_before_title_and_prompt_are_entered(self):
        response = self.save(title='', direction='', image=self.image(), draft_only='1')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()['scene_url'])
        plan = ScenePlan.objects.get(pk=response.json()['id'])
        self.assertTrue(plan.scene.storage.exists(plan.scene.name))
        self.assertFalse(Job.objects.exists())
        restored = self.save(previous_plan=str(plan.pk))
        self.assertEqual(restored.status_code, 201)
        self.assertEqual(ScenePlan.objects.get(pk=restored.json()['id']).prompt, self.fields()['direction'])
