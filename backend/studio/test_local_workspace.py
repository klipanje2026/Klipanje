import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import Client, TestCase
from .models import LocalAccount, LocalScript, Project, Workspace, Membership


class LocalWorkspaceTests(TestCase):
    def test_initial_users_have_unique_passwords_and_rerun_keeps_them(self):
        with TemporaryDirectory() as directory:
            destination = Path(directory) / 'credentials.txt'
            call_command('bootstrap_local_users', credentials_file=destination, stdout=StringIO())
            initial = destination.read_text(encoding='utf-8')
            users = list(get_user_model().objects.order_by('username'))
            self.assertEqual([user.username for user in users], ['Abdullah', 'Rijad'])
            self.assertNotEqual(users[0].password, users[1].password)
            self.assertTrue(all(user.local_account.must_change_password for user in users))
            self.assertTrue(all(user.memberships.count() == 1 for user in users))
            hashes = [user.password for user in users]
            call_command('bootstrap_local_users', credentials_file=destination, stdout=StringIO())
            self.assertEqual(destination.read_text(encoding='utf-8'), initial)
            self.assertEqual(list(get_user_model().objects.order_by('username').values_list('password', flat=True)), hashes)

    def test_first_login_blocks_tools_until_valid_password_change(self):
        user = get_user_model().objects.create_user(username='Writer', password='InitialTest!82Password')
        LocalAccount.objects.create(user=user)
        client = Client(enforce_csrf_checks=True)
        client.force_login(user)
        self.assertTrue(client.get('/api/auth/me').json()['user']['mustChangePassword'])
        self.assertEqual(client.get('/api/scripts').json()['code'], 'password_change_required')
        body = {'currentPassword': 'InitialTest!82Password', 'newPassword': 'ChangedTest!45Password', 'confirmation': 'ChangedTest!45Password'}
        self.assertEqual(client.post('/api/auth/password', json.dumps(body), content_type='application/json').status_code, 403)
        csrf = client.get('/api/auth/csrf').json()['csrfToken']
        bad = {**body, 'currentPassword': 'wrong'}
        self.assertEqual(client.post('/api/auth/password', json.dumps(bad), content_type='application/json', HTTP_X_CSRFTOKEN=csrf).status_code, 400)
        response = client.post('/api/auth/password', json.dumps(body), content_type='application/json', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['user']['mustChangePassword'])
        user.refresh_from_db()
        self.assertTrue(user.check_password(body['newPassword']))
        self.assertFalse(user.check_password(body['currentPassword']))
        self.assertEqual(client.get('/api/scripts').status_code, 200)

    def test_scripts_stay_with_owner_and_support_editing_and_deletion(self):
        owner = get_user_model().objects.create_user(username='Writer')
        other = get_user_model().objects.create_user(username='OtherWriter')
        workspace=Workspace.objects.create(name='Local')
        Membership.objects.create(user=owner,workspace=workspace,role='owner')
        project=Project.objects.create(workspace=workspace,created_by=owner,name='Test',kind='production')
        self.client.force_login(owner)
        response = self.client.post('/api/scripts', {'project':str(project.pk),'title': 'Moja prica', 'content': 'Prva recenica.\nDruga recenica.'}, content_type='application/json')
        self.assertEqual(response.status_code, 201)
        identifier = response.json()['id']
        route = f'/api/scripts/{identifier}'
        self.client.force_login(other)
        self.assertEqual(self.client.get('/api/scripts').json(), [])
        self.assertEqual(self.client.get(route).status_code, 404)
        self.assertEqual(self.client.patch(route, {'content': 'tudja izmjena'}, content_type='application/json').status_code, 404)
        self.assertEqual(self.client.delete(route).status_code, 404)
        self.client.force_login(owner)
        updated = self.client.patch(route, {'content': '  Nova verzija.\n'}, content_type='application/json')
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()['content'], '  Nova verzija.\n')
        self.assertEqual(self.client.delete(route).status_code, 204)
        self.assertFalse(LocalScript.objects.exists())
