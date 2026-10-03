// Observer only: the complete emitted class owns parameter coercion and entry.
const ContextParameters=load('nativeClass').readNativeClass(load('ContextParameters').ContextParameters);
const subject=new ContextParameters(),values=[new api.SoundLoaderContext(),null,undefined,api.as3CreateDynamicObject(),7,'text',api.SoundLoaderContext,[]];
const rows=[],errorState=e=>[api.as3GetProperty(e,'name'),api.as3GetProperty(e,'errorID')];
values.forEach((input,i)=>{
 for(const operation of ['accept','set','construct']) {
  subject.raw='sentinel';let result,state;
  try {
   if(operation==='set'){subject.value=input;result=subject.raw;}
   else if(operation==='construct')result=(new ContextParameters(input)).raw;
   else result=subject.accept(input);
   state=['ok',result===input,result===null];
  }catch(error){state=errorState(error);if(operation!=='construct')state.push(subject.raw);}
  rows.push({id:operation+'-'+i,value:state});
 }
});
rows.push({id:'omitted-method',value:subject.accept()===null});
rows.push({id:'omitted-constructor',value:(new ContextParameters()).raw===null});
for(const forged of [Object.create(api.SoundLoaderContext.prototype),{bufferTime:1000,checkPolicyFile:false}]) {
 for(const operation of ['accept','set','construct']) {
  let rejected=false;
  try{if(operation==='construct')new ContextParameters(forged);else if(operation==='set')subject.value=forged;else subject.accept(forged);}
  catch(error){rejected=api.as3GetProperty(error,'errorID')===1034;}
  if(!rejected)throw Error('forged SoundLoaderContext accepted by '+operation);
 }
}
globalThis.result=rows;
