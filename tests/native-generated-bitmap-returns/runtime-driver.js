// Observer only: complete emitted BitmapReturns owns coercion and finally logic.
const BitmapReturns=load('nativeClass').readNativeClass(load('BitmapReturns').BitmapReturns);
const disposed=new api.BitmapData(1,1);disposed.dispose();
const subject=new BitmapReturns(),values=[new api.BitmapData(1,1),disposed,null,undefined,api.as3CreateDynamicObject(),7,'text',api.BitmapData];
const rows=[],errorState=e=>[api.as3GetProperty(e,'name'),api.as3GetProperty(e,'errorID')];
values.forEach((input,i)=>{
 subject.raw=input;
 for(const method of ['get','echo','typed','set']) {
  let result,state;
  if(method==='set')subject.raw='sentinel';
  try {
   if(method==='set'){subject.value=input;result=subject.raw;}
   else result=method==='get'?subject.value:subject[method](input);
   state=['ok',result===input,result===null];
  }catch(error){state=errorState(error);if(method==='set')state.push(subject.raw);}
  rows.push({id:method+'-'+i,value:state});
 }
});
let log=[],state;
try{state=['ok',subject.replace(api.as3CreateDynamicObject(),values[0],log)===values[0],log];}
catch(error){state=[...errorState(error),log];}
rows.push({id:'finally-valid',value:state});
log=[];
try{subject.replace(values[0],api.as3CreateDynamicObject(),log);state=['ok',log];}
catch(error){state=[...errorState(error),log];}
rows.push({id:'finally-invalid',value:state});
for(const forged of [Object.create(api.BitmapData.prototype),{width:1,height:1}]) {
 let rejected=false;
 try{subject.echo(forged);}catch(error){rejected=api.as3GetProperty(error,'errorID')===1034;}
 if(!rejected)throw Error('forged BitmapData accepted');
}
globalThis.result=rows;
