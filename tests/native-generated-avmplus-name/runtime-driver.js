// Observer only; both captured classes are emitted unchanged.
const get=name=>load('nativeClass').readNativeClass(load(name)[name]);
const NameConsumer=get('NameConsumer'),NamedValue=get('NamedValue'),instance=new NamedValue();
const rows=[{id:'identity',value:api.avmplusGetQualifiedClassName===api.getQualifiedClassName}];
const pair=value=>[NameConsumer.className(value),api.getQualifiedClassName(value)];
const method=api.as3GetProperty(instance,'method');
for(const [id,value] of [['class',NamedValue],['instance',instance],['null',null],['undefined',undefined],['integer',7],['uint',4294967295],['fraction',1.5],['string','a'],['boolean',true],['array',[]],['object',api.as3CreateDynamicObject()],['function',method],['date',new api.AS3Date(0)],['error',api.as3CreateError('a')]])rows.push({id,value:pair(value)});
globalThis.result=rows;
