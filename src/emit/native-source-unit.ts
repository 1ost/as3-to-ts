import Node from '../syntax/node';
import K from '../syntax/nodeKind';
import parse = require('../parse');

/** Build-time identity, never a public QName or a runtime Class value. */
export interface NativeSourceUnitDeclaration {
    readonly sourceOwner: string;
    readonly name: string;
    /** Syntactic named-package identity; this does not grant public export visibility. */
    readonly packageQName: string | null;
    readonly reflectedName: string;
    readonly filePrivate: boolean;
    readonly kind: 'class' | 'interface';
}
/** A namespace definition is not a Class/type descriptor. */
export interface NativeSourceUnitNamespace {
    readonly sourceOwner: string;
    readonly name: string;
    readonly packageQName: string;
    readonly filePrivate: false;
    readonly kind: 'namespace';
}
export interface NativeSourceUnit {
    readonly owner: string;
    readonly source: string;
    readonly sourceSha256: string;
    readonly declarations: ReadonlyArray<NativeSourceUnitDeclaration>;
    readonly namespaces: ReadonlyArray<NativeSourceUnitNamespace>;
}
type SourceDescriptor = NativeSourceUnitDeclaration | NativeSourceUnitNamespace;
interface Context {root: Node; nodes: Map<SourceDescriptor, Node>;}
const contexts = new WeakMap<NativeSourceUnit, Context>();
function fail(reason: string): never {throw new Error('AS3_SOURCE_UNIT_UNSUPPORTED: ' + reason);}
function normalize(node: Node): void {
    node.children = node.children.filter(Boolean);
    node.children.forEach(child => {child.parent = node; normalize(child);});
}

/** Preserve one exact source file and distinct opaque identities for its declarations.
 * This does not split/rewrite source, publish helper names, or admit emission. */
export function readNativeSourceUnit(owner: string, source: string, sourceSha256: string): NativeSourceUnit {
    if (typeof owner !== 'string' || !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(owner) || typeof source !== 'string'
        || require('crypto').createHash('sha256').update(source).digest('hex') !== sourceSha256)
        fail('exact source owner/bytes/hash required');
    const root = parse(owner + '.as', source); normalize(root);
    const packages = root.findChildren(K.PACKAGE), pkg = packages[0], content = pkg && pkg.findChild(K.CONTENT);
    const declared = (node: Node): boolean => node.kind === K.CLASS || node.kind === K.INTERFACE;
    const primary = content && content.children.filter(declared);
    const namespaceNodes = content ? content.findChildren(K.NAMESPACE_DECLARATION) : [];
    if (packages.length !== 1 || !primary || primary.length > 1
        || !primary.length && namespaceNodes.length !== 1)
        fail('exactly one package class, interface or standalone namespace: ' + owner);
    const namespace = pkg.findChild(K.NAME).text, name = (primary[0] || namespaceNodes[0]).findChild(K.NAME).text;
    if ((namespace ? namespace + '.' : '') + name !== owner) fail('source QName mismatch: ' + owner);
    const tails = root.findChildren(K.CONTENT);
    if (tails.length > 1) fail('one file scope required: ' + owner);
    const tail = tails[0], helpers = tail ? tail.children.filter(declared) : [];
    if (!primary.length && helpers.length) fail('namespace source with file-local classes requires qualification: ' + owner);
    if (!primary.length && content.children.some(node =>
        [K.NAMESPACE_DECLARATION, K.IMPORT, K.AS_DOC, K.MULTI_LINE_COMMENT, K.STMT_EMPTY].indexOf(node.kind) < 0))
        fail('standalone namespace source has additional package statements: ' + owner);
    if (!primary.length && tail && tail.children.some(node =>
        [K.IMPORT, K.AS_DOC, K.MULTI_LINE_COMMENT, K.STMT_EMPTY].indexOf(node.kind) < 0))
        fail('standalone namespace source has additional file statements: ' + owner);
    const all = primary.concat(helpers), nodes = new Map<SourceDescriptor, Node>();
    const localNames = new Set<string>();
    const declarations = all.map((node, index) => {
        const local = node.findChild(K.NAME).text;
        if (index) {
            if (localNames.has(local)) fail('duplicate file-local declaration: ' + owner + ':' + local);
            localNames.add(local);
            const mods = node.findChild(K.MOD_LIST);
            if (mods && mods.children.some(mod => ['final','dynamic','internal'].indexOf(mod.text) < 0))
                fail('file-local declaration modifier: ' + owner + ':' + local);
        }
        const value = Object.freeze<NativeSourceUnitDeclaration>({sourceOwner: owner, name: local,
            packageQName: index ? null : owner, reflectedName: index ? '::' + local : owner.replace(/\.([^.]*)$/, '::$1'),
            filePrivate: index !== 0, kind: node.kind === K.CLASS ? 'class' : 'interface'});
        nodes.set(value, node); return value;
    });
    const packageNames = new Set(primary.map(node => node.findChild(K.NAME).text));
    const namespaces = namespaceNodes.map(node => {
        const local = node.findChild(K.NAME).text, mods = node.findChild(K.MOD_LIST);
        if (!mods || mods.children.length !== 1 || mods.children[0].text !== 'public')
            fail('public source namespace required: ' + owner + ':' + local);
        if (packageNames.has(local)) fail('duplicate package declaration: ' + owner + ':' + local);
        packageNames.add(local);
        const value = Object.freeze<NativeSourceUnitNamespace>({sourceOwner: owner, name: local,
            packageQName: (namespace ? namespace + '.' : '') + local, filePrivate: false, kind: 'namespace'});
        nodes.set(value, node); return value;
    });
    let count = 0;
    const visit = (node: Node): void => {if (declared(node) || node.kind === K.NAMESPACE_DECLARATION) count++; node.children.forEach(visit);}; visit(root);
    if (count !== all.length + namespaces.length) fail('nested declaration scope: ' + owner);
    const unit = Object.freeze({owner, source, sourceSha256, declarations: Object.freeze(declarations), namespaces: Object.freeze(namespaces)});
    contexts.set(unit, {root, nodes});
    return unit;
}

/** Return a detached AST; mutations by one consumer never change source authority. */
export function nativeSourceUnitAst(unit: NativeSourceUnit):
    {root: Node; declarations: ReadonlyArray<{declaration: NativeSourceUnitDeclaration; node: Node}>;
        namespaces: ReadonlyArray<{declaration: NativeSourceUnitNamespace; node: Node}>} {
    const context = contexts.get(unit);
    if (!context) fail('exact source-unit capability required');
    const copies = new Map<Node, Node>();
    const clone = (node: Node, parent?: Node): Node => {
        const result = Object.assign(new Node(), {kind: node.kind, text: node.text, start: node.start, end: node.end,
            qualifiedName: node.qualifiedName, parent});
        copies.set(node, result); result.children = node.children.map(child => clone(child, result)); return result;
    };
    const root = clone(context.root);
    return {root, declarations: unit.declarations.map(declaration => ({declaration, node: copies.get(context.nodes.get(declaration))})),
        namespaces: unit.namespaces.map(declaration => ({declaration, node: copies.get(context.nodes.get(declaration))}))};
}
/** Only live compiler-owned units and their own descriptors authorize AST access. */
export function nativeSourceUnitNode(unit: NativeSourceUnit, declaration: SourceDescriptor): Node {
    const context = contexts.get(unit);
    if (!context || !context.nodes.has(declaration)) fail('exact source-unit declaration capability required');
    const ast = nativeSourceUnitAst(unit);
    return declaration.kind === 'namespace'
        ? ast.namespaces.find(item => item.declaration === declaration).node
        : ast.declarations.find(item => item.declaration === declaration).node;
}
/** File-local candidates are visible only to declarations in this same live unit.
 * Import/builtin conflicts still need the caller's full lexical resolution. */
export function nativeSourceUnitLocal(unit: NativeSourceUnit, consumer: SourceDescriptor,
    spelling: string): NativeSourceUnitDeclaration | null {
    const context = contexts.get(unit);
    if (!context || !context.nodes.has(consumer)) fail('exact source-unit declaration capability required');
    return unit.declarations.find(declaration => declaration.filePrivate && declaration.name === spelling) || null;
}

export const nativeSourceIntrinsicNames: ReadonlyArray<string> = Object.freeze([
    '*', 'void', 'int', 'uint', 'Number', 'Boolean', 'String', 'Object', 'Array', 'Function', 'Class'
]);
/** Private names resolve to opaque descriptors, never to reflected/public strings. */
export function nativeSourceUnitResolver(unit: NativeSourceUnit, consumer: SourceDescriptor,
    known: (name: string) => boolean): (spelling: string) => string | NativeSourceUnitDeclaration {
    const context = contexts.get(unit);
    if (!context || !context.nodes.has(consumer)) fail('exact source-unit declaration capability required');
    const pkg = context.root.findChild(K.PACKAGE);
    const content = consumer.filePrivate ? context.root.findChild(K.CONTENT) : pkg.findChild(K.CONTENT);
    const namespace = consumer.filePrivate ? '' : pkg.findChild(K.NAME).text;
    const imports = content ? content.findChildren(K.IMPORT).map(node => node.text) : [];
    return (spelling: string): string | NativeSourceUnitDeclaration => {
        if (typeof spelling !== 'string') fail('source type spelling required');
        if (spelling.indexOf('.') >= 0) return spelling;
        const local = nativeSourceUnitLocal(unit, consumer, spelling);
        const same = (namespace ? namespace + '.' : '') + spelling;
        const explicit = imports.filter(name => !/\.\*$/.test(name) && name.split('.').pop() === spelling)
            .filter((name, index, all) => all.indexOf(name) === index);
        if (explicit.length > 1) fail('ambiguous explicit type: ' + unit.owner + ':' + spelling);
        if (nativeSourceIntrinsicNames.indexOf(spelling) >= 0) {
            if (consumer.name === spelling || local || known(same) || explicit.length
                || imports.some(name => /\.\*$/.test(name) && known(name.slice(0, -1) + spelling)))
                fail('ambiguous builtin type: ' + unit.owner + ':' + spelling);
            return spelling;
        }
        if (local) {
            // Colliding explicit imports need a separately qualified ambiguity rule.
            if (explicit.length || consumer.name === spelling && !consumer.filePrivate)
                fail('file-local/import declaration collision: ' + unit.owner + ':' + spelling);
            return local;
        }
        if (consumer.name === spelling) return consumer.packageQName;
        if (explicit.length) return explicit[0];
        if (known(same)) return same;
        const wildcard = imports.filter(name => /\.\*$/.test(name)).map(name => name.slice(0, -1) + spelling)
            .filter(known).filter((name, index, all) => all.indexOf(name) === index);
        if (wildcard.length > 1) fail('ambiguous wildcard type: ' + unit.owner + ':' + spelling);
        return wildcard[0] || spelling;
    };
}

export interface NativeSourceUnitReference {
    readonly start: number;
    readonly end: number;
    readonly spelling: string;
    readonly identity: string | NativeSourceUnitDeclaration;
}
/** Exact type/base spans owned by one declaration, including private Vector elements. */
export function nativeSourceUnitReferences(unit: NativeSourceUnit, consumer: NativeSourceUnitDeclaration,
    known: (name: string) => boolean): ReadonlyArray<NativeSourceUnitReference> {
    const node = nativeSourceUnitNode(unit, consumer), resolve = nativeSourceUnitResolver(unit, consumer, known);
    const references: NativeSourceUnitReference[] = [];
    const visit = (value: Node): void => {
        if ([K.TYPE, K.EXTENDS, K.IMPLEMENTS].indexOf(value.kind) >= 0 && value.text !== 'function') {
            const spelling = value.qualifiedName || value.text || '*';
            references.push(Object.freeze({start: value.start, end: value.end, spelling, identity: resolve(spelling)}));
        }
        value.children.forEach(visit);
    }; visit(node);
    return Object.freeze(references);
}
