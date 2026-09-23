const p=load('AS3Property'),inv=load('AS3Invocation'),nc=load('nativeClass');
const get=name=>nc.readNativeClass(load(name)[name],'value');
const OptionalMethods=get('OptionalMethods'),RestMethods=get('RestMethods'),OptionalCtor=get('OptionalCtor'),RestBase=get('RestBase'),RestChild=get('RestChild'),RestRequiredCtor=get('RestRequiredCtor'),Trace=get('Trace'),Value=get('Value');
const register=(fn,returned)=>{inv.registerAS3Function(fn,load('AS3ScriptGlobal').getAS3BuiltinScriptGlobal(),fn.length,returned);return fn;};
const rows=[],callback=register(function(){}),value=new Value(),token={token:true};
function encode(v){if(v===undefined)return {kind:'undefined'};if(v===null)return null;if(v===callback)return {kind:'callback'};if(v===value)return {kind:'value'};if(v===token)return {kind:'token'};if(Array.isArray(v))return v.map(encode);return v;}
function failure(e){return e===token?['token']:load('AS3SourceError').isAS3SourceError(e)?[p.as3GetProperty(e,'name'),p.as3GetProperty(e,'errorID')]:[e.name,e.errorID];}
function invoke(id,target,method,args){Trace.events=[];let result=null,error=[];try{result=target[method].apply(target,args);}catch(e){error=failure(e);}rows.push({id,value:[encode(result),error,Trace.events.concat()]});}
function construct(id,C,args){Trace.events=[];Trace.captured=null;let result=null,error=[];try{result=Reflect.construct(C,args);}catch(e){error=failure(e);}let observed=null;
if(result instanceof OptionalCtor)observed=[result.marker,encode(result.stored)];else if(result instanceof RestBase)observed=[result.marker,result instanceof RestChild?result.childMarker:null,encode(result.values),args.length===1&&Array.isArray(args[0])?result.values===args[0]:false];else if(result instanceof RestRequiredCtor)observed=encode(result.stored);
rows.push({id,value:[observed,error,Trace.events.concat(),Trace.captured===result&&result!==null]});}
   var o=new OptionalMethods(),r=new RestMethods();
   invoke("slot-default",o,"slot",[callback,value]);invoke("slot-full",o,"slot",[callback,value,true,9]);
   invoke("slot-undefined",o,"slot",[undefined,undefined,undefined,undefined]);invoke("slot-null",o,"slot",[null,null,null,null]);
   invoke("slot-convert",o,"slot",[callback,value,"",4294967297]);invoke("slot-missing",o,"slot",[callback]);invoke("slot-extra",o,"slot",[callback,value,true,9,5]);
   invoke("slot-bad-listener",o,"slot",[{},value]);invoke("slot-bad-interface",o,"slot",[callback,{}]);
   invoke("defaults-none",o,"defaults",[]);invoke("defaults-undefined",o,"defaults",[undefined,undefined,undefined,undefined]);invoke("defaults-null",o,"defaults",[null,null,null,null]);
   invoke("defaults-partial",o,"defaults",[false]);invoke("defaults-reference",o,"defaults",[true,3,"s",value]);invoke("defaults-extra",o,"defaults",[true,3,"s",value,5]);
   var number={valueOf:register(function(){Trace.events.push("number");return 11;})};
   var text={toString:register(function(){Trace.events.push("string");return "text";},"String")};
   var throwing={valueOf:register(function(){Trace.events.push("number-throw");throw token;})};
   invoke("defaults-order",o,"defaults",[{},number,text,value]);invoke("defaults-throw",o,"defaults",[true,throwing,text,value]);
   invoke("protected-default",o,"add",[callback]);invoke("protected-explicit",o,"addOnce",[callback]);
   invoke("static-default",OptionalMethods,"choose",[]);invoke("static-undefined",OptionalMethods,"choose",[undefined,undefined]);invoke("static-extra",OptionalMethods,"choose",[1,true,3]);
   invoke("rest-empty",r,"only",[]);invoke("rest-values",r,"only",[1,undefined,null,value,callback]);invoke("rest-array-value",r,"only",[[1,2]]);
   invoke("mixed-missing",r,"mixed",[]);invoke("mixed-head",r,"mixed",["8"]);invoke("mixed-tail",r,"mixed",["8",1,2]);invoke("mixed-undefined",r,"mixed",[undefined,undefined]);invoke("mixed-throw",r,"mixed",[throwing,1]);
   invoke("optional-rest-empty",r,"optional",[]);invoke("optional-rest-undefined",r,"optional",[undefined,1,2]);
   invoke("rebind-array",r,"rebind",[[9],1,2]);invoke("rebind-undefined",r,"rebind",[undefined,1]);invoke("rebind-null",r,"rebind",[null,1]);invoke("rebind-object",r,"rebind",[{},1]);
   var input=[1,2];Trace.events=[];var first=r.mutate.apply(r,input),second=r.mutate.apply(r,input);
   rows.push({id:"rest-fresh",value:[input,first,second,first!==second]});
   rows.push({id:"method-length",value:[o.slot.length,o.defaults.length,o.add.length,OptionalMethods.choose.length,r.only.length,r.mixed.length,r.optional.length]});
   construct("ctor-default",OptionalCtor,[callback,value]);construct("ctor-full",OptionalCtor,[callback,value,true,9]);construct("ctor-undefined",OptionalCtor,[undefined,undefined,undefined,undefined]);construct("ctor-missing",OptionalCtor,[callback]);construct("ctor-extra",OptionalCtor,[callback,value,false,0,1]);construct("ctor-bad-reference",OptionalCtor,[callback,{}]);construct("ctor-number-throw",OptionalCtor,[callback,value,false,throwing]);
   construct("base-empty",RestBase,[]);construct("base-values",RestBase,[1,2]);construct("base-array",RestBase,[[1,2]]);
   construct("child-empty",RestChild,[]);construct("child-values",RestChild,[1,2]);construct("child-array",RestChild,[[1,2]]);construct("child-undefined",RestChild,[undefined]);
   construct("required-rest-missing",RestRequiredCtor,[]);construct("required-rest-head",RestRequiredCtor,["8"]);construct("required-rest-tail",RestRequiredCtor,["8",1,2]);construct("required-rest-throw",RestRequiredCtor,[throwing,1]);
globalThis.result=rows;
