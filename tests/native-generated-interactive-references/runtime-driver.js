const nc=load('nativeClass');
const Reader=consumerOnly?load('Reader').Reader:nc.readNativeClass(load('Reader').Reader);
class SpriteChild extends api.Sprite {}
const rows=[],values=[new api.MovieClip(),new api.Sprite(),new SpriteChild(),new api.TextField(),new api.Shape(),new api.EventDispatcher(),null,undefined,{},[],7,api.InteractiveObject.prototype];
for(let i=0;i<values.length;i++){
 const value=values[i],r=new Reader(value),before=r.calls,matches=r.test(value),cast=r.cast(value);
 rows.push({id:'identity-'+i,value:[matches,cast===value,cast===null,r.calls-before,r.saved===value,r.saved===null]});
 try{const slot=r.coerce(value);rows.push({id:'coerce-'+i,value:[slot===value,slot===null]});}
 catch(error){rows.push({id:'coerce-'+i,value:[error.name,error.errorID,api.as3IsSourceErrorInstance(error)]});}
 const beforeReturn=r.calls;
 try{const slot=r.returned(value);rows.push({id:'return-'+i,value:[slot===value,slot===null,r.calls-beforeReturn]});}
 catch(error){rows.push({id:'return-'+i,value:[error.name,error.errorID,api.as3IsSourceErrorInstance(error),r.calls-beforeReturn]});}
}
let traps=0;const r=new Reader();
const forged=[Object.create(api.InteractiveObject.prototype),{constructor:api.InteractiveObject},new Proxy(values[0],{get(){traps++;throw Error('get');},getPrototypeOf(){traps++;throw Error('prototype');}})];
for(const value of forged){
 if(r.test(value)!==false||r.cast(value)!==null)throw Error('forged InteractiveObject identity');
 let caught;try{r.coerce(value);}catch(error){caught=error;}
 if(!caught||caught.errorID!==1034||!api.as3IsSourceErrorInstance(caught))throw Error('forged coercion accepted');
}
if(traps!==0)throw Error('host value inspected');
globalThis.result=rows;
