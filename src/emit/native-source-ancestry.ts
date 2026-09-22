import Node, {createNode} from '../syntax/node';
import K from '../syntax/nodeKind';
import parse = require('../parse');
import {nativeSourceTypeIdentity} from './native-source-type';

export interface NativeSourceAncestrySource {
    source: string;
    sourceSha256?: string;
    referenceOnly?: boolean;
}

export interface NativeSourceAncestryInput {
    sources: {[qname: string]: NativeSourceAncestrySource};
    definitionsByNamespace?: {[namespace: string]: string[]};
    namespaceUris?: {[qname: string]: string};
    /** Authenticated provider declarations that are available without AS3 source text. */
    providerClasses?: {[qname: string]: NativeSourceAncestryClass};
}

export interface NativeSourceAncestryMember {
    name: string;
    uri: string;
    static: boolean;
    kind: K;
    override: boolean;
}

export interface NativeSourceAncestryType {
    name: string;
    type: string;
    static: boolean;
}

export interface NativeSourceAncestryClass {
    base?: string;
    dynamic: boolean;
    /** Provider-only proof that the retained namespace member surface is complete. */
    namespaceComplete?: boolean;
    members: NativeSourceAncestryMember[];
    /** Typed ordinary fields/accessors retained for cross-file receiver inference. */
    types?: NativeSourceAncestryType[];
    /** Fully qualified namespace declarations opened by the source class's unit. */
    uses?: string[];
}

export interface NativeSourceAncestryPlan {
    version: 1;
    classes: {[qname: string]: NativeSourceAncestryClass};
    namespaceUris: {[qname: string]: string};
    sourceHashes: {[qname: string]: string};
    parseErrors: {[qname: string]: string};
}

function fail(message: string): never { throw new Error('AS3_SOURCE_ANCESTRY_UNSUPPORTED: ' + message); }

function normalize(root: Node): void {
    root.children = root.children.filter(Boolean);
    root.children.forEach(child => { child.parent = root; normalize(child); });
}

function packageNode(root: Node): Node {
    const value = root.findChild(K.PACKAGE);
    if (!value || !value.findChild(K.NAME) || !value.findChild(K.CONTENT)) return fail('package content required');
    return value;
}

function packageName(root: Node): string {
    const name = packageNode(root).findChild(K.NAME).text;
    return name ? name + '.' : '';
}

function imports(root: Node): Node[] {
    return packageNode(root).findChild(K.CONTENT).findChildren(K.IMPORT);
}

function candidates(root: Node, name: string): string[] {
    if (name.indexOf('.') >= 0) return [name];
    const result: string[] = [], add = (value: string): void => {
        if (result.indexOf(value) < 0) result.push(value);
    };
    add(packageName(root) + name);
    imports(root).forEach(value => {
        if (value.text.split('.').pop() === name) add(value.text);
        else if (/\.\*$/.test(value.text)) add(value.text.slice(0, -1) + name);
    });
    return result;
}

function declarationNodes(root: Node): Node[] {
    return packageNode(root).findChild(K.CONTENT).findChildren(K.NAMESPACE_DECLARATION);
}

function literalUri(node: Node): string {
    const value = node && node.children[2];
    const literal = value && value.kind === K.LITERAL && /^("|')([^\\\r\n]*)\1$/.exec(value.text);
    return literal && literal[2] || undefined;
}

function resolveNamespace(root: Node, name: string, declarations: {[qname: string]: {root: Node; node: Node}}, configured: {[qname: string]: string}, active: string[] = []): string {
    const matches = candidates(root, name).filter(qname => declarations[qname] || configured[qname]
        || qname === 'flash.utils.flash_proxy');
    if (matches.length !== 1) return fail('unresolved or ambiguous namespace: ' + name);
    const qname = matches[0], record = declarations[qname];
    if (qname === 'flash.utils.flash_proxy') return 'http://www.adobe.com/2006/actionscript/flash/proxy';
    if (!record) return configured[qname];
    if (active.indexOf(qname) >= 0) return fail('cyclic namespace alias: ' + qname);
    const literal = literalUri(record.node);
    if (literal) return literal;
    const value = record.node.children[2];
    if (!value || value.kind !== K.IDENTIFIER) return fail('dynamic namespace declaration: ' + qname);
    return resolveNamespace(record.root, value.text, declarations, configured, active.concat(qname));
}

function namespaceQName(root: Node, name: string, declarations: {[qname: string]: {root: Node; node: Node}},
    configured: {[qname: string]: string}): string {
    const matches = candidates(root, name).filter(qname => declarations[qname] || configured[qname]
        || qname === 'flash.utils.flash_proxy');
    if (matches.length !== 1) return fail('unresolved or ambiguous namespace: ' + name);
    return matches[0];
}

function classQName(root: Node, node: Node): string {
    return packageName(root) + node.findChild(K.NAME).text;
}

function memberNames(node: Node): Node[] {
    if (node.kind === K.VAR_LIST || node.kind === K.CONST_LIST)
        return node.findChildren(K.NAME_TYPE_INIT).map(value => value.findChild(K.NAME));
    return [node.findChild(K.NAME)];
}

/**
 * Build a closed, source-backed class/namespace ancestry table. This is
 * compile-time evidence only: it never treats engine declarations or a type
 * name alone as source authority.
 */
export function createNativeSourceAncestryPlan(input: NativeSourceAncestryInput): NativeSourceAncestryPlan {
    if (!input || !input.sources || typeof input.sources !== 'object' || Array.isArray(input.sources))
        return fail('complete source table required');
    const providerClasses = input.providerClasses || {};
    if (typeof providerClasses !== 'object' || Array.isArray(providerClasses))
        return fail('provider class table must be an object');
    Object.keys(providerClasses).forEach(qname => {
        if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(qname))
            fail('invalid provider class QName: ' + qname);
        const metadata = providerClasses[qname];
        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
            fail('provider class metadata required: ' + qname);
        if (metadata.base !== undefined && !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(metadata.base))
            fail('invalid provider base QName: ' + qname);
        if (typeof metadata.dynamic !== 'boolean' || !Array.isArray(metadata.members))
            fail('complete provider class metadata required: ' + qname);
        if (metadata.namespaceComplete !== undefined && typeof metadata.namespaceComplete !== 'boolean')
            fail('provider namespace completeness must be boolean: ' + qname);
    });
    const roots: {[qname: string]: Node} = {}, sourceHashes: {[qname: string]: string} = {}, parseErrors: {[qname: string]: string} = {};
    const declarations: {[qname: string]: {root: Node; node: Node}} = {};
    const configured = input.namespaceUris || {};
    Object.keys(input.sources).sort().forEach(qname => {
        const record = input.sources[qname];
        if (!record || typeof record.source !== 'string') return fail('source text required: ' + qname);
        let root: Node;
        try { root = parse(qname + '.as', record.source); }
        catch (error) {
            // A review scope may contain an independently malformed source.
            // Keep it out of ancestry authority so its own emission reports the
            // parser error, while valid source siblings remain compilable.
            parseErrors[qname] = String(error && (error.stack || error));
            return;
        }
        normalize(root); roots[qname] = root;
        if (record.sourceSha256 !== undefined) sourceHashes[qname] = record.sourceSha256;
        declarationNodes(root).forEach(node => {
            const name = node.findChild(K.NAME);
            if (!name) return fail('namespace name required: ' + qname);
            const identity = packageName(root) + name.text;
            if (declarations[identity]) return fail('duplicate namespace declaration: ' + identity);
            declarations[identity] = {root, node};
        });
    });
    const classes: {[qname: string]: NativeSourceAncestryClass} = {};
    Object.keys(roots).sort().forEach(qname => {
        const root = roots[qname], content = packageNode(root).findChild(K.CONTENT);
        content.children.filter(owner => owner && [K.CLASS, K.INTERFACE].indexOf(owner.kind) >= 0).forEach(owner => {
            const identity = classQName(root, owner), extension = owner.findChild(K.EXTENDS);
            if (classes[identity]) return fail('duplicate source class: ' + identity);
            const mods = owner.findChild(K.MOD_LIST);
            const metadata: NativeSourceAncestryClass = {
                dynamic: !!mods && mods.children.some(mod => mod.text === 'dynamic'), members: [], types: [], uses: []
            };
            if (extension) {
                const base = candidates(root, extension.text).filter(value => Object.keys(roots).indexOf(value) >= 0
                    || Object.prototype.hasOwnProperty.call(providerClasses, value));
                if (base.length > 1) return fail('ambiguous source base: ' + identity + ' extends ' + extension.text);
                // A base outside the authenticated source table remains
                // unresolved. NativeNamespaces will keep its existing
                // fail-closed behavior for that ordinary engine/provider base.
                if (base.length === 1) metadata.base = base[0];
            }
            owner.findChild(K.CONTENT).children.forEach(member => {
                if ([K.FUNCTION, K.GET, K.SET, K.VAR_LIST, K.CONST_LIST].indexOf(member.kind) < 0) return;
                const memberMods = member.findChild(K.MOD_LIST), qualifier = memberMods && memberMods.children.filter(mod =>
                    ['public','private','protected','internal','static','override','final','native','dynamic'].indexOf(mod.text) < 0);
                const isStatic = !!memberMods && memberMods.children.some(mod => mod.text === 'static');
                const importsForType = imports(root).map(value => value.text);
                if ([K.GET, K.SET].indexOf(member.kind) >= 0) {
                    const name = member.findChild(K.NAME), type = member.findChild(K.TYPE);
                    if (name && type) metadata.types.push({name:name.text,
                        type:nativeSourceTypeIdentity(type, identity, importsForType), static:isStatic});
                }
                if (!qualifier || !qualifier.length) return;
                if (qualifier.length !== 1) return fail('multiple namespace modifiers: ' + identity);
                const uri = resolveNamespace(root, qualifier[0].text, declarations, configured);
                const names = memberNames(member);
                if (names.length !== 1 || !names[0]) return fail('multiple namespace fields: ' + identity);
                metadata.members.push({name:names[0].text, uri, static:!!memberMods.children.some(mod => mod.text === 'static'),
                    kind:member.kind, override:!!memberMods.children.some(mod => mod.text === 'override')});
            });
            const unitContent = packageNode(root).findChild(K.CONTENT);
            const opened = unitContent.findChildren(K.USE).concat(owner.findChild(K.CONTENT).findChildren(K.USE));
            opened.forEach(use => {
                const qname = namespaceQName(root, use.text, declarations, configured);
                if (metadata.uses.indexOf(qname) < 0) metadata.uses.push(qname);
            });
            classes[identity] = metadata;
        });
    });
    const namespaceUris: {[qname: string]: string} = {};
    Object.keys(declarations).sort().forEach(qname => { namespaceUris[qname] = resolveNamespace(declarations[qname].root, qname, declarations, configured); });
    Object.keys(configured).forEach(qname => { if (namespaceUris[qname] === undefined) namespaceUris[qname] = configured[qname]; });
    Object.keys(providerClasses).sort().forEach(qname => {
        if (classes[qname]) return fail('provider class collides with source class: ' + qname);
        classes[qname] = {
            base: providerClasses[qname].base,
            dynamic: providerClasses[qname].dynamic,
            members: providerClasses[qname].members.slice(),
            ...(providerClasses[qname].types ? {types: providerClasses[qname].types.slice()} : {}),
            ...(providerClasses[qname].namespaceComplete ? {namespaceComplete: true} : {}),
            ...(providerClasses[qname].uses ? {uses: providerClasses[qname].uses.slice()} : {})
        };
    });
    return {version:1, classes, namespaceUris, sourceHashes, parseErrors};
}
