#!/usr/bin/env python3
"""Regression checks for retained native SDK signatures and target admission."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('native_api', Path(__file__).with_name('native-api-profile.py'))
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)

class NativeSignaturesTest(unittest.TestCase):
    def test_wildcard_types_defaults_and_declaring_owner(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'Matrix.as').write_text('package flash.geom { public class Matrix {} }')
            (root / 'Base.as').write_text('''package flash.display {
import flash.geom.*;
import flash.geom.*;
public class Base {
 public function Base(value:int = 7) {}
 public function draw(matrix:Matrix = null, label:String = "a,b"):void {}
 public function get width():Number {}
}
}''')
            (root / 'Child.as').write_text('package flash.display { public class Child extends Base {} }')
            classes = api.read_native_declarations(root)
            members = list(api.native_members(classes, 'flash.display.Child'))
            draw = next(m for m in members if m['name'] == 'draw')
            self.assertEqual(draw['parameters'][0]['type'], 'flash.geom.Matrix')
            self.assertEqual(draw['minArgs'], 0)
            self.assertEqual(draw['maxArgs'], 2)
            self.assertEqual(draw['declaredBy'], 'flash.display.Base')
            self.assertFalse(any(m['constructor'] for m in members))
            self.assertEqual(draw['parameters'][1]['default'], '"a,b"')

    def test_unknown_type_is_not_invented(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, 'C.as').write_text('package p { public class C {\npublic function f(x:Missing):void {}\n} }')
            with self.assertRaisesRegex(ValueError, 'Unresolved native signature type'):
                api.read_native_declarations(directory)

    def test_target_arity_preserves_optional_and_generic_arguments(self):
        self.assertEqual(api.target_arity('<T extends LayaNode>(child: T) => T'), (1, 1))
        self.assertEqual(api.target_arity('(x: number, y?: number) => void'), (1, 2))
        self.assertEqual(api.target_arity('(x: number, ...args: unknown[]) => void'), (1, 1000000))
        self.assertIsNone(api.target_arity('number'))

    def test_member_requires_compatible_target_type_and_arity(self):
        member = dict(name='width', access='read', scope='instance', constructor=False,
            signature='public function get width() : Number', minArgs=0, maxArgs=0,
            type='Number', parameters=[])
        classes = {'flash.display.Base': {'base':None, 'members':[member]}}
        row = dict(module='src/layaAir/flash/display/Base.ts', export='Base', kind='class', signature='typeof Base',
            members=[dict(name='width', scope='instance', kind='get+set', signature='boolean')])
        args = ('flash.display.Base', ['instance-member'], row, 'capability', classes, {'width'})
        self.assertEqual(api.map_native_members(*args), ([], []))
        row['members'][0]['signature'] = 'get number; set unknown'
        self.assertEqual(len(api.map_native_members(*args)[0]), 1)

if __name__ == '__main__': unittest.main()
