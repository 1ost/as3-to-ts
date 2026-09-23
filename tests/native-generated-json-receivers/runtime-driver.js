// Observer only; Reader and JSONToken are complete authenticated AS3 subjects.
const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const Reader=klass('Reader'),JSONToken=klass('JSONToken');
const rows=[],row=(id,value)=>rows.push({id,value});
const reader=new Reader(new JSONToken(7,'public'));
row('receiver-read',reader.read());
row('receiver-write',reader.write('changed'));
row('receiver-parameter',reader.parameter(new JSONToken(8,'argument')));
row('receiver-null-value',reader.write(null));
reader.replace(null);
try {reader.read();row('receiver-null','accepted');}
catch(error){row('receiver-null',[api.as3GetProperty(error,'name'),api.as3GetProperty(error,'errorID')]);}
globalThis.result=rows;
