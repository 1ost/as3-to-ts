const get=n=>load('nativeClass').readNativeClass(load(n)[n]);
const Reader=consumerOnly?load('Reader').Reader:get('Reader'),Subject=get('Subject');
const Contract=load('declarationDomain')[declarationInterfaces.find(i=>i.qname==='cases.Contract').tokenExport];
const reader=new Reader(),rows=[],marker={marker:true};let log=[];
const host={method(){}};
// Adapter for the exact retained probe's private method, independent of the emitted Reader.
const method=api.getBoundAS3Method(host,'method',host.method,'ConstructionProbe/method');
const values=[Subject,Contract,Object,Array,Number,String,Boolean,api.AS3Int,api.AS3Uint,api.AS3ClassType,Function,
 function(){},method,new Subject(),null,undefined,{},[],42,'x',true];
const ids=['subject','interface','Object','Array','Number','String','Boolean','int','uint','Class','Function',
 'function','method','instance','null','undefined','object','array','number','string','boolean'];
function observe(action){
 try{
  const value=action();
  if(value instanceof Subject)return ['subject',value.value===marker,value.value===null];
  if(Array.isArray(value))return ['array',value.length];
  if(['number','string','boolean'].includes(typeof value))return [typeof value,String(value)];
  if(typeof value==='function')return ['function'];
  return ['object',value===marker,value!==null];
 }catch(e){const kind=api.getAS3SourceErrorClassName(e),source=api.as3IsSourceErrorInstance(e);
  return ['thrown',e===marker,source,kind==='TypeError',kind==='ArgumentError',kind==='VerifyError',source?e.errorID:0,source?e.message:''];}
}
for(let i=0;i<values.length;i++){log=[];const outcome=observe(()=>reader.create(values[i]));rows.push({id:ids[i],value:[outcome,log]});}
for(const index of [0,1,9,12,14,18]){log=[];
 const outcome=observe(()=>reader.selected(()=>{log.push('select');return values[index];},()=>{log.push('argument');return marker;}));
 rows.push({id:ids[index]+'-order',value:[outcome,log]});
}
log=[];let outcome=observe(()=>reader.selected(()=>{log.push('select-throw');throw marker;},()=>{log.push('argument');return marker;}));
rows.push({id:'select-throw',value:[outcome,log]});
log=[];outcome=observe(()=>reader.selected(()=>{log.push('select');return Subject;},()=>{log.push('argument-throw');throw marker;}));
rows.push({id:'argument-throw',value:[outcome,log]});
for(const name of ['throw','return']){log=[];
 const ctor=name==='throw'?function(value){log.push('constructor');throw marker;}:function(value){log.push('constructor');return value;};
 outcome=observe(()=>reader.selected(()=>{log.push('select');return ctor;},()=>{log.push('argument');return marker;}));
 rows.push({id:'constructor-'+name,value:[outcome,log]});
}
globalThis.result=rows;
