import io,json,tempfile
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch,MagicMock
from django.conf import settings
from django.test import TestCase,override_settings,Client
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from .models import VideoProject,ScenePlan,Job,BillingSnapshot,Budget
from .provider_billing import current_cycle,sync_billing,billing_state
from .creative_workspace import averages

class CreativeTests(TestCase):
 def setUp(self):
  profiles=patch('studio.modal_accounts.configured_profiles',return_value={'test':{'token_id':'test-only','token_secret':'test-only','active':True}});profiles.start();self.addCleanup(profiles.stop)
  profile_alias=patch('studio.creative_workspace.configured_profiles',return_value={'test':{'token_id':'test-only','token_secret':'test-only','active':True}});profile_alias.start();self.addCleanup(profile_alias.stop)
  worker=patch('studio.creative_workspace.check_modal_worker');worker.start();self.addCleanup(worker.stop)
  runtime=Path(settings.BASE_DIR)/'.runtime';runtime.mkdir(exist_ok=True);self.temp=tempfile.TemporaryDirectory(dir=runtime);self.addCleanup(self.temp.cleanup)
  local=override_settings(MEDIA_ROOT=self.temp.name,VIDEOGEN_ALLOW_PAID=False);local.enable();self.addCleanup(local.disable)
  self.project=VideoProject.objects.create(name='Story',context={'name':'Klipanje story','brief':{'characters':[{'name':'Junak'}]}})
  self.budget=Budget.objects.create(name='creative',limit_usd=30)
 def image(self,name='reference.png'):
  out=io.BytesIO();Image.new('RGB',(40,30),'red').save(out,format='PNG');return SimpleUploadedFile(name,out.getvalue(),content_type='image/png')
 def post(self,path,data):return self.client.post('/api/creative/'+path,json.dumps(data),content_type='application/json')
 def balance(self):return BillingSnapshot.objects.create(cycle=current_cycle(),payload={'summary':{'metered_cost':'11.77679594','billed_cost':'0','adjustments':{'Credits':'-11.64'}},'monthly_credit_usd':'30'})
 def plan(self):return ScenePlan.objects.create(project=self.project,title='Scene',direction='Junak ulazi u sobu',description='Junak mirno ulazi.',prompt='A hero enters the room slowly.',style='cartoon3d',aspect='16:9',reference_mode='combined',scene=self.image())
 def test_projects_drafts_and_context_are_local(self):
  created=self.post('projects/',{'name':'Drugi'}).json();self.assertNotEqual(created['id'],str(self.project.pk))
  response=self.client.patch(f'/api/creative/projects/{self.project.pk}/',json.dumps({'draft':{'direction':'saved'},'context':{'name':'Selected only'}}),content_type='application/json');self.assertEqual(response.status_code,200)
  self.project.refresh_from_db();self.assertEqual(self.project.draft['direction'],'saved')
  boot=self.client.get('/api/creative/bootstrap/').json();self.assertEqual(len(boot['styles']),9);self.assertEqual(len(boot['projects']),2)
 @patch('studio.creative_workspace.plan_scene',return_value={'title':'AI title','description':'Opis','prompt':'An English animation prompt.'})
 def test_prepare_distinguishes_character_and_scene_and_reuses_saved_inputs(self,planner):
  response=self.client.post('/api/creative/prepare/',{'project':str(self.project.pk),'direction':'Junak seta kroz sumu','style':'cartoon3d','aspect':'16:9','reference_mode':'separate','character':self.image('person.png'),'scene':self.image('forest.png')})
  self.assertEqual(response.status_code,201);plan=ScenePlan.objects.get(pk=response.json()['id']);self.assertTrue(plan.character);self.assertTrue(plan.scene)
  labels=[label for label,_ in planner.call_args.args[2]];self.assertIn('CHARACTER',labels[0]);self.assertIn('SCENE',labels[1]);self.assertEqual(Job.objects.count(),0)
  response=self.client.post('/api/creative/prepare/',{'project':str(self.project.pk),'previous_plan':str(plan.pk),'direction':'Junak sada trci kroz sumu','style':'cartoon3d','reference_mode':'separate'})
  self.assertEqual(response.status_code,201)
 @patch('studio.creative_workspace.plan_scene')
 def test_invalid_image_or_missing_role_never_calls_provider(self,planner):
  response=self.client.post('/api/creative/prepare/',{'project':str(self.project.pk),'direction':'Enough direction text','style':'anime','reference_mode':'separate','scene':self.image()});self.assertEqual(response.status_code,400);planner.assert_not_called()
 @override_settings(VIDEOGEN_ALLOW_PAID=True)
 @patch('studio.creative_workspace.submit_modal')
 def test_production_uses_all_credit_without_local_reservation(self,submit):
  self.balance();plan=self.plan();response=self.post('generate/',{'plan':str(plan.pk),'model_id':'wan22-5b','gpu':'RTX-PRO-6000','placement':'resident','steps':15})
  self.assertEqual(response.status_code,201);job=Job.objects.get();self.assertEqual(job.reserved_usd,0);self.assertEqual(job.project,self.project);self.assertTrue(job.reference.storage.exists(job.reference.name));submit.assert_called_once()
  self.assertEqual(self.post('generate/',{'plan':str(plan.pk),'model_id':'wan22-5b','gpu':'RTX-PRO-6000','placement':'resident','steps':15}).status_code,409)
 @override_settings(VIDEOGEN_ALLOW_PAID=True)
 @patch('studio.creative_workspace.submit_modal')
 def test_unknown_balance_and_incompatible_references_cannot_generate(self,submit):
  plan=self.plan();response=self.post('generate/',{'plan':str(plan.pk),'model_id':'wan22-5b','gpu':'RTX-PRO-6000','placement':'resident','steps':15});self.assertEqual(response.status_code,400)
  self.balance();response=self.post('generate/',{'plan':str(plan.pk),'model_id':'wan21-1.3b','gpu':'L4','steps':30});self.assertEqual(response.status_code,400);submit.assert_not_called()
 def test_gallery_export_only_accepts_approved_existing_files(self):
  job=Job.objects.create(project=self.project,budget=self.budget,title='Original',model_id='wan22-5b',gpu='RTX-PRO-6000',status='completed',video='not-found.mp4',in_gallery=True)
  self.assertEqual(self.client.get('/api/creative/gallery/').json()['jobs'],[])
  job.video.save('real.mp4',self.image(),save=True)
  response=self.client.get('/api/creative/gallery/',HTTP_ORIGIN='http://127.0.0.1:5175');self.assertEqual(len(response.json()['jobs']),1);self.assertEqual(response['Access-Control-Allow-Origin'],'http://127.0.0.1:5175')
  job.in_gallery=False;job.save();self.assertEqual(self.client.get(f'/api/creative/gallery/{job.pk}/video/').status_code,404)
 def test_measured_averages_never_become_actual_invoices(self):
  for cost in [.02,.04]:Job.objects.create(project=self.project,budget=self.budget,title='Measured',model_id='ltx-2b',gpu='L40S',status='completed',mode='modal',steps=8,metrics={'historical':True,'archive_cost':cost,'archive_cost_kind':'measured'})
  self.assertAlmostEqual(averages()[0]['mean_usd'],.03)
  data=self.client.get('/api/creative/costs/').json();self.assertTrue(all(j['actual_usd'] is None for j in data['jobs']))
 def test_csrf_required_for_every_new_write(self):
  client=Client(enforce_csrf_checks=True)
  for path in ['projects/','prepare/','generate/','billing/sync/']:self.assertEqual(client.post('/api/creative/'+path).status_code,403)
 def test_bill_uses_title_case_sdk_adjustments_and_no_double_subtraction(self):
  self.balance();state=billing_state();self.assertEqual(state['remaining'],18.36);self.assertEqual(state['credit_used'],11.64)
 @patch('modal.Workspace.from_context')
 def test_billing_sync_reads_summary_and_report_without_compute(self,workspace):
  workspace.return_value.billing.summary.return_value={'metered_cost':'11.77679594','billed_cost':'0','adjustments':{'Credits':'-11.64','Network Egress Allowance':'-.13679594'}}
  workspace.return_value.billing.report.return_value=[{'object_id':'app-test','description':'video','interval_start':'2026-10-28T00:00:00Z','cost':'11.64'}]
  state=sync_billing();self.assertEqual(state['remaining'],18.36);self.assertEqual(len(state['reports']),1);self.assertEqual(workspace.return_value.billing.report.call_args.kwargs['resolution'],'d')
 def test_manual_reconciliation_is_not_a_provider_confirmed_invoice(self):
  Job.objects.create(project=self.project,budget=self.budget,title='Manual',model_id='ltx-2b',gpu='L40S',status='completed',billed_usd=Decimal('.03'))
  row=self.client.get('/api/creative/costs/').json()['jobs'][0];self.assertIsNone(row['actual_usd']);self.assertEqual(row['manual_usd'],.03)
 def test_gallery_rejects_untrusted_origins(self):
  self.assertEqual(self.client.get('/api/creative/gallery/',HTTP_ORIGIN='https://untrusted.example').status_code,403)
 @patch('studio.scene_planner.provider')
 def test_separate_references_are_really_composed_before_video(self,provider):
  import base64
  from studio.scene_planner import compose_reference
  plan=self.plan();plan.reference_mode='separate';plan.character.save('person.png',self.image('person.png'),save=True);plan.save()
  image=self.image();provider.return_value={'data':[{'b64_json':base64.b64encode(image.read()).decode()}]}
  compose_reference(plan);self.assertTrue(plan.reference);self.assertTrue(plan.reference.storage.exists(plan.reference.name))
  self.assertEqual(provider.call_args.args[0],'images/edits');self.assertEqual(provider.call_args.args[1].count(b'name="image[]"'),2)
  self.assertIn(b'consistent scale, light, shadows',provider.call_args.args[1]);self.assertEqual(Job.objects.count(),0)
