import json
from tempfile import TemporaryDirectory
from unittest.mock import patch
from django.test import override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from studio.test_profiles import ProfileTests
from studio.test_character_sheet import test_png

class CharacterSheetImportTests(ProfileTests):
    def test_import_and_crop_without_generation(self):
        with TemporaryDirectory() as directory, override_settings(MEDIA_ROOT=directory), patch('studio.creative.request_image') as provider:
            metadata={'purpose':'character-sheet','characterId':'mila','sheetWidth':1}
            response=self.client.post(f'/api/projects/{self.project.pk}/assets',{'file':SimpleUploadedFile('mine.png',test_png(),content_type='image/png'),'metadata':json.dumps(metadata)})
            self.assertEqual(response.status_code,201,response.content)
            sheet=response.json()
            self.assertEqual(sheet['metadata']['sheetWidth'],1536)
            self.assertEqual(len(sheet['metadata']['cropBoxes']),5)
            self.assertEqual(self.project.assets.count(),1)
            result=self.client.post('/api/creative/character/crop',{'sheet':sheet['id'],'boxes':sheet['metadata']['cropBoxes']},content_type='application/json')
            self.assertEqual(result.status_code,201,result.content)
            self.assertEqual(len(result.json()['assets']),5)
            self.project.refresh_from_db()
            self.assertNotIn('views',self.project.brief['characters'][0])
            provider.assert_not_called()
            self.client.force_login(self.other)
            self.assertEqual(self.client.post('/api/creative/character/crop',{'sheet':sheet['id'],'boxes':sheet['metadata']['cropBoxes']},content_type='application/json').status_code,404)

    def test_invalid_sheet_is_not_stored(self):
        for character,raw in [('unknown',test_png()),('mila',b'not png')]:
            response=self.client.post(f'/api/projects/{self.project.pk}/assets',{'file':SimpleUploadedFile('mine.png',raw,content_type='image/png'),'metadata':json.dumps({'purpose':'character-sheet','characterId':character})})
            self.assertEqual(response.status_code,400,response.content)
        self.assertEqual(self.project.assets.count(),0)
