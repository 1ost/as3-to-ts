'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const test = require('node:test');
const root = path.resolve(__dirname, '../..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const output = require('esbuild').buildSync({stdin: {
  contents: 'export * from "./src/hardened-runtime/AS3ObjectDispatch"; export {installAS3TypeAuthority} from "./src/hardened-runtime/internal/AS3TypeRegistry";',
  resolveDir: root, loader: 'ts'
}, bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent'}).outputFiles[0].text;
const compiled = {exports: {}};
Function('require', 'module', 'exports', output)(require, compiled, compiled.exports);
const runtime = compiled.exports;
const itemBrands = new WeakSet(), childBrands = new WeakSet(), otherBrands = new WeakSet();
const baseBrands = new WeakSet(), ownerBrands = new WeakSet(), probeBrands = new WeakSet();
const collisionBaseBrands = new WeakSet(), collisionOwnerBrands = new WeakSet();
class SlotItem { constructor() { itemBrands.add(this); } }
class SlotChild extends SlotItem { constructor() { super(); childBrands.add(this); } }
class OtherSlotItem { constructor() { otherBrands.add(this); } }
class SlotBase { constructor() { baseBrands.add(this); this.inherited = null; } }
class SlotOwner extends SlotBase {
  constructor() { super(); ownerBrands.add(this); this.button = null; this.numeric = 4; this.unknown = null; }
}
class TypedInstanceComputedProbe { constructor() { probeBrands.add(this); } }
class CollisionBase { constructor() { collisionBaseBrands.add(this); this.shared = null; } }
class CollisionOwner extends CollisionBase { constructor() { super(); collisionOwnerBrands.add(this); } }
const field = (name, type, visibility = 'public') => ({name, kind: 'field', type, visibility, namespaceName: null});
const definitions = [
  ['SlotItem', SlotItem, null, itemBrands, []],
  ['SlotChild', SlotChild, 'SlotItem', childBrands, []],
  ['OtherSlotItem', OtherSlotItem, null, otherBrands, []],
  ['SlotBase', SlotBase, null, baseBrands, [field('inherited', 'SlotItem', 'protected')]],
  ['SlotOwner', SlotOwner, 'SlotBase', ownerBrands, [field('button', 'SlotItem', 'private'), field('numeric', 'int'), field('unknown', 'UnavailableReference')]],
  ['TypedInstanceComputedProbe', TypedInstanceComputedProbe, null, probeBrands, []],
  ['CollisionBase', CollisionBase, null, collisionBaseBrands, [field('shared', 'SlotItem')]],
  ['CollisionOwner', CollisionOwner, 'CollisionBase', collisionOwnerBrands, [field('shared', 'SlotItem', 'private')]],
];
const rows = definitions.map(([qname, , base, , members]) => ({kind: 'class', qname, base, interfaces: [],
  sourceSha256: sha(qname), fields: [], objectTraits: {dynamic: false, members}}));
const metadata = {schema: 'as3-runtime-type-authority@1', qnames: rows.map(row => row.qname), entries: rows};
runtime.installAS3TypeAuthority({schema: metadata.schema, sha256: sha(JSON.stringify(metadata)), qnames: metadata.qnames, entries: rows.map((row, index) => ({...row,
  constructor: definitions[index][1], predicate: value => definitions[index][3].has(value), constructionTarget: null, constructionProof: null}))});
function read(owner, key) { return runtime.as3ObjectRead(owner, key, 'SlotOwner'); }
function exercise(mode) {
  const owner = new SlotOwner(), item = new SlotItem();
  let value = item, key = 'button', outcome;
  if (mode === 1) value = new SlotChild();
  if (mode === 2) value = null;
  if (mode === 3) value = undefined;
  if (mode === 4) value = new OtherSlotItem();
  if (mode === 5) value = 17;
  if (mode === 6) key = 'absent';
  if (mode === 9 || mode === 10) key = 'inherited';
  try {
    if (mode === 7) { value = runtime.as3ObjectRead(owner, key, 'TypedInstanceComputedProbe'); outcome = ['read', value === null]; }
    else if (mode === 8 || mode === 10) { runtime.as3ObjectWrite(owner, key, item, 'TypedInstanceComputedProbe'); outcome = ['write']; }
    else if (mode === 11) { runtime.as3ObjectWrite(null, key, item, 'TypedInstanceComputedProbe'); outcome = ['write']; }
    else { runtime.as3ObjectWrite(owner, key, value, 'SlotOwner'); outcome = ['write', read(owner, key) === value, read(owner, key) === null]; }
  } catch (error) { outcome = [error.name, error.errorID]; }
  return [outcome, owner.button !== null, owner.inherited !== null, read(owner, 'button') === item];
}
test('reference-slot dispatch reproduces all twelve source-bound native controls', () => {
  assert.ok(process.env.HARDENED_FIXTURE_LAYA, 'HARDENED_FIXTURE_LAYA identifies retained native evidence');
  const directory = path.join(process.env.HARDENED_FIXTURE_LAYA, 'tests/nativeFlashOracle/typed-instance-computed-slots');
  const retained = JSON.parse(fs.readFileSync(path.join(directory, 'native-air.json')));
  assert.equal(retained.status, 'passed-native-only');
  assert.equal(Object.keys(retained.sourceFiles).length, 6);
  for (const [file, hash] of Object.entries(retained.sourceFiles))
    assert.equal(sha(fs.readFileSync(path.join(directory, file))), hash, file);
  assert.equal(sha(fs.readFileSync(path.join(directory, 'scenario.json'))), retained.scenarioSha256);
  const capture = retained.capture;
  assert.equal(capture.state.ready, true); assert.equal(capture.state.failure, '');
  const rows = capture.state.observations;
  assert.equal(rows.length, 12);
  rows.forEach((row, mode) => assert.deepEqual(exercise(mode), row.result, row.id));
});
test('nominal rejected stores preserve the prior slot and never call conversion hooks', () => {
  const owner = new SlotOwner(), original = new SlotItem();
  runtime.as3ObjectWrite(owner, 'button', original, 'SlotOwner');
  let hooks = 0;
  for (const wrong of [new OtherSlotItem(), Object.create(SlotItem.prototype), 17,
    {valueOf() { hooks++; return original; }, toString() { hooks++; return 'SlotItem'; }}]) {
    assert.throws(() => runtime.as3ObjectWrite(owner, 'button', wrong, 'SlotOwner'), error => error.name === 'TypeError' && error.errorID === 1034);
    assert.equal(read(owner, 'button'), original);
  }
  assert.equal(hooks, 0);
  assert.equal(runtime.as3ObjectWrite(owner, 'button', undefined, 'SlotOwner'), undefined);
  assert.equal(read(owner, 'button'), null);
});
test('primitive coercion holds and distinct namespace storage collisions remain closed', () => {
  const owner = new SlotOwner(); let hooks = 0;
  assert.throws(() => runtime.as3ObjectWrite(owner, 'numeric', {valueOf() { hooks++; return 8; }}, 'SlotOwner'), {name: 'AS3ObjectDispatchUnavailable'});
  assert.equal(owner.numeric, 4); assert.equal(hooks, 0);
  assert.throws(() => runtime.as3ObjectWrite(owner, 'unknown', null, 'SlotOwner'), {name: 'AS3ObjectDispatchUnavailable'});
  assert.throws(() => runtime.as3ObjectWrite(new CollisionOwner(), 'shared', new SlotItem(), 'CollisionOwner'), /Distinct namespace slots/);
});
