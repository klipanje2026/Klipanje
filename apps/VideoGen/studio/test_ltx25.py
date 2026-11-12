"""Local contract checks; no model downloads, Modal calls or paid generations."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
from django.test import SimpleTestCase
from .catalog import get_model, allowed_gpus
from .services import modal_target
from .views import validate

spec = importlib.util.spec_from_file_location('ltx25_contract', Path(__file__).parents[1] / 'gpu/ltx25_app.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class LTX25Tests(SimpleTestCase):
    def settings(self, model='ltx25-distilled', gpu='RTX-PRO-6000', **changes):
        return {'model_id': model, 'gpu': gpu, 'mode': 'modal', 'placement': 'native',
                'steps': get_model(model)['steps'], 'prompt': 'Two people slowly shake hands.',
                'duration': 5, 'aspect': '16:9', **changes}

    def test_routes_for_both_models_on_rtx(self):
        for model in worker.MODELS:
            for gpu, suffix in [('RTX-PRO-6000', 'rtx')]:
                with self.subTest(model=model, gpu=gpu):
                    values, entry, _ = validate(self.settings(model, gpu))
                    self.assertIn(gpu, allowed_gpus(entry))
                    job = SimpleNamespace(**values)
                    self.assertEqual(modal_target(job), ('videogen-ltx25', 'prepare_ltx25'))
                    self.assertEqual(modal_target(job, True), ('videogen-ltx25', 'generate_ltx25_' + suffix))

    def test_invalid_settings_are_rejected_before_any_submission(self):
        for changes in [{'gpu': 'L4'}, {'steps': 30}, {'duration': 11}, {'render_profile': 'ultra'},
                        {'placement': 'offload'}, {'runtime_budget': 'dollar-v1'}]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                validate(self.settings(**changes))
        for steps in [20, 30, 40]:
            validate(self.settings('ltx25-dev', steps=steps, duration=10))

    def test_every_second_and_only_rtx(self):
        for model in worker.MODELS:
            for seconds in range(1,11):
                values, _, _ = validate(self.settings(model, duration=seconds))
                payload={**values,'seconds':seconds,'reference':b'image'}
                worker.validate_payload(payload,'RTX-PRO-6000')
                args=worker.cli_arguments(payload,worker.component_files(model),'/tmp/test')
                self.assertEqual(args[args.index('--num-frames')+1],str(seconds*24+1))
            for gpu in ['H100-SXM5','B200']:
                with self.assertRaises(ValueError):validate(self.settings(model,gpu))
                with self.assertRaises(ValueError):worker.validate_payload({**payload,'gpu':gpu},gpu)

    def test_components_and_cli_preserve_variant_prompt_and_end_frame(self):
        for model in worker.MODELS:
            values, _, _ = validate(self.settings(model))
            payload = {**values, 'seconds': values['duration'], 'reference': b'image', 'end_reference': b'end',
                       'prompt': 'A hand touches a shoulder; $() stays literal', 'negative_prompt': 'fused fingers'}
            worker.validate_payload(payload, 'RTX-PRO-6000')
            files = worker.component_files(model)
            self.assertIn(worker.MODELS[model] + '-transformer-bf16', files['transformer-path'])
            args = worker.cli_arguments(payload, files, '/tmp/scene')
            self.assertEqual(args[args.index('--prompt') + 1], payload['prompt'])
            self.assertEqual(args.count('--image'), 2)
            self.assertEqual(args[args.index('--num-frames') + 1], '121')
            self.assertIn('120', args)
            self.assertEqual('--distilled-lora' in args, model == 'ltx25-dev')
            self.assertEqual('--negative-prompt' in args, model == 'ltx25-dev')
            self.assertEqual('--num-inference-steps' in args, model == 'ltx25-dev')

    def test_gpu_worker_rejects_wrong_target_and_missing_image(self):
        values, _, _ = validate(self.settings())
        payload = {**values, 'seconds': 5, 'reference': b'image'}
        with self.assertRaises(ValueError):
            worker.validate_payload(payload, 'B200')
        with self.assertRaises(ValueError):
            worker.validate_payload({**payload, 'reference': None}, 'RTX-PRO-6000')

    def test_reference_is_conditioned_midway_while_end_frame_keeps_its_position(self):
        for model in worker.MODELS:
            values, _, _ = validate(self.settings(model))
            payload = {**values, 'seconds': 5, 'reference': b'image', 'end_reference': b'end', 'image_role': 'reference'}
            worker.validate_payload(payload, 'RTX-PRO-6000')
            args = worker.cli_arguments(payload, worker.component_files(model), '/tmp/reference')
            position = args.index('--image')
            self.assertEqual(args[position + 2:position + 4], ['56', '0.5'])
            end_position = args.index('--image', position + 1)
            self.assertEqual(args[end_position + 2:end_position + 4], ['120', '0.8'])

    def test_other_enabled_models_offer_key_durations(self):
        from .catalog import MODELS,duration_options
        for model in MODELS:
            if not model['enabled']:continue
            for seconds in [3,5,7,10]:
                with self.subTest(model=model['id'],seconds=seconds):
                    self.assertIn(seconds,duration_options(model))
                    values,_,_=validate({'model_id':model['id'],'gpu':model['gpu'],'steps':model['steps'],'duration':seconds,'prompt':'A person walks slowly through a forest.','mode':'modal'})
                    self.assertEqual(values['duration'],seconds)
