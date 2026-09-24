// Observer only: all catch/finally logic belongs to the complete emitted Catcher.
const Catcher=consumerOnly?load('Catcher').Catcher:load('nativeClass').readNativeClass(load('Catcher').Catcher);
const renamed=api.createAS3FullscreenSecurityError();api.as3SetProperty(renamed,'name','changed');
const named=new api.AS3Error('other',18);api.as3SetProperty(named,'name','SecurityError');
const values=[api.createAS3FullscreenSecurityError(),renamed,named,new api.AS3Error(),api.createAS3ArrayCoercionError(),api.as3CreateObjectLiteral([['name','SecurityError'],['errorID',2029]]),null,undefined,'text',3];
// Constructor fields are not observed: native creation uses the already qualified denial factory.
const subject=new Catcher(),rows=[];
values.forEach((value,i)=>{
 for(const method of ['select','rethrow','replace','errorSelect','errorRethrow','errorReplace']) {
  const log=[],replacement={};let result,escaped=false;
  try{result=(method==='replace'||method==='errorReplace')?subject[method](value,replacement,log):subject[method](value,log);}
  catch(error){escaped=true;result=error;}
  rows.push({id:method+'-'+i,value:[escaped,result===((method==='replace'||method==='errorReplace')?replacement:value),log]});
 }
});
// Native lookalikes have no private source SecurityError allocation proof.
for(const value of [new Error('host'),api.getAS3SourceErrorPrototype('SecurityError'),{name:'SecurityError',errorID:2029}]) {
 const log=[];let escaped=false;
 try{subject.select(value,log);}catch(error){if(error!==value)throw Error('catch changed identity');escaped=true;}
 if(!escaped||JSON.stringify(log)!=='["finally"]')throw Error('forged SecurityError entered typed catch');
}
let traps=0;
const hostile=new Proxy({}, {get(){traps++;throw Error('get trap');},getPrototypeOf(){traps++;throw Error('prototype trap');}});
const hostileLog=[];let escaped=false;
try {subject.select(hostile,hostileLog);} catch(error) {if(error!==hostile)throw Error('proxy identity changed');escaped=true;}
if(!escaped||traps||JSON.stringify(hostileLog)!=='["finally"]')throw Error('host proxy admitted or inspected');
globalThis.result=rows;
