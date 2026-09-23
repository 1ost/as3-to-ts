const p=load('AS3Property'),inv=load('AS3Invocation'),nc=load('nativeClass');
const get=name=>nc.readNativeClass(load(name)[name],'value');
const FieldCalls=get('FieldCalls'),ChildCalls=get('ChildCalls'),MethodTarget=get('MethodTarget');
const subject=new FieldCalls(),child=new ChildCalls(),other=new FieldCalls(),target=new MethodTarget();
const receiver={},token={},rows=[];let events=[],bareReceiver,childReceiver;
const callbackGlobal=load('AS3ScriptGlobal').getAS3BuiltinScriptGlobal();
const register=fn=>inv.registerAS3Function(fn,callbackGlobal,fn.length);
const original=register(function(...args){events.push('original');return [this,args];});
const replacement=register(function(...args){events.push('replacement');return [this,args];});
const getQualifiedClassName=load('getQualifiedClassName').getQualifiedClassName;
function encode(v){if(v===undefined)return {kind:'undefined'};if(v===null)return null;if(v===subject)return 'subject';if(v===child)return 'child';if(v===other)return 'other';if(v===target)return 'target';if(v===receiver)return 'receiver';if(v===token)return 'token';if(v===callbackGlobal)return 'global';if(v===bareReceiver)return 'bare-receiver';if(v===childReceiver)return 'child-receiver';return Array.isArray(v)?v.map(encode):v;}
function failure(e){return e===token?['token']:load('AS3SourceError').isAS3SourceError(e)?[p.as3GetProperty(e,'name'),p.as3GetProperty(e,'errorID')]:[e.name,e.errorID];}
function invoke(id,object,method,args){events=[];let value=null,error=[];try{value=object[method].apply(object,args);}catch(e){error=failure(e);}rows.push({id,value:[encode(value),error,events.slice()]});}
   subject.install(original);child.install(original);other.install(replacement);
   bareReceiver=subject.fire0()[0];childReceiver=child.inherited(0)[0];
   rows.push({id:"receiver-identities",value:[getQualifiedClassName(bareReceiver),getQualifiedClassName(childReceiver),bareReceiver===callbackGlobal,childReceiver===bareReceiver,subject.privateCall(0)[0]===bareReceiver,subject.fire2(0,0)[0]===bareReceiver]});
   invoke("direct-zero",subject,"fire0",[]);invoke("direct-one",subject,"fire1",[7]);invoke("direct-two",subject,"fire2",[7,undefined]);
   invoke("private",subject,"privateCall",[9]);invoke("inherited",child,"inherited",[11]);
   invoke("apply-null",subject,"applied",[null,[7,8]]);invoke("apply-object",subject,"applied",[receiver,[7,8]]);
   invoke("call-null",subject,"called",[null,7]);invoke("call-object",subject,"called",[receiver,7]);
   subject.install(target.capture);invoke("bound-direct",subject,"fire1",[12]);invoke("bound-bare",subject,"fire0",[]);invoke("bound-bare-success",subject,"privateCall",[14]);invoke("bound-apply",subject,"applied",[receiver,[13]]);
   subject.install(original);
   var stable={next:function(){events.push("argument");return 17;}};
   invoke("stable-argument",subject,"changing",[stable]);
   var replace={next:function(){events.push("argument-replace");subject.install(replacement);return 19;}};
   invoke("replace-during-argument",subject,"changing",[replace]);invoke("after-replace",subject,"fire1",[20]);
   subject.install(original);
   var clear={next:function(){events.push("argument-clear");subject.install(null);return 21;}};
   invoke("clear-during-argument",subject,"changing",[clear]);invoke("null-function",subject,"fire1",[22]);
   var install={next:function(){events.push("argument-install");subject.install(original);return 23;}};
   invoke("install-during-argument",subject,"changing",[install]);
   subject.install(original);invoke("qualified-replace",subject,"qualifiedChanging",[replace]);
   subject.install(original);invoke("qualified-clear",subject,"qualifiedChanging",[clear]);
   subject.install(null);invoke("qualified-install",subject,"qualifiedChanging",[install]);
   invoke("base-method-on-child",child,"fire0",[]);
   var throwing={next:function(){events.push("argument-throw");throw token;}};
   invoke("argument-throw",subject,"changing",[throwing]);
   invoke("other-receiver",subject,"otherChanging",[other,stable]);
   invoke("null-receiver",subject,"otherChanging",[null,stable]);
   invoke("null-receiver-throw",subject,"otherChanging",[null,throwing]);
   subject.install(register(function(value){events.push("body-throw");throw token;}));invoke("body-throw",subject,"fire1",[24]);
   subject.install(null);invoke("null-apply",subject,"applied",[receiver,[25]]);

   var receiverArg={next:function(){events.push("receiver-argument");return receiver;}};
   var receiverReplace={next:function(){events.push("receiver-replace");subject.install(replacement);return receiver;}};
   subject.install(original);invoke("apply-argument",subject,"applyChanging",[receiverArg]);
   subject.install(original);invoke("call-argument",subject,"callChanging",[receiverArg]);
   subject.install(original);invoke("apply-replace",subject,"applyChanging",[receiverReplace]);
   subject.install(original);invoke("call-replace",subject,"callChanging",[receiverReplace]);
   subject.install(null);invoke("apply-null-argument",subject,"applyChanging",[receiverArg]);
   subject.install(null);invoke("call-null-argument",subject,"callChanging",[receiverArg]);
   subject.install(null);invoke("apply-null-throw",subject,"applyChanging",[throwing]);
   subject.install(null);invoke("call-null-throw",subject,"callChanging",[throwing]);

globalThis.result=rows;

const domainChecks=[];
function check(id,ok){if(!ok)throw Error('domain invariant: '+id);domainChecks.push(id);}
const globals=load('AS3ScriptGlobal');
check('base caller global authenticated',globals.isAS3ScriptGlobal(bareReceiver));
check('child caller global authenticated',globals.isAS3ScriptGlobal(childReceiver));
check('base source Class binding',globals.readAS3ScriptGlobalDeclaration(bareReceiver,'FieldCalls','callbacks').value===FieldCalls);
check('child source Class binding',globals.readAS3ScriptGlobalDeclaration(childReceiver,'ChildCalls','callbacks').value===ChildCalls);
if(typeof createDomainLoader==='function'){
 const alternate=createDomainLoader();const OtherField=nc.readNativeClass(alternate('FieldCalls').FieldCalls,'value');
 const OtherChild=nc.readNativeClass(alternate('ChildCalls').ChildCalls,'value');
 const another=new OtherField(),anotherChild=new OtherChild();another.install(original);anotherChild.install(original);
 const secondGlobal=another.fire0()[0],secondChildGlobal=anotherChild.inherited(0)[0];
 check('fresh loader creates fresh Classes',OtherField!==FieldCalls&&OtherChild!==ChildCalls);
 check('same source has distinct globals per loader',secondGlobal!==bareReceiver&&secondChildGlobal!==childReceiver);
 check('other domain base binding',globals.readAS3ScriptGlobalDeclaration(secondGlobal,'FieldCalls','callbacks').value===OtherField);
 check('other domain base method keeps defining global',anotherChild.fire0()[0]===secondGlobal);
 check('cross-domain callback keeps creation global for apply',another.applied(null,[])[0]===callbackGlobal);
}
globalThis.domainChecks=domainChecks;
