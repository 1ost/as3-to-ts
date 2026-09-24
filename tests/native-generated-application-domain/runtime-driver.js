// AIR host observer adaptation; all four callback/known Class subjects are emitted unchanged.
// Native scope publications below stand in for host loading, not source Loader qualification.
const root = api.ApplicationDomain.currentDomain, childScope = new api.ApplicationDomain(root);
const parentDomain = api.createAS3ScriptDomain(root), childDomain = api.createAS3ScriptDomain(childScope);
const parent = createDomainLoader(parentDomain), childLoader = createDomainLoader(childDomain);
const get = (load, name) => load('nativeClass').readNativeClass(load(name)[name], 'value');
const ParentKnown = get(parent, 'ParentKnown'), ChildKnown = get(childLoader, 'ChildKnown');
const hostClaim = root.publishOwnedDomainDefinitions([{name:'host.ParentKnown', definition:ParentKnown}], () => {});
const childClaim = childScope.publishOwnedDomainDefinitions([{name:'child.ChildKnown', definition:ChildKnown}], () => {});
const ParentCallbacks = get(parent, 'ParentCallbacks'), ChildCallbacks = get(childLoader, 'ChildCallbacks');
const host = new ParentCallbacks(), child = new ChildCallbacks(), callback = child.callback();
const rows = [];
const inspect = (id, fn) => {
    const a = fn(), b = fn();
    rows.push({id, value:[a === b, a === root, a === childScope,
        a.hasDefinition('host.ParentKnown'), a.hasDefinition('child.ChildKnown'),
        a.getDefinition('host.ParentKnown') === ParentKnown]});
};
let guards = 0;
const reject = (fn, message) => {
    try { fn(); } catch (error) { if (!message.test(error.message)) throw error; guards++; return; }
    throw Error('Expected runtime domain rejection');
};
try {
    inspect('host-direct', host.current); inspect('child-direct', child.current);
    inspect('child-static', ChildCallbacks.staticCurrent); inspect('child-closure', callback);
    inspect('parent-calls-child', () => host.invoke(child.current));
    inspect('child-calls-parent', () => child.invoke(host.current));
    inspect('parent-calls-child-closure', () => host.invoke(callback));
    inspect('child-calls-parent-closure', () => child.invoke(host.callback()));
    inspect('nested-crossing', () => child.invoke(() => host.invoke(callback)));
    inspect('child-apply-parent-receiver', () => callback.apply(ParentCallbacks));
    inspect('host-qualified', host.qualified); inspect('child-qualified', child.qualified);
    api.unloadAS3ScriptDomain(childDomain);
    inspect('retained-child-closure', callback); inspect('retained-child-static', ChildCallbacks.staticCurrent);
    reject(() => get(createDomainLoader({}), 'ParentCallbacks'), /unknown or unloaded script domain/);
    reject(() => get(createDomainLoader(new Proxy(parentDomain, {})), 'ParentCallbacks'), /unknown or unloaded script domain/);
    reject(() => get(createDomainLoader(childDomain), 'ParentCallbacks'), /unknown or unloaded script domain/);
    const unboundDomain = api.createAS3ScriptDomain();
    try {
        const Unbound = get(createDomainLoader(unboundDomain), 'ParentCallbacks');
        reject(() => new Unbound().current(), /no explicit ApplicationDomain binding/);
    } finally { api.unloadAS3ScriptDomain(unboundDomain); }
    globalThis.result = {rows, guards};
} finally {
    api.unloadAS3ScriptDomain(parentDomain); api.unloadAS3ScriptDomain(childDomain);
    childClaim.cancel(); hostClaim.cancel();
}
