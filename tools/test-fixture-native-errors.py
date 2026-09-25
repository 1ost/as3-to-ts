#!/usr/bin/env python3
"""Global builtin census must retain actual SDK classes and their bases."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location('fixture_profile', Path(__file__).with_name('create-fixture-profile.py'))
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)

class NativeErrorCensusTest(unittest.TestCase):
    def extract(self, has_security):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact = root / 'frameworks/libs/air/airglobal.swc'
            artifact.parent.mkdir(parents=True)
            with zipfile.ZipFile(artifact, 'w') as archive:
                archive.writestr('library.swf', b'fixture SDK archive payload')
            output = root / 'output'
            output.mkdir()
            abc = 'public dynamic class Object\n{\n}\npublic dynamic class Array extends Object\n{\n}\npublic dynamic class Error extends Object\n{\npublic function get errorID():int\n}\n'
            if has_security:
                abc += 'public dynamic class SecurityError extends Error\n{\npublic function SecurityError(*,*):*\n}\n'
            with patch.object(api.subprocess, 'run', return_value=types.SimpleNamespace(stdout=abc)) as run:
                path, count, _ = api.source_members(root, output, set())
                self.assertEqual(run.call_args.args[0][1], '-abc')
                document = json.loads(path.read_text())
                self.assertEqual(count, 4)
                self.assertEqual(document['sourceArtifactSha256'], hashlib.sha256(artifact.read_bytes()).hexdigest())
                rows = {row['qname']: row for row in document['entries']}
                self.assertEqual(rows['SecurityError']['baseQName'], 'Error')
                self.assertEqual(rows['SecurityError']['ownInstanceMemberNames'], [])
                self.assertEqual(rows['Error']['baseQName'], 'Object')
                self.assertEqual(rows['Error']['ownInstanceMemberNames'], ['errorID'])
                self.assertIsNone(rows['Object']['baseQName'])

    def test_global_builtin_follows_native_base_chain(self):
        self.extract(True)

    def test_missing_sdk_builtin_does_not_fabricate_authority(self):
        with self.assertRaisesRegex(KeyError, 'SecurityError'):
            self.extract(False)

if __name__ == '__main__':
    unittest.main()
