// Separate observer; full Base/Record source classes are emitted unchanged.
const nc=load('nativeClass'),api=load('NativeObjectCodec'),dates=load('AS3Date'),p=load('AS3Property'),Record=nc.readNativeClass(load('Record').Record);
const clone=v=>api.decodeNativeObject(api.encodeNativeObject(v)),rows=[],row=(id,value)=>rows.push({id,value});
const times=[1234567,-1234567,0,NaN,8640000000000000];
times.forEach((time,i)=>{const date=new dates.AS3Date(time),copy=clone(date);row('date-'+i,[copy!==date,dates.isFlashDate(copy),Number.isNaN(copy.time)?'NaN':copy.time]);});
const date=new dates.AS3Date(42),graph=clone({a:date,b:date});row('date-shared',[graph.a===graph.b,graph.a!==date,dates.isFlashDate(graph.a),graph.a.time]);
date.extra=3;const copied=clone(date);row('date-dynamic',[copied.time,Object.hasOwn(copied,'extra')]);
const r=new Record();r.child={nested:2};p.as3SetProperty(r,'extra',11);p.as3SetProperty(r,'alias',r.child);p.as3SetProperty(r,'self',r);Record.events=[];
const result=clone(r);row('record-fields',[result instanceof Record,result.value,result.baseValue,result.child.nested,result.extra,result.alias===result.child,result.self===result]);
row('record-trait-selection',['fixed','hidden','protectedValue','method','pair','readOnly','writeOnly'].map(key=>Object.hasOwn(result,key)));
row('record-accessors',[result.pair,Record.events]);row('record-keys',Object.keys(result).sort());row('record-const',Object.hasOwn(result,'fixed')?result.fixed:null);
globalThis.result=rows;
