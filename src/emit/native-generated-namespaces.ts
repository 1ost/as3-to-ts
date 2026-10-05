import Node from '../syntax/node';
import K from '../syntax/nodeKind';
import parse = require('../parse');
import {NativeNamespaces} from './native-namespaces';
import {createNativeSourceAncestryPlan, NativeSourceAncestryPlan} from './native-source-ancestry';
import {NativeGeneratedDeclarationPlan, nativeGeneratedDeclarationInputs, nativeGeneratedClassDeclaration} from './native-generated-declarations';
import {generatedProxyMember, generatedProxyUri} from './native-generated-proxy';

const ancestryCache=new WeakMap<object,NativeSourceAncestryPlan>();
const namespaceCache=new WeakMap<object,Map<string,NativeNamespaces>>();
export function generatedNamespaceAncestry(plan:NativeGeneratedDeclarationPlan):NativeSourceAncestryPlan {
    let result=ancestryCache.get(plan);
    if(!result){
        const input=nativeGeneratedDeclarationInputs(plan,plan.scope),namespaceUris:{[qname:string]:string}={};
        plan.namespaces.forEach(binding=>namespaceUris[binding.qname]=binding.uri);
        // The qualified native EventDispatcher entry has a sealed public
        // instance surface and no custom namespace traits (retained AIR
        // reflection in dispatcher-namespaces). A reference-only provider or
        // a same-named source class does not establish this native boundary.
        const dispatcher=plan.nativeBindings.some(binding=>binding.qname==='flash.events.EventDispatcher'&&!!binding.nativeBaseExport);
        result=createNativeSourceAncestryPlan({sources:input.sources,namespaceUris,
            providerClasses:dispatcher?{'flash.events.EventDispatcher':{dynamic:false,members:[]}}:{}});
        ancestryCache.set(plan,result);
    }
    return result;
}
export function generatedNamespaces(plan:NativeGeneratedDeclarationPlan,owner:string):NativeNamespaces {
    let cache=namespaceCache.get(plan);if(!cache)namespaceCache.set(plan,cache=new Map());
    if(!cache.has(owner)){
        const binding=nativeGeneratedClassDeclaration(plan,owner),input=nativeGeneratedDeclarationInputs(plan,plan.scope);
        const source=input.sources[binding.sourceOwner].source,root=parse(binding.sourceOwner+'.as',source);
        const normalize=(node:Node):void=>{node.children=node.children.filter(Boolean);node.children.forEach(child=>{child.parent=node;normalize(child);});};normalize(root);
        const ancestry=generatedNamespaceAncestry(plan);
        cache.set(owner,new NativeNamespaces(root,source,ancestry.namespaceUris,plan.nativeBindings.some(b=>b.qname==='flash.utils.Proxy'&&!!b.nativeBaseExport),ancestry));
    }
    return cache.get(owner);
}
export function generatedMemberUri(plan:NativeGeneratedDeclarationPlan,owner:string,node:Node):string {
    const mods=node.findChild(K.MOD_LIST),custom=mods&&mods.children.filter(m=>['public','private','protected','internal','static','override','final'].indexOf(m.text)<0);
    if(!custom||!custom.length)return undefined;
    if(custom.length!==1||[K.VAR_LIST,K.CONST_LIST,K.FUNCTION,K.GET,K.SET].indexOf(node.kind)<0)
        throw new Error('AS3_GENERATED_TRAITS_UNSUPPORTED: exact namespace member required: '+owner);
    const uri=generatedNamespaces(plan,owner).resolve(node,custom[0].text);
    if(uri===generatedProxyUri)generatedProxyMember(plan,owner,node);
    return uri;
}
export function generatedMemberIdentity(name:string,uri?:string):string {
    return uri?JSON.stringify([uri,name]):name;
}
