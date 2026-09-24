const get=n=>load('nativeClass').readNativeClass(load(n)[n]);
const Reader=consumerOnly?load('Reader').Reader:get('Reader'),Root=get('Root'),Domain=get('Domain');
const reader=new Reader(),marker={},rows=[];let log=[],selectedValue;
const argument=()=>{log.push('argument');return marker;},select=()=>{log.push('select');return selectedValue;};
const failArgument=()=>{log.push('argument-throw');throw marker;},failSelect=()=>{log.push('select-throw');throw marker;};
function observe(action){
 try{const value=action();if(value===undefined)return ['undefined'];if(value===null)return ['null'];if(value===marker)return ['marker'];
  if(typeof value==='string')return ['string',value];return ['object'];
 }catch(e){const source=api.as3IsSourceErrorInstance(e),kind=api.getAS3SourceErrorClassName(e);
  return ['thrown',e===marker,source,kind==='TypeError',kind==='ReferenceError',source?e.errorID:0,source?e.message:''];}
}
const good={getDefinition:function(value){log.push('call:'+(this===good)+':'+(value===marker));return value;}};
const values=[null,undefined,{}, {applicationDomain:null},{applicationDomain:undefined},{applicationDomain:{}},
 {applicationDomain:{getDefinition:null}},{applicationDomain:{getDefinition:42}},{applicationDomain:good},42,'x',true];
const ids=['null','undefined','missing','domain-null','domain-undefined','method-missing','method-null','method-number','success','number','string','boolean'];
for(let i=0;i<values.length;i++){
 selectedValue=api.as3CoerceObject(values[i]);log=[];let result=observe(()=>reader.lookup(selectedValue,argument));rows.push({id:ids[i],value:[result,log]});
 log=[];result=observe(()=>reader.recover(selectedValue,argument));rows.push({id:ids[i]+'-recover',value:[result,log]});
}
const root=new Root(),domain=new Domain();root.value=domain;
domain.value=value=>{log.push('call:'+(value===marker));return value;};selectedValue=root;
const record=(id,action)=>{log=[];root.log=log;domain.log=log;rows.push({id,value:[observe(action),log]});};
record('getters-order',()=>reader.selected(select,argument));
domain.failure=marker;record('method-get-throw',()=>reader.selected(select,argument));
record('argument-before-method-throw',()=>reader.selected(select,failArgument));
domain.failure=null;root.failure=marker;record('root-get-throw',()=>reader.selected(select,argument));
record('select-throw',()=>reader.selected(failSelect,argument));
root.failure=null;domain.value=()=>{log.push('call-throw');throw marker;};record('call-throw',()=>reader.selected(select,argument));
globalThis.result=rows;
