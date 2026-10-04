import {intrinsicStringAs} from './native-string-casts';
import Node, {unwrapEncapsulatedExpression, outerEncapsulatedExpression} from '../syntax/node';
import K from '../syntax/nodeKind';
import {generatedModule} from './native-generated-emission';
import {nativeGeneratedDeclarationInputs, nativeGeneratedDeclarationNode} from './native-generated-declarations';
import {typeOfBinding} from './native-typeof';

const xmlMethodNames=['addNamespace','appendChild','attribute','attributes','child','childIndex','children','comments','contains','copy',
            'descendants','elements','hasComplexContent','hasOwnProperty','hasSimpleContent','inScopeNamespaces',
            'insertChildAfter','insertChildBefore','length','localName','name','namespace','namespaceDeclarations',
            'nodeKind','normalize','parent','prependChild','processingInstructions','propertyIsEnumerable',
            'removeNamespace','replace','setChildren','setLocalName','setName','setNamespace','text','toString',
            'toXMLString','valueOf'];
function fail(detail:string):never {throw new Error('AS3_XML_UNSUPPORTED: '+detail);}
/** Provider paths in a plan are relative to its declaration-domain module. */
export function xmlGlobalProviderModule(module:string,domain:string):string {
    if(module.charAt(0)!=='.')return module;
    const path=require('path').posix;
    const rebased=path.normalize(path.join(path.dirname(domain),module));
    return rebased.charAt(0)==='.'?rebased:'./'+rebased;
}
/** Literal E4X paths on exact XML bindings and authenticated source return types. */
export function emitNativeXML(e:any,n:Node,visit:(e:any,n:Node)=>void):boolean {
    if(e.options.nativeXMLModule===undefined)return false;
    const module=generatedModule(e.options.nativeXMLModule);
    const type=(value:Node):string=>{
        value=unwrapEncapsulatedExpression(value);
        if(!value||!e.generated||!e.references)return null;
        if(childSelection(value))return 'XMLList';
        if(value.kind===K.CALL&&value.children[0].kind===K.DOT
            &&['descendants','attributes'].indexOf(value.children[0].children[1].text)>=0
            &&value.findChild(K.ARGUMENTS).children.length===0&&type(value.children[0].children[0]))return 'XMLList';
        if(value.kind===K.DOT&&value.children[1].kind===K.LITERAL
            &&/^@?[A-Za-z_$][A-Za-z0-9_$]*$/.test(value.children[1].text)&&type(value.children[0]))return 'XMLList';
        let identity:string=null;
        if(value.kind===K.IDENTIFIER){
            const binding=e.findDefInScope(value.text);
            if(!binding||!binding.as3Type)return null;
            if(binding.bound) {
                // Resolve the selected source field's annotation, not a private
                // spelling on the XML value. Preserve normal lexical reads when
                // emitting the receiver; parameter/local shadowing stays above it.
                const lexical=e.generated.lexical;
                const field=lexical.traits.find((t:any)=>t.name===value.text
                    &&t.static===(binding.bound!=='this')&&(t.kind==='variable'||t.kind==='constant'));
                const ref=field&&field.type&&e.generated.options.plan.references.find((r:any)=>r.owner===field.owner
                    &&r.start===field.type.start&&r.end===field.type.end&&r.kind==='native');
                if(!ref)return null;
                identity=ref.identity;
            }else identity=e.references.resolve(binding.as3Type);
        }else if(value.kind===K.CALL&&value.children[0].kind===K.DOT){
            const receiver=unwrapEncapsulatedExpression(value.children[0].children[0]),member=value.children[0].children[1];
            if(receiver.kind!==K.IDENTIFIER||member.kind!==K.LITERAL)return null;
            const binding=e.findDefInScope(receiver.text),plan=e.generated.options.plan;
            if(binding&&(binding.bound||Object.prototype.hasOwnProperty.call(binding,'as3Type'))
                ||typeOfBinding(receiver,e.source,Object.keys(e.generated.classes))==='lexical'
                ||!e.references.publicStaticMethod(receiver.text,member.text))return null;
            const owner=e.references.resolve(receiver.text);
            const method=nativeGeneratedDeclarationNode(plan,owner).findChild(K.CONTENT).children.find((n:Node)=>
                n.kind===K.FUNCTION&&n.findChild(K.NAME).text===member.text);
            const returned=method&&method.findChild(K.TYPE);
            const ref=returned&&plan.references.find((r:any)=>r.owner===owner&&r.start===returned.start&&r.end===returned.end);
            if(!ref||ref.kind!=='native')return null;
            identity=ref.identity;
        }
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
    const childSelection=(value:Node):{receiver:Node;name:string}|null=>{
        value=unwrapEncapsulatedExpression(value);
        if(!value||value.kind!==K.CALL||value.children[0].kind!==K.DOT
            ||value.children[0].children[1].text!=='child'||!type(value.children[0].children[0]))return null;
        const args=value.findChild(K.ARGUMENTS).children;
        if(args.length!==1||args[0].kind!==K.LITERAL||!/^(["'])[A-Za-z_$][A-Za-z0-9_$]*\1$/.test(args[0].text))
            fail('XML child method requires one unqualified literal name');
        return {receiver:value.children[0].children[0],name:args[0].text.slice(1,-1)};
    };
    const attribute=(value:Node):{receiver:Node;name:string}|null=>{
        if(value&&value.kind===K.DOT&&value.children[1]
            &&value.children[1].kind===K.LITERAL&&/^@[A-Za-z_$][A-Za-z0-9_$]*$/.test(value.children[1].text)
            &&type(value.children[0]))return {receiver:value.children[0],name:value.children[1].text.slice(1)};
        if(value&&value.kind===K.CALL&&value.children[0].kind===K.DOT
            &&value.children[0].children[1].text==='attribute'&&type(value.children[0].children[0])){
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
        const dotChild=iterable.kind===K.DOT&&iterable.children[1].kind===K.LITERAL
            &&/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(iterable.children[1].text)
            &&xmlMethodNames.indexOf(iterable.children[1].text)<0&&type(iterable.children[0])
            ?{receiver:iterable.children[0],name:iterable.children[1].text}:null;
        const child=childSelection(iterable)||dotChild,list=type(iterable)==='XMLList';
        const selected=child?{receiver:child.receiver,names:null}:list?{receiver:iterable,names:null}:children&&type(children)==='XML'?{receiver:children,names:null}:selection(iterable);
        if(!selected)return false;
        const target=n.children[0],inline=(child||list)&&target.kind===K.VAR&&target.children.length===1
            &&target.children[0].kind===K.NAME_TYPE_INIT&&!target.children[0].findChild(K.INIT)?target.children[0]:null;
        const targetName=inline?inline.findChild(K.NAME).text:target.text;
        if(inline){
            const annotation=inline.findChild(K.TYPE);
            if(!annotation||e.references.resolve(annotation.qualifiedName||annotation.text)!=='XML')
                fail('XML child enumeration requires an XML local');
            e.declareInScope({name:targetName,as3Type:'XML'});
        }
        const binding=e.findDefInScope(targetName);
        if(!inline&&target.kind!==K.NAME||!binding||binding.bound||e.references.resolve(binding.as3Type)!=='XML')
            fail('XML enumeration requires an existing XML local or qualified child-loop declaration');
        let temporary='__as3_xml_item';while(e.source.indexOf(temporary)>=0)temporary+='_';
        e.declareInScope({name:temporary});
        e.catchup(n.start);e.insert('{');
        if(e.pendingStatementLabel){e.insert(e.pendingStatementLabel+': ');e.pendingStatementLabel=null;}
        e.insert('for(var '+temporary+' of '+helper(child?'as3XMLChildNamed':list?'as3XMLListValues':selected.names?'as3XMLDescendantsNamed':'as3XMLChildren')+'(');
        e.skipTo(selected.receiver.start);visit(e,selected.receiver);e.catchup(selected.receiver.end);
        // ES5 for-of lowering indexes arrays; a native XMLList is iterable but
        // does not expose numeric JS properties. Preserve its selected node list.
        e.insert((child?', '+JSON.stringify(child.name):selected.names?', '+JSON.stringify(selected.names):'')+')'+(child?'.toArray()':'')+'){'+(e.getIdentifierRemap(targetName)||targetName)+'='+temporary+';');
        const body=n.children[2];e.skipTo(body.start);visit(e,body);e.catchup(body.end);e.insert('}}');e.skipTo(n.end);return true;
    }
    if(n.kind===K.E4X_FILTER){selection(n);fail('XML filtered list escape requires separate qualification');}
    const selectedChild=childSelection(n);
    if(selectedChild){emit(n,selectedChild.receiver,'as3XMLChildNamed',JSON.stringify(selectedChild.name));return true;}
    if(n.kind===K.NEW){
        const target=n.children[0]&&n.children[0].kind===K.CALL?n.children[0].children[0]:n.children[0];
        const global=target&&e.nativeGlobals.resolve(target);
        if(global&&['XML','XMLList'].indexOf(global.name)>=0) {
            if(global.name!=='XML')fail('XMLList construction requires separate qualification');
            if(!e.generated||!e.references)fail('XML construction requires a generated declaration/reference plan');
            const input=nativeGeneratedDeclarationInputs(e.generated.options.plan,e.generated.options.plan.scope);
            const provider=input.providers&&input.providers.XML;
            if(!provider||provider.exportName!=='XML'||provider.nativeBase||provider.nativeInterface
                ||xmlGlobalProviderModule(provider.module,e.generated.options.module)!==global.module)
                fail('exact XML constructor global and declaration provider required');
            const invocation=n.children[0],args=invocation.kind===K.CALL&&invocation.findChild(K.ARGUMENTS);
            if(!args||args.children.length>1)fail('XML String constructor requires zero or one argument');
            const value=args.children.length?unwrapEncapsulatedExpression(args.children[0]):null;
            const binding=value&&value.kind===K.IDENTIFIER&&e.findDefInScope(value.text);
            const byteMethod=value&&value.kind===K.CALL&&value.children[0].kind===K.DOT&&value.children[0];
            const byteReceiver=byteMethod&&unwrapEncapsulatedExpression(byteMethod.children[0]);
            const byteBinding=byteReceiver&&byteReceiver.kind===K.IDENTIFIER&&e.findDefInScope(byteReceiver.text);
            // The shared ByteArray provider authenticates this source method's
            // String return type. Unknown/dynamic calls still need their own proof.
            const byteString=e.options.nativeByteArrayReferenceModule!==undefined&&byteMethod
                &&byteMethod.children[1].kind===K.LITERAL&&byteMethod.children[1].text==='readUTFBytes'
                &&value.findChild(K.ARGUMENTS).children.length===1
                &&byteBinding&&!byteBinding.bound&&byteBinding.as3Type
                &&e.references.resolve(byteBinding.as3Type)==='flash.utils.ByteArray';
            if(value&&!(binding&&!binding.bound&&binding.as3Type&&e.references.resolve(binding.as3Type)==='String')
                &&!(value.kind===K.LITERAL&&/^["']/.test(value.text))&&value.text!=='null'&&!intrinsicStringAs(e,value)&&!byteString)
                fail('XML constructor input requires String binding, literal, null or intrinsic String-as');
            e.catchup(n.start);e.insert(helper('as3ConstructXMLString')+'(');
            if(value){e.skipTo(value.start);visit(e,value);e.catchup(value.end);}
            e.insert(')');e.skipTo(n.end);return true;
        }
    }
    if(n.kind===K.ASSIGN&&n.children.length===3){
        const target=unwrapEncapsulatedExpression(n.children[0]),operator=n.children[1],right=n.children[2];
        const literal=target.kind===K.DOT?attribute(target):null;
        const dynamic=target.kind===K.ARRAY_ACCESSOR&&target.children.length===2
            &&target.children[0].kind===K.DOT&&target.children[0].children[1].text==='@'
            &&type(target.children[0].children[0]);
        if(literal||dynamic){
            if(operator.text!=='=')fail('XML compound attribute assignment requires separate qualification');
            const receiver=literal?literal.receiver:target.children[0].children[0];
            e.catchup(n.start);e.insert('(<any>'+helper('as3XMLSetAttribute')+'(');
            e.skipTo(receiver.start);visit(e,receiver);e.catchup(receiver.end);e.insert(', ');
            if(literal)e.insert(JSON.stringify(literal.name));
            else {const key=target.children[1];e.skipTo(key.start);visit(e,key);e.catchup(key.end);}
            e.insert(', ');e.skipTo(right.start);visit(e,right);e.catchup(right.end);
            e.insert('))');e.skipTo(n.end);return true;
        }
    }
    const stringArgs=n.kind===K.CALL&&n.children[0].kind===K.IDENTIFIER&&n.children[0].text==='String'
        &&n.findChild(K.ARGUMENTS).children;
    const convertedName=stringArgs&&stringArgs.length===1&&call(stringArgs[0],'name');
    if(convertedName&&type(convertedName)==='XML'&&e.references.resolve('String')==='String'
        &&!e.references.sourceClass('String')&&!e.references.sourceInterface('String')&&!e.findDefInScope('String')
        &&typeOfBinding(n.children[0],e.source,[])==='builtin'){
        emit(n,convertedName,'as3XMLNameStringCoerce');return true;
    }
    const descendants=call(n,'descendants'),attributes=call(n,'attributes');
    if(descendants&&type(descendants)){emit(n,descendants,'as3XMLDescendants');return true;}
    if(attributes&&type(attributes)){emit(n,attributes,'as3XMLAttributes');return true;}
    const selectedAttribute=attribute(n);
    if(selectedAttribute){
        const outer=outerEncapsulatedExpression(n);
        if(outer.parent&&outer.parent.children[0]===outer&&[K.ASSIGN,K.DELETE,K.PRE_INC,K.PRE_DEC,K.POST_INC,K.POST_DEC].indexOf(outer.parent.kind)>=0)
            fail('XML attribute writes require separate qualification');
        emit(n,selectedAttribute.receiver,'as3XMLAttribute',JSON.stringify(selectedAttribute.name));return true;
    }
    if(n.kind===K.DOT&&n.children[1].kind===K.LITERAL&&/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n.children[1].text)
        &&type(n.children[0])){
        if(xmlMethodNames.indexOf(n.children[1].text)>=0)
            fail('XML method-name child selection requires separate qualification');
        const outer=outerEncapsulatedExpression(n),parent=outer.parent;
        if(parent&&parent.children[0]===outer&&[K.ASSIGN,K.DELETE,K.PRE_INC,K.PRE_DEC,K.POST_INC,K.POST_DEC,K.CALL,K.NEW].indexOf(parent.kind)>=0)
            fail('XML child mutation or invocation requires separate qualification');
        emit(n,n.children[0],'as3XMLChildNamed',JSON.stringify(n.children[1].text));return true;
    }
    if(n.kind===K.TYPEOF&&(attribute(n.children[0])||childSelection(n.children[0]))){emit(n,n.children[0],'as3TypeOf');return true;}
    const stringReceiver=call(n,'toString'),lengthReceiver=call(n,'length');
    const localNameReceiver=call(n,'localName');
    if(localNameReceiver&&type(localNameReceiver)==='XML'){emit(n,localNameReceiver,'as3XMLLocalName');return true;}
    if(stringReceiver&&type(stringReceiver)==='XML'){emit(n,stringReceiver,'as3XMLNodeString');return true;}
    const selectedList=(value:Node):boolean=>!!childSelection(value)||!!attribute(value)
        ||unwrapEncapsulatedExpression(value).kind===K.DOT&&type(value)==='XMLList';
    if(stringReceiver&&selectedList(stringReceiver)){emit(n,stringReceiver,'as3XMLListString');return true;}
    if(lengthReceiver&&selectedList(lengthReceiver)){emit(n,lengthReceiver,'as3XMLListLength');return true;}
    const nameReceiver=stringReceiver&&call(stringReceiver,'name');
    if(nameReceiver&&type(nameReceiver)==='XML'){emit(n,nameReceiver,'as3XMLNameString');return true;}
    if(n.kind===K.DOT&&(type(n.children[0])||n.children[1]&&/^@/.test(n.children[1].text)))
        fail('XML member requires a qualified literal attribute or fused operation');
    return false;
}
