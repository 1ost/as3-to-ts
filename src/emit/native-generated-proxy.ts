import Node from '../syntax/node';
import K from '../syntax/nodeKind';
import {NativeNamespaces} from './native-namespaces';
import {NativeGeneratedDeclarationPlan, nativeGeneratedClassDeclaration, nativeGeneratedDeclarationInputs,
    nativeGeneratedDeclarationResolver} from './native-generated-declarations';

export const generatedProxyUri='http://www.adobe.com/2006/actionscript/flash/proxy';
export const generatedProxySignatures:{[name:string]:{parameters:string[];returns:string;rest?:boolean}}=Object.freeze(Object.assign(Object.create(null),{
    getProperty:{parameters:['*'],returns:'*'},setProperty:{parameters:['*','*'],returns:'void'},
    callProperty:{parameters:['*'],returns:'*',rest:true},hasProperty:{parameters:['*'],returns:'Boolean'},
    deleteProperty:{parameters:['*'],returns:'Boolean'},nextNameIndex:{parameters:['int'],returns:'int'},
    nextName:{parameters:['int'],returns:'String'},nextValue:{parameters:['int'],returns:'*'},
    isAttribute:{parameters:['*'],returns:'Boolean'},getDescendants:{parameters:['*'],returns:'*'}
}));
const namespaces=new WeakMap<object,Map<string,NativeNamespaces>>();
export function generatedProxyNamespace(plan:NativeGeneratedDeclarationPlan,owner:string):NativeNamespaces {
    let binding=nativeGeneratedClassDeclaration(plan,owner);
    const visited=new Set<string>();
    while(binding && binding.base && !visited.has(binding.identity)) {
        visited.add(binding.identity);
        if(binding.base==='flash.utils.Proxy' && plan.nativeBindings.some(b=>b.qname===binding.base&&!!b.nativeBaseExport)) {
            let cache=namespaces.get(plan);if(!cache)namespaces.set(plan,cache=new Map());
            if(!cache.has(owner)) {
                const own=nativeGeneratedClassDeclaration(plan,owner),input=nativeGeneratedDeclarationInputs(plan,plan.scope);
                const source=input.sources[own.sourceOwner].source;
                const root=nativeGeneratedDeclarationResolver(plan,owner,source).root;
                cache.set(owner,new NativeNamespaces(root,source,undefined,true));
            }
            return cache.get(owner);
        }
        // Other qualified native roots have no source unit to traverse and
        // cannot contribute flash_proxy hooks. In particular, ordinary source
        // namespaces on EventDispatcher descendants are not Proxy namespaces.
        if(plan.nativeBindings.some(b=>b.qname===binding.base&&!!b.nativeBaseExport))return undefined;
        binding=nativeGeneratedClassDeclaration(plan,binding.base);
    }
    return undefined;
}
export function generatedProxyMember(plan:NativeGeneratedDeclarationPlan,owner:string,node:Node):string {
    const mods=node.findChild(K.MOD_LIST),custom=mods&&mods.children.filter(m=>['public','private','protected','internal','static','override','final'].indexOf(m.text)<0);
    if(!custom||!custom.length)return undefined;
    const ns=generatedProxyNamespace(plan,owner),name=node.findChild(K.NAME);
    const uri=ns&&ns.resolve(node,custom[0].text),signature=name&&generatedProxySignatures[name.text];
    const fail=():never=>{throw new Error('AS3_GENERATED_TRAITS_UNSUPPORTED: exact flash_proxy override signature required: '+owner+':'+(name&&name.text));};
    if(uri!==generatedProxyUri||mods.children.some(m=>m.text==='static')||node.kind!==K.FUNCTION||!signature
        ||['isAttribute','getDescendants'].indexOf(name.text)>=0||custom.length!==1
        ||!mods.children.some(m=>m.text==='override'))return fail();
    const parameters=node.findChild(K.PARAMETER_LIST).children,fixed=parameters.filter(p=>!p.findChild(K.REST));
    if(fixed.length!==signature.parameters.length||parameters.length!==fixed.length+(signature.rest?1:0)
        ||!!signature.rest!==!!parameters[parameters.length-1].findChild(K.REST)
        ||fixed.some((p,i)=>{const n=p.findChild(K.NAME_TYPE_INIT),t=n&&n.findChild(K.TYPE);return !t||t.text!==signature.parameters[i]||!!n.findChild(K.INIT);})
        ||!node.findChild(K.TYPE)||node.findChild(K.TYPE).text!==signature.returns)return fail();
    return name.text;
}
