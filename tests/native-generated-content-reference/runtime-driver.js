// Host observer supplies authentic native allocations; the complete Reader is emitted.
const Reader=load('nativeClass').readNativeClass(load('Reader').Reader);
const rows=[],add=(id,value)=>rows.push({id,value});
const r=new Reader(),group=new api.GroupElement();
const observe=(r,value)=>[
 r.castContentElement(value)===value,r.castContentElement(value)===null,r.isContentElement(value),
 r.castTextElement(value)===value,r.castTextElement(value)===null,r.isTextElement(value),
 r.castGroupElement(value)===value,r.castGroupElement(value)===null,r.isGroupElement(value),
 r.castGraphicElement(value)===value,r.castGraphicElement(value)===null,r.isGraphicElement(value)];
const values=[new api.TextElement('abc'),group,new api.GraphicElement(null,0,0),null,undefined,0,7,'bad',true,{},[],function(){}];
values.forEach((value,i)=>add('value-'+i,observe(r,value)));
let conversions=0;function convert(){conversions++;return new api.GroupElement();}
const object={valueOf:convert,toString:convert};
add('no-conversion',[observe(r,object),conversions]);
add('once',[r.castNext(group)===group,r.matchesNext(group),r.calls]);
add('once-null',[r.castNext(null)===null,r.matchesNext(undefined),r.calls]);
add('property',[r.entry({content:group})===group,r.entry({content:object})===null,r.entry({})===null,conversions]);
add('fresh',[new Reader().castGroupElement(group)===group,new Reader().isContentElement(group),r.calls]);
// Host-only controls: prototypes, constructor names and proxies cannot allocate native identity.
for(const name of ['ContentElement','TextElement','GroupElement','GraphicElement']){
 for(const fake of [Object.create(api[name].prototype),{constructor:api[name],name:'flash.text.engine::'+name}]){
  if(r['cast'+name](fake)!==null||r['is'+name](fake))throw Error('forged content accepted');
 }
}
let traps=0;const proxy=new Proxy(group,{get(){traps++;throw Error('get trap');},getPrototypeOf(){traps++;throw Error('prototype trap');}});
if(r.castGroupElement(proxy)!==null||r.isContentElement(proxy)||traps!==0)throw Error('proxy inspected');
globalThis.result=rows;
