const get=n=>load('nativeClass').readNativeClass(load(n)[n]);
const Reader=consumerOnly?load('Reader').Reader:get('Reader'),Subject=load('Subject').Subject;
const reader=new Reader(),subject=new Subject(),marker={},rows=[];let log=[],failArgument=false;
const key=()=>{log.push('key');return 'callable';};
const argument=()=>{log.push('argument');if(failArgument)throw marker;return marker;};
for(let mode=0;mode<4;mode++)for(let state=0;state<3;state++){
 log=[];subject.log=log;subject.failure=state===0?null:marker;failArgument=state===2;let value;
 try{const result=mode===0?reader.dot(subject,argument):mode===1?reader.literal(subject,argument):
  mode===2?reader.computed(subject,key,argument):reader.local(subject,'callable',argument);
  value=['return',result===marker];
 }catch(e){value=['throw',e===marker];}
 rows.push({id:['dot','literal','computed','local'][mode]+'-'+state,value:[value,log]});
}
globalThis.result=rows;
