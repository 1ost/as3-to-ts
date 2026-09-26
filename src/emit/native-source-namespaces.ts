import K from '../syntax/nodeKind';
import {NativeSourceUnit, NativeSourceUnitNamespace, nativeSourceUnitAst, nativeSourceUnitNode, nativeSourceUnitResolver} from './native-source-unit';
import {nativeNamespaceLiteralUri} from './native-namespaces';

export interface NativeSourceNamespaceBinding {
    readonly qname: string;
    readonly sourceOwner: string;
    readonly declaration: NativeSourceUnitNamespace;
    readonly uri: string;
    readonly aliasOf?: string;
}
function fail(reason: string): never {throw new Error('AS3_SOURCE_NAMESPACE_UNSUPPORTED: ' + reason);}

/** Authenticate literal/alias namespace identities from whole source files.
 * These are build-time records, never Class tokens or runtime Namespace values. */
export function planNativeSourceNamespaces(units: Map<string, NativeSourceUnit>): ReadonlyArray<NativeSourceNamespaceBinding> {
    const entries = new Map<string, {unit: NativeSourceUnit; declaration: NativeSourceUnitNamespace}>();
    const classes = new Set<string>();
    units.forEach((unit, owner) => {
        if (owner !== unit.owner) fail('source owner mismatch');
        const ast = nativeSourceUnitAst(unit);
        ast.declarations.forEach(item => {if (item.declaration.packageQName) classes.add(item.declaration.packageQName);});
        ast.namespaces.forEach(item => {
            const qname = item.declaration.packageQName;
            if (entries.has(qname)) fail('duplicate source namespace: ' + qname);
            entries.set(qname, {unit, declaration: item.declaration});
        });
    });
    entries.forEach((_, name) => {if (classes.has(name)) fail('namespace/Class collision: ' + name);});
    const complete = new Map<string, NativeSourceNamespaceBinding>(), active = new Set<string>();
    const resolve = (qname: string): NativeSourceNamespaceBinding => {
        if (complete.has(qname)) return complete.get(qname);
        if (active.has(qname)) fail('cyclic namespace alias: ' + qname);
        const entry = entries.get(qname);
        if (!entry) fail('alias requires an exact source namespace: ' + qname);
        active.add(qname);
        const node = nativeSourceUnitNode(entry.unit, entry.declaration), value = node.children[2];
        let uri: string, aliasOf: string;
        if (value.kind === K.LITERAL) uri = nativeNamespaceLiteralUri(value.text);
        else if (value.kind === K.IDENTIFIER) {
            const identity = nativeSourceUnitResolver(entry.unit, entry.declaration,
                name => entries.has(name) || classes.has(name))(value.text);
            if (typeof identity !== 'string') fail('namespace alias cannot name a private Class');
            aliasOf = identity as string;
            uri = resolve(aliasOf).uri;
        } else fail('dynamic namespace declaration: ' + qname);
        const binding = Object.freeze({qname, sourceOwner: entry.unit.owner, declaration: entry.declaration,
            uri, ...(aliasOf === undefined ? {} : {aliasOf})});
        complete.set(qname, binding); active.delete(qname); return binding;
    };
    return Object.freeze(Array.from(entries.keys()).sort().map(resolve));
}
