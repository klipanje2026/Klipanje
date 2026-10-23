from django.test import SimpleTestCase
from .continuity import continuity

class ContinuityTests(SimpleTestCase):
    def setUp(self):
        self.brief={'characters':[{'name':'Kerim','aliases':'Kerima, Flegma','prompt':'green eyes','clothing':'blue jeans','outfits':[{'name':'Pidžama','description':'navy plaid','views':{'body-front':'outfit-ref'}}]},{'name':'Ema','clothing':'cream joggers','outfits':[{'name':'Pidžama','description':'pink shirt'}]}], 'scenes':[{'name':'Spavaća soba','prompt':'white blanket','isDefault':True,'referenceId':'room-ref'},{'name':'Kuhinja','prompt':'wood table'}]}
    def test_named_outfit_scoped_to_character(self):
        people,scene,refs=continuity(self.brief,'Kerima odjeća pidzama. Ema drži šalicu.')
        self.assertEqual(people[0]['clothing'],'navy plaid')
        self.assertEqual(people[1]['clothing'],'cream joggers')
        self.assertEqual(people[0]['permanentPrompt'],'green eyes')
        self.assertEqual(scene['prompt'],'white blanket')
        self.assertEqual(refs,['outfit-ref','room-ref'])
    def test_shortcuts_override_defaults_and_do_not_force_cast(self):
        people,scene,refs=continuity(self.brief,'[Lik: Ema; Odjeća: Pidžama]\n[Scena: Kuhinja]')
        self.assertEqual([p['name'] for p in people],['Ema'])
        self.assertEqual(people[0]['clothing'],'pink shirt')
        self.assertEqual(scene['prompt'],'wood table')
        self.assertEqual(refs,[])
        self.assertIsNone(continuity(self.brief,'[Scena: bez]')[1])
    def test_stale_shortcuts_fail_before_paid_generation(self):
        for text in ['[Lik: Nepoznat]','[Lik: Kerim; Odjeća: Nema]','[Scena: Nema]']:
            with self.assertRaises(ValueError):continuity(self.brief,text)
    def test_per_frame_selection_overrides_shared_selection(self):
        people,scene,_=continuity(self.brief,'[Lik: Kerim; Odjeća: Pidžama]\n[Scena: Spavaća soba]\n[Lik: Kerim]\n[Scena: Kuhinja]')
        self.assertEqual(people[0]['clothing'],'blue jeans')
        self.assertEqual(scene['name'],'Kuhinja')

    def test_short_named_outfit_and_name_case(self):
        self.brief['characters'][0].pop('aliases')
        self.brief['characters'][0]['outfits'][0]['name']='Pidžama — tamnoplava'
        self.assertEqual(continuity(self.brief,'Kerima odjeća pidžama')[0][0]['clothing'],'navy plaid')

    def test_ambiguous_shared_clause_does_not_transfer_outfit(self):
        people,_,_=continuity(self.brief,'Kerim i Ema, odjeća pidžama.')
        self.assertEqual([p['clothing'] for p in people],['blue jeans','cream joggers'])
