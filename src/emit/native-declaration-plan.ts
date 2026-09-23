import Node from '../syntax/node';
import K from '../syntax/nodeKind';
import parse = require('../parse');
import {NativeClassMetadataOptions, validateNativeClassMetadata} from './native-class-metadata';
import {NativeLexicalMembers} from './native-lexical-members';

export interface NativeDeclarationDomainInput {
    /** Compiler-only output module specifier, used consistently by every class. */
    module: string;
    sources: {[qname: string]: string};
    metadata: NativeClassMetadataOptions;
    lexicalModule?: string;
    typedLocals?: boolean;
}
export interface NativeDeclarationBinding {
    readonly qname: string;
    readonly tokenExport: string;
    readonly publishExport: string;
}
export interface NativeDeclarationReference {
    readonly owner: string;
    readonly start: number;
    readonly end: number;
    readonly sourceName: string;
    readonly kind: 'intrinsic' | 'declaration';
    readonly identity: string;
}
export interface NativeDeclarationDomain {
    readonly module: string;
    readonly moduleSource: string;
    readonly sources: {[qname: string]: string};
    readonly metadata: NativeClassMetadataOptions;
    readonly bindings: ReadonlyArray<NativeDeclarationBinding>;
    readonly references: ReadonlyArray<NativeDeclarationReference>;
}
interface DomainRecord {
    readonly domain: NativeDeclarationDomain;
    readonly lexicalModule: string;
    readonly typedLocals: boolean;
}
// This is a compiler-context capability. No runtime value or QName is a key.
const contexts = new WeakMap<object, DomainRecord>();
const plannedTables = new WeakSet<object>();
const marker = 'nativeDeclarationDomain';
const intrinsicNames = ['*', 'void', 'Object', 'Array', 'Number', 'int', 'uint', 'Boolean', 'String', 'Function', 'Class'];
function fail(reason: string): never {throw new Error('AS3_DECLARATION_DOMAIN_UNSUPPORTED: ' + reason);}
function moduleName(value: any): string {
    if (typeof value !== 'string' || !value.trim() || /[\r\n\u0000]/.test(value)) return fail('compiler module specifier');
    return value;
}
/** Copy data without invoking getters or retaining caller-mutable metadata. */
function snapshot<T>(value: T, ancestors: object[] = []): T {
    if (value === null || ['string', 'boolean', 'number', 'undefined'].indexOf(typeof value) >= 0) return value;
    if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype
        && Object.getPrototypeOf(value) !== null && !Array.isArray(value)) return fail('plain configuration data required');
    if (ancestors.indexOf(value as any) >= 0) return fail('cyclic configuration data');
    const parents = ancestors.concat([value as any]);
    const result: any = Array.isArray(value) ? [] : Object.create(null);
    Object.keys(value).forEach(key => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor)) return fail('configuration accessors are not authority');
        Object.defineProperty(result, key, {value:snapshot(descriptor.value,parents), enumerable:true});
    });
    return Object.freeze(result);
}
function normalize(root: Node): void {
    root.children = root.children.filter(Boolean);
    root.children.forEach(child => {child.parent = root; normalize(child);});
}

/**
 * Build one closed compiler domain, emit its module once, and pass the returned
 * exact metadata/sources into every ordinary emit call. Serialization is not a
 * way to recreate this capability: rebuild explicitly from authenticated inputs.
 * This does not enable foreign-local lowering or derived source declarations.
 */
export function createNativeDeclarationDomain(input: NativeDeclarationDomainInput): NativeDeclarationDomain {
    const copied = snapshot(input), module = moduleName(copied.module);
    if (!copied.metadata || !copied.sources || typeof copied.sources !== 'object'
        || Array.isArray(copied.sources) || !copied.metadata.classes) return fail('complete source and metadata tables required');
    if (Object.prototype.hasOwnProperty.call(copied.metadata, marker)) return fail('build from original metadata, not a serialized domain');
    const provider = moduleName(copied.metadata.module);
    if (module === provider) return fail('domain module cannot replace its common provider');
    const lexicalModule = copied.lexicalModule === undefined ? undefined : moduleName(copied.lexicalModule);
    if (module === lexicalModule) return fail('domain module cannot replace its lexical provider');
    if (copied.typedLocals !== undefined && typeof copied.typedLocals !== 'boolean') return fail('typed-local mode must be boolean');
    if (copied.typedLocals && !lexicalModule) return fail('typed locals require authenticated lexical mode');
    const names = Object.keys(copied.sources).sort();
    if (!names.length || JSON.stringify(names) !== JSON.stringify(Object.keys(copied.metadata.classes).sort()))
        return fail('exact complete source/metadata domain required');
    const references: NativeDeclarationReference[] = [];
    const bindings = names.map((qname,index) => Object.freeze({qname, tokenExport:'type' + index, publishExport:'publish' + index}));
    const roots = new Map<string, Node>();
    names.forEach(qname => {
        if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(qname)) return fail('qualified source declaration required');
        const source = copied.sources[qname];
        if (typeof source !== 'string') return fail('exact source text required');
        const root = parse(qname + '.as', source); normalize(root);
        roots.set(qname,root);
        const pkg = root.findChild(K.PACKAGE), namespace = qname.slice(0,qname.lastIndexOf('.'));
        const imports = pkg.findChild(K.CONTENT).findChildren(K.IMPORT).map(node => node.text);
        const own = qname.slice(qname.lastIndexOf('.') + 1);
        const walk = (node: Node): void => {
            if (node.kind === K.TYPE) {
                const name = node.qualifiedName || node.text || '*';
                let identity: string, kind: 'intrinsic' | 'declaration' = 'declaration';
                if (!node.qualifiedName && name === own && intrinsicNames.indexOf(name) >= 0)
                    return fail('ambiguous own/builtin source annotation: ' + qname + '.' + name);
                if (!node.qualifiedName && intrinsicNames.indexOf(name) >= 0
                    && (names.indexOf(namespace + '.' + name) >= 0 || imports.some(value =>
                        value.split('.').pop() === name || value.endsWith('.*') && names.indexOf(value.slice(0,-1) + name) >= 0)))
                    return fail('imported or same-package builtin-name annotation remains held: ' + qname + '.' + name);
                if (!node.qualifiedName && intrinsicNames.indexOf(name) >= 0) {identity = name; kind = 'intrinsic';}
                else if (node.qualifiedName) {
                    if (names.indexOf(name) < 0) return fail('unknown qualified source annotation: ' + name);
                    const targetNamespace = name.slice(0,name.lastIndexOf('.'));
                    if (targetNamespace !== namespace && imports.indexOf(name) < 0 && imports.indexOf(targetNamespace + '.*') < 0)
                        return fail('qualified annotation lacks source import: ' + name);
                    identity = name;
                } else if (name === own) identity = qname;
                else {
                    const candidates: string[] = [];
                    const add = (candidate: string): void => {if (names.indexOf(candidate) >= 0 && candidates.indexOf(candidate) < 0) candidates.push(candidate);};
                    add(namespace + '.' + name);
                    imports.forEach(value => {
                        if (value.endsWith('.*')) add(value.slice(0,-1) + name);
                        else if (value.split('.').pop() === name) add(value);
                    });
                    if (candidates.length !== 1) return fail('unresolved or ambiguous source annotation: ' + qname + '.' + name);
                    identity = candidates[0];
                }
                references.push(Object.freeze({owner:qname,start:node.start,end:node.end,sourceName:name,kind,identity}));
            }
            node.children.forEach(walk);
        };
        walk(root);
    });
    // Resolve complete annotation ownership before validating local storage.
    // This provisional resolver never escapes: all source/metadata validation
    // must succeed before the exact compiler capability is published below.
    names.forEach(qname => {
        const source=copied.sources[qname],root=roots.get(qname);
        const referenceFor=(node:Node):string => {
            const found=node && references.find(r=>r.owner===qname&&r.start===node.start&&r.end===node.end&&r.kind==='declaration');
            return found ? found.identity : undefined;
        };
        const lexical=lexicalModule ? new NativeLexicalMembers(source,root,lexicalModule,copied.metadata,!!copied.typedLocals,referenceFor) : undefined;
        validateNativeClassMetadata(qname,source,copied.metadata,lexical);
    });
    const metadata: NativeClassMetadataOptions = Object.freeze(Object.assign(Object.create(null),copied.metadata,
        {[marker]:Object.freeze({version:1,module})}));
    const lines = ['// Compiler-only declaration domain. Never bind this module as a source Class.',
        'import {declareAS3ReferenceType} from ' + JSON.stringify(provider) + ';'];
    bindings.forEach((binding,index) => {
        lines.push('const authority' + index + '=declareAS3ReferenceType<unknown>(' + JSON.stringify(metadata.classes[binding.qname].metadata.name) + ');');
        lines.push('export const ' + binding.tokenExport + '=authority' + index + '.type;');
        lines.push('export const ' + binding.publishExport + '=authority' + index + '.publishGeneration;');
    });
    const domain = Object.freeze({module,moduleSource:lines.join('\n') + '\n',sources:copied.sources,metadata,
        bindings:Object.freeze(bindings),references:Object.freeze(references)});
    contexts.set(metadata,{domain,lexicalModule,typedLocals:!!copied.typedLocals});
    plannedTables.add(metadata.classes);
    return domain;
}

/** Internal compiler consumer; this never supplies runtime source authority. */
export function nativeDeclarationDomainFor(metadata: NativeClassMetadataOptions,
    sources: {[qname: string]: string}, lexical?: NativeLexicalMembers): NativeDeclarationDomain | undefined {
    if (!metadata) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(metadata,marker),record = contexts.get(metadata);
    if (!descriptor && !record && !plannedTables.has(metadata.classes)) return undefined;
    if (!descriptor || !('value' in descriptor) || !record) return fail('missing exact compiler domain capability; rebuild after serialization');
    const domain = record.domain;
    if (lexical && lexical.module !== record.lexicalModule || !lexical && record.lexicalModule
        || !!(lexical && lexical.typedLocals) !== record.typedLocals) return fail('domain lexical mode changed');
    const names = Object.keys(domain.sources).sort();
    if (!sources || JSON.stringify(Object.keys(sources).sort()) !== JSON.stringify(names)
        || names.some(name => sources[name] !== domain.sources[name])) return fail('complete planned source bytes changed');
    return domain;
}

/** Exact source annotation lookup; a copied metadata marker is not authority. */
export function nativeDeclarationReferenceFor(metadata: NativeClassMetadataOptions, owner: string, source: string, node: Node): string {
    const record=metadata && contexts.get(metadata);
    if(!record||!node)return undefined;
    if(record.domain.sources[owner]!==source)return fail('reference source bytes changed');
    const found=record.domain.references.find(r=>r.owner===owner&&r.start===node.start&&r.end===node.end&&r.kind==='declaration');
    return found ? found.identity : undefined;
}
