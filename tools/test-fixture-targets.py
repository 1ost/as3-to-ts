#!/usr/bin/env python3
"""Prove facade identity without changing ordinary bridge consumers."""
import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('fixture_profile', Path(__file__).with_name('create-fixture-profile.py'))
profile = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profile)


class FixtureTargetsTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.prefix = 'src/layaAir/flash/events/'
        self.qname = 'flash.events.EventDispatcher'
        self.proof = {}

    def put(self, name, text):
        path = self.root / self.prefix / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        return self.prefix + name

    def digest(self, module):
        return hashlib.sha256((self.root / module).read_text().replace('\r\n', '\n').encode()).hexdigest()

    def setup_facade(self, kind='class', export='EventDispatcher'):
        self.core = self.put('Core.ts', f'export {kind} {export} {{}}')
        self.facade = self.put('EventDispatcher.ts', f'export {{ {export} as EventDispatcher }} from "./Core";')
        self.row = {'module': self.core, 'export': export, 'kind': kind, 'sha256': self.digest(self.core)}
        self.target = {'capabilities': [{'id': 'api.flash.events', 'status': 'typescript-obligation',
                                        'obligations': [self.row]}]}
        self.predicates = {self.qname: {'targetModule': self.facade, 'targetCapabilityId': 'api.flash.events',
                                      'constructorExport': 'EventDispatcher', 'interfaceExport': 'EventDispatcher',
                                      'kind': kind, 'moduleSha256': self.digest(self.facade)}}

    def resolve(self):
        return profile.resolve_fixture_target(self.qname, self.target, self.predicates, self.root, self.proof)

    def replace_facade(self, source):
        self.put('EventDispatcher.ts', source)
        self.predicates[self.qname]['moduleSha256'] = self.digest(self.facade)

    def test_existing_direct_obligation_is_unchanged(self):
        self.setup_facade()
        self.predicates[self.qname]['targetModule'] = self.core
        self.assertEqual(self.resolve(), ('api.flash.events', self.row))
        self.assertEqual(self.proof, {})

    def test_class_reexport_records_resolved_source_bytes(self):
        self.setup_facade()
        self.assertEqual(self.resolve()[1], self.row)
        self.assertIn(str(self.root / self.core), self.proof)
        self.assertIn(str(self.root / self.facade), self.proof)

    def test_renamed_transitive_reexport_uses_symbol_identity(self):
        self.setup_facade(export='NativeDispatcher')
        middle = self.put('Middle.ts', 'export { NativeDispatcher as Shared } from "./Core";')
        self.replace_facade('export { Shared as EventDispatcher } from "./Middle";')
        self.assertEqual(self.resolve()[1]['export'], 'NativeDispatcher')
        self.assertIn(str(self.root / middle), self.proof)

    def test_type_only_interface_reexport(self):
        self.setup_facade(kind='interface')
        self.replace_facade('export type { EventDispatcher } from "./Core";')
        self.assertEqual(self.resolve()[1]['kind'], 'interface')

    def test_merged_interface_const_retains_actual_obligation_kind(self):
        self.setup_facade(kind='interface')
        self.put('Core.ts', 'export interface EventDispatcher {}\nexport const EventDispatcher = {};')
        self.row.update(kind='const', sha256=self.digest(self.core))
        self.assertEqual(self.resolve()[1], self.row)
        self.assertIn(str(self.root / self.core), self.proof)

    def test_plain_const_is_not_an_interface(self):
        self.setup_facade(kind='interface')
        self.put('Core.ts', 'export const EventDispatcher = {};')
        self.row.update(kind='const', sha256=self.digest(self.core))
        with self.assertRaisesRegex(ValueError, 'No unique defining obligation'):
            self.resolve()

    def test_merged_interface_mutable_value_is_not_a_const(self):
        self.setup_facade(kind='interface')
        self.put('Core.ts', 'export interface EventDispatcher {}\nexport let EventDispatcher = {};')
        self.row.update(kind='const', sha256=self.digest(self.core))
        with self.assertRaisesRegex(ValueError, 'No unique defining obligation'):
            self.resolve()

    def test_same_name_without_same_class_is_rejected(self):
        self.setup_facade()
        self.replace_facade('export class EventDispatcher {}')
        with self.assertRaisesRegex(ValueError, 'No unique defining obligation'):
            self.resolve()

    def test_value_alias_cannot_impersonate_constructor_declaration(self):
        self.setup_facade()
        self.replace_facade('import { EventDispatcher as Core } from "./Core"; export const EventDispatcher = Core;')
        with self.assertRaisesRegex(ValueError, 'No unique defining obligation'):
            self.resolve()

    def test_duplicate_defining_obligations_are_rejected(self):
        self.setup_facade()
        self.target['capabilities'][0]['obligations'].append(dict(self.row))
        with self.assertRaisesRegex(ValueError, 'No unique defining obligation'):
            self.resolve()

    def test_changed_facade_bytes_are_rejected(self):
        self.setup_facade()
        self.put('EventDispatcher.ts', 'export { EventDispatcher } from "./Core"; // drift')
        with self.assertRaisesRegex(ValueError, 'facade hash mismatch'):
            self.resolve()

    def test_changed_owned_bytes_are_rejected(self):
        self.setup_facade()
        self.put('Core.ts', 'export class EventDispatcher { changed = true; }')
        with self.assertRaisesRegex(ValueError, 'obligation hash mismatch'):
            self.resolve()

    def test_ambiguous_star_exports_are_rejected(self):
        self.setup_facade()
        self.put('Other.ts', 'export class EventDispatcher {}')
        self.replace_facade('export * from "./Core"; export * from "./Other";')
        with self.assertRaisesRegex(ValueError, 'Ambiguous bridge declaration or export'):
            self.resolve()

    def test_cyclic_aliases_are_rejected(self):
        self.setup_facade()
        self.put('Cycle.ts', 'export { EventDispatcher } from "./EventDispatcher";')
        self.replace_facade('export { EventDispatcher } from "./Cycle";')
        with self.assertRaisesRegex(ValueError, 'No unique defining obligation'):
            self.resolve()


if __name__ == '__main__':
    unittest.main()
