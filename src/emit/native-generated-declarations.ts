import Node from '../syntax/node';
import {NativeGeneratedPrivateDeclarationBinding, planNativePrivateDeclarations, privateDeclarationIdentity} from './native-generated-private-declarations';
import {NativeSourceUnit, readNativeSourceUnit, nativeSourceUnitAst, nativeSourceUnitNode, NativeSourceUnitDeclaration, nativeSourceUnitResolver, nativeSourceIntrinsicNames} from './native-source-unit';
import K from '../syntax/nodeKind';
import parse = require('../parse');
import {NativePatternLocal, nativePatternLocals} from './native-pattern-locals';
import {NativeGeneratedInterfaceContracts,projectNativeGeneratedInterfaceContracts} from './native-generated-interface-contracts';
import {nativeGeneratedInterfaceBoundary} from './native-generated-interface-boundaries';

export interface NativeGeneratedDeclarationInput {
    scope: string;
    providerModule: string;
    /** Explicit common AS3Type provider; required for source interface tokens. */
    interfaceProviderModule?: string;
    /** Explicit common Vector provider for generated specialization identities. */
    vectorProviderModule?: string;
    /** Optional explicit script-global provider for generated lexical calls. */
    scriptGlobalProviderModule?: string;
    /** Explicit cohort-owned AS3ScriptDomain, allocated by the native loader/bootstrap. */
    scriptDomainProvider?: {module: string; exportName: string};
    /** Resolve inherited source Class/type identity before allocating local declarations. */
    inheritScriptClasses?: true;
    /** Explicit provider for sealed package-internal lexical membership. */
    lexicalProviderModule?: string;
    /** Common String intrinsics for proven nonescaping RegExp literal locals. */
    patternProviderModule?: string;
    /** Explicit GreenSock migration storage provider; never a source Class token. */
    tweenHandleProviderModule?: string;
    /** Explicit class subset; omission selects all planned source classes. */
    scriptGlobalSources?: ReadonlyArray<string>;
    /** Explicit single-Class script units whose failed initializer globals are retained. */
    classScriptSources?: ReadonlyArray<string>;
    sources: {[qname: string]: {source: string; sourceSha256: string; referenceOnly?: boolean}};
    providers?: {[qname: string]: {module: string; exportName: string; nativeBase?: 'Event' | 'Error' | 'EventDispatcher' | 'Sprite'; nativeInterface?: true; nativeVector?: true}};
}
export interface NativeGeneratedDeclarationBinding {
    readonly qname: string;
    readonly base: string | null;
    readonly tokenExport: string;
    readonly publishExport: string;
    readonly lexicalExport: string;
    readonly scriptGlobalExport?: string;
    readonly interfaces: ReadonlyArray<string>;
}
export interface NativeGeneratedInterfaceBinding {
    readonly qname: string;
    readonly bases: ReadonlyArray<string>;
    readonly tokenExport: string;
}
export interface NativeGeneratedReference {
    readonly owner: string;
    readonly start: number;
    readonly end: number;
    readonly sourceName: string;
    readonly kind: 'intrinsic' | 'declaration' | 'interface' | 'native' | 'pattern-local' | 'tween-handle-local' | 'private-declaration' | 'unresolved';
    readonly identity: string;
}
export interface NativeGeneratedDeclarationPlan {
    readonly scope: string;
    readonly moduleSource: string;
    readonly bindings: ReadonlyArray<NativeGeneratedDeclarationBinding>;
    readonly interfaces: ReadonlyArray<NativeGeneratedInterfaceBinding>;
    readonly privateBindings: ReadonlyArray<NativeGeneratedPrivateDeclarationBinding>;
    readonly interfaceContracts: NativeGeneratedInterfaceContracts;
    readonly references: ReadonlyArray<NativeGeneratedReference>;
    readonly patternLocals: ReadonlyArray<NativePatternLocal>;
    readonly vectors: ReadonlyArray<{readonly owner:string;readonly start:number;readonly end:number;readonly identity:string;readonly name:string;readonly specExport:string;readonly elementClass?:string;readonly elementNative?:string}>;
    readonly sourceHashes: {[qname: string]: string};
    readonly nativeBindings: ReadonlyArray<{readonly qname: string; readonly referenceExport: string; readonly nativeInterface?: true; readonly eventBaseExport?: string; readonly nativeBaseExport?: string; readonly declarationExport?: string}>;
}
interface Context {input: NativeGeneratedDeclarationInput; plan: NativeGeneratedDeclarationPlan; units: Map<string, NativeSourceUnit>;}
const contexts = new WeakMap<object, Context>();
const builtins = nativeSourceIntrinsicNames;
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
    fields(data, ['scope', 'providerModule', 'interfaceProviderModule', 'vectorProviderModule', 'scriptGlobalProviderModule', 'scriptDomainProvider', 'inheritScriptClasses', 'scriptGlobalSources', 'classScriptSources', 'lexicalProviderModule', 'patternProviderModule', 'tweenHandleProviderModule', 'sources', 'providers']);
    moduleName(data.providerModule);
    if (data.patternProviderModule !== undefined) moduleName(data.patternProviderModule);
    if (data.tweenHandleProviderModule !== undefined) moduleName(data.tweenHandleProviderModule);
    if (data.interfaceProviderModule !== undefined) moduleName(data.interfaceProviderModule);
    if (data.lexicalProviderModule !== undefined) moduleName(data.lexicalProviderModule);
    if (data.vectorProviderModule !== undefined) moduleName(data.vectorProviderModule);
    if (data.scriptGlobalProviderModule !== undefined) moduleName(data.scriptGlobalProviderModule);
    if (data.scriptDomainProvider !== undefined) {
        if (!data.scriptGlobalProviderModule || !table(data.scriptDomainProvider)) fail('script domain requires explicit global provider');
        fields(data.scriptDomainProvider, ['module', 'exportName']);
        moduleName(data.scriptDomainProvider.module);
        if (typeof data.scriptDomainProvider.exportName !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(data.scriptDomainProvider.exportName)) fail('script domain export identifier');
    }
    if (data.inheritScriptClasses !== undefined && (data.inheritScriptClasses !== true || !data.scriptDomainProvider
        || !data.scriptGlobalProviderModule))
        fail('inherited Classes require explicit script cohort');
    if(data.scriptGlobalSources!==undefined&&(!data.scriptGlobalProviderModule||!Array.isArray(data.scriptGlobalSources)
        ||new Set(data.scriptGlobalSources).size!==data.scriptGlobalSources.length))fail('script global source selection requires unique names and provider');
    if(data.classScriptSources!==undefined&&(!data.scriptGlobalProviderModule||!data.scriptDomainProvider||data.lexicalProviderModule&&!data.inheritScriptClasses
        ||!Array.isArray(data.classScriptSources)||!data.classScriptSources.length
        ||new Set(data.classScriptSources).size!==data.classScriptSources.length))
        fail('Class script selection requires unique names, explicit script domain and inherited internal membership');
    if (!table(data.sources) || !Object.keys(data.sources).length) fail('nonempty exact source table required');
    if (data.providers !== undefined && !table(data.providers)) fail('provider table required');
    const providers = data.providers || {}, names = Object.keys(data.sources).sort(), nativeNames = Object.keys(providers).sort();
    const roots = new Map<string, Node>(), classes = new Map<string, Node>(), units = new Map<string, NativeSourceUnit>();
    const sourceHashes: {[qname: string]: string} = Object.create(null);
    nativeNames.forEach(name => {
        qname(name);
        if (names.indexOf(name) >= 0 || builtins.indexOf(name) >= 0) fail('source/provider or builtin collision: ' + name);
        const provider = providers[name];
        if (!table(provider)) fail('provider binding required');
        fields(provider, ['module', 'exportName','nativeBase','nativeInterface','nativeVector']);
        if (provider.nativeVector !== undefined && (provider.nativeVector !== true || name !== 'flash.display.MovieClip'
            || provider.exportName !== 'MovieClip' || provider.nativeBase !== undefined || provider.nativeInterface !== undefined))
            fail('native Vector requires the qualified MovieClip provider');
        if (provider.nativeInterface !== undefined && (provider.nativeInterface !== true || provider.nativeBase !== undefined || !data.interfaceProviderModule))
            fail('native interface requires explicit interface provider and cannot be a native Class base');
        if(provider.nativeBase !== undefined && !((provider.nativeBase === 'Event' && name === 'flash.events.Event' && provider.exportName === 'Event')
            || (provider.nativeBase === 'Error' && name === 'Error' && provider.exportName === 'Error')
            || (provider.nativeBase === 'EventDispatcher' && name === 'flash.events.EventDispatcher' && provider.exportName === 'EventDispatcher')
            || (provider.nativeBase === 'Sprite' && name === 'flash.display.Sprite' && provider.exportName === 'Sprite')))
            fail('native base requires the exact supported Event, Error, EventDispatcher or Sprite provider');
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
        let unit: NativeSourceUnit;
        try {unit = readNativeSourceUnit(name, record.source, record.sourceSha256);}
        catch (error) {fail(error.message.replace(/^AS3_SOURCE_UNIT_UNSUPPORTED: /, ''));}
        const ast = nativeSourceUnitAst(unit), root = ast.root, cls = ast.declarations[0].node;
        // Private declarations retain this source unit. Implementation admission
        // remains gated separately from header/type planning.
        if (record.referenceOnly && unit.declarations.length !== 1) fail('reference-only source cannot supply private Class implementations');
        units.set(name, unit);
        roots.set(name, root); classes.set(name, cls); sourceHashes[name] = record.sourceSha256;
    });
    const privatePlan = planNativePrivateDeclarations(units, name => names.indexOf(name) >= 0 || nativeNames.indexOf(name) >= 0);
    const privateBindings = privatePlan.bindings;
    const resolvers = new Map<string, (spelling: string) => string>();
    const resolve = (owner: string, spelling: string): string => {
        if (!resolvers.has(owner)) {
            const helper = privateBindings.find(binding => binding.identity === owner);
            const unit = units.get(helper ? helper.declaration.sourceOwner : owner);
            resolvers.set(owner, plannedUnitResolver(unit,
                name => names.indexOf(name) >= 0 || nativeNames.indexOf(name) >= 0, true, helper && helper.declaration));
        }
        return resolvers.get(owner)(spelling);
    };
    if (data.tweenHandleProviderModule && (classes.has('com.greensock.TweenMax') || providers['com.greensock.TweenMax']))
        fail('TweenMax migration cannot also declare or bind its source Class');
    const bindings: NativeGeneratedDeclarationBinding[] = [], references: NativeGeneratedReference[] = [];
    const interfaces: NativeGeneratedInterfaceBinding[] = [];
    names.forEach(owner => {
        const node = classes.get(owner);
        if (node.kind !== K.INTERFACE) return;
        if (!data.interfaceProviderModule) fail('explicit source interface provider required: ' + owner);
        if (data.sources[owner].referenceOnly) fail('interface cannot be reference-only: ' + owner);
        const bases = node.findChildren(K.EXTENDS).map(base => resolve(owner, base.qualifiedName || base.text));
        if (new Set(bases).size !== bases.length) fail('duplicate interface base: ' + owner);
        bases.forEach(base => {
            if(providers[base]&&providers[base].nativeInterface&&nativeGeneratedInterfaceBoundary(base))return;
            if (!classes.has(base) || classes.get(base).kind !== K.INTERFACE || data.sources[base].referenceOnly)
                fail('interface base requires exact source interface: ' + owner + ':' + base);
        });
        interfaces.push(Object.freeze({qname: owner, bases: Object.freeze(bases), tokenExport: 'interface' + interfaces.length}));
    });
    names.forEach(owner => {
        const cls = classes.get(owner);
        if (cls.kind === K.INTERFACE) return;
        if (!data.sources[owner].referenceOnly) {
            const implemented = cls.findChild(K.IMPLEMENTS_LIST);
            const declaredInterfaces = implemented ? implemented.children.map(node => resolve(owner,node.qualifiedName || node.text)) : [];
            if (new Set(declaredInterfaces).size !== declaredInterfaces.length) fail('duplicate implements declaration: ' + owner);
            declaredInterfaces.forEach(name => {
                if (!interfaces.some(binding => binding.qname === name)) fail('interface declaration authority required: ' + owner + ':' + name);
            });
            const baseNode = cls.findChild(K.EXTENDS), base = baseNode ? resolve(owner, baseNode.qualifiedName || baseNode.text) : 'Object';
            if (base !== 'Object' && (!data.sources[base] || data.sources[base].referenceOnly || classes.get(base).kind !== K.CLASS) && !(providers[base] && (providers[base].nativeBase === 'Event' || providers[base].nativeBase === 'Error' || providers[base].nativeBase === 'EventDispatcher' || providers[base].nativeBase === 'Sprite')))
                fail('base requires a planned source declaration: ' + owner + ':' + base);
            bindings.push(Object.freeze({qname: owner, base: base === 'Object' ? null : base,
                tokenExport: 'type' + bindings.length, publishExport: 'publish' + bindings.length, lexicalExport: 'lexical' + bindings.length,
                ...(data.scriptGlobalProviderModule&&(!data.scriptGlobalSources||data.scriptGlobalSources.indexOf(owner)>=0) ? {scriptGlobalExport:'publishScript'+bindings.length} : {}),
                interfaces: Object.freeze(declaredInterfaces)}));
        }
    });
    const patternLocals: NativePatternLocal[] = [];
    if(data.patternProviderModule) names.forEach(owner => {
        if(!data.sources[owner].referenceOnly && !providers.RegExp && !classes.has('RegExp'))
            patternLocals.push(...nativePatternLocals(classes.get(owner),owner,data.sources[owner].source,name=>resolve(owner,name)));
    });
    names.forEach(owner => {
        const walk = (node: Node): void => {
            // Legacy interface method signatures have a TYPE-kind wrapper named
            // 'function'; only its actual return/parameter children are types.
            if (node.kind === K.TYPE && node.text !== 'function') {
                const spelling = node.qualifiedName || node.text || '*', identity = resolve(owner, spelling);
                let tweenLocal = false;
                if (data.tweenHandleProviderModule && identity === 'com.greensock.TweenMax'
                    && !providers[identity] && !classes.has(identity) && node.parent && node.parent.kind === K.NAME_TYPE_INIT
                    && node.parent.parent && [K.VAR_LIST,K.VAR].indexOf(node.parent.parent.kind) >= 0) {
                    let member = node.parent.parent;
                    while (member && [K.FUNCTION,K.GET,K.SET].indexOf(member.kind) < 0) member = member.parent;
                    tweenLocal = !!member && member.parent === classes.get(owner).findChild(K.CONTENT)
                        && member.findChild(K.NAME).text !== classes.get(owner).findChild(K.NAME).text;
                }
                const kind: NativeGeneratedReference['kind'] = builtins.indexOf(identity) >= 0 ? 'intrinsic' : bindings.some(binding => binding.qname === identity)
                    ? 'declaration' : interfaces.some(binding => binding.qname === identity) ? 'interface'
                    : nativeNames.indexOf(identity) >= 0 ? 'native'
                    : patternLocals.some(p=>p.owner===owner&&p.typeStart===node.start&&p.typeEnd===node.end) ? 'pattern-local'
                    : privateBindings.some(binding => binding.identity === identity) ? 'private-declaration'
                    : tweenLocal ? 'tween-handle-local' : 'unresolved';
                references.push(Object.freeze({owner, start: node.start, end: node.end, sourceName: spelling, kind, identity}));
            }
            node.children.forEach(walk);
        };
        walk(classes.get(owner));
    });
    privatePlan.references.forEach(reference => {
        const identity = typeof reference.identity === 'string' ? reference.identity : privateDeclarationIdentity(reference.identity);
        const kind: NativeGeneratedReference['kind'] = builtins.indexOf(identity) >= 0 ? 'intrinsic'
            : privateBindings.some(binding => binding.identity === identity) ? 'private-declaration'
            : bindings.some(binding => binding.qname === identity) ? 'declaration'
            : interfaces.some(binding => binding.qname === identity) ? 'interface'
            : nativeNames.indexOf(identity) >= 0 ? 'native' : 'unresolved';
        references.push(Object.freeze({owner: reference.owner, start: reference.start, end: reference.end,
            sourceName: reference.spelling, kind, identity}));
    });
    if(data.scriptGlobalSources&&data.scriptGlobalSources.some(name=>!bindings.some(binding=>binding.qname===name)))
        fail('script global source must be a planned class');
    if(data.inheritScriptClasses && bindings.some(binding=>!binding.scriptGlobalExport))
        fail('inherited Class selection requires all class script globals');
    if(data.classScriptSources)data.classScriptSources.forEach(name=>{
        const binding=bindings.find(value=>value.qname===name);
        if(!binding||!binding.scriptGlobalExport)fail('Class script selection requires a planned class with script global');
        // Root Class generations retain their package capability and independent
        // lexical storage across initializer failures. Derived internal retries
        // still need separate evidence for ancestry and trait enrollment.
        if(data.lexicalProviderModule&&binding.base){
            const pkg=name.slice(0,name.lastIndexOf('.'));
            classes.forEach((cls,qname)=>{
                if(qname.slice(0,qname.lastIndexOf('.'))!==pkg)return;
                if(cls.findChild(K.CONTENT).children.some(member=>{
                    if([K.VAR_LIST,K.CONST_LIST,K.FUNCTION,K.GET,K.SET].indexOf(member.kind)<0)return false;
                    const mods=member.findChild(K.MOD_LIST);
                    return !mods||!mods.children.some(mod=>['public','private','protected'].indexOf(mod.text)>=0);
                }))fail('Class script retries with internal declarations in their package require qualification');
            });
        }
        if(binding.base){
            // Direct EventDispatcher generations retain the canonical native
            // constructor entry and independent event storage across retries.
            // Other direct native bases still require their own qualification.
            const dispatcherBase=binding.base==='flash.events.EventDispatcher'
                &&providers[binding.base]&&providers[binding.base].nativeBase==='EventDispatcher';
            // Stable source ancestry may end at the authenticated Sprite
            // boundary. Check every ancestor: a retrying intermediate Class
            // cannot be treated as a stable constructor/prototype authority.
            // The previously qualified immediate source-root case is retained.
            let parent=bindings.find(value=>value.qname===binding.base);
            const seen=new Set<string>([name]);
            let stableParent=false,depth=0;
            while(parent&&parent.scriptGlobalExport&&!seen.has(parent.qname)
                &&data.classScriptSources.indexOf(parent.qname)<0){
                seen.add(parent.qname);depth++;
                if(!parent.base){stableParent=depth===1;break;}
                if(parent.base==='flash.display.Sprite'&&providers[parent.base]
                    &&providers[parent.base].nativeBase==='Sprite'){stableParent=true;break;}
                parent=bindings.find(value=>value.qname===parent.base);
            }
            if(!dispatcherBase&&!stableParent)
                fail('derived Class script requires a non-retrying source root parent');
        }
    });
    const lines = ['// Compiler-only declaration identities; no source class implementation imports.',
        'import {declareAS3ReferenceType} from ' + JSON.stringify(data.providerModule) + ';'];
    if (references.some(ref => ref.kind === 'tween-handle-local')) lines.push(
        'import {coerceFlashTweenMaxHandle as __tweenHandleCoerce} from ' + JSON.stringify(data.tweenHandleProviderModule) + ';',
        'export const coerceTweenMaxHandle=__tweenHandleCoerce;');
    if(data.scriptGlobalProviderModule) {
        lines.push('import {instantiateAS3ScriptUnit'+(data.classScriptSources?',instantiateAS3ClassScriptUnit':'')+(data.inheritScriptClasses?',selectAS3ScriptDomainClass,selectAS3ScriptDomainType':'')+(data.scriptDomainProvider?'':',createAS3ScriptDomain')+'} from '+JSON.stringify(data.scriptGlobalProviderModule)+';');
        lines.push(data.scriptDomainProvider
            ? 'import {'+data.scriptDomainProvider.exportName+' as __scriptDomain} from '+JSON.stringify(data.scriptDomainProvider.module)+';'
            : 'const __scriptDomain=createAS3ScriptDomain();');
    }
    if (interfaces.length) lines.push('import {defineAS3Interface,registerAS3Class'+(data.inheritScriptClasses?',isAS3Interface':'')+'} from ' + JSON.stringify(data.interfaceProviderModule) + ';');
    if (nativeNames.some(name => providers[name].nativeInterface))
        lines.push('import {isAS3Interface as __isNativeInterface} from ' + JSON.stringify(data.interfaceProviderModule) + ';');
    const emittedInterfaces = new Set<string>(), activeInterfaces = new Set<string>();
    const addInterface = (binding: NativeGeneratedInterfaceBinding): void => {
        if (emittedInterfaces.has(binding.qname)) return;
        if (activeInterfaces.has(binding.qname)) fail('cyclic source interface inheritance: ' + binding.qname);
        activeInterfaces.add(binding.qname);
        const parents = binding.bases.map(name => interfaces.find(value => value.qname === name)).filter(Boolean);
        parents.forEach(addInterface);
        const name = JSON.stringify(binding.qname.replace(/\.([^.]*)$/, '::$1'));
        const tokens=binding.bases.map(base=>{
            const source=interfaces.find(value=>value.qname===base);
            return source?source.tokenExport:'native'+nativeNames.indexOf(base);
        });
        const create = 'defineAS3Interface<unknown>('+name+',['+tokens.join(',')+'])';
        lines.push('export const ' + binding.tokenExport + '=' + (data.inheritScriptClasses
            ? '(()=>{const selected=selectAS3ScriptDomainType(__scriptDomain,'+name+');if(selected){if(!isAS3Interface(selected.declaration))throw new TypeError("Inherited definition is not an interface");return selected.declaration;}return '+create+';})()'
            : create) + ';');
        activeInterfaces.delete(binding.qname); emittedInterfaces.add(binding.qname);
    };
    const vectors:Array<NativeGeneratedDeclarationPlan['vectors'][number]>=[];
    const vectorLines:string[]=[];
    if(data.vectorProviderModule){
        lines.push('import {as3VectorInterfaceSpec,as3VectorPrimitiveSpec,as3VectorDeclarationSpec,as3VectorCanonicalSpec} from '+JSON.stringify(data.vectorProviderModule)+';');
        const exports=new Map<string,string>();
        names.concat(privateBindings.map(binding => binding.identity)).forEach(owner=>{
            const walk=(node:Node):void=>{
                if(node.kind===K.VECTOR){
                    const construction=node.parent&&node.parent.kind===K.CALL&&node.parent.children[0]===node
                        &&node.parent.parent&&node.parent.parent.kind===K.NEW;
                    const literal=node.parent&&node.parent.kind===K.SHORT_VECTOR&&node.parent.parent&&node.parent.parent.kind===K.NEW;
                    if(!construction&&!literal&&(!node.parent||[K.NAME_TYPE_INIT,K.FUNCTION,K.GET,K.TYPE].indexOf(node.parent.kind)<0))
                        fail('Vector expression conversion requires separate qualification');
                    const element=node.findChild(K.TYPE);
                    if(!element||node.children.length!==1)fail('nested Vector specialization publication requires qualification');
                    const identity=resolve(owner,element.qualifiedName||element.text);
                    if(literal&&(identity!=='Class'||classes.has(identity)||providers[identity]))fail('Vector literal requires intrinsic Class element');
                    const contract=interfaces.find(i=>i.qname===identity);
                    const elementClass=bindings.find(b=>b.qname===identity);
                    const elementPrivate=privateBindings.find(b=>b.identity===identity);
                    const elementNative=providers[identity]&&providers[identity].nativeVector;
                    if(!contract&&!elementClass&&!elementPrivate&&!elementNative&&['*','int','uint','Number','Boolean','String','Object','Function','Class'].indexOf(identity)<0)
                        fail('Vector element publication requires interface, planned source class or qualified primitive: '+identity);
                    let specExport=exports.get(identity);
                    if(!specExport){
                        specExport='vector'+exports.size;exports.set(identity,specExport);
                        vectorLines.push('export const '+specExport+'='+(contract?'as3VectorInterfaceSpec('+contract.tokenExport+')':elementClass?'as3VectorDeclarationSpec('+elementClass.tokenExport+')':elementPrivate?'as3VectorDeclarationSpec('+elementPrivate.tokenExport+')':elementNative?'as3VectorCanonicalSpec('+JSON.stringify(identity.replace(/\.([^.]*)$/,'::$1'))+',__vectorNative'+nativeNames.indexOf(identity)+')':'as3VectorPrimitiveSpec('+JSON.stringify(identity)+')')+';');
                    }
                    vectors.push(Object.freeze({owner,start:node.start,end:node.end,identity:'Vector.<'+identity+'>',
                        name:'__AS3__.vec::Vector.<'+(elementPrivate?elementPrivate.declaration.reflectedName:identity.replace(/\.([^.]*)$/,'::$1'))+'>',specExport,...(elementClass||elementPrivate?{elementClass:identity}:{}),...(elementNative?{elementNative:identity}:{})}));
                }
                node.children.forEach(walk);
            };
            const helper = privateBindings.find(binding => binding.identity === owner);
            walk(helper ? nativeSourceUnitNode(units.get(helper.declaration.sourceOwner), helper.declaration) : classes.get(owner));
        });
    }
    const nativeBindings: Array<NativeGeneratedDeclarationPlan['nativeBindings'][number]> = nativeNames.map((name, index) => {
        const provider = providers[name], referenceExport = 'native' + index;
        if(provider.nativeVector)lines.push('import {'+provider.exportName+' as __vectorNative'+index+'} from '+JSON.stringify(provider.module)+';');
        if (provider.nativeInterface) {
            lines.push('import {' + provider.exportName + ' as ' + referenceExport + '} from ' + JSON.stringify(provider.module) + ';',
                'if(!__isNativeInterface(' + referenceExport + ')||' + referenceExport + '.name!==' + JSON.stringify(name.replace(/\.([^.]*)$/, '::$1'))
                    + ')throw new TypeError("AS3_GENERATED_DECLARATIONS_UNSUPPORTED: native interface token");',
                'export {' + referenceExport + '};');
            return Object.freeze({qname:name,referenceExport,nativeInterface:true as true});
        }
        lines.push('export {' + provider.exportName + ' as ' + referenceExport + '} from ' + JSON.stringify(provider.module) + ';');
        if(provider.nativeBase) {
            if(provider.nativeBase==='Sprite')lines.push('import {requireGeneratedFlashSpriteSurface as __requireSpriteSurface} from '+JSON.stringify(provider.module)+';',
                '__requireSpriteSurface();');
            const declarationExport='nativeType'+index,nativeBaseExport='nativeEntry'+index;
            lines.push('import {'+provider.nativeBase+'Declaration as '+declarationExport+'} from '+JSON.stringify(provider.module)+';');
            lines.push('export {'+declarationExport+'};');
            lines.push('export {'+provider.nativeBase+'ConstructorEntry as '+nativeBaseExport+'} from '+JSON.stringify(provider.module)+';');
            return Object.freeze({qname:name,referenceExport,declarationExport,nativeBaseExport,
                ...(provider.nativeBase==='Event'?{eventBaseExport:nativeBaseExport}:{})});
        }
        return Object.freeze({qname: name, referenceExport});
    });
    // Validate native tokens before source interfaces use them as parents.
    interfaces.forEach(addInterface);
    const emitted = new Set<string>(), active = new Set<string>();
    const add = (binding: NativeGeneratedDeclarationBinding): void => {
        if (emitted.has(binding.qname)) return;
        if (active.has(binding.qname)) fail('cyclic source inheritance: ' + binding.qname);
        active.add(binding.qname);
        const parent = binding.base && bindings.find(value => value.qname === binding.base);
        const nativeParent = binding.base && nativeBindings.find(value => value.qname === binding.base);
        if (parent) add(parent);
        const authority = '__authority_' + binding.tokenExport;
        const name = binding.qname.replace(/\.([^.]*)$/, '::$1');
        const selection = '__inherited_' + binding.tokenExport;
        if(data.inheritScriptClasses) lines.push('const '+selection+'=selectAS3ScriptDomainClass(__scriptDomain,'+JSON.stringify(name)+');');
        lines.push('const ' + authority + '='+(data.inheritScriptClasses?selection+'?null:':'')+'declareAS3ReferenceType<unknown>(' + JSON.stringify(name)
            + (parent ? ',' + parent.tokenExport : nativeParent ? ',' + nativeParent.declarationExport : '') + ');');
        lines.push('export const ' + binding.tokenExport + '='+(data.inheritScriptClasses?selection+'?'+selection+'.declaration:':'') + authority + '.type;');
        if(binding.interfaces.length) {
            const tokens=binding.interfaces.map(name=>interfaces.find(value=>value.qname===name).tokenExport);
            lines.push('export const '+binding.publishExport+'=(constructor:Function)=>{'+(data.inheritScriptClasses?'if(!'+authority+')throw new TypeError("Inherited Class cannot publish a child generation");':'')+'const generation='+authority+'.publishGeneration(constructor);'
                +'registerAS3Class(constructor,['+tokens.join(',')+']);return generation;};');
        } else lines.push('export const ' + binding.publishExport + '=' + (data.inheritScriptClasses
            ? '(constructor:Function)=>{if(!'+authority+')throw new TypeError("Inherited Class cannot publish a child generation");return '+authority+'.publishGeneration(constructor);}'
            : authority + '.publishGeneration') + ';');
        // Opaque common-engine scopes indexed by exact native generation. These
        // compiler exports never become properties of the source Class value.
        lines.push('export const ' + binding.lexicalExport + '=new WeakMap<Function,any>();');
        if(binding.scriptGlobalExport) {
            const split=binding.qname.lastIndexOf('.'),local=binding.qname.slice(split+1),uri=split<0?'':binding.qname.slice(0,split);
            const declaration={sourceId:binding.qname,sourceSha256:sourceHashes[binding.qname],bindings:[{name:local,uri,kind:'constant',type:name}]};
            const instantiate=data.classScriptSources&&data.classScriptSources.indexOf(binding.qname)>=0?'instantiateAS3ClassScriptUnit':'instantiateAS3ScriptUnit';
            lines.push('export const '+binding.scriptGlobalExport+'=<T>(factory:(global:object)=>T):T=>'+(data.inheritScriptClasses?selection+'?'+selection+'.resolve() as T:':'')+instantiate+'(__scriptDomain,'+JSON.stringify(declaration)
                +',context=>[{name:'+JSON.stringify(local)+',uri:'+JSON.stringify(uri)+',value:factory(context.global)}])'
                +'.export('+JSON.stringify(local)+','+JSON.stringify(uri)+') as T;');
        }
        active.delete(binding.qname); emitted.add(binding.qname);
    };
    bindings.forEach(add);
    const privateActive = new Set<string>(), privateDone = new Set<string>();
    const addPrivate = (binding: NativeGeneratedPrivateDeclarationBinding): void => {
        if (privateDone.has(binding.identity)) return;
        if (privateActive.has(binding.identity)) fail('cyclic file-private source inheritance: ' + binding.identity);
        privateActive.add(binding.identity);
        let baseToken: string;
        if (binding.base) {
            if (typeof binding.base !== 'string') {
                const parent = privateBindings.find(item => item.declaration === binding.base);
                if (!parent) fail('file-private base is outside its planned source file');
                addPrivate(parent); baseToken = parent.tokenExport;
            } else {
                const parent = bindings.find(item => item.qname === binding.base);
                if (!parent) fail('file-private base requires a planned source Class: ' + binding.identity);
                baseToken = parent.tokenExport;
            }
        }
        const authority = '__authority_' + binding.tokenExport;
        lines.push('const '+authority+'=declareAS3ReferenceType<unknown>('+JSON.stringify(binding.declaration.reflectedName)+(baseToken?','+baseToken:'')+');',
            'export const '+binding.tokenExport+'='+authority+'.type;',
            'export const '+binding.publishExport+'='+authority+'.publishGeneration;',
            'export const '+binding.lexicalExport+'=new WeakMap<Function,any>();');
        privateActive.delete(binding.identity); privateDone.add(binding.identity);
    };
    privateBindings.forEach(addPrivate);
    lines.push(...vectorLines);
    if(data.lexicalProviderModule){
        const membership=data.inheritScriptClasses?'bindAS3InternalPackage':'declareAS3InternalPackage';
        lines.push('import {'+membership+'} from '+JSON.stringify(data.lexicalProviderModule)+';');
        const packages=new Map<string,string[]>();
        bindings.forEach(binding=>{const split=binding.qname.lastIndexOf('.'),pkg=split<0?'':binding.qname.slice(0,split);
            if(!packages.has(pkg))packages.set(pkg,[]);packages.get(pkg).push(binding.tokenExport);});
        packages.forEach((tokens,pkg)=>{
            if(data.inheritScriptClasses&&!pkg)fail('inherited internal membership requires named source packages');
            lines.push(membership+'(['+tokens.join(',')+']);');
        });
    }
    const interfaceContracts=projectNativeGeneratedInterfaceContracts(classes,bindings,interfaces,resolve,
        name=>builtins.indexOf(name)>=0||bindings.some(b=>b.qname===name)||interfaces.some(b=>b.qname===name)||nativeNames.indexOf(name)>=0,
        name=>providers[name]&&providers[name].nativeInterface?nativeGeneratedInterfaceBoundary(name):undefined,
        name=>name==='flash.events.EventDispatcher'&&providers[name]&&providers[name].nativeBase==='EventDispatcher'
            ?nativeGeneratedInterfaceBoundary('flash.events.IEventDispatcher'):undefined);
    const plan: NativeGeneratedDeclarationPlan = Object.freeze({scope: data.scope, moduleSource: lines.join('\n') + '\n',
        sourceHashes: Object.freeze(sourceHashes), privateBindings, bindings: Object.freeze(bindings), interfaces: Object.freeze(interfaces), references: Object.freeze(references),vectors:Object.freeze(vectors),
        nativeBindings: Object.freeze(nativeBindings),patternLocals:Object.freeze(patternLocals),interfaceContracts});
    contexts.set(plan, {input: data, plan, units});
    return plan;
}

/** Shared source-file capability; private descriptors are never public QNames. */
export function nativeGeneratedSourceUnit(plan: NativeGeneratedDeclarationPlan, owner: string): NativeSourceUnit {
    const context = contexts.get(plan), helper = context && plan.privateBindings.find(binding => binding.identity === owner);
    const unit = context && context.units.get(helper ? helper.declaration.sourceOwner : owner);
    if (!unit) fail('exact planned source-unit capability required');
    return unit;
}

/** Detached AST for a planned declaration, preserving its original file scope. */
export function nativeGeneratedDeclarationNode(plan: NativeGeneratedDeclarationPlan, owner: string): Node {
    const ast = nativeSourceUnitAst(nativeGeneratedSourceUnit(plan, owner));
    const helper = plan.privateBindings.find(binding => binding.identity === owner);
    const selected = ast.declarations.find(item => helper ? item.declaration === helper.declaration : item.declaration.packageQName === owner);
    if (!selected) fail('planned declaration owner required');
    return selected.node;
}

/** Exact compiler capability plus source-byte check; serialization grants no authority. */
export function nativeGeneratedDeclarationSource(plan: NativeGeneratedDeclarationPlan, scope: string, owner: string, source: string):
    {readonly source: string; readonly sourceSha256: string; readonly referenceOnly?: boolean} {
    const context = plan && contexts.get(plan), helper = context && plan.privateBindings.find(binding => binding.identity === owner);
    const record = context && context.input.sources[helper ? helper.declaration.sourceOwner : owner];
    if (!context || scope !== plan.scope || !record || record.source !== source) fail('exact planned scope/source capability required');
    return record;
}

/** Internal consumers get the frozen source snapshot only through the live plan. */
export function nativeGeneratedDeclarationInputs(plan: NativeGeneratedDeclarationPlan, scope: string): NativeGeneratedDeclarationInput {
    const context = plan && contexts.get(plan);
    if (!context || context.input.scope !== scope) fail('exact planned scope capability required');
    return context.input;
}

function plannedUnitResolver(unit: NativeSourceUnit, known: (name: string) => boolean, privateNames = false, consumer?: NativeSourceUnitDeclaration): (spelling: string) => string {
    const resolve = nativeSourceUnitResolver(unit, consumer || unit.declarations[0], known);
    return (spelling: string): string => {
        try {
            const identity = resolve(spelling);
            if (typeof identity === 'string') return identity;
            if (privateNames) return privateDeclarationIdentity(identity);
            return fail('private source binding requires emission integration');
        } catch (error) {fail(error.message.replace(/^AS3_SOURCE_UNIT_UNSUPPORTED: /, '').replace(/^AS3_GENERATED_DECLARATIONS_UNSUPPORTED: /, ''));}
    };
}

/** A consumer resolves existing identities; it never adds tokens or publishers. */
export function nativeGeneratedConsumerResolver(plan: NativeGeneratedDeclarationPlan, source: string):
    {root: Node; owner: string; resolve: (name: string) => string} {
    const input = nativeGeneratedDeclarationInputs(plan, plan && plan.scope);
    const root = parse('ReferenceConsumer.as', source); normalize(root);
    const pkg = root.findChild(K.PACKAGE), content = pkg && pkg.findChild(K.CONTENT);
    const classes = content && content.findChildren(K.CLASS);
    if (!classes || classes.length !== 1) fail('one reference consumer class required');
    let count = 0;
    const walk = (node: Node): void => {if (node.kind === K.CLASS || node.kind === K.INTERFACE) count++; node.children.forEach(walk);};
    walk(root);
    if (count !== 1) fail('additional consumer declarations require source authority');
    const namespace = pkg.findChild(K.NAME).text;
    const owner = (namespace ? namespace + '.' : '') + classes[0].findChild(K.NAME).text;
    if (input.sources[owner]) nativeGeneratedDeclarationSource(plan, input.scope, owner, source);
    const known = Object.keys(input.sources).concat(Object.keys(input.providers || {}));
    const unit = input.sources[owner] ? nativeGeneratedSourceUnit(plan, owner) : readNativeSourceUnit(owner, source, hash(source));
    return {root, owner, resolve: plannedUnitResolver(unit, name => known.indexOf(name) >= 0)};
}
