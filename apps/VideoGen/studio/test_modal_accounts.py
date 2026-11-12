import json,tempfile
from pathlib import Path
from unittest.mock import patch,MagicMock,sentinel
from django.test import TestCase,override_settings,Client
from django.conf import settings
from studio.models import ModalAccount,ModalSelection,BillingSnapshot,Job,Budget
from studio.modal_accounts import ensure_accounts,accounts_state,client_for,start_login
from studio.provider_billing import current_cycle
from studio.services import submit_modal,poll_modal,check_modal_worker
class ModalAccountTests(TestCase):
 def setUp(self):
  self.profiles={'first':{'token_id':'id-first','token_secret':'secret-first','active':True},'second':{'token_id':'id-second','token_secret':'secret-second'}}
  self.profile_patch=patch('studio.modal_accounts.configured_profiles',side_effect=lambda:self.profiles);self.profile_patch.start();self.addCleanup(self.profile_patch.stop)
  alias=patch('studio.creative_workspace.configured_profiles',side_effect=lambda:self.profiles);alias.start();self.addCleanup(alias.stop)
  self.first=ensure_accounts();self.second=ModalAccount.objects.get(profile='second');self.second.monthly_credit=30;self.second.save()
  self.budget=Budget.objects.create(name='creative',limit_usd=30)
 def post(self,path,data):return self.client.post('/api/creative/'+path,json.dumps(data),content_type='application/json')
 def job(self):return Job.objects.create(budget=self.budget,title='Pinned',model_id='wan22-5b',style='3d',gpu='RTX-PRO-6000',placement='resident',steps=15,mode='modal',status='running',modal_call_id='fc-test',modal_account=self.first)
 def test_account_balances_are_separate_in_same_cycle_and_no_secrets_returned(self):
  for account,used in [(self.first,'11.64'),(self.second,'2.00')]:BillingSnapshot.objects.create(account=account,cycle=current_cycle(),payload={'monthly_credit_usd':'30','summary':{'metered_cost':used,'billed_cost':'0','adjustments':{'credits':'-'+used}}})
  first=self.client.get('/api/creative/bootstrap/').json();self.assertEqual(first['billing']['remaining'],18.36)
  self.assertEqual(self.post('accounts/select/',{'account':self.second.pk}).status_code,200)
  second=self.client.get('/api/creative/bootstrap/').json();self.assertEqual(second['billing']['remaining'],28);self.assertEqual(second['selected_account'],self.second.pk)
  self.assertNotIn('secret-first',json.dumps(second));self.assertNotIn('secret-second',json.dumps(second));self.assertEqual(BillingSnapshot.objects.count(),2)
 @patch('studio.modal_accounts.client_for',return_value=sentinel.first_client)
 @patch('modal.Function.from_name')
 def test_both_preparation_and_gpu_phase_use_pinned_account_after_switch(self,lookup,client):
  job=self.job();self.post('accounts/select/',{'account':self.second.pk});lookup.return_value.spawn.return_value.object_id='fc-new'
  submit_modal(job);submit_modal(job,prepared=True)
  self.assertTrue(all(c.kwargs['client'] is sentinel.first_client for c in lookup.call_args_list));self.assertTrue(all(c.args[0].pk==self.first.pk for c in client.call_args_list))
 @patch('studio.modal_accounts.client_for',return_value=sentinel.first_client)
 @patch('modal.FunctionCall.from_id')
 def test_polling_and_cancel_stay_on_original_account(self,lookup,client):
  job=self.job();self.post('accounts/select/',{'account':self.second.pk});lookup.return_value.get.side_effect=TimeoutError()
  poll_modal(job);self.assertEqual(lookup.call_args.kwargs['client'],sentinel.first_client)
  response=self.client.post(f'/api/jobs/{job.pk}/cancel/');self.assertEqual(response.status_code,200);self.assertEqual(lookup.call_args.kwargs['client'],sentinel.first_client);self.assertEqual(client.call_args.args[0].pk,self.first.pk)
 @patch('studio.modal_accounts.client_for',return_value=sentinel.first_client)
 @patch('modal.Function.from_name')
 def test_preflight_only_looks_up_worker_without_spawning(self,lookup,client):
  check_modal_worker(self.job());self.assertEqual(lookup.call_count,2);lookup.return_value.spawn.assert_not_called()
 def test_unknown_unconfigured_account_cannot_be_selected(self):
  self.profiles.pop('second');response=self.post('accounts/select/',{'account':self.second.pk});self.assertEqual(response.status_code,400);self.assertEqual(ModalSelection.objects.get(pk=1).account_id,self.first.pk)
 def test_credit_edit_does_not_alter_other_account(self):
  response=self.client.patch(f'/api/creative/accounts/{self.second.pk}/',json.dumps({'monthly_credit':'50'}),content_type='application/json');self.assertEqual(response.status_code,200);self.first.refresh_from_db();self.assertEqual(self.first.monthly_credit,30)
 def test_account_mutations_require_csrf(self):
  browser=Client(enforce_csrf_checks=True)
  for route in ['accounts/select/','accounts/connect/']:self.assertEqual(browser.post('/api/creative/'+route).status_code,403)
 @patch('studio.modal_accounts.subprocess.Popen')
 def test_new_login_preserves_global_profile_and_keeps_tokens_out_of_arguments(self,process):
  from studio import modal_accounts
  modal_accounts._logins.clear();self.addCleanup(modal_accounts._logins.clear);process.return_value.poll.return_value=None
  runtime=Path(settings.BASE_DIR)/'.runtime';runtime.mkdir(exist_ok=True)
  with tempfile.TemporaryDirectory(dir=runtime) as tmp,override_settings(BASE_DIR=Path(tmp)):
   result=start_login('github-3','Third',30);args=process.call_args.args[0]
   self.assertIn('--no-activate',args);self.assertIn('github-3',args);self.assertNotIn('secret-first',' '.join(args));self.assertEqual(result['status'],'waiting');self.assertEqual(ModalSelection.objects.get(pk=1).account_id,self.first.pk)
 def test_invalid_profile_never_launches_process(self):
  with patch('studio.modal_accounts.subprocess.Popen') as process:
   with self.assertRaises(ValueError):start_login('../escape','x',30)
   process.assert_not_called()
 @patch('studio.modal_accounts.subprocess.Popen')
 def test_renewal_preserves_account_budget_and_waits_for_new_credentials(self,process):
  from studio import modal_accounts
  modal_accounts._logins.clear();self.addCleanup(modal_accounts._logins.clear);process.return_value.poll.return_value=None
  with tempfile.TemporaryDirectory(dir=Path(settings.BASE_DIR)/'.runtime') as tmp,override_settings(BASE_DIR=Path(tmp)):
   result=start_login('first','Must not overwrite label',999,renew=True)
   self.assertEqual(result['status'],'waiting');self.assertFalse(result['configured'])
   self.first.refresh_from_db();self.assertEqual(self.first.monthly_credit,30);self.assertNotEqual(self.first.label,'Must not overwrite label')
   self.assertEqual(ModalSelection.objects.get(pk=1).account_id,self.first.pk)
   self.profiles['first']={**self.profiles['first'],'token_secret':'new-secret'}
   with patch('studio.modal_accounts.client_for',return_value=sentinel.first_client):
    self.assertTrue(modal_accounts.login_state('first')['configured'])
 @patch('modal.Client.from_credentials')
 def test_expired_credentials_get_clear_message_without_leaking_provider_text(self,client):
  import modal
  from studio import modal_accounts
  with patch.dict(modal_accounts._clients,{},clear=True):
   client.side_effect=modal.exception.AuthError('Token expired secret-first')
   with self.assertRaisesRegex(ValueError,'Obnovi prijavu') as caught:client_for(self.first)
   self.assertNotIn('secret-first',str(caught.exception))
 @patch('modal.Workspace.from_context')
 @patch('modal.Client.from_credentials')
 def test_renewal_cannot_reassign_existing_budget_to_wrong_workspace(self,client,workspace):
  from studio import modal_accounts
  self.first.workspace_name='expected';self.first.save();workspace.return_value.name='different'
  with patch.dict(modal_accounts._clients,{},clear=True):
   with self.assertRaisesRegex(ValueError,'drugi workspace'):client_for(self.first)
  self.first.refresh_from_db();self.assertEqual(self.first.workspace_name,'expected');self.assertEqual(self.first.monthly_credit,30)
 def test_renewal_requires_csrf(self):
  self.assertEqual(Client(enforce_csrf_checks=True).post(f'/api/creative/accounts/{self.first.pk}/renew/').status_code,403)
 @patch('modal.Workspace.from_context')
 @patch('modal.Client.from_credentials')
 def test_lazy_workspace_is_loaded_before_account_identity_comparison(self,client,workspace):
  from studio import modal_accounts
  self.first.workspace_name='expected';self.first.save();workspace.return_value.name=None
  def hydrate():workspace.return_value.name='expected'
  workspace.return_value.hydrate.side_effect=hydrate
  with patch.dict(modal_accounts._clients,{},clear=True):
   self.assertIs(client_for(self.first),client.return_value)
  workspace.return_value.hydrate.assert_called_once()
