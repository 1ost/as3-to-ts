// Separate observer; all three subject implementations come from complete AS3.
const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const JSONParseError=klass('JSONParseError'),Child=klass('Child'),Entry=klass('Entry');
const rows=[],row=(id,value)=>rows.push({id,value}),get=(object,key)=>api.as3GetProperty(object,key);
const inspect=e=>[get(e,'name'),get(e,'message'),get(e,'errorID'),get(e,'location'),get(e,'text'),api.as3IsSourceErrorInstance(e),api.as3Is(e,JSONParseError),api.getQualifiedClassName(e)];
row('default',inspect(new JSONParseError()));
row('undefined',inspect(new JSONParseError(undefined,undefined,undefined)));
row('null',inspect(new JSONParseError(null,null,null)));
row('strings',inspect(new JSONParseError('message',-2.9,'source')));
row('numeric',inspect(new JSONParseError(17,7.9,17)));
const child=new Child('child',4,'json');row('child',inspect(child));row('child-is',[api.as3Is(child,Child),api.as3Is(child,JSONParseError),api.as3IsSourceErrorInstance(child)]);
const object=api.as3CreateDynamicObject(),entry=new Entry(object,7.9);
row('entry-before',entry.before);row('entry-before-exact',[entry.before[0]===undefined,entry.before[0]===null,entry.before[1]===undefined,entry.before[1]===null,entry.before[2]===0]);
row('entry-after',[entry.after[0],entry.after[1]===object,entry.after[2]]);row('entry-replace',entry.replace(null,17));
try{entry.raise();row('catch','not-thrown');}catch(error){if(!api.as3IsSourceErrorInstance(error))throw error;row('catch',[error===entry,api.as3Is(error,Entry),get(error,'name'),get(error,'message'),get(error,'errorID')]);}
const values=[new Entry(undefined,undefined),new Entry(null,null),new Entry('text','12'),new Entry(17,-2.9)];
values.forEach((value,index)=>row('entry-value-'+index,value.inspect()));
const dynamicValue=new JSONParseError('fixed',5,'text');
try{api.as3SetProperty(dynamicValue,'extra',9);row('sealed','accepted');}catch(e){row('sealed',[get(e,'name'),get(e,'errorID')]);}
try{api.as3SetProperty(dynamicValue,'errorID',9);row('readonly','accepted');}catch(e){row('readonly',[get(e,'name'),get(e,'errorID'),get(dynamicValue,'errorID')]);}
row('delete',[api.as3DeleteProperty(dynamicValue,'message'),api.as3DeleteProperty(dynamicValue,'location')]);
row('keys',[api.as3HasOwnProperty(dynamicValue,'message'),api.as3HasOwnProperty(dynamicValue,'location'),api.as3CallValue(get(dynamicValue,'propertyIsEnumerable'),()=>['message']),api.as3CallValue(get(dynamicValue,'propertyIsEnumerable'),()=>['location'])]);
row('strings-rendered',[api.as3String(new JSONParseError()),api.as3String(new JSONParseError('bad')),api.as3String(child)]);
const prototype=api.getAS3SourceErrorPrototype(),previousName=get(prototype,'name');
try{api.as3SetProperty(prototype,'name','renamed');row('prototype-name',inspect(new JSONParseError('message',2,'source')));}finally{api.as3SetProperty(prototype,'name',previousName);}
try{const id={valueOf(){api.as3SetProperty(prototype,'name','during-id');return 8.9;}};row('id-conversion-order',new Entry('message',id).inspect());}finally{api.as3SetProperty(prototype,'name',previousName);}
globalThis.result=rows;
