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

// A namespace opened by a base compilation unit remains available to an
// inherited class. The source-backed plan records that unit directive on the
// synthetic base used during the child's emission.
const openBase = `package owners {
 import fixture.shared;
 use namespace shared;
 public class OpenBase { shared function clear():int { return 4; } }
}`;
const openChild = `package owners {
 import owners.OpenBase;
 public class OpenChild extends OpenBase {
  public function read():int { return clear(); }
 }
}`;
const openPlan = createNativeSourceAncestryPlan({sources: {
  'fixture.shared': {source: shared}, 'owners.OpenBase': {source: openBase},
  'owners.OpenChild': {source: openChild}
}});
const openOutput = emit(parse('owners.OpenChild.as', openChild), openChild, {
  lineSeparator: '\n', customVisitors: [], namespaceUris: openPlan.namespaceUris,
  nativeSourceAncestry: openPlan
});
assert.match(openOutput, /__as3_namespace_member_/);
assert.doesNotMatch(openOutput, /implicit namespace member requires an explicit selector/);

// The base can be the parsed source while a derived source is installed as a
// synthetic ancestry node. That cross-file relation has no in-file ordering.
const baseOutput = emit(parse('owners.Base.as', base), base, {
  lineSeparator: '\n', customVisitors: [], namespaceUris: plan.namespaceUris,
  nativeSourceAncestry: plan
});
assert.match(baseOutput, /__as3_namespace_member_/);
assert.doesNotMatch(baseOutput, /forward namespace base declaration/);

const provider = createNativeSourceAncestryPlan({
  sources: { 'fixture.shared': { source: shared } },
  providerClasses: {
    'flash.events.EventDispatcher': { dynamic: false, members: [] },
    'flash.display.DisplayObject': {
      base: 'flash.events.EventDispatcher', dynamic: false, members: []
    }
  }
});
const providerChild = `package owners {
 import fixture.shared;
 import flash.display.DisplayObject;
 public class ProviderChild extends DisplayObject {
  shared var value:int = 4;
  public function read():int { return this.shared::value; }
 }
}`;
const providerOutput = emit(parse('owners.ProviderChild.as', providerChild), providerChild, {
  lineSeparator: '\n', customVisitors: [], namespaceUris: provider.namespaceUris,
  nativeSourceAncestry: createNativeSourceAncestryPlan({
    sources: { 'fixture.shared': { source: shared }, 'owners.ProviderChild': { source: providerChild } },
    providerClasses: provider.classes
  })
});
assert.match(providerOutput, /__as3_namespace_member_/);
assert.doesNotMatch(providerOutput, /proven ordinary base/);

const incomplete = createNativeSourceAncestryPlan({ sources: {
  'fixture.shared': { source: shared }, 'owners.Child': { source: child }
} });
assert.throws(() => emit(parse('owners.Child.as', child), child, {
  lineSeparator: '\n', customVisitors: [], namespaceUris: incomplete.namespaceUris,
  nativeSourceAncestry: incomplete
}), /namespace inheritance requires a proven same-file ordinary base/);

console.log('native source ancestry planning and fail-closed emission passed');
