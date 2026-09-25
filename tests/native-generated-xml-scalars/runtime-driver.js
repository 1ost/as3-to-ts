// Observer only: all subject operations execute complete emitted ScalarReader source.
const Reader=load('nativeClass').readNativeClass(load('ScalarReader').ScalarReader);
const reader=new Reader(),rows=[],row=(id,value)=>rows.push({id,value});
const inputs=['<root/>','<root>value&amp;&lt;</root>','<root><x>a</x><y/></root>'];
inputs.forEach((text,i)=>row('element-'+i,reader.read(new api.XML(text))));
const mixed=new api.XML('<root id="a&amp;b">before<x>value</x><!--note--><![CDATA[raw<&]]><y/> after</root>');
row('attribute',reader.read(mixed.attribute('id').at(0)));
row('children',reader.children(mixed));row('empty',reader.children(new api.XML('<root/>')));
try{reader.read(null);throw Error('accepted null');}catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;row('null',[e.name,e.errorID]);}
globalThis.result=rows;
