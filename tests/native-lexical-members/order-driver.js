const P=modules.get('AS3MethodBinding'),read=modules.get('nativeClass').readNativeClass;
const C=read(modules.get('LexicalOrder').LexicalOrder),x=P.as3ConstructValue(C,()=>[]);
const call=(receiver,key,...args)=>P.as3CallProperty(receiver,key,()=>args);
let events=[],rows=[];
function rec(id,fn){events=[];try{rows.push({id,value:fn(),events:events.slice()})}catch(e){rows.push({id,error:{name:e.name,errorID:e.errorID},events:events.slice()})}}
rec('static-initializer-order',()=>call(C,'initialized'));
rec('receiver-key-arguments-once',()=>call(x,'once'));
rec('after-once',()=>call(x,'state'));
rec('argument-effects-before-arity',()=>call(x,'arity'));
rec('after-arity',()=>call(x,'state'));
rec('reentrant-write',()=>{const hook=P.as3CreateDynamicObject();P.as3SetProperty(hook,'valueOf',function(){events.push('outer');call(x,'assign',17);return 19});call(x,'assign',hook);return call(x,'getValue')});
rec('throwing-write',()=>{const hook=P.as3CreateDynamicObject();P.as3SetProperty(hook,'valueOf',function(){events.push('throw');throw Object.assign(new Error('capture'),{errorID:0})});call(x,'assign',hook);return call(x,'getValue')});
rec('after-throw',()=>call(x,'getValue'));
globalThis.result=rows;
globalThis.storageGuards={ownNames:Object.getOwnPropertyNames(x),prototypeNames:Object.getOwnPropertyNames(C.prototype),staticNames:Object.getOwnPropertyNames(C),prototypeSymbols:Object.getOwnPropertySymbols(C.prototype).length,entered:P.getAS3EnteredSourceConstructors(x).length};
