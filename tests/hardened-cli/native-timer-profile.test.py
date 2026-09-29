"""Fixture profiles retain SDK signatures for the already authenticated timer runtime."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('native_api', ROOT / 'tools/native-api-profile.py')
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)


class TimerProfileTest(unittest.TestCase):
    def test_sdk_signatures_are_retained_and_missing_evidence_rejected(self):
        signatures = {
            'getTimer': ('public native function getTimer() : int;', 0, 0),
            'setTimeout': ('public function setTimeout(closure:Function, delay:Number, ... arguments) : uint', 2, None),
            'setInterval': ('public function setInterval(closure:Function, delay:Number, ... arguments) : uint', 2, None),
            'clearTimeout': ('public function clearTimeout(id:uint) : void', 1, 1),
            'clearInterval': ('public function clearInterval(id:uint) : void', 1, 1),
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scripts = root / 'scripts/flash/utils'
            scripts.mkdir(parents=True)
            for name, (signature, minimum, maximum) in signatures.items():
                file = scripts / (name + '.as')
                file.write_text('package flash.utils {\n' + signature + '\n}\n')
                rows = [{'qname': 'flash.utils.' + name, 'roles': ['import']}]
                result = api.native_timer_member_uses(rows, root)
                self.assertEqual(result[0]['signatures'], [{'signature': signature, 'minArgs': minimum, 'maxArgs': maximum}])
                self.assertEqual(rows[0]['roles'], ['import', 'package-function'])
                file.write_text('package flash.utils {}')
                with self.assertRaises(ValueError):
                    api.native_timer_member_uses(rows, root)
            self.assertEqual(api.native_timer_member_uses([{'qname': 'flash.display.Sprite'}], root), [])


if __name__ == '__main__':
    unittest.main()
