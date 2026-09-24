const get=n=>load('nativeClass').readNativeClass(load(n)[n]);
const Writer=consumerOnly?load('Writer').Writer:get('Writer'),Root=get('Root'),Slot=get('Slot');
 const writer=new Writer(),slot=new Slot(),marker={},rows=[];let log=[],rhsValue='17.8',failRhs=false,failKey=false;
 const rhs=()=>{log.push('rhs');if(failRhs)throw marker;return rhsValue;};
 const key=()=>{log.push('key');if(failKey)throw marker;return 'value';};
 const observe=(action)=>{
  try {const v=action();return v===undefined?['undefined']:v===null?['null']:[typeof v,v];}
  catch(e){const source=api.as3IsSourceErrorInstance(e),kind=api.getAS3SourceErrorClassName(e);return ['thrown',e===marker,source,kind==='TypeError',kind==='ReferenceError',source?e.errorID:0,source?e.message:''];}
 };
 const ids=['dynamic','typed','null','undefined','number','string','boolean'];
 for(let mode=0;mode<3;mode++)for(let kind=0;kind<7;kind++)for(let state=0;state<2;state++){
  log=[];slot.log=log;slot.stored=0;failRhs=state===1;
  const target=api.as3CoerceObject([api.as3CreateDynamicObject(),slot,null,undefined,42,'x',true][kind]);
  const result=observe(()=>mode===0?writer.dot(target,rhs):mode===1?writer.literal(target,rhs):writer.computed(target,key,rhs));
  rows.push({id:['dot','literal','computed'][mode]+'-'+ids[kind]+'-'+state,value:[result,log,kind===0?api.as3GetProperty(target,'value'):kind===1?slot.stored:null]});
 }
 failRhs=false;slot.failure=marker;
 for(let mode=0;mode<3;mode++){
  log=[];slot.log=log;slot.stored=0;
  const result=observe(()=>mode===0?writer.dot(slot,rhs):mode===1?writer.literal(slot,rhs):writer.computed(slot,key,rhs));
  rows.push({id:'setter-throw-'+mode,value:[result,log,slot.stored]});
 }
 slot.failure=null;failKey=true;log=[];
 rows.push({id:'key-throw',value:[observe(()=>writer.computed(null,key,rhs)),log]});failKey=false;
 const root=new Root();root.selected=slot;
 for(let state=0;state<4;state++){
  log=[];root.log=log;slot.log=log;slot.stored=0;root.failure=state===1?marker:null;root.selected=state===2?null:slot;failRhs=state===3;
  rows.push({id:'nested-'+state,value:[observe(()=>writer.nested(root,rhs)),log,slot.stored]});
 }
 failRhs=false;
 const coercions=[undefined,null,'-3.9',4294967297,true,'invalid'];
 for(let i=0;i<coercions.length;i++){
  log=[];slot.log=log;slot.stored=99;rhsValue=coercions[i];
  rows.push({id:'coercion-'+i,value:[observe(()=>writer.dot(slot,rhs)),log,slot.stored]});
 }
 log=[];rows.push({id:'wildcard-undefined',value:[observe(()=>writer.wildcard(undefined,rhs)),log]});

globalThis.result=rows;
