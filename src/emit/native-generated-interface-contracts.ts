import Node from '../syntax/node';
import K from '../syntax/nodeKind';
import {NativeGeneratedDeclarationBinding,NativeGeneratedInterfaceBinding} from './native-generated-declarations';

export interface NativeGeneratedInterfaceMember {
    readonly owner: string;
    readonly name: string;
    readonly kind: 'method' | 'get' | 'set';
    readonly returnType: string;
    readonly parameters: ReadonlyArray<{readonly type:string;readonly optional:boolean;readonly rest:boolean}>;
}
export interface NativeGeneratedInterfaceImplementation {
    readonly owner: string;
    readonly interface: string;
    readonly member: NativeGeneratedInterfaceMember;
    readonly implementationOwner: string;
}
export interface NativeGeneratedInterfaceContracts {
    readonly members: ReadonlyArray<NativeGeneratedInterfaceMember>;
    readonly implementations: ReadonlyArray<NativeGeneratedInterfaceImplementation>;
}
function fail(reason:string):never {throw new Error('AS3_GENERATED_INTERFACE_CONTRACT_UNSUPPORTED: '+reason);}
function flags(node:Node):string[]{const mods=node.findChild(K.MOD_LIST);return mods?mods.children.map(n=>n.text):[];}
function memberKind(node:Node):NativeGeneratedInterfaceMember['kind']|null {
    return node.kind===K.GET?'get':node.kind===K.SET?'set':node.kind===K.FUNCTION||node.kind===K.TYPE&&node.text==='function'?'method':null;
}
function key(member:NativeGeneratedInterfaceMember):string{return member.kind+':'+member.name;}
function signature(member:NativeGeneratedInterfaceMember):string{return JSON.stringify([member.kind,member.returnType,member.parameters]);}

/** Declaration validation only: does not publish runtime implementations or
 * qualify callable bodies, defaults, rest arrays, Class values or reflection. */
export function projectNativeGeneratedInterfaceContracts(
    declarations:Map<string,Node>, classes:ReadonlyArray<NativeGeneratedDeclarationBinding>,
    interfaces:ReadonlyArray<NativeGeneratedInterfaceBinding>, resolve:(owner:string,name:string)=>string,
    knownType:(name:string)=>boolean,
    nativeInterface:(name:string)=>ReadonlyArray<NativeGeneratedInterfaceMember>|undefined=()=>undefined,
    nativeBase:(name:string)=>ReadonlyArray<NativeGeneratedInterfaceMember>|undefined=()=>undefined):NativeGeneratedInterfaceContracts {
    const members:NativeGeneratedInterfaceMember[]=[],implementations:NativeGeneratedInterfaceImplementation[]=[];
    const annotation=(owner:string,node:Node):string=>{
        if(node&&node.kind===K.VECTOR){
            const children=node.children.filter(Boolean);
            if(children.length!==1||[K.TYPE,K.VECTOR].indexOf(children[0].kind)<0)
                fail('malformed vector interface signature: '+owner);
            const element=annotation(owner,children[0]);
            if(element==='void')fail('void vector interface element: '+owner);
            // A declaration contract compares the complete specialization,
            // including its resolved element identity. AIR's runtime Vector
            // covariance does not permit a different implements signature.
            // This creates no Vector token or callable/storage admission.
            return 'Vector.<'+element+'>';
        }
        const name=resolve(owner,node&&(node.qualifiedName||node.text)||'*');
        if(!knownType(name))fail('unresolved interface signature type: '+owner+':'+name);
        return name;
    };
    const type=(owner:string,node:Node):string=>annotation(owner,node&&(node.findChild(K.VECTOR)||node.findChild(K.TYPE)));
    const member=(owner:string,node:Node):NativeGeneratedInterfaceMember=>{
        const kind=memberKind(node),name=node.findChild(K.NAME).text;
        const params=node.findChild(K.PARAMETER_LIST).children.map(parameter=>{
            const rest=!!parameter.findChild(K.REST),value=parameter.findChild(K.NAME_TYPE_INIT);
            return Object.freeze({type:rest?'*':type(owner,value),optional:!!(value&&value.findChild(K.INIT)),rest});
        });
        const result=type(owner,node);
        if(kind==='get'&&params.length||kind==='set'&&(params.length!==1||params[0].rest||params[0].optional||result!=='void'))
            fail('invalid interface accessor signature: '+owner+':'+name);
        return Object.freeze({owner,name,kind,returnType:result,parameters:Object.freeze(params)});
    };
    const surfaces=new Map<string,Map<string,NativeGeneratedInterfaceMember>>();
    const build=(name:string):Map<string,NativeGeneratedInterfaceMember>=>{
        if(surfaces.has(name))return surfaces.get(name);
        const binding=interfaces.find(i=>i.qname===name);
        const surface=new Map<string,NativeGeneratedInterfaceMember>();
        const merge=(entry:NativeGeneratedInterfaceMember):void=>{
            const old=surface.get(key(entry));
            if(old&&signature(old)!==signature(entry))fail('conflicting inherited interface signature: '+name+':'+entry.name);
            for(const other of Array.from(surface.values()).filter(m=>m.name===entry.name)){
                if((entry.kind==='method')!==(other.kind==='method'))fail('interface method/accessor conflict: '+name+':'+entry.name);
                if(entry.kind!==other.kind){
                    const getter=entry.kind==='get'?entry:other,setter=entry.kind==='set'?entry:other;
                    if(getter.returnType!==setter.parameters[0].type)fail('interface accessor type mismatch: '+name+':'+entry.name);
                }
            }
            surface.set(key(entry),entry);
        };
        if(!binding){
            const contract=nativeInterface(name);
            if(!contract)fail('native interface contract requires qualification: '+name);
            contract.forEach(entry=>{
                if(![entry.returnType,...entry.parameters.map(p=>p.type)].every(knownType))
                    fail('unresolved native interface signature type: '+name+':'+entry.name);
                members.push(entry);merge(entry);
            });
            surfaces.set(name,surface);return surface;
        }
        binding.bases.forEach(base=>build(base).forEach(merge));
        const own=new Set<string>();
        declarations.get(binding.qname).findChild(K.CONTENT).children.forEach(node=>{
            if([K.AS_DOC,K.MULTI_LINE_COMMENT,K.STMT_EMPTY].indexOf(node.kind)>=0)return;
            if(!memberKind(node)||node.findChild(K.BLOCK)||flags(node).length)fail('unsupported interface declaration member: '+binding.qname);
            const entry=member(binding.qname,node);
            if(own.has(key(entry)))fail('duplicate interface member: '+binding.qname+':'+entry.name);
            own.add(key(entry));members.push(entry);merge(entry);
        });
        surfaces.set(binding.qname,surface);return surface;
    };
    interfaces.forEach(binding=>build(binding.qname));
    const closure=(name:string,set:Set<string>):void=>{
        if(set.has(name))return;set.add(name);
        const binding=interfaces.find(i=>i.qname===name);
        if(binding)binding.bases.forEach(base=>closure(base,set));
    };
    for(const cls of classes){
        const required=new Set<string>(),ancestors:NativeGeneratedDeclarationBinding[]=[];
        for(let current=cls;current;current=classes.find(c=>c.qname===current.base)){
            ancestors.push(current);current.interfaces.forEach(name=>closure(name,required));
        }
        for(const name of Array.from(required).sort())for(const expected of Array.from(surfaces.get(name).values())){
            let actual:NativeGeneratedInterfaceMember;
            for(const ancestor of ancestors){
                const candidate=declarations.get(ancestor.qname).findChild(K.CONTENT).children.find(node=>
                    memberKind(node)===expected.kind&&node.findChild(K.NAME).text===expected.name
                    &&!(node.kind===K.FUNCTION&&node.findChild(K.NAME).text===ancestor.qname.split('.').pop())
                    &&flags(node).indexOf('public')>=0&&flags(node).indexOf('static')<0);
                if(candidate){actual=member(ancestor.qname,candidate);break;}
            }
            if(!actual){
                const base=ancestors[ancestors.length-1].base,contract=base&&nativeBase(base);
                const inherited=contract&&contract.find(entry=>key(entry)===key(expected));
                if(inherited)actual=Object.freeze({...inherited,owner:base});
            }
            if(!actual)fail('missing public instance interface member: '+cls.qname+':'+name+':'+expected.name+':'+expected.kind);
            if(signature(actual)!==signature(expected))fail('incompatible interface signature: '+cls.qname+':'+name+':'+expected.name);
            implementations.push(Object.freeze({owner:cls.qname,interface:name,member:expected,implementationOwner:actual.owner}));
        }
    }
    return Object.freeze({members:Object.freeze(members),implementations:Object.freeze(implementations)});
}
