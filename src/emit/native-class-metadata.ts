import Node from '../syntax/node';
import {NativeLexicalMembers} from './native-lexical-members';
import K from '../syntax/nodeKind';
import parse = require('../parse');
import {nativeSourceTypeIdentity} from './native-source-type';

export interface NativeClassMetadataOptions {
    module: string;
    classes: {[qname: string]: {sourceSha256: string; metadata: any; instanceTraits: any[]; staticTraits: any[]}};
}

/** Source completeness is validated here; authenticated reflection ordering is a toolkit input. */
export function validateNativeClassMetadata(qname: string, source: string, input: NativeClassMetadataOptions, lexical?: NativeLexicalMembers): void {
    const fail = (reason: string): never => {throw new Error('AS3_CLASS_METADATA_UNSUPPORTED: ' + reason);};
    if (!input || typeof input.module !== 'string' || !input.module.trim() || /[\r\n\u0000]/.test(input.module)) fail('common metadata provider module');
    const record = input.classes && input.classes[qname];
    if (!record || require('crypto').createHash('sha256').update(source).digest('hex') !== record.sourceSha256) fail('exact source bytes ' + qname);
    const tree = parse(qname + '.as', source), classes: Node[] = [];
    const clean = (node: Node): void => {if (!node) return; node.children = node.children.filter(Boolean); if (node.kind === K.CLASS) classes.push(node); node.children.forEach(clean);};
    clean(tree);
    if (classes.length !== 1) fail('exactly one source class');
    const cls = classes[0], name = cls.findChild(K.NAME).text;
    const pkg = tree.findChild(K.PACKAGE).findChild(K.NAME).text;
    const imports = tree.findChild(K.PACKAGE).findChild(K.CONTENT).findChildren(K.IMPORT).map(node => node.text);
    if (pkg + '.' + name !== qname || record.metadata.name !== qname.replace(/\.([^.]*)$/, '::$1')) fail('source declaration identity');
    if (cls.findChild(K.EXTENDS) || record.metadata.base !== 'Object') fail('reference declaration ancestry integration pending');
    const mods = (node: Node): string[] => {const value = node.findChild(K.MOD_LIST); return value ? value.children.map(x => x.text) : [];};
    if (record.metadata.isDynamic !== (mods(cls).indexOf('dynamic') >= 0) || record.metadata.isFinal !== (mods(cls).indexOf('final') >= 0)) fail('source class flags');
    const surfaces: {[side: string]: any[]} = {instance: [], statics: []};
    cls.findChild(K.CONTENT).children.forEach(member => {
        const flags = mods(member);
        if (flags.indexOf('public') < 0) {
            if ([K.VAR_LIST, K.CONST_LIST, K.FUNCTION, K.GET, K.SET].indexOf(member.kind) >= 0
                && !(lexical && lexical.source === source && lexical.qname === qname && lexical.proves(member)))
                fail('nonpublic source members require lexical namespace dispatch');
            return;
        }
        const side = flags.indexOf('static') >= 0 ? 'statics' : 'instance';
        if (member.kind === K.VAR_LIST || member.kind === K.CONST_LIST) {
            member.findChildren(K.NAME_TYPE_INIT).forEach(field => surfaces[side].push({name: field.findChild(K.NAME).text,
                kind: member.kind === K.VAR_LIST ? 'variable' : 'constant',
                // The exact reflected declaration authenticates this own-class
                // spelling; other reference names still need separate binding.
                type: nativeSourceTypeIdentity(field.findChild(K.TYPE), qname, imports) === qname
                    ? record.metadata.name : nativeSourceTypeIdentity(field.findChild(K.TYPE), qname, imports)}));
        } else if (member.kind === K.FUNCTION) {
            const method = member.findChild(K.NAME).text; if (method === name) return;
            surfaces[side].push({name: method, kind: 'method', parameterCount: member.findChild(K.PARAMETER_LIST).children.length});
        } else if (member.kind === K.GET) {
            if (member.findChild(K.PARAMETER_LIST).children.length) fail('source getter parameters');
            if ((member.findChild(K.TYPE) || {text:'*'}).text !== '*') fail('typed getter return coercion integration pending');
            surfaces[side].push({name: member.findChild(K.NAME).text, kind:'accessor',
                type:(member.findChild(K.TYPE) || {text:'*'}).text, access:'readonly'});
        } else fail('source setter/custom trait validation pending');
    });
    const sort = (a: any, b: any): number => a.name.localeCompare(b.name);
    ['instance', 'statics'].forEach(side => {
        const expected = surfaces[side].sort(sort), actual: any[] = [];
        [['variables', 'variable'], ['constants', 'constant'], ['methods', 'method'], ['accessors', 'accessor']].forEach(pair => {
            const list = record.metadata[side][pair[0]]; if (!Array.isArray(list)) fail('complete metadata lists');
            list.forEach((member: any) => {
                if (member.declaredBy !== record.metadata.name) {
                    if (side === 'statics' && pair[0] === 'accessors' && member.name === 'prototype' && member.declaredBy === 'Class' && member.access === 'readonly') return;
                    fail('unvalidated inherited metadata');
                }
                if (member.uri) fail('custom namespace metadata requires namespace authority');
                const item: any = {name: member.name, kind: pair[1]};
                if (pair[1] === 'method') item.parameterCount = member.parameterCount;
                else if (pair[1] === 'accessor') item.access = member.access;
                else item.type = member.type;
                actual.push(item);
            });
        });
        const reflected = expected.map(x => {const result = Object.assign({}, x); if (result.kind === 'accessor') delete result.type; return result;});
        if (JSON.stringify(actual.sort(sort)) !== JSON.stringify(reflected)) fail('complete source member surface');
        const supplied = side === 'instance' ? record.instanceTraits : record.staticTraits;
        if (!Array.isArray(supplied)) fail('complete source traits');
        const traits = supplied.map(x => Object.assign({}, x)).sort(sort);
        const wanted = expected.map(x => {const result = Object.assign({}, x); delete result.parameterCount; delete result.access; return result;});
        if (JSON.stringify(traits) !== JSON.stringify(wanted)) fail('source storage/types');
    });
}
