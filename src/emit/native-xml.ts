import Node, {unwrapEncapsulatedExpression, outerEncapsulatedExpression} from '../syntax/node';
import K from '../syntax/nodeKind';
import {generatedModule} from './native-generated-emission';
import {nativeGeneratedDeclarationInputs} from './native-generated-declarations';

function fail(detail:string):never {throw new Error('AS3_XML_UNSUPPORTED: '+detail);}
/** Provider paths in a plan are relative to its declaration-domain module. */
export function xmlGlobalProviderModule(module:string,domain:string):string {
    if(module.charAt(0)!=='.')return module;
    const path=require('path').posix;
    const rebased=path.normalize(path.join(path.dirname(domain),module));
    return rebased.charAt(0)==='.'?rebased:'./'+rebased;
}
/** Literal E4X operations on exact source XML local/parameter bindings. */
export function emitNativeXML(e:any,n:Node,visit:(e:any,n:Node)=>void):boolean {
    if(e.options.nativeXMLModule===undefined)return false;
    const module=generatedModule(e.options.nativeXMLModule);
    const type=(value:Node):string=>{
        value=unwrapEncapsulatedExpression(value);
        if(!value||value.kind!==K.IDENTIFIER||!e.generated||!e.references)return null;
        const binding=e.findDefInScope(value.text);
        if(!binding||binding.bound||!binding.as3Type)return null;
        const identity=e.references.resolve(binding.as3Type);
        if(['XML','XMLList'].indexOf(identity)<0)return null;
        const input=nativeGeneratedDeclarationInputs(e.generated.options.plan,e.generated.options.plan.scope);
        const provider=input.providers&&input.providers[identity];
        if(!provider||provider.exportName!==identity||!e.options.nativeGlobalModules
            ||e.options.nativeGlobalModules[identity]!==xmlGlobalProviderModule(provider.module,e.generated.options.module))
            fail('exact XML global and declaration provider binding required');
        return identity;
    };
    const helper=(name:string):string=>{
        let alias='__as3_xml_'+name;while(e.source.indexOf(alias)>=0)alias+='_';
        e.ensureImportIdentifier(name+' as '+alias,module,false);e.nativeSourceHelpers.add(alias);return alias;
    };
    const attribute=(value:Node):{receiver:Node;name:string}|null=>{
        if(value&&value.kind===K.DOT&&value.children[1]
            &&value.children[1].kind===K.LITERAL&&/^@[A-Za-z_$][A-Za-z0-9_$]*$/.test(value.children[1].text)
            &&type(value.children[0])==='XML')return {receiver:value.children[0],name:value.children[1].text.slice(1)};
        if(value&&value.kind===K.CALL&&value.children[0].kind===K.DOT
            &&value.children[0].children[1].text==='attribute'&&type(value.children[0].children[0])==='XML'){
            const args=value.findChild(K.ARGUMENTS).children;
            if(args.length!==1||args[0].kind!==K.LITERAL||!/^(["'])[A-Za-z_$][A-Za-z0-9_$]*\1$/.test(args[0].text))
                fail('XML attribute method requires one unqualified literal name');
            return {receiver:value.children[0].children[0],name:args[0].text.slice(1,-1)};
        }
        return null;
    };
    const call=(value:Node,method:string):Node=>value&&value.kind===K.CALL&&value.children[0].kind===K.DOT
        &&value.children[0].children[1].text===method&&value.findChild(K.ARGUMENTS).children.length===0
        ?value.children[0].children[0]:null;
    const emit=(whole:Node,receiver:Node,name:string,extra?:string):void=>{
        e.catchup(whole.start);e.insert(helper(name)+'(');e.skipTo(receiver.start);visit(e,receiver);
        e.catchup(receiver.end);e.insert((extra?', '+extra:'')+')');e.skipTo(whole.end);
    };
    const filterNames=(predicate:Node):string[]=>{
        predicate=unwrapEncapsulatedExpression(predicate);
        if(predicate.kind===K.OR&&predicate.children.every((v:Node,i:number)=>i%2===0||v.text==='||'))
            return [].concat(...predicate.children.filter((_:Node,i:number)=>i%2===0).map(filterNames));
        const parts=predicate.children,left=parts[0],right=parts[2];
        if(predicate.kind!==K.EQUALITY||parts.length!==3||parts[1].text!=='=='
            ||left.kind!==K.CALL||left.children[0].kind!==K.IDENTIFIER||left.children[0].text!=='name'
            ||left.findChild(K.ARGUMENTS).children.length||!right||right.kind!==K.LITERAL
            ||!/^(["'])[A-Za-z_$][A-Za-z0-9_$]*\1$/.test(right.text))
            return fail('only literal unqualified name equality filters are qualified');
        return [right.text.slice(1,-1)];
    };
    const selection=(value:Node):{receiver:Node;names:string[]}|null=>{
        if(!value||value.kind!==K.E4X_FILTER)return null;
        const root=value.children[0];
        if(root.kind!==K.E4X_DESCENDANT||root.children[1].text!=='*'||type(root.children[0])!=='XML')
            return fail('filtered descendants require an exact XML receiver');
        return {receiver:root.children[0],names:filterNames(value.children[1])};
    };
    if(n.kind===K.FOREACH){
        const iterable=n.children[1].children[0],children=call(iterable,'children');
        const selected=children&&type(children)==='XML'?{receiver:children,names:null}:selection(iterable);
        if(!selected)return false;
        const target=n.children[0],binding=e.findDefInScope(target.text);
        if(target.kind!==K.NAME||!binding||binding.bound||e.references.resolve(binding.as3Type)!=='XML')
            fail('XML enumeration requires an existing XML local');
        let temporary='__as3_xml_item';while(e.source.indexOf(temporary)>=0)temporary+='_';
        e.declareInScope({name:temporary});
        e.catchup(n.start);e.insert('{');
        if(e.pendingStatementLabel){e.insert(e.pendingStatementLabel+': ');e.pendingStatementLabel=null;}
        e.insert('for(var '+temporary+' of '+helper(selected.names?'as3XMLDescendantsNamed':'as3XMLChildren')+'(');
        e.skipTo(selected.receiver.start);visit(e,selected.receiver);e.catchup(selected.receiver.end);
        e.insert((selected.names?', '+JSON.stringify(selected.names):'')+')){'+(e.getIdentifierRemap(target.text)||target.text)+'='+temporary+';');
        const body=n.children[2];e.skipTo(body.start);visit(e,body);e.catchup(body.end);e.insert('}}');e.skipTo(n.end);return true;
    }
    if(n.kind===K.E4X_FILTER){selection(n);fail('XML filtered list escape requires separate qualification');}
    if(n.kind===K.NEW){
        const target=n.children[0]&&n.children[0].kind===K.CALL?n.children[0].children[0]:n.children[0];
        const global=target&&e.nativeGlobals.resolve(target);
        if(global&&['XML','XMLList'].indexOf(global.name)>=0)fail('XML construction requires separate qualification');
    }
    const selectedAttribute=attribute(n);
    if(selectedAttribute){
        const outer=outerEncapsulatedExpression(n);
        if(outer.parent&&outer.parent.children[0]===outer&&[K.ASSIGN,K.DELETE,K.PRE_INC,K.PRE_DEC,K.POST_INC,K.POST_DEC].indexOf(outer.parent.kind)>=0)
            fail('XML attribute writes require separate qualification');
        emit(n,selectedAttribute.receiver,'as3XMLAttribute',JSON.stringify(selectedAttribute.name));return true;
    }
    if(n.kind===K.TYPEOF&&attribute(n.children[0])){emit(n,n.children[0],'as3TypeOf');return true;}
    const stringReceiver=call(n,'toString'),lengthReceiver=call(n,'length');
    const localNameReceiver=call(n,'localName');
    if(localNameReceiver&&type(localNameReceiver)==='XML'){emit(n,localNameReceiver,'as3XMLLocalName');return true;}
    if(stringReceiver&&type(stringReceiver)==='XML'){emit(n,stringReceiver,'as3XMLNodeString');return true;}
    if(stringReceiver&&attribute(stringReceiver)){emit(n,stringReceiver,'as3XMLListString');return true;}
    if(lengthReceiver&&attribute(lengthReceiver)){emit(n,lengthReceiver,'as3XMLListLength');return true;}
    const nameReceiver=stringReceiver&&call(stringReceiver,'name');
    if(nameReceiver&&type(nameReceiver)==='XML'){emit(n,nameReceiver,'as3XMLNameString');return true;}
    if(n.kind===K.DOT&&(type(n.children[0])||n.children[1]&&/^@/.test(n.children[1].text)))
        fail('XML member requires a qualified literal attribute or fused operation');
    return false;
}
