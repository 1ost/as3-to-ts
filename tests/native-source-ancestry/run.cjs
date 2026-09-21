const assert = require('assert');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const { createNativeSourceAncestryPlan } = require('../../lib');

const shared = 'package fixture { public namespace shared = "urn:cross-file"; }';
const base = `package owners {
 import fixture.shared;
 public class Base {
  shared var value:int = 3;
  shared function read():String { return "base:" + shared::value; }
 }
}`;
const child = `package owners {
 import fixture.shared;
 import owners.Base;
 public class Child extends Base {
  override shared function read():String { return "child:" + shared::value; }
  public function readValue():String { return this.shared::read(); }
 }
}`;

const plan = createNativeSourceAncestryPlan({ sources: {
  'fixture.shared': { source: shared },
  'owners.Base': { source: base },
  'owners.Child': { source: child }
} });
assert.strictEqual(plan.classes['owners.Child'].base, 'owners.Base');
assert.strictEqual(plan.classes['owners.Base'].members[0].name, 'value');
assert.strictEqual(plan.namespaceUris['fixture.shared'], 'urn:cross-file');

const output = emit(parse('owners.Child.as', child), child, {
  lineSeparator: '\n', customVisitors: [], namespaceUris: plan.namespaceUris,
  nativeSourceAncestry: plan
});
assert.match(output, /__as3_namespace_member_/);
assert.doesNotMatch(output, /namespace inheritance requires/);

const incomplete = createNativeSourceAncestryPlan({ sources: {
  'fixture.shared': { source: shared }, 'owners.Child': { source: child }
} });
assert.throws(() => emit(parse('owners.Child.as', child), child, {
  lineSeparator: '\n', customVisitors: [], namespaceUris: incomplete.namespaceUris,
  nativeSourceAncestry: incomplete
}), /namespace inheritance requires a proven same-file ordinary base/);

console.log('native source ancestry planning and fail-closed emission passed');
