import Node from '../syntax/node';
import K from '../syntax/nodeKind';
import parse = require('../parse');

export interface NativeGeneratedDeclarationInput {
    scope: string;
    providerModule: string;
    sources: {[qname: string]: {source: string; sourceSha256: string; referenceOnly?: boolean}};
    providers?: {[qname: string]: {module: string; exportName: string}};
}
export interface NativeGeneratedDeclarationBinding {
    readonly qname: string;
    readonly base: string | null;
    readonly tokenExport: string;
    readonly publishExport: string;
}
export interface NativeGeneratedReference {
    readonly owner: string;
    readonly start: number;
    readonly end: number;
    readonly sourceName: string;
    readonly kind: 'intrinsic' | 'declaration' | 'native' | 'unresolved';
    readonly identity: string;
}
export interface NativeGeneratedDeclarationPlan {
    readonly scope: string;
    readonly moduleSource: string;
    readonly bindings: ReadonlyArray<NativeGeneratedDeclarationBinding>;
    readonly references: ReadonlyArray<NativeGeneratedReference>;
    readonly sourceHashes: {[qname: string]: string};
    readonly nativeBindings: ReadonlyArray<{readonly qname: string; readonly referenceExport: string}>;
}
interface Context {input: NativeGeneratedDeclarationInput; plan: NativeGeneratedDeclarationPlan;}
const contexts = new WeakMap<object, Context>();
const builtins = ['*', 'void', 'int', 'uint', 'Number', 'Boolean', 'String', 'Object', 'Array', 'Function', 'Class', 'XML', 'XMLList'];
function fail(reason: string): never {throw new Error('AS3_GENERATED_DECLARATIONS_UNSUPPORTED: ' + reason);}
function moduleName(value: string): string {
    if (typeof value !== 'string' || !value.trim() || /[\x00\r\n]/.test(value)) fail('module specifier');
    return value;
}
function qname(value: string): void {
    if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(value)) fail('source QName');
}
function copy(value: any, active: object[] = []): any {
    if (value === null || ['string', 'boolean', 'number', 'undefined'].indexOf(typeof value) >= 0) return value;
    if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype
        && Object.getPrototypeOf(value) !== null && !Array.isArray(value)) fail('plain configuration required');
    if (active.indexOf(value) >= 0) fail('cyclic configuration');
    const result: any = Array.isArray(value) ? [] : Object.create(null);
    Object.keys(value).forEach(key => {
        const property = Object.getOwnPropertyDescriptor(value, key);
        if (!property || !('value' in property)) fail('configuration getters are not authority');
        Object.defineProperty(result, key, {value: copy(property.value, active.concat([value])), enumerable: true});
    });
    return Object.freeze(result);
}
function normalize(node: Node): void {
    node.children = node.children.filter(Boolean);
    node.children.forEach(child => {child.parent = node; normalize(child);});
}
function table(value: any): boolean {return value && typeof value === 'object' && !Array.isArray(value);}
function fields(value: any, allowed: string[]): void {
    if (Object.keys(value).some(key => allowed.indexOf(key) < 0)) fail('unknown configuration field');
}
function hash(source: string): string {return require('crypto').createHash('sha256').update(source).digest('hex');}

/**
 * Plan declaration identities without loading their implementations. This does
 * not approve constructor/static initialization, reflection or trait emission.
 * Native bindings retain exact provider constructors; the registrar must still
 * authenticate their runtime source identity before using them as trait types.
 */
export function createNativeGeneratedDeclarationPlan(input: NativeGeneratedDeclarationInput): NativeGeneratedDeclarationPlan {
    const data: NativeGeneratedDeclarationInput = copy(input);
    if (!data || typeof data.scope !== 'string' || !data.scope.trim()) fail('source scope required');
    fields(data, ['scope', 'providerModule', 'sources', 'providers']);
    moduleName(data.providerModule);
    if (!table(data.sources) || !Object.keys(data.sources).length) fail('nonempty exact source table required');
    if (data.providers !== undefined && !table(data.providers)) fail('provider table required');
    const providers = data.providers || {}, names = Object.keys(data.sources).sort(), nativeNames = Object.keys(providers).sort();
    const roots = new Map<string, Node>(), classes = new Map<string, Node>();
    const sourceHashes: {[qname: string]: string} = Object.create(null);
    nativeNames.forEach(name => {
        qname(name);
        if (names.indexOf(name) >= 0 || builtins.indexOf(name) >= 0) fail('source/provider or builtin collision: ' + name);
        const provider = providers[name];
        if (!table(provider)) fail('provider binding required');
        fields(provider, ['module', 'exportName']);
        moduleName(provider.module);
        if (!/^[A-Za-z_$][\w$]*$/.test(provider.exportName)) fail('provider export name');
    });
    names.forEach(name => {
        qname(name);
        const record = data.sources[name];
        if (!table(record) || typeof record.source !== 'string' || hash(record.source) !== record.sourceSha256)
            fail('exact source bytes/hash required: ' + name);
        fields(record, ['source', 'sourceSha256', 'referenceOnly']);
        if (record.referenceOnly !== undefined && typeof record.referenceOnly !== 'boolean') fail('referenceOnly must be boolean');
        const root = parse(name + '.as', record.source); normalize(root);
        const pkg = root.findChild(K.PACKAGE), content = pkg && pkg.findChild(K.CONTENT);
        const list = content && content.findChildren(K.CLASS);
        if (!pkg || !list || list.length !== 1) fail('exactly one package class: ' + name);
        const prefix = pkg.findChild(K.NAME).text, cls = list[0];
        if ((prefix ? prefix + '.' : '') + cls.findChild(K.NAME).text !== name) fail('source QName mismatch: ' + name);
        // Do not silently omit a second file-local class or interface from identity planning.
        let count = 0;
        const visit = (node: Node): void => {if (node.kind === K.CLASS || node.kind === K.INTERFACE) count++; node.children.forEach(visit);};
        visit(root);
        if (count !== 1) fail('additional source declarations: ' + name);
        roots.set(name, root); classes.set(name, cls); sourceHashes[name] = record.sourceSha256;
    });
    const resolve = (owner: string, spelling: string): string => {
        if (spelling.indexOf('.') >= 0) return spelling;
        const root = roots.get(owner), pkg = root.findChild(K.PACKAGE), namespace = pkg.findChild(K.NAME).text;
        const imports = pkg.findChild(K.CONTENT).findChildren(K.IMPORT).map(node => node.text);
        const ownName = owner.split('.').pop(), same = (namespace ? namespace + '.' : '') + spelling;
        const known = (name: string): boolean => names.indexOf(name) >= 0 || nativeNames.indexOf(name) >= 0;
        const explicit = imports.filter(name => !/\.\*$/.test(name) && name.split('.').pop() === spelling)
            .filter((name, index, all) => all.indexOf(name) === index);
        if (explicit.length > 1) fail('ambiguous explicit type: ' + owner + ':' + spelling);
        if (builtins.indexOf(spelling) >= 0) {
            if (ownName === spelling || known(same) || explicit.length
                || imports.some(name => /\.\*$/.test(name) && known(name.slice(0, -1) + spelling)))
                fail('ambiguous builtin type: ' + owner + ':' + spelling);
            return spelling;
        }
        if (ownName === spelling) return owner;
        if (explicit.length) return explicit[0];
        if (known(same)) return same;
        const wildcard = imports.filter(name => /\.\*$/.test(name)).map(name => name.slice(0, -1) + spelling)
            .filter(known).filter((name, index, all) => all.indexOf(name) === index);
        if (wildcard.length > 1) fail('ambiguous wildcard type: ' + owner + ':' + spelling);
        return wildcard[0] || spelling;
    };
    const bindings: NativeGeneratedDeclarationBinding[] = [], references: NativeGeneratedReference[] = [];
    names.forEach(owner => {
        const cls = classes.get(owner);
        if (!data.sources[owner].referenceOnly) {
            if (cls.findChild(K.IMPLEMENTS_LIST) && cls.findChild(K.IMPLEMENTS_LIST).children.length)
                fail('interface declaration authority required: ' + owner);
            const baseNode = cls.findChild(K.EXTENDS), base = baseNode ? resolve(owner, baseNode.qualifiedName || baseNode.text) : 'Object';
            if (base !== 'Object' && (!data.sources[base] || data.sources[base].referenceOnly))
                fail('base requires a planned source declaration: ' + owner + ':' + base);
            bindings.push(Object.freeze({qname: owner, base: base === 'Object' ? null : base,
                tokenExport: 'type' + bindings.length, publishExport: 'publish' + bindings.length}));
        }
    });
    names.forEach(owner => {
        const walk = (node: Node): void => {
            if (node.kind === K.TYPE) {
                const spelling = node.qualifiedName || node.text || '*', identity = resolve(owner, spelling);
                const kind: NativeGeneratedReference['kind'] = builtins.indexOf(identity) >= 0 ? 'intrinsic' : bindings.some(binding => binding.qname === identity)
                    ? 'declaration' : nativeNames.indexOf(identity) >= 0 ? 'native' : 'unresolved';
                references.push(Object.freeze({owner, start: node.start, end: node.end, sourceName: spelling, kind, identity}));
            }
            node.children.forEach(walk);
        };
        walk(roots.get(owner));
    });
    const lines = ['// Compiler-only declaration identities; no source class implementation imports.',
        'import {declareAS3ReferenceType} from ' + JSON.stringify(data.providerModule) + ';'];
    const nativeBindings = nativeNames.map((name, index) => {
        const provider = providers[name], referenceExport = 'native' + index;
        lines.push('export {' + provider.exportName + ' as ' + referenceExport + '} from ' + JSON.stringify(provider.module) + ';');
        return Object.freeze({qname: name, referenceExport});
    });
    const emitted = new Set<string>(), active = new Set<string>();
    const add = (binding: NativeGeneratedDeclarationBinding): void => {
        if (emitted.has(binding.qname)) return;
        if (active.has(binding.qname)) fail('cyclic source inheritance: ' + binding.qname);
        active.add(binding.qname);
        const parent = binding.base && bindings.find(value => value.qname === binding.base);
        if (parent) add(parent);
        const authority = '__authority_' + binding.tokenExport;
        const name = binding.qname.replace(/\.([^.]*)$/, '::$1');
        lines.push('const ' + authority + '=declareAS3ReferenceType<unknown>(' + JSON.stringify(name)
            + (parent ? ',' + parent.tokenExport : '') + ');');
        lines.push('export const ' + binding.tokenExport + '=' + authority + '.type;');
        lines.push('export const ' + binding.publishExport + '=' + authority + '.publishGeneration;');
        active.delete(binding.qname); emitted.add(binding.qname);
    };
    bindings.forEach(add);
    const plan: NativeGeneratedDeclarationPlan = Object.freeze({scope: data.scope, moduleSource: lines.join('\n') + '\n',
        sourceHashes: Object.freeze(sourceHashes), bindings: Object.freeze(bindings), references: Object.freeze(references),
        nativeBindings: Object.freeze(nativeBindings)});
    contexts.set(plan, {input: data, plan});
    return plan;
}

/** Exact compiler capability plus source-byte check; serialization grants no authority. */
export function nativeGeneratedDeclarationSource(plan: NativeGeneratedDeclarationPlan, scope: string, owner: string, source: string):
    {readonly source: string; readonly sourceSha256: string; readonly referenceOnly?: boolean} {
    const context = plan && contexts.get(plan), record = context && context.input.sources[owner];
    if (!context || scope !== plan.scope || !record || record.source !== source) fail('exact planned scope/source capability required');
    return record;
}
