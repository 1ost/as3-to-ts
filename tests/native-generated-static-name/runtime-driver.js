// Observer only; all three captured classes are emitted unchanged.
const get=name=>load('nativeClass').readNativeClass(load(name)[name]);
const NameConsumer=get('NameConsumer'),NamedValue=get('NamedValue'),instance=new NamedValue();
const rows=[{id:'identity',value:api.avmplusGetQualifiedClassName===api.getQualifiedClassName}];
const pair=value=>[NameConsumer.name(value),api.getQualifiedClassName(value)];
const method=api.as3GetProperty(instance,'method');
for(const [id,value] of [['class',NamedValue],['instance',instance],['null',null],['undefined',undefined],['integer',7],['uint',4294967295],['fraction',1.5],['string','a'],['boolean',true],['array',[]],['object',api.as3CreateDynamicObject()],['function',method],['date',new api.AS3Date(0)],['error',api.as3CreateError('a')]])rows.push({id,value:pair(value)});
const NameChild=get('NameChild'),alias=api.as3GetProperty(NameConsumer,'name');
const invoke=(fn,args)=>{try{return api.getAS3FunctionIntrinsic(fn,'apply')(null,args);}catch(e){return [e.name,e.errorID];}};
rows.push({id:'consumer-class',value:pair(NameConsumer)}, {id:'consumer-instance',value:pair(new NameConsumer())},
 {id:'forwarded',value:NameConsumer.forwarded(new NamedValue())},
 {id:'child-static',value:NameChild.identify(new NameChild())},
 {id:'child-instance',value:new NameChild().identifyInstance(NameChild)},
 {id:'static-alias',value:invoke(alias,[NameConsumer])},
 {id:'static-alias-identity',value:alias===api.as3GetProperty(NameConsumer,'name')},
 {id:'static-alias-no-args',value:invoke(alias,[])},
 {id:'static-alias-extra-args',value:invoke(alias,[null,null])},
 {id:'child-parent',value:new NameChild() instanceof NameConsumer});
globalThis.result=rows;
