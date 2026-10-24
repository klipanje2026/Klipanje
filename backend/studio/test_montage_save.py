from copy import deepcopy
from django.contrib.auth import get_user_model
from django.test import TestCase
from .models import LocalScript, Project, Workspace, MediaAsset, Membership


class MontageSaveTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(username='editor')
        project = Project.objects.create(workspace=Workspace.objects.create(name='Local'), created_by=user, name='Story', kind='production')
        Membership.objects.create(user=user, workspace=project.workspace, role='owner')
        self.script = LocalScript.objects.create(owner=user, project=project, title='Scene')
        self.url = f'/api/scripts/{self.script.pk}'
        self.client.force_login(user)
        self.doc = {'editor':'edita','files':[], 'data':{'clips':[], 'assets':[], 'captions':{'__script':{'segments':[]}}, 'overlays':[], 'timelineFloor':12}}

    def stored_document(self):
        doc = self.client.get(self.url).json()['storyboard']
        self.assertIn('savedAt', doc)
        doc.pop('savedAt')
        return doc

    def save(self, doc, revision=None):
        data = {'storyboard':doc}
        if revision is not None: data['expectedStoryboardRevision'] = revision
        return self.client.patch(self.url, data, content_type='application/json')

    def test_deleted_items_and_empty_montage_survive_script_updates(self):
        self.assertEqual(self.save(self.doc).status_code, 200)
        self.client.patch(self.url, {'segments':[{'id':'old','text':'Old title','start':0,'end':2}], 'photo_settings':{'style':'chibi'}}, content_type='application/json')
        self.assertEqual(self.stored_document(), self.doc)

    def test_stale_editor_cannot_restore_deleted_clip(self):
        first = deepcopy(self.doc)
        first['data']['clips'] = [{'id':'deleted', 'start':1.2}]
        rev = self.save(first).json()['storyboardRevision']
        saved = self.save(self.doc, rev)
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(self.save(first, rev).status_code, 409)
        self.assertEqual(self.save(first).status_code, 409)
        self.assertEqual(self.stored_document(), self.doc)
        updated = deepcopy(self.doc)
        updated['data']['timelineFloor'] = 16
        self.assertEqual(self.save(updated, saved.json()['storyboardRevision']).status_code, 200)
        self.assertEqual(self.stored_document(), updated)

    def test_unrelated_script_edit_does_not_invalidate_video_save(self):
        rev = self.save(self.doc).json()['storyboardRevision']
        self.client.patch(self.url, {'title':'Renamed'}, content_type='application/json')
        self.assertEqual(self.save(self.doc, rev).status_code, 200)

    def test_video_save_time_is_not_changed_by_renaming_script(self):
        saved = self.save(self.doc).json()['storyboard']['savedAt']
        self.client.patch(self.url, {'title':'New name'}, content_type='application/json')
        self.assertEqual(self.client.get(self.url).json()['storyboard']['savedAt'], saved)

    def test_new_script_cannot_be_overwritten_by_stale_editor(self):
        initial = self.save(self.doc).json()
        fresh_segments = [{'id':'new', 'text':'New narration', 'start':0, 'end':5}]
        self.client.patch(self.url, {'segments':fresh_segments}, content_type='application/json')
        response = self.client.patch(self.url, {
            'expectedStoryboardRevision':initial['storyboardRevision'],
            'expectedScriptUpdatedAt':initial['updated_at'],
            'segments':[], 'storyboard':self.doc,
        }, content_type='application/json')
        self.assertEqual(response.status_code, 409)
        fresh = self.client.get(self.url).json()
        self.assertEqual(fresh['segments'], fresh_segments)
        self.assertEqual(self.client.patch(self.url, {
            'expectedStoryboardRevision':fresh['storyboardRevision'],
            'expectedScriptUpdatedAt':fresh['updated_at'],
            'segments':fresh_segments, 'storyboard':self.doc,
        }, content_type='application/json').status_code, 200)

    def test_checkpoint_is_immutable_and_restore_keeps_current_as_backup(self):
        first = self.save(self.doc).json()
        version = self.client.post(self.url+'/versions', {'expectedStoryboardRevision':first['storyboardRevision'], 'title':'First cut'}, content_type='application/json')
        self.assertEqual(version.status_code, 201)
        self.assertEqual(self.client.get(self.url).json()['storyboard'], first['storyboard'])
        changed = deepcopy(self.doc)
        changed['data']['timelineFloor'] = 24
        latest = self.save(changed, first['storyboardRevision']).json()
        self.client.patch(self.url, {'content':'Changed story', 'segments':[{'id':'a','start':0,'end':3,'text':'Changed story'}]}, content_type='application/json')
        restored = self.client.post(self.url+'/versions/'+version.json()['id']+'/restore', {'expectedStoryboardRevision':latest['storyboardRevision']}, content_type='application/json')
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(restored.json()['storyboard']['data']['timelineFloor'], 12)
        self.assertEqual(restored.json()['content'], '')
        versions = self.client.get(self.url+'/versions').json()
        self.assertEqual(len(versions), 2)
        backup = self.client.post(self.url+'/versions/'+versions[0]['id']+'/restore', {'expectedStoryboardRevision':restored.json()['storyboardRevision']}, content_type='application/json')
        self.assertEqual(backup.status_code, 200)
        self.assertEqual(backup.json()['storyboard']['data']['timelineFloor'], 24)
        self.assertEqual(backup.json()['content'], 'Changed story')

    def test_version_actions_require_current_revision_and_owner(self):
        saved = self.save(self.doc).json()
        self.assertEqual(self.client.post(self.url+'/versions', {}, content_type='application/json').status_code, 409)
        version = self.client.post(self.url+'/versions', {'expectedStoryboardRevision':saved['storyboardRevision']}, content_type='application/json').json()
        self.assertEqual(self.client.post(self.url+'/versions/'+version['id']+'/restore', {'expectedStoryboardRevision':'stale'}, content_type='application/json').status_code, 409)
        self.assertEqual(len(self.client.get(self.url+'/versions').json()), 1)
        stranger = get_user_model().objects.create_user(username='stranger')
        self.client.force_login(stranger)
        self.assertEqual(self.client.get(self.url+'/versions').status_code, 404)
        self.assertEqual(self.client.post(self.url+'/versions/'+version['id']+'/restore', {}, content_type='application/json').status_code, 404)

    def test_version_keeps_media_after_current_timeline_removes_it(self):
        asset = MediaAsset.objects.create(project=self.script.project, name='version.wav', file='test/version.wav', size=12, content_type='audio/wav')
        doc = deepcopy(self.doc)
        doc['files'] = [{'key':'audio', 'id':str(asset.pk)}]
        doc['data']['clips'] = [{'id':'voice', 'assetId':'audio'}]
        first = self.save(doc).json()
        self.assertEqual(self.client.post(self.url+'/versions', {'expectedStoryboardRevision':first['storyboardRevision']}, content_type='application/json').status_code, 201)
        self.assertEqual(self.save(self.doc, first['storyboardRevision']).status_code, 200)
        self.assertEqual(self.client.delete(f'/api/assets/{asset.pk}').status_code, 204)
        asset.refresh_from_db()
        self.assertTrue(asset.metadata['archived'])
        self.assertFalse(asset.metadata['gallery'])

    def test_preeditor_replacement_keeps_source_and_backs_up_atomically(self):
        self.script.content='Keep source *direction*'
        self.script.segments=[{'id':'a','text':'Keep source','start':0,'end':3}]
        self.script.save()
        first=self.save(self.doc).json()
        next_doc=deepcopy(self.doc)
        next_doc['data']['preeditor']={'version':1}
        next_doc['data']['timelineFloor']=7
        payload={'storyboard':next_doc,'backupStoryboard':True,'expectedStoryboardRevision':first['storyboardRevision'],'expectedScriptUpdatedAt':first['updated_at']}
        result=self.client.patch(self.url,payload,content_type='application/json')
        self.assertEqual(result.status_code,200)
        self.script.refresh_from_db()
        self.assertEqual(self.script.content,'Keep source *direction*')
        self.assertEqual(self.script.segments[0]['end'],3)
        self.assertEqual(self.script.video_versions.count(),1)
        self.assertEqual(self.script.video_versions.first().snapshot['storyboard']['data']['timelineFloor'],12)
        self.assertEqual(self.client.patch(self.url,payload,content_type='application/json').status_code,409)
        self.assertEqual(self.script.video_versions.count(),1)

    def test_preeditor_draft_roundtrip_does_not_replace_timeline(self):
        first=self.save(self.doc).json()
        plan={'version':1,'blocks':[{'id':'custom','sourceIds':['a'],'imageIds':['photo'],'audioIds':['voice'],'captionIds':['a'],'filler':False,'duration':3}],'spacing':0.5,'entryEnabled':True}
        response=self.client.patch(self.url,{'preeditorPlan':plan,'expectedScriptUpdatedAt':first['updated_at']},content_type='application/json')
        self.assertEqual(response.status_code,200)
        reloaded=self.client.get(self.url).json()
        self.assertEqual(reloaded['photo_settings']['preeditor'],plan)
        self.assertEqual(reloaded['storyboard'],first['storyboard'])
        self.assertEqual(self.script.video_versions.count(),0)

    def test_stale_photo_page_cannot_overwrite_preeditor_and_history_survives(self):
        first=self.client.get(self.url).json()
        old={'version':1,'blocks':[{'id':'old'}]}
        new={'version':1,'blocks':[{'id':'hand-edited','duration':8.2}]}
        saved=self.client.patch(self.url,{'preeditorPlan':old,'expectedScriptUpdatedAt':first['updated_at']},content_type='application/json').json()
        response=self.client.patch(self.url,{'preeditorPlan':new,'expectedScriptUpdatedAt':saved['updated_at']},content_type='application/json')
        self.assertEqual(response.status_code,200)
        for stale in [{'format':'9:16','preeditor':old},{'format':'1:1'}]:
            response=self.client.patch(self.url,{'photo_settings':stale},content_type='application/json')
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.json()['photo_settings']['preeditor'],new)
        history=self.client.get(self.url+'/preeditor-versions').json()
        self.assertEqual([v['plan'] for v in history],[new,old])
        self.assertEqual(self.client.patch(self.url,{'preeditorPlan':old,'expectedScriptUpdatedAt':saved['updated_at']},content_type='application/json').status_code,409)
        self.assertEqual(self.client.patch(self.url,{'preeditorPlan':old},content_type='application/json').status_code,409)
        stranger=get_user_model().objects.create_user(username='preeditor-stranger')
        self.client.force_login(stranger)
        self.assertEqual(self.client.get(self.url+'/preeditor-versions').status_code,404)
