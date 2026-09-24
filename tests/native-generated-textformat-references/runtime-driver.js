const nc=load('nativeClass');
const Reader=consumerOnly?load('Reader').Reader:nc.readNativeClass(load('Reader').Reader);
class FormatChild extends api.TextFormat {}
const rows=[],r=new Reader(),values=[new api.TextFormat(),new FormatChild(),{},[],null,undefined,7,'abc',true,api.TextFormat.prototype];
for(let i=0;i<values.length;i++){
 const value=values[i],before=r.calls,matches=r.test(value),cast=r.cast(value);
 rows.push({id:'identity-'+i,value:[matches,cast===value,cast===null,r.calls-before]});
 try{const slot=r.coerce(value);rows.push({id:'coerce-'+i,value:[slot===value,slot===null]});}
 catch(error){rows.push({id:'coerce-'+i,value:[error.name,error.errorID,api.as3IsSourceErrorInstance(error)]});}
 rows.push({id:'style-'+i,value:[r.unchanged(value,value),r.unchanged({},value)]});
}
let traps=0;
const forged=[Object.create(api.TextFormat.prototype),{constructor:api.TextFormat},new Proxy(values[0],{get(){traps++;throw Error('get');},getPrototypeOf(){traps++;throw Error('prototype');}})];
for(const value of forged){
 if(r.test(value)!==false||r.cast(value)!==null)throw Error('forged TextFormat identity');
 let caught;try{r.coerce(value);}catch(error){caught=error;}
 if(!caught||caught.errorID!==1034||!api.as3IsSourceErrorInstance(caught))throw Error('forged coercion accepted');
}
if(traps!==0)throw Error('host value inspected');
globalThis.result=rows;
