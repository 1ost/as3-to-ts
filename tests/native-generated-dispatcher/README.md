# Generated EventDispatcher ancestry

Build with `node node_modules/typescript/bin/tsc`, then run
`node tests/native-generated-dispatcher/run.cjs --combined`.
The sibling LayaAir-op2 checkout supplies the authenticated dispatcher-construction
AIR packet and common native provider. The runner compiles both complete original
AS3 subjects; runtime-driver.js only observes the generated classes.

The exact opt-in provider binding is:

```js
'flash.events.EventDispatcher': {
  module: '<common AS3CanonicalEventDispatcherConstruction module>',
  exportName: 'EventDispatcher', nativeBase: 'EventDispatcher'
}
```

The plan imports the canonical declaration and constructor entry. Native state
is prepared before source fields; the explicit super call initializes the same
receiver. Native method closures are bound once by that preparation, preserving
identity when fields capture methods before super. Inherited trait names and
parameter counts use the canonical EventDispatcher surface.

Ten AIR observations pass on ES5 and ES2015 in initialized Laya/Chromium with
zero generated or dependency type errors. Seven compiler rejection cases cover
invalid bindings, missing/repeated/conditional super and a conflicting field.
Fourteen runtime guards reject forged, ordinary-native and repeated generated
entry and verify that prototype resemblance grants no nominal identity. Three
comparison controls reject missing, reordered or changed evidence rows.

Reports retain actual source/output/provider hashes under
.cache/native-generated-dispatcher. Full SoundPlayer dependencies, arbitrary
native overrides/super-method calls, complete generated reflection and whole-game
integration are not qualified by this fixture.
