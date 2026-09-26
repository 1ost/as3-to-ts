import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('fixture_profile', Path(__file__).resolve().parents[2] / 'tools/create-fixture-profile.py')
profile = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profile)

class LocalWildcard(unittest.TestCase):
    def test_retained_packages_resolve_without_changing_closure_or_flash_inventory(self):
        qnames = {'FileLocalSignatureProbe', 'one.Owner', 'two.Owner'}
        before = set(qnames)
        self.assertEqual(profile.fixture_flash_imports(['one.*', 'two.*', 'flash.utils.Endian', 'one.Owner'], qnames), ['flash.utils.Endian'])
        self.assertEqual(qnames, before)
        self.assertEqual(profile.fixture_flash_imports(['one.*', 'two.*'], qnames), [])

    def test_missing_sibling_subpackage_and_flash_wildcards_fail_closed(self):
        for imported, retained in [('missing.*', {'one.Owner'}), ('one.*', {'one.child.Owner'}),
                                   ('flash.*', {'flash.Owner'}), ('flash.display.*', {'flash.display.Sprite'}),
                                   ('one.**', {'one.Owner'}), ('one.*.Owner', {'one.Owner'}),
                                   ('one.Other', {'one.Owner'})]:
            with self.subTest(imported=imported), self.assertRaises(ValueError):
                profile.fixture_flash_imports([imported], retained)

    def test_wildcard_does_not_authorize_unretained_explicit_reference(self):
        with self.assertRaises(ValueError):
            profile.fixture_flash_imports(['one.*', 'one.Missing'], {'one.Owner'})
        self.assertEqual(profile.fixture_flash_imports(['flash.events.Event', 'flash.events.Event'], set()), ['flash.events.Event'])

if __name__ == '__main__':
    unittest.main()
