// Observer only: all catch/finally logic belongs to the complete emitted Catcher.
const Catcher=load('nativeClass').readNativeClass(load('Catcher').Catcher);
const renamed=new api.IOError('disk',17);api.as3SetProperty(renamed,'name','changed');
const named=new api.AS3Error('other',18);api.as3SetProperty(named,'name','IOError');
const values=[new api.IOError(),renamed,named,new api.AS3Error(),api.createAS3ArrayCoercionError(),api.as3CreateObjectLiteral([['name','IOError'],['errorID',2029]]),null,undefined,'text',3];
const subject=new Catcher(),rows=[];
values.forEach((value,i)=>{
 for(const method of ['select','rethrow','replace']) {
  const log=[],replacement={};let result,escaped=false;
  try{result=method==='replace'?subject.replace(value,replacement,log):subject[method](value,log);}
  catch(error){escaped=true;result=error;}
  rows.push({id:method+'-'+i,value:[escaped,result===(method==='replace'?replacement:value),log]});
 }
});
// Native lookalikes have no private source IOError allocation proof.
for(const value of [new Error('host'),Object.create(api.IOError.prototype),{name:'IOError',errorID:2029}]) {
 const log=[];let escaped=false;
 try{subject.select(value,log);}catch(error){if(error!==value)throw Error('catch changed identity');escaped=true;}
 if(!escaped||JSON.stringify(log)!=='["finally"]')throw Error('forged IOError entered typed catch');
}
globalThis.result=rows;
