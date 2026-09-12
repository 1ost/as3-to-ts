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
    def test_signature_closure_follows_implicit_receivers_and_keeps_unavailable_types_held(self):
        def member(name, result):
            return dict(name=name, access='read', scope='instance', constructor=False, type=result, parameters=[])
        classes = {
            'flash.display.Shape': {'base': None, 'members': [member('graphics', 'flash.display.Graphics')]},
            'flash.display.Graphics': {'base': None, 'members': [member('clear', 'void'), member('unsupported', 'flash.Missing')]},
        }
        self.assertEqual(api.native_type_closure(['flash.display.Shape'], classes, {'graphics', 'clear', 'unsupported'}, classes.__contains__),
                         ['flash.display.Graphics', 'flash.display.Shape'])
        self.assertEqual(api.native_type_closure(['flash.display.Shape'], classes, {'clear'}, classes.__contains__), ['flash.display.Shape'])

    def test_sdk_override_before_public_keeps_the_actual_declaring_class(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'Event.as').write_text('''package flash.events { public class Event {
 public function clone():Event {}
 public function toString():String {}
} }''')
            (root / 'StatusEvent.as').write_text('''package flash.events { public class StatusEvent extends Event {
 override public function clone():Event {}
 public override function toString():String {}
 private function hidden():void {}
} }''')
            members = list(api.native_members(api.read_native_declarations(root), 'flash.events.StatusEvent'))
            self.assertEqual([(m['name'], m['declaredBy']) for m in members],
                [('clone', 'flash.events.StatusEvent'), ('toString', 'flash.events.StatusEvent')])
            self.assertEqual(members[0]['type'], 'flash.events.Event')

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
        self.assertEqual(api.target_arity('<T extends Node = Node>(index: number, classType?: new (...args: any[]) => T) => T'), (1, 2))
        self.assertEqual(api.target_arity('(callback: (x: number, y: number) => void, label?: string) => () => void'), (1, 2))
        self.assertEqual(api.target_arity('<T extends () => void>(callback: T) => T'), (1, 1))
        with self.assertRaisesRegex(ValueError, 'Malformed native parameter signature'):
            api.split_parameters('x: (number]')
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

    def test_native_string_is_nullable_but_numeric_and_boolean_are_not(self):
        member = dict(name='value', access='read', scope='instance', constructor=False,
            signature='public function get value() : String', minArgs=0, maxArgs=0,
            type='String', parameters=[])
        classes = {'flash.events.Payload': {'base': None, 'members': [member]}}
        target = dict(name='value', scope='instance', kind='get+set', signature='string | null')
        row = dict(module='Payload.ts', export='Payload', kind='class', signature='typeof Payload', members=[target])
        args = ('flash.events.Payload', ['base-type', 'instance-member'], row, 'capability', classes, {'value'})
        self.assertEqual(len(api.map_native_members(*args)[0]), 1)
        self.assertEqual(api.map_native_members(*args)[0][0]['sourceRoles'], ['instance-member'])
        for native, target_type in [('Boolean', 'boolean | null'), ('Number', 'number | null'), ('String', 'string | undefined')]:
            member['type'] = native
            target['signature'] = target_type
            self.assertEqual(api.map_native_members(*args), ([], []))

    def test_native_constructor_does_not_admit_extra_host_parameters(self):
        member = dict(name='Loader', access='call', scope='static', constructor=True,
            signature='public function Loader()', minArgs=0, maxArgs=0,
            type='flash.display.Loader', parameters=[])
        classes = {'flash.display.Loader': {'base': None, 'members': [member]}}
        row = dict(module='Loader.ts', export='Loader', kind='class', signature='typeof Loader',
            constructors=['new (host?: NativeHost): Loader'])
        args = ('flash.display.Loader', ['constructor'], row, 'capability', classes, set())
        self.assertEqual(api.map_native_members(*args), ([], []))
        row['constructors'].append('new (): Loader')
        self.assertEqual(len(api.map_native_members(*args)[0]), 1)

if __name__ == '__main__': unittest.main()
