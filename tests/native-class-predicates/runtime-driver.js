const get=n=>load('nativeClass').readNativeClass(load(n)[n]);
const Reader=consumerOnly?load('Reader').Reader:get('Reader'),Subject=get('Subject');
const Contract=load('declarationDomain')[declarationInterfaces.find(i=>i.qname==='cases.Contract').tokenExport];
const reader=new Reader(),subject=new Subject(),rows=[];
const host={ordinary(){}};api.bindAS3Method(host,'ordinary',0);
const values=[Subject,Contract,Object,Array,Number,String,Boolean,api.AS3Int,api.AS3Uint,api.AS3ClassType,Function,
 function(){},host.ordinary,subject.method,subject,null,undefined,{},[],42,'x',true];
const ids=['source-class','source-interface','Object','Array','Number','String','Boolean','int','uint','Class','Function',
 'function','method','bound-method','instance','null','undefined','object','array','number','string','boolean'];
for(let i=0;i<values.length;i++){
 const value=values[i],cast=reader.cast(value);
 rows.push({id:ids[i],value:[reader.check(value),cast===value,cast===null,reader.wildcard(value),reader.negate(value)]});
}
const log=[];rows.push({id:'evaluation-order',value:[reader.evaluate(()=>{log.push('get');return Subject;},log),log]});
// Host-only controls: public labels do not grant source Class identity.
let reads=0;
const lookalike={get constructor(){reads++;return Subject;}};
function namedFunction() {}
Object.defineProperty(namedFunction,'name',{value:'Subject'});
let unregistered=false;
try {reader.check(class Unregistered {});} catch(error) {unregistered=String(error).includes('AS3_CLASS_UNSUPPORTED');}
const controls=[reader.check(lookalike)===false&&reads===0,reader.cast(lookalike)===null&&reads===0,
 reader.check(namedFunction)===false&&reader.cast(namedFunction)===null,unregistered];
if(!controls.every(Boolean))throw Error('Class predicate host controls failed: '+JSON.stringify(controls));
globalThis.result=rows;
