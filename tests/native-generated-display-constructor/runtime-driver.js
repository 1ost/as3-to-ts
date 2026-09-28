const Reader=load('nativeClass').readNativeClass(load('Reader').Reader);
const rows=[],values=[new api.MovieClip(),new api.Sprite(),new api.Shape(),new api.TextField(),new api.EventDispatcher(),null,undefined,{},[],7,api.DisplayObject.prototype];
for(let i=0;i<values.length;i++){
 const value=values[i];try{const r=new Reader(value);rows.push({id:"value-"+i,value:[r.saved===value,r.saved===null,r.label]});}
 catch(e){rows.push({id:"value-"+i,value:[e.name,e.errorID]});}
}
const r=new Reader(null,undefined);rows.push({id:"undefined-label",value:[r.saved===null,r.label]});
try{new Reader();}catch(e){rows.push({id:"missing",value:[e.name,e.errorID]});}
let traps=0;
for(const value of [Object.create(api.DisplayObject.prototype),{constructor:api.DisplayObject},new Proxy(values[0],{get(){traps++;throw Error('get');},getPrototypeOf(){traps++;throw Error('prototype');}})]) {
 let caught;try{new Reader(value);}catch(e){caught=e;}
 if(!caught||caught.errorID!==1034)throw Error('forged constructor argument admitted');
}
if(traps)throw Error('host inspected');
globalThis.result=rows;
