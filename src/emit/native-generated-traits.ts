import {nativeGeneratedInterfaceBindings} from './native-generated-declarations';
import {generatedProxyUri, generatedProxySignatures} from './native-generated-proxy';
import {generatedMemberIdentity, generatedMemberUri, generatedNamespaces} from './native-generated-namespaces';
import Node from '../syntax/node';
import {nativeMouseEventTraits} from './native-mouseevent-traits';
import {nativeSpriteTraits} from './native-sprite-traits';
import {nativeMovieClipTraits} from './native-movieclip-traits';
import K from '../syntax/nodeKind';
import {NativeGeneratedDeclarationPlan, NativeGeneratedClassDeclaration,
    nativeGeneratedClassDeclaration, nativeGeneratedDeclarationInputs, nativeGeneratedDeclarationSource, nativeGeneratedDeclarationNode} from './native-generated-declarations';

interface ReferenceType {readonly name: string; readonly referenceExport?: string; readonly vectorExport?:string;}
type TraitType = string | ReferenceType;
interface Trait {
    readonly name: string;
    readonly uri?: string;
    readonly kind: 'variable' | 'constant' | 'method' | 'accessor';
    readonly type?: TraitType;
    readonly setterType?: TraitType;
    readonly access?: 'readonly' | 'writeonly' | 'readwrite';
}
interface AccessorPart {owner:string; override:boolean; final:boolean; type?:TraitType;}
interface Member extends Trait {
    parts?: {get?:AccessorPart; set?:AccessorPart};
    declaredBy: string;
    constantLiteral?: string;
    access?: 'readonly' | 'writeonly' | 'readwrite';
    parameterCount?: number;
    override?: boolean;
    final?: boolean;
    signature?: {parameters: TraitType[]; returns: TraitType; requiredCount: number};
}
/** Reflection uses the getter type regardless of source declaration order. */
function accessorTypes(parts:{get?:AccessorPart;set?:AccessorPart},fallback:TraitType):{type:TraitType;setterType?:TraitType} {
    const read=parts.get ? parts.get.type===undefined?fallback:parts.get.type : parts.set.type===undefined?fallback:parts.set.type;
    const write=parts.set ? parts.set.type===undefined?fallback:parts.set.type : read;
    if(parts.get&&parts.set&&JSON.stringify(read)!==JSON.stringify(write)&&read!=='*'&&write!=='*')
        fail('incompatible accessor half types');
    return Object.assign({type:read},parts.get&&parts.set&&JSON.stringify(read)!==JSON.stringify(write)?{setterType:write}:{});
}
interface MethodSignature {name: string; uri?: string; parameters: TraitType[]; returns: TraitType; requiredCount: number; override: boolean; final: boolean;}
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
    public readonly binding: NativeGeneratedClassDeclaration;
    public readonly metadata: any;
    public readonly instanceTraits: ReadonlyArray<Trait>;
    public readonly staticTraits: ReadonlyArray<Trait>;
    public readonly instanceConstants: ReadonlyArray<{name: string; uri?: string; literal: string}>;
    public readonly lexicalMembers: ReadonlyArray<LexicalMember>;
    public readonly inheritInstanceLayout: boolean;
    public readonly nativeAccessorBase: boolean;
    public readonly instanceAccessors: ReadonlyArray<Member>;
    public readonly instanceMethods: ReadonlyArray<MethodSignature>;

    constructor(plan: NativeGeneratedDeclarationPlan, scope: string, owner: string, source: string) {
        nativeGeneratedDeclarationSource(plan, scope, owner, source);
        const input = nativeGeneratedDeclarationInputs(plan, scope);
        // Source interfaces are admitted only through this authenticated plan's
        // exact token exports. Class references and other native facets remain held.
        const interfaces=nativeGeneratedInterfaceBindings(plan);
        const qualifiedAccessor=(member:{type?:TraitType;setterType?:TraitType;name:string;uri?:string}):boolean=>
            !!member.uri || member.type==='*'&&member.setterType!==undefined
            || typeof member.type==='object'&&interfaces.some(i=>i.tokenExport===(member.type as ReferenceType).referenceExport&&i.reflectedName===(member.type as ReferenceType).name)
            || member.type==='Array'|| member.type==='Object'&&['target','currentTarget'].indexOf(member.name)>=0||member.type==='Boolean'||member.type==='Number'&&['x','y'].indexOf(member.name)>=0;
        this.binding = nativeGeneratedClassDeclaration(plan, owner);
        if (!this.binding) fail('reference-only source cannot publish a class: ' + owner);
        const isClass = (identity: string): boolean => plan.bindings.some(item => item.qname === identity) || plan.privateBindings.some(item => item.identity === identity);
        const reflectedClass = (identity: string): string => isClass(identity) ? nativeGeneratedClassDeclaration(plan, identity).reflectedName : reflected(identity);
        const lexical: LexicalMember[] = [];
        const surfaces = new Map<string, {instance: Member[]; statics: Member[]; dynamic: boolean; final: boolean}>();
        if(plan.nativeBindings.some(b=>b.qname==='flash.accessibility.AccessibilityImplementation'&&!!b.nativeBaseExport)) {
            const declaredBy='flash.accessibility::AccessibilityImplementation';
            const instance:Member[]=[{name:'stub',kind:'variable',type:'Boolean',declaredBy},
                {name:'errno',kind:'variable',type:'uint',declaredBy}];
            const counts:{[name:string]:number}={accDoDefaultAction:1,accLocation:1,get_accSelection:0,get_accFocus:0,
                isLabeledBy:1,accSelect:2,getChildIDArray:0,get_accRole:1,get_accName:1,get_accValue:1,get_accState:1,get_accDefaultAction:1};
            const returns:{[name:string]:string}={accDoDefaultAction:'void',accLocation:'*',get_accFocus:'uint',accSelect:'void',get_accRole:'uint',get_accName:'String',get_accValue:'String',get_accState:'uint',get_accDefaultAction:'String'};
            Object.keys(counts).forEach(name=>instance.push({name,kind:'method',parameterCount:counts[name],declaredBy,
                signature:returns[name]?{parameters:Array(counts[name]).fill('uint'),returns:returns[name],requiredCount:counts[name]}:undefined}));
            surfaces.set('flash.accessibility.AccessibilityImplementation',{instance,statics:[],dynamic:false,final:false});
        }
        if(plan.nativeBindings.some(b=>b.qname==='flash.utils.Proxy'&&!!b.nativeBaseExport)) {
            const instance:Member[]=Object.keys(generatedProxySignatures).map(name=>({name,uri:generatedProxyUri,kind:'method',
                declaredBy:'flash.utils::Proxy',parameterCount:generatedProxySignatures[name].parameters.length} as Member));
            surfaces.set('flash.utils.Proxy',{instance,statics:[],dynamic:false,final:false});
        }
        if(plan.nativeBindings.some(binding=>!!binding.eventBaseExport)) {
            const declaredBy='flash.events::Event';
            const instance: Member[] = [['type','String'],['bubbles','Boolean'],['cancelable','Boolean'],['eventPhase','uint'],['target','Object'],['currentTarget','Object']]
                .map(([name,type])=>({name,type,kind:'accessor',access:'readonly',declaredBy} as Member));
            ['clone','toString','formatToString','stopImmediatePropagation','preventDefault','isDefaultPrevented','stopPropagation']
                .forEach(name=>instance.push({name,kind:'method',parameterCount:name==='formatToString'?1:0,declaredBy}));
            surfaces.set('flash.events.Event',{instance,statics:[],dynamic:false,final:false});
        }
        if(plan.nativeBindings.some(binding=>binding.qname==='flash.events.MouseEvent'&&!!binding.nativeBaseExport)) {
            const instance:Member[]=nativeMouseEventTraits.map(trait=>{
                let type:TraitType=trait.type;
                if(type&&type.indexOf('::')>=0) {
                    const native=plan.nativeBindings.find(binding=>binding.qname===(type as string).replace('::','.'));
                    if(!native||native.nativeInterface)fail('native MouseEvent trait requires explicit reference provider: '+trait.name+':'+type);
                    type={name:type as string,referenceExport:native.referenceExport};
                }
                return Object.assign({},trait,type===undefined?{}:{type},trait.kind==='accessor'&&trait.type==='Object'&&['target','currentTarget'].indexOf(trait.name)>=0
                    ?{parts:{get:{owner:trait.declaredBy,override:false,final:false}}}:{}) as Member;
            });
            surfaces.set('flash.events.MouseEvent',{instance,statics:[],dynamic:false,final:false});
        }
        if(plan.nativeBindings.some(binding=>binding.qname==='Error'&&!!binding.nativeBaseExport)) {
            const declaredBy='Error';
            const instance: Member[] = [{name:'name',kind:'variable',type:'*',declaredBy},
                {name:'message',kind:'variable',type:'*',declaredBy},
                {name:'errorID',kind:'accessor',access:'readonly',type:'int',declaredBy},
                {name:'getStackTrace',kind:'method',parameterCount:0,declaredBy}];
            surfaces.set('Error',{instance,statics:[],dynamic:true,final:false});
        }
        if(plan.nativeBindings.some(binding=>binding.qname==='flash.events.EventDispatcher'&&!!binding.nativeBaseExport)) {
            const declaredBy='flash.events::EventDispatcher';
            const instance: Member[] = [['willTrigger',1],['removeEventListener',3],['toString',0],['addEventListener',5],['dispatchEvent',1],['hasEventListener',1]]
                .map(([name,parameterCount])=>({name,parameterCount,kind:'method',declaredBy} as Member));
            surfaces.set('flash.events.EventDispatcher',{instance,statics:[],dynamic:false,final:false});
        }
        for(const base of ['Sprite','MovieClip']) if(plan.nativeBindings.some(binding=>binding.qname==='flash.display.'+base&&!!binding.nativeBaseExport)) {
            const instance: Member[]=(base==='Sprite'?nativeSpriteTraits:nativeMovieClipTraits).map(trait=>{
                let type: TraitType=trait.type;
                if(type && type.indexOf('::')>=0) {
                    const native=plan.nativeBindings.find(binding=>binding.qname===(type as string).replace('::','.'));
                    if(!native || native.nativeInterface)fail('native '+base+' trait requires explicit reference provider: '+trait.name+':'+type);
                    type={name:type as string,referenceExport:native.referenceExport};
                }
                return Object.assign({},trait,type===undefined?{}:{type},base==='Sprite'&&trait.kind==='accessor'&&trait.type==='Number'&&['x','y'].indexOf(trait.name)>=0?{parts:{get:{owner:trait.declaredBy,override:false,final:false},set:{owner:trait.declaredBy,override:false,final:false}}}:{}) as Member;
            });
            surfaces.set('flash.display.'+base,{instance,statics:[],dynamic:base==='MovieClip',final:false});
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
                if (['*','int','uint','Number','Boolean','String','Object','Function','Array','Class'].indexOf(reference.identity) < 0)
                    fail('intrinsic storage requires provider authority: ' + reference.identity);
                return reference.identity;
            }
            const binding = (reference.kind === 'declaration' || reference.kind === 'private-declaration') && nativeGeneratedClassDeclaration(plan, reference.identity);
            const contract = reference.kind === 'interface' && nativeGeneratedInterfaceBindings(plan).find(item => item.qname === reference.identity);
            const native = reference.kind === 'native' && plan.nativeBindings.find(item => item.qname === reference.identity);
            if (!binding && !contract && !native) fail('unresolved source storage type: ' + qname + ':' + reference.sourceName);
            return {name: binding ? binding.reflectedName : contract ? contract.reflectedName : reflected(reference.identity), referenceExport: binding ? binding.tokenExport : contract ? contract.tokenExport : native.referenceExport};
        };
        const build = (binding: NativeGeneratedClassDeclaration): void => {
            if (surfaces.has(binding.identity)) return;
            const parent = binding.base && isClass(binding.base) && nativeGeneratedClassDeclaration(plan, binding.base);
            if (parent) build(parent);
            const inherited = binding.base && surfaces.get(binding.base);
            if (inherited && inherited.final) fail('source extends final class: ' + binding.identity);
            const cls = nativeGeneratedDeclarationNode(plan, binding.identity);
            const own: {instance: Member[]; statics: Member[]} = {instance: [], statics: []};
            const visit = (member: Node): void => {
                const mods = flags(member), isStatic = mods.indexOf('static') >= 0;
                const uri=generatedMemberUri(plan,binding.identity,member);
                if(member.kind===K.USE) {
                    generatedNamespaces(plan,binding.identity).resolve(member,member.text);return;
                }
                if ([K.NAMESPACE_DECLARATION,K.USE,K.INCLUDE,K.EMBED].indexOf(member.kind) >= 0)
                    fail('namespace/include/embed declaration authority: ' + binding.identity);
                if ([K.VAR_LIST,K.CONST_LIST,K.FUNCTION,K.GET,K.SET].indexOf(member.kind) < 0) return;
                const visibility = mods.filter(mod => ['public','private','protected','internal'].indexOf(mod) >= 0);
                if (visibility.length > 1) fail('conflicting source visibility');
                if (member.kind === K.FUNCTION && member.findChild(K.NAME).text === cls.findChild(K.NAME).text) {
                    if (isStatic || mods.indexOf('override') >= 0 || visibility[0] && visibility[0] !== 'public') fail('source constructor modifiers');
                    return;
                }
                if (visibility[0] !== 'public' && !uri) {
                    lexical.push({owner:binding.identity,start:member.start,end:member.end,visibility:visibility[0] || 'internal',static:isStatic});
                    return;
                }
                const list = own[isStatic ? 'statics' : 'instance'];
                const add = (value: Member): void => {
                    const previous = list.find(item => item.name === value.name && item.uri===value.uri);
                    if (previous) {
                        if (previous.kind !== 'accessor' || value.kind !== 'accessor' || previous.access === value.access
                            || previous.access === 'readwrite' || JSON.stringify(previous.type) !== JSON.stringify(value.type) && previous.type!=='*' && value.type!=='*'
                            || previous.override !== value.override && !qualifiedAccessor(previous) && !qualifiedAccessor(value) || previous.final !== value.final)
                            fail('duplicate or incompatible public declaration: ' + binding.identity + ':' + value.name);
                        previous.access = 'readwrite';
                        previous.parts=Object.assign({},previous.parts,value.parts);
                        previous.override=previous.override||value.override;
                        Object.assign(previous,accessorTypes(previous.parts,previous.type));
                    } else list.push(value);
                };
                const common = {declaredBy:binding.reflectedName,override:mods.indexOf('override') >= 0,final:mods.indexOf('final') >= 0,...(uri?{uri}:{})};
                if (isStatic && common.override) fail('static override authority');
                if (member.kind === K.VAR_LIST || member.kind === K.CONST_LIST) {
                    if (common.override || common.final) fail('storage override/final modifier');
                    member.findChildren(K.NAME_TYPE_INIT).forEach(field => {
                        if(field.findChild(K.VECTOR)&&(isStatic||member.kind===K.CONST_LIST))fail('Vector static/constant storage requires separate authority');
                        const fieldType = type(binding.identity,storageType(field));
                        let constantLiteral: string;
                        if (member.kind === K.CONST_LIST && !isStatic) {
                            const init = field.findChild(K.INIT);
                            constantLiteral = init && input.sources[binding.sourceOwner].source.slice(init.start,initializerEnd(init)).trim();
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
                    // Non-rest signatures retain exact source declaration/interface
                    // tokens; labels alone cannot grant selected-parent authority.
                    const signatureType=(node:Node,returns=false):TraitType=>{
                        if(!node)return '*';
                        if(returns && node.kind===K.TYPE && node.text==='void')return 'void';
                        const ref=plan.references.find(r=>r.owner===binding.identity && r.start===node.start && r.end===node.end);
                        if(ref && (ref.kind==='declaration'||ref.kind==='private-declaration'||ref.kind==='interface'))return type(binding.identity,node);
                        return ref && ref.kind==='intrinsic' && ['*','Object','int','uint','Number','Boolean','String','Function'].indexOf(ref.identity)>=0
                            ? ref.identity : undefined;
                    };
                    const parameters=params.map(p=>{
                        const value=p.findChild(K.NAME_TYPE_INIT);
                        return !p.findChild(K.REST) && value
                            ? signatureType(value.findChild(K.VECTOR)||value.findChild(K.TYPE)) : undefined;
                    });
                    const returns=signatureType(member.findChild(K.VECTOR)||member.findChild(K.TYPE),true);
                    const requiredCount=params.filter(p=>!p.findChild(K.REST)&&!p.findChild(K.NAME_TYPE_INIT).findChild(K.INIT)).length;
                    if(params.some((p,i)=>!p.findChild(K.REST)&&i>=requiredCount&&!p.findChild(K.NAME_TYPE_INIT).findChild(K.INIT)))
                        fail('required method parameter after optional');
                    // Defaults may differ in an AS3 override. Their literal values
                    // are validated and applied by the actual method implementation.
                    const signature=returns!==undefined && parameters.every(p=>p!==undefined) ? {parameters,returns,requiredCount} : undefined;
                    add(Object.assign({},common,{name,kind:'method',parameterCount:params.filter(p=>!p.findChild(K.REST)).length,signature}) as Member);
                    return;
                }
                let valueType: TraitType;
                if (member.kind === K.GET) {
                    if (params.length) fail('getter parameter count');
                    valueType = type(binding.identity, storageType(member));
                } else {
                    if (params.length !== 1 || params[0].findChild(K.REST)) fail('setter parameter count/rest');
                    const value = params[0].findChild(K.NAME_TYPE_INIT), result = member.findChild(K.TYPE);
                    if (value.findChild(K.INIT) || result && result.text !== 'void') fail('setter signature');
                    valueType = type(binding.identity,storageType(value));
                }
                // Accessors use the same exact planned specialization as fields.
                // Callable entry/return conversion owns their Vector coercion;
                // a getter does not introduce a separately initialized slot.
                add(Object.assign({},common,{name,kind:'accessor',type:valueType,access:member.kind === K.GET ? 'readonly' : 'writeonly',parts:{[member.kind===K.GET?'get':'set']:{owner:binding.reflectedName,override:common.override,final:common.final,type:valueType}}}) as Member);
            };
            cls.findChild(K.CONTENT).children.forEach(visit);
            const instance = inherited ? inherited.instance.slice() : [];
            own.instance.forEach(member => {
                const index = instance.findIndex(item => item.name === member.name && item.uri===member.uri), previous = instance[index];
                if (previous) {
                    if(inherited && inherited.instance.some(trait=>trait.declaredBy==='flash.display::MovieClip')
                        && nativeMovieClipTraits.some(trait=>trait.name===previous.name&&trait.declaredBy===previous.declaredBy))
                        fail('native MovieClip override requires separate signature/dispatch authority: '+member.name);
                    if(inherited && inherited.instance.some(trait=>trait.declaredBy==='flash.display::Sprite')
                        && nativeSpriteTraits.some(trait=>trait.name===previous.name&&trait.declaredBy===previous.declaredBy)
                        && !(input.inheritScriptClasses && member.kind==='accessor' && member.type==='Number' && previous.type==='Number' && ['x','y'].indexOf(member.name)>=0))
                        fail('native Sprite override requires separate signature/dispatch authority: '+member.name);
                    if(previous.declaredBy==='flash.events::MouseEvent')
                        fail('native MouseEvent method/property override requires separate source authority: '+member.name);
                    if(previous.declaredBy==='flash.events::Event' && ['clone','toString','formatToString'].indexOf(member.name)<0
                        && !(binding.base==='flash.events.MouseEvent'&&member.kind==='accessor'&&member.type==='Object'&&['target','currentTarget'].indexOf(member.name)>=0))
                        fail('native Event override requires separate source authority: '+member.name);
                    if(member.kind==='accessor' && previous.kind==='accessor' && (parent || binding.base==='flash.display.Sprite'||binding.base==='flash.events.MouseEvent') && input.inheritScriptClasses
                        && (qualifiedAccessor(member)||qualifiedAccessor(previous)) && member.parts && previous.parts) {
                        for(const side of (['get','set'] as ('get'|'set')[]))if(member.parts[side]){
                            const ownHalf=member.parts[side],parentHalf=previous.parts[side];
                            if(parentHalf ? !ownHalf.override||parentHalf.final
                                || JSON.stringify(ownHalf.type===undefined?member.type:ownHalf.type)!==JSON.stringify(parentHalf.type===undefined?previous.type:parentHalf.type)
                                : !parent||ownHalf.override)
                                fail('accessor override requires matching nonfinal parent half: '+binding.identity+':'+member.name);
                        }
                        const parts=Object.assign({},previous.parts,member.parts);
                        instance[index]=Object.assign({},member,accessorTypes(parts,previous.type),{parts,access:parts.get&&parts.set?'readwrite':parts.get?'readonly':'writeonly'});
                        return;
                    }
                    if (!member.override || previous.final || previous.kind !== member.kind || member.kind === 'variable' || member.kind === 'constant'
                        || member.kind === 'accessor' && (previous.access !== member.access || JSON.stringify(previous.type) !== JSON.stringify(member.type))
                        || member.kind === 'method' && previous.parameterCount !== member.parameterCount)
                        fail('inherited collision/partial override requires authority: ' + binding.identity + ':' + member.name);
                    if(input.inheritScriptClasses && (parent||binding.base==='flash.accessibility.AccessibilityImplementation') && member.kind==='method'
                        && (!member.signature || !previous.signature || JSON.stringify(member.signature)!==JSON.stringify(previous.signature)))
                        fail('selected parent override requires matching method signature: '+binding.identity+':'+member.name);
                    instance[index] = member;
                } else {
                    if (member.override) fail('override without source public ancestor: ' + binding.identity + ':' + member.name);
                    instance.push(member);
                }
            });
            surfaces.set(binding.identity,{instance,statics:own.statics,dynamic:flags(cls).indexOf('dynamic') >= 0,final:flags(cls).indexOf('final') >= 0});
        };
        build(this.binding);
        const surface = surfaces.get(owner);
        this.inheritInstanceLayout = !!input.inheritScriptClasses && !!this.binding.base
            && (isClass(this.binding.base)||this.binding.base==='flash.accessibility.AccessibilityImplementation');
        if(this.inheritInstanceLayout && surface.instance.some(item=>item.declaredBy===reflectedClass(owner) && item.override && item.kind!=='method' && !(item.kind==='accessor'&&qualifiedAccessor(item)&&item.parts)))
            fail('selected parent accessor override requires separate authority');
        this.instanceAccessors=frozen(surface.instance.filter(item=>item.kind==='accessor'&&qualifiedAccessor(item)&&item.parts
            && (['get','set'] as ('get'|'set')[]).some(side=>item.parts[side]&&item.parts[side].owner===reflectedClass(owner))).map(item=>Object.assign({},item,{parts:{
                get:item.parts.get&&item.parts.get.owner===reflectedClass(owner)?item.parts.get:undefined,
                set:item.parts.set&&item.parts.set.owner===reflectedClass(owner)?item.parts.set:undefined}})));
        this.nativeAccessorBase=['flash.display.Sprite','flash.events.MouseEvent'].indexOf(this.binding.base)>=0 && this.instanceAccessors.some(a=>!a.uri&&(a.parts.get&&a.parts.get.override||a.parts.set&&a.parts.set.override));
        this.instanceMethods=frozen(surface.instance.filter(item=>item.uri!==generatedProxyUri && item.kind==='method' && item.declaredBy===reflectedClass(owner)
            && !!item.signature && (!item.override || this.inheritInstanceLayout)).map(item=>({name:item.name,
                ...(item.uri?{uri:item.uri}:{}),
                parameters:item.signature.parameters,returns:item.signature.returns,requiredCount:item.signature.requiredCount,override:!!item.override,final:!!item.final})));
        const members = (items: Member[]): any => {
            const result: any = {variables:[],constants:[],methods:[],accessors:[]};
            items.forEach(item => {
                const value: any = {name:item.name,declaredBy:item.declaredBy};
                if(item.uri)value.uri=item.uri;
                if (item.kind === 'method') value.parameterCount = item.parameterCount;
                else if (item.kind === 'accessor') {value.access = item.access;if(item.parts)value.declaredBy=(item.parts.get||item.parts.set).owner;if(qualifiedAccessor(item))value.type=typeof item.type==='string'?item.type:item.type.name;}
                else value.type = typeof item.type === 'string' ? item.type : item.type.name;
                result[item.kind === 'variable' ? 'variables' : item.kind === 'constant' ? 'constants' : item.kind === 'method' ? 'methods' : 'accessors'].push(value);
            });
            return result;
        };
        const traits = (items: Member[]): Trait[] => items.map(item => Object.assign({name:item.name,kind:item.kind},
            item.uri ? {uri:item.uri} : {}, item.type === undefined ? {} : {type:item.type},item.setterType===undefined?{}:{setterType:item.setterType},item.kind === 'accessor' ? {access:item.access} : {}));
        this.metadata = frozen({name:reflectedClass(owner),base:this.binding.base ? reflectedClass(this.binding.base) : 'Object',
            isDynamic:surface.dynamic,isFinal:surface.final,instance:members(surface.instance),statics:members(surface.statics)});
        this.instanceConstants = frozen(surface.instance.filter(item=>item.kind==='constant').map(item=>({name:item.name,...(item.uri?{uri:item.uri}:{}),literal:item.constantLiteral})));
        this.instanceTraits = frozen(traits(surface.instance));
        this.staticTraits = frozen(traits(surface.statics));
        this.lexicalMembers = frozen(lexical);
        Object.freeze(this);
    }

    /** Domain is a compiler-created import alias; Array is a captured intrinsic. */
    public emitDefinition(domain: string, array: string, base?: string): string {
        if (![domain,array].every(value => /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(value))) fail('compiler reference expression');
        if (this.inheritInstanceLayout && (!base || !/^[A-Za-z_$][\w$]*$/.test(base))) fail('compiler base expression');
        const emitType=(value:TraitType):string=>value==='Array'?'{name:"Array",reference:'+array+'}'
            : typeof value==='string'?JSON.stringify(value)
            : '{name:'+JSON.stringify(value.name)+(value.vectorExport?',vector:':',reference:')+domain+'.'+(value.vectorExport||value.referenceExport)+'}';
        const sameMember=(left:{name:string;uri?:string},right:{name:string;uri?:string}):boolean=>left.name===right.name&&left.uri===right.uri;
        const emit = (traits: ReadonlyArray<Trait>): string => '[' + traits.map(trait => {
            const fields = 'name:' + JSON.stringify(trait.name) + ',kind:' + JSON.stringify(trait.kind)
                + (trait.uri ? ',uri:'+JSON.stringify(trait.uri)+',key:globalThis.Symbol.for('+JSON.stringify('as3.namespace.member@1:'+JSON.stringify([trait.uri,trait.name]))+')' : '')
                + (trait.access === undefined ? '' : ',access:' + JSON.stringify(trait.access));
            if (trait.type === undefined) return '{' + fields + '}';
            return '{' + fields + ',type:' + emitType(trait.type) + (trait.setterType===undefined?'':',setterType:'+emitType(trait.setterType)) + '}';
        }).join(',') + ']';
        const metadata = this.inheritInstanceLayout ? Object.assign({},this.metadata,{instance:Object.keys(this.metadata.instance).reduce((members:any,kind)=>{
            members[kind]=this.metadata.instance[kind].filter((member:any)=>member.declaredBy===this.metadata.name || kind==='accessors'&&this.instanceAccessors.some(a=>sameMember(a,member))).map((member:any)=>kind==='accessors'&&this.instanceAccessors.some(a=>sameMember(a,member))?Object.assign({},member,{declaredBy:this.metadata.name}):member);return members;
        },{})}) : this.nativeAccessorBase ? Object.assign({},this.metadata,{instance:Object.assign({},this.metadata.instance,{accessors:this.metadata.instance.accessors.map((a:any)=>this.instanceAccessors.some(own=>sameMember(own,a))?Object.assign({},a,{declaredBy:this.metadata.name}):a)})}) : this.metadata;
        const ownNames = this.inheritInstanceLayout ? new Set<string>([].concat(...Object.keys(metadata.instance).map(kind=>metadata.instance[kind])).map((member:any)=>generatedMemberIdentity(member.name,member.uri))) : null;
        const methods='['+this.instanceMethods.map(method=>'{name:'+JSON.stringify(method.name)+(method.uri?',uri:'+JSON.stringify(method.uri):'')+',parameters:['+method.parameters.map(emitType).join(',')+'],returns:'+emitType(method.returns)+',requiredCount:'+method.requiredCount+',override:'+method.override+',final:'+method.final+'}').join(',')+']';
        const accessors='['+this.instanceAccessors.map(a=>{
            const halves={...(a.parts.get?{get:{override:a.parts.get.override,final:a.parts.get.final}}:{}),...(a.parts.set?{set:{override:a.parts.set.override,final:a.parts.set.final}}:{})};
            if(!a.uri&&typeof a.type==='string'&&a.type!=='Array'&&(a.setterType===undefined||typeof a.setterType==='string'&&a.setterType!=='Array'))
                return JSON.stringify({name:a.name,type:a.type,...(a.setterType===undefined?{}:{setterType:a.setterType}),...halves});
            return '{name:'+JSON.stringify(a.name)+(a.uri?',uri:'+JSON.stringify(a.uri):'')+',type:'+emitType(a.type)+(a.setterType===undefined?'':',setterType:'+emitType(a.setterType))+','+JSON.stringify(halves).slice(1);
        }).join(',')+']';
        return '{' + (this.nativeAccessorBase ? 'nativeAccessorBase:'+base+',' : '') + (this.inheritInstanceLayout ? 'instanceBase:' + base + ',' : '') + 'metadata:' + JSON.stringify(metadata) + ',instanceTraits:' + emit(ownNames ? this.instanceTraits.filter(trait=>ownNames.has(generatedMemberIdentity(trait.name,trait.uri))) : this.instanceTraits) + ',staticTraits:' + emit(this.staticTraits)
            + ',instanceConstants:[' + this.instanceConstants.filter(item=>!ownNames || ownNames.has(generatedMemberIdentity(item.name,item.uri))).map(item=>'{name:'+JSON.stringify(item.name)+(item.uri?',uri:'+JSON.stringify(item.uri):'')+',value:'+item.literal+'}').join(',') + ']'
            + ',instanceAccessors:'+accessors
            + ',instanceMethods:' + methods
            + ',declaration:{type:' + domain + '.' + this.binding.tokenExport + ',publishGeneration:' + domain + '.' + this.binding.publishExport + '}}';
    }
}
