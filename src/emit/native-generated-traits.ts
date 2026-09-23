import Node from '../syntax/node';
import K from '../syntax/nodeKind';
import parse = require('../parse');
import {NativeGeneratedDeclarationPlan, NativeGeneratedDeclarationBinding,
    nativeGeneratedDeclarationInputs, nativeGeneratedDeclarationSource} from './native-generated-declarations';

interface ReferenceType {readonly name: string; readonly referenceExport?: string; readonly vectorExport?:string;}
type TraitType = string | ReferenceType;
interface Trait {
    readonly name: string;
    readonly kind: 'variable' | 'constant' | 'method' | 'accessor';
    readonly type?: TraitType;
}
interface Member extends Trait {
    declaredBy: string;
    constantLiteral?: string;
    access?: 'readonly' | 'writeonly' | 'readwrite';
    parameterCount?: number;
    override?: boolean;
    final?: boolean;
}
interface LexicalMember {
    readonly owner: string; readonly start: number; readonly end: number;
    readonly visibility: string; readonly static: boolean;
}
function fail(reason: string): never {throw new Error('AS3_GENERATED_TRAITS_UNSUPPORTED: ' + reason);}
function reflected(name: string): string {return name.replace(/\.([^.]*)$/, '::$1');}
function flags(node: Node): string[] {const mods = node.findChild(K.MOD_LIST); return mods ? mods.children.map(mod => mod.text) : [];}
function storageType(node: Node): Node {
    if (node.findChild(K.SHORT_VECTOR)) fail('vector literal storage requires separate initialization authority');
    return node.findChild(K.VECTOR)||node.findChild(K.TYPE);
}
function initializerEnd(node: Node): number {
    return node.children.reduce((end, child) => Math.max(end, initializerEnd(child)), Math.max(node.start, node.end));
}
function frozen<T>(value: T): T {
    if (value && typeof value === 'object') Object.keys(value).forEach(key => frozen((value as any)[key]));
    return Object.freeze(value);
}

/**
 * Source projection for the common generated registrar, not complete Flash
 * reflection. Nonpublic declarations remain explicit lexical prerequisites;
 * this projection never grants permission to emit them as public JS names.
 * Initializer scheduling and native provider admission are separate consumers.
 */
export class NativeGeneratedClassTraits {
    public readonly binding: NativeGeneratedDeclarationBinding;
    public readonly metadata: any;
    public readonly instanceTraits: ReadonlyArray<Trait>;
    public readonly staticTraits: ReadonlyArray<Trait>;
    public readonly instanceConstants: ReadonlyArray<{name: string; literal: string}>;
    public readonly lexicalMembers: ReadonlyArray<LexicalMember>;

    constructor(plan: NativeGeneratedDeclarationPlan, scope: string, owner: string, source: string) {
        nativeGeneratedDeclarationSource(plan, scope, owner, source);
        const input = nativeGeneratedDeclarationInputs(plan, scope);
        this.binding = plan.bindings.find(item => item.qname === owner);
        if (!this.binding) fail('reference-only source cannot publish a class: ' + owner);
        const lexical: LexicalMember[] = [];
        const surfaces = new Map<string, {instance: Member[]; statics: Member[]; dynamic: boolean; final: boolean}>();
        if(plan.nativeBindings.some(binding=>!!binding.eventBaseExport)) {
            const declaredBy='flash.events::Event';
            const instance: Member[] = [['type','String'],['bubbles','Boolean'],['cancelable','Boolean'],['eventPhase','uint'],['target','Object'],['currentTarget','Object']]
                .map(([name,type])=>({name,type,kind:'accessor',access:'readonly',declaredBy} as Member));
            ['clone','toString','formatToString','stopImmediatePropagation','preventDefault','isDefaultPrevented','stopPropagation']
                .forEach(name=>instance.push({name,kind:'method',parameterCount:name==='formatToString'?1:0,declaredBy}));
            surfaces.set('flash.events.Event',{instance,statics:[],dynamic:false,final:false});
        }
        if(plan.nativeBindings.some(binding=>binding.qname==='Error'&&!!binding.nativeBaseExport)) {
            const declaredBy='Error';
            const instance: Member[] = [{name:'name',kind:'variable',type:'*',declaredBy},
                {name:'message',kind:'variable',type:'*',declaredBy},
                {name:'errorID',kind:'accessor',access:'readonly',type:'int',declaredBy},
                {name:'getStackTrace',kind:'method',parameterCount:0,declaredBy}];
            surfaces.set('Error',{instance,statics:[],dynamic:true,final:false});
        }
        const type = (qname: string, node: Node): TraitType => {
            if (!node) return '*';
            if(node.kind===K.VECTOR){
                const vector=plan.vectors.find(v=>v.owner===qname&&v.start===node.start&&v.end===node.end);
                if(!vector)fail('vector storage requires separate initialization authority');
                return {name:vector.name,vectorExport:vector.specExport};
            }
            const reference = plan.references.find(item => item.owner === qname && item.start === node.start && item.end === node.end);
            if (!reference) fail('exact source type span required: ' + qname);
            if (reference.kind === 'intrinsic') {
                if (['*','int','uint','Number','Boolean','String','Object','Function','Array'].indexOf(reference.identity) < 0)
                    fail('intrinsic storage requires provider authority: ' + reference.identity);
                return reference.identity;
            }
            const binding = reference.kind === 'declaration' && plan.bindings.find(item => item.qname === reference.identity);
            const contract = reference.kind === 'interface' && plan.interfaces.find(item => item.qname === reference.identity);
            const native = reference.kind === 'native' && plan.nativeBindings.find(item => item.qname === reference.identity);
            if (!binding && !contract && !native) fail('unresolved source storage type: ' + qname + ':' + reference.sourceName);
            return {name: reflected(reference.identity), referenceExport: binding ? binding.tokenExport : contract ? contract.tokenExport : native.referenceExport};
        };
        const build = (binding: NativeGeneratedDeclarationBinding): void => {
            if (surfaces.has(binding.qname)) return;
            const parent = binding.base && plan.bindings.find(item => item.qname === binding.base);
            if (parent) build(parent);
            const inherited = binding.base && surfaces.get(binding.base);
            if (inherited && inherited.final) fail('source extends final class: ' + binding.qname);
            const root = parse(binding.qname + '.as', input.sources[binding.qname].source);
            const clean = (node: Node): void => {node.children = node.children.filter(Boolean); node.children.forEach(clean);};
            clean(root);
            const cls = root.findChild(K.PACKAGE).findChild(K.CONTENT).findChild(K.CLASS);
            const own: {instance: Member[]; statics: Member[]} = {instance: [], statics: []};
            const visit = (member: Node): void => {
                const mods = flags(member), isStatic = mods.indexOf('static') >= 0;
                if (mods.some(mod => ['public','private','protected','internal','static','override','final'].indexOf(mod) < 0))
                    fail('custom namespace or unsupported member modifier: ' + binding.qname);
                if ([K.NAMESPACE_DECLARATION,K.USE,K.INCLUDE,K.EMBED].indexOf(member.kind) >= 0)
                    fail('namespace/include/embed declaration authority: ' + binding.qname);
                if ([K.VAR_LIST,K.CONST_LIST,K.FUNCTION,K.GET,K.SET].indexOf(member.kind) < 0) return;
                const visibility = mods.filter(mod => ['public','private','protected','internal'].indexOf(mod) >= 0);
                if (visibility.length > 1) fail('conflicting source visibility');
                if (member.kind === K.FUNCTION && member.findChild(K.NAME).text === cls.findChild(K.NAME).text) {
                    if (isStatic || mods.indexOf('override') >= 0 || visibility[0] && visibility[0] !== 'public') fail('source constructor modifiers');
                    return;
                }
                if (visibility[0] !== 'public') {
                    lexical.push({owner:binding.qname,start:member.start,end:member.end,visibility:visibility[0] || 'internal',static:isStatic});
                    return;
                }
                const list = own[isStatic ? 'statics' : 'instance'];
                const add = (value: Member): void => {
                    const previous = list.find(item => item.name === value.name);
                    if (previous) {
                        if (previous.kind !== 'accessor' || value.kind !== 'accessor' || previous.access === value.access
                            || previous.access === 'readwrite' || JSON.stringify(previous.type) !== JSON.stringify(value.type)
                            || previous.override !== value.override || previous.final !== value.final)
                            fail('duplicate or incompatible public declaration: ' + binding.qname + ':' + value.name);
                        previous.access = 'readwrite';
                    } else list.push(value);
                };
                const common = {declaredBy:reflected(binding.qname),override:mods.indexOf('override') >= 0,final:mods.indexOf('final') >= 0};
                if (isStatic && common.override) fail('static override authority');
                if (member.kind === K.VAR_LIST || member.kind === K.CONST_LIST) {
                    if (common.override || common.final) fail('storage override/final modifier');
                    member.findChildren(K.NAME_TYPE_INIT).forEach(field => {
                        if(field.findChild(K.VECTOR)&&(isStatic||member.kind===K.CONST_LIST))fail('Vector static/constant storage requires separate authority');
                        const fieldType = type(binding.qname,storageType(field));
                        let constantLiteral: string;
                        if (member.kind === K.CONST_LIST && !isStatic) {
                            const init = field.findChild(K.INIT);
                            constantLiteral = init && input.sources[binding.qname].source.slice(init.start,initializerEnd(init)).trim();
                            const numeric = constantLiteral && /^[+-]?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(constantLiteral)
                                && isFinite(Number(constantLiteral));
                            if (!(typeof fieldType === 'string' && (['int','uint','Number'].indexOf(fieldType)>=0 && numeric
                                || fieldType==='Boolean' && /^(true|false)$/.test(constantLiteral || '')
                                || fieldType==='String' && /^(null|"[^"\\\r\n\u2028\u2029]*"|'[^'\\\r\n\u2028\u2029]*')$/.test(constantLiteral || ''))))
                                fail('instance constant requires qualified primitive literal');
                        }
                        add(Object.assign({},common,{name:field.findChild(K.NAME).text,
                            kind:member.kind===K.VAR_LIST?'variable':'constant',type:fieldType,constantLiteral}) as Member);
                    });
                    return;
                }
                const name = member.findChild(K.NAME).text, params = member.findChild(K.PARAMETER_LIST).children;
                if (member.kind === K.FUNCTION) {
                    add(Object.assign({},common,{name,kind:'method',parameterCount:params.filter(p=>!p.findChild(K.REST)).length}) as Member);
                    return;
                }
                let valueType: TraitType;
                if (member.kind === K.GET) {
                    if (params.length) fail('getter parameter count');
                    valueType = type(binding.qname, storageType(member));
                } else {
                    if (params.length !== 1 || params[0].findChild(K.REST)) fail('setter parameter count/rest');
                    const value = params[0].findChild(K.NAME_TYPE_INIT), result = member.findChild(K.TYPE);
                    if (value.findChild(K.INIT) || result && result.text !== 'void') fail('setter signature');
                    valueType = type(binding.qname,storageType(value));
                }
                if(typeof valueType!=='string'&&valueType.vectorExport)fail('Vector accessor storage requires separate authority');
                add(Object.assign({},common,{name,kind:'accessor',type:valueType,access:member.kind === K.GET ? 'readonly' : 'writeonly'}) as Member);
            };
            cls.findChild(K.CONTENT).children.forEach(visit);
            const instance = inherited ? inherited.instance.slice() : [];
            own.instance.forEach(member => {
                const index = instance.findIndex(item => item.name === member.name), previous = instance[index];
                if (previous) {
                    if(previous.declaredBy==='flash.events::Event' && ['clone','toString','formatToString'].indexOf(member.name)<0)
                        fail('native Event override requires separate source authority: '+member.name);
                    if (!member.override || previous.final || previous.kind !== member.kind || member.kind === 'variable' || member.kind === 'constant'
                        || member.kind === 'accessor' && (previous.access !== member.access || JSON.stringify(previous.type) !== JSON.stringify(member.type))
                        || member.kind === 'method' && previous.parameterCount !== member.parameterCount)
                        fail('inherited collision/partial override requires authority: ' + binding.qname + ':' + member.name);
                    instance[index] = member;
                } else {
                    if (member.override) fail('override without source public ancestor: ' + binding.qname + ':' + member.name);
                    instance.push(member);
                }
            });
            surfaces.set(binding.qname,{instance,statics:own.statics,dynamic:flags(cls).indexOf('dynamic') >= 0,final:flags(cls).indexOf('final') >= 0});
        };
        build(this.binding);
        const surface = surfaces.get(owner);
        const members = (items: Member[]): any => {
            const result: any = {variables:[],constants:[],methods:[],accessors:[]};
            items.forEach(item => {
                const value: any = {name:item.name,declaredBy:item.declaredBy};
                if (item.kind === 'method') value.parameterCount = item.parameterCount;
                else if (item.kind === 'accessor') value.access = item.access;
                else value.type = typeof item.type === 'string' ? item.type : item.type.name;
                result[item.kind === 'variable' ? 'variables' : item.kind === 'constant' ? 'constants' : item.kind === 'method' ? 'methods' : 'accessors'].push(value);
            });
            return result;
        };
        const traits = (items: Member[]): Trait[] => items.map(item => Object.assign({name:item.name,kind:item.kind},item.type === undefined ? {} : {type:item.type}));
        this.metadata = frozen({name:reflected(owner),base:this.binding.base ? reflected(this.binding.base) : 'Object',
            isDynamic:surface.dynamic,isFinal:surface.final,instance:members(surface.instance),statics:members(surface.statics)});
        this.instanceConstants = frozen(surface.instance.filter(item=>item.kind==='constant').map(item=>({name:item.name,literal:item.constantLiteral})));
        this.instanceTraits = frozen(traits(surface.instance));
        this.staticTraits = frozen(traits(surface.statics));
        this.lexicalMembers = frozen(lexical);
        Object.freeze(this);
    }

    /** Domain is a compiler-created import alias; Array is a captured intrinsic. */
    public emitDefinition(domain: string, array: string): string {
        if (![domain,array].every(value => /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(value))) fail('compiler reference expression');
        const emit = (traits: ReadonlyArray<Trait>): string => '[' + traits.map(trait => {
            const fields = 'name:' + JSON.stringify(trait.name) + ',kind:' + JSON.stringify(trait.kind);
            if (trait.type === undefined) return '{' + fields + '}';
            const type = trait.type === 'Array' ? '{name:"Array",reference:' + array + '}' : typeof trait.type === 'string' ? JSON.stringify(trait.type)
                : '{name:' + JSON.stringify(trait.type.name) + (trait.type.vectorExport?',vector:':',reference:') + domain + '.' + (trait.type.vectorExport||trait.type.referenceExport) + '}';
            return '{' + fields + ',type:' + type + '}';
        }).join(',') + ']';
        return '{metadata:' + JSON.stringify(this.metadata) + ',instanceTraits:' + emit(this.instanceTraits) + ',staticTraits:' + emit(this.staticTraits)
            + ',instanceConstants:[' + this.instanceConstants.map(item=>'{name:'+JSON.stringify(item.name)+',value:'+item.literal+'}').join(',') + ']'
            + ',declaration:{type:' + domain + '.' + this.binding.tokenExport + ',publishGeneration:' + domain + '.' + this.binding.publishExport + '}}';
    }
}
