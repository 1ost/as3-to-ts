const get=n=>load('nativeClass').readNativeClass(load(n)[n]);
const Adder=consumerOnly?load('Adder').Adder:get('Adder'),Root=get('Root'),Slot=get('Slot');
 const a=new Adder(),s=new Slot(),root=new Root(),rows=[],marker={};let log=[],rhsValue=0.8,failRhs=false;
 const object=(v)=>api.as3CreateObjectLiteral(Object.entries(v));
 const rhs=()=>{log.push('rhs');if(failRhs)throw marker;return rhsValue;};
 const scalar=(v)=>v===undefined?['undefined']:v===null?['null']:typeof v==='number'&&isNaN(v)?['NaN']:[typeof v,v];
 const observe=(action)=>{
  try{return ['return',scalar(action())];}
  catch(e){const source=api.as3IsSourceErrorInstance(e),kind=api.getAS3SourceErrorClassName(e);return ['throw',e===marker,source,kind==='TypeError',kind==='ReferenceError',source?e.errorID:0,source?e.message:''];}
 };
 const ids=['number','string','missing','typed','null','undefined','primitive-number','primitive-string','primitive-boolean','rhs-throw','get-throw','set-throw'];
 for(let mode=0;mode<2;mode++)for(let kind=0;kind<ids.length;kind++){
  log=[];s.log=log;s.stored=2;s.readFailure=kind===10?marker:null;s.writeFailure=kind===11?marker:null;failRhs=kind===9;rhsValue=0.8;
  const o=object({amount:3}),target=api.as3CoerceObject([o,object({amount:'x'}),object({}),s,null,undefined,42,'x',true,o,s,s][kind]);
  root.log=log;root.selected=target;root.second=target;root.reads=0;root.failAt=0;
  const result=observe(()=>mode===0?a.add(target,rhs):a.nested(root,rhs));
  rows.push({id:['dot','nested'][mode]+'-'+ids[kind],value:[result,log,kind<3||kind===9?scalar(api.as3GetProperty(target,'amount')):kind===3||kind>=10?scalar(s.stored):null]});
 }
 failRhs=false;s.readFailure=null;s.writeFailure=null;rhsValue=4;
 for(let mode=0;mode<2;mode++){
  log=[];const o=object({amount:3}),replacement=object({amount:20});root.log=log;root.selected=o;root.second=o;root.reads=0;
  const other=new Root();other.log=log;other.selected=replacement;other.second=replacement;
  const result=observe(()=>mode===0?a.replace(o,replacement,rhs):a.nestedReplace(root,other,rhs));
  rows.push({id:'replace-'+mode,value:[result,log,api.as3GetProperty(o,'amount'),api.as3GetProperty(replacement,'amount')]});
 }
 for(let state=0;state<4;state++){
  log=[];const o=object({amount:3}),replacement=object({amount:20});root.log=log;root.reads=0;root.selected=o;root.second=state===3?null:replacement;root.failure=marker;root.failAt=state===1?1:state===2?2:0;
  rows.push({id:'root-'+state,value:[observe(()=>a.nested(root,rhs)),log,api.as3GetProperty(o,'amount'),api.as3GetProperty(replacement,'amount')]});
 }
 root.failAt=0;
 for(let mode=0;mode<2;mode++)for(let state=0;state<4;state++){
  log=[];const o=object({amount:object({valueOf:()=>{log.push('left-valueOf');if(state===1)throw marker;return 2;}})});
  rhsValue=object({valueOf:()=>{log.push('right-valueOf');if(state===2)throw marker;return 3;}});
  root.log=log;root.reads=0;root.selected=o;root.second=o;root.failure=marker;root.failAt=state===3?2:0;
  rows.push({id:'conversion-'+mode+'-'+state,value:[observe(()=>mode===0?a.add(o,rhs):a.nested(root,rhs)),log,typeof api.as3GetProperty(o,'amount')]});
 }
 log=[];rows.push({id:'wildcard-undefined',value:[observe(()=>a.wildcard(undefined,rhs)),log]});
 log=[];rows.push({id:'nested-null-root',value:[observe(()=>a.nested(null,rhs)),log]});

globalThis.result=rows;
