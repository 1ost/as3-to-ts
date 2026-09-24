const nc=load('nativeClass');
const Reader=consumerOnly?load('Reader').Reader:nc.readNativeClass(load('Reader').Reader);
class MovieChild extends api.MovieClip {}
const rows=[],values=[new api.MovieClip(),new MovieChild(),new api.Sprite(),new api.Shape(),new api.EventDispatcher(),null,undefined,{},[],7,api.MovieClip.prototype];
for(let i=0;i<values.length;i++){
 const value=values[i],r=new Reader(value),before=r.calls,matches=r.test(value),cast=r.cast(value);
 rows.push({id:'identity-'+i,value:[matches,cast===value,cast===null,r.calls-before,r.saved===value,r.saved===null]});
 try{const slot=r.coerce(value);rows.push({id:'coerce-'+i,value:[slot===value,slot===null]});}
 catch(error){rows.push({id:'coerce-'+i,value:[error.name,error.errorID,api.as3IsSourceErrorInstance(error)]});}
}
let traps=0;const r=new Reader();
const forged=[Object.create(api.MovieClip.prototype),{constructor:api.MovieClip},new Proxy(values[0],{get(){traps++;throw Error('get');},getPrototypeOf(){traps++;throw Error('prototype');}})];
for(const value of forged){
 if(r.test(value)!==false||r.cast(value)!==null)throw Error('forged MovieClip identity');
 let caught;try{r.coerce(value);}catch(error){caught=error;}
 if(!caught||caught.errorID!==1034||!api.as3IsSourceErrorInstance(caught))throw Error('forged coercion accepted');
}
if(traps!==0)throw Error('host value inspected');
globalThis.result=rows;
