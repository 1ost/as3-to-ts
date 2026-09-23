// Separate observer; full Base/Record source classes are emitted unchanged.
const nc=load('nativeClass'),codec=load('NativeObjectCodec'),dates=load('AS3Date'),p=load('AS3Property'),Record=nc.readNativeClass(load('Record').Record);
const clone=v=>codec.decodeNativeObject(codec.encodeNativeObject(v)),rows=[],row=(id,value)=>rows.push({id,value});
const times=[1234567,-1234567,0,NaN,8640000000000000];
times.forEach((time,i)=>{const date=new dates.AS3Date(time),copy=clone(date);row('date-'+i,[copy!==date,dates.isFlashDate(copy),Number.isNaN(copy.time)?'NaN':copy.time]);});
const date=new dates.AS3Date(42),graph=clone({a:date,b:date});row('date-shared',[graph.a===graph.b,graph.a!==date,dates.isFlashDate(graph.a),graph.a.time]);
date.extra=3;const copied=clone(date);row('date-dynamic',[copied.time,Object.hasOwn(copied,'extra')]);
const r=new Record();r.child={nested:2};p.as3SetProperty(r,'extra',11);p.as3SetProperty(r,'alias',r.child);p.as3SetProperty(r,'self',r);Record.events=[];
const result=clone(r);row('record-fields',[result instanceof Record,result.value,result.baseValue,result.child.nested,result.extra,result.alias===result.child,result.self===result]);
row('record-trait-selection',['fixed','hidden','protectedValue','method','pair','readOnly','writeOnly'].map(key=>Object.hasOwn(result,key)));
row('record-accessors',[result.pair,Record.events]);row('record-keys',Object.keys(result).sort());row('record-const',Object.hasOwn(result,'fixed')?result.fixed:null);
globalThis.result=rows;

// Host boundary controls are separate from AIR comparisons and do not alter subjects.
Record.events=[];
let guards=0;const rejects=fn=>{let thrown=false;try{fn();}catch(e){thrown=true;}if(!thrown)throw Error('expected provider rejection');guards++;};
rejects(()=>clone(Object.create(Record.prototype)));
const overlaid=new Record();Object.defineProperty(overlaid,'hostOnly',{get(){throw Error('host accessor');},enumerable:true});
if(Object.hasOwn(clone(overlaid),'hostOnly'))throw Error('host descriptor leaked');guards++;
const token={},throwing=new Record(),events=Record.events;Record.events=[];Record.events.push=function(){throw token;};
let same=false;try{clone(throwing);}catch(e){same=e===token;}finally{Record.events=events;}if(!same)throw Error('source getter throw changed');guards++;
result.child.nested=99;if(r.child.nested!==2||result.alias.nested!==99)throw Error('clone alias isolation');guards++;
load('ClassAlias').registerClassAlias('clonecase-qualified-host-guard',Record);rejects(()=>clone(new Record()));
if(guards!==5)throw Error('clone guards');globalThis.cloneGuards=guards;
