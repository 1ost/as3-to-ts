// Observer only: all tested method bodies come from the complete AS3 Reader.
const Reader=load('nativeClass').readNativeClass(load('Reader').Reader);
const reader=new Reader(),rows=[],row=(id,value)=>rows.push({id,value});
const xmlDocument=new api.XML('<type name="Example"><variable name="first"/><method name="ignored"/><accessor name="second"/><factory><variable name="nested"/></factory></type>');
const values=[xmlDocument,new api.XMLList(),new api.XMLList([new api.XML('<one/>')]),new api.XMLList([new api.XML('<one/>'),new api.XML('<two/>')]),null,undefined,'<one/>',api.as3CreateDynamicObject(),api.XML.prototype,api.XMLList.prototype];
const caught=(id,operation)=>{try{row(id,operation());}catch(error){if(!api.as3IsSourceErrorInstance(error))throw error;row(id,[error.name,error.errorID]);}};
values.forEach((value,i)=>{caught('xml-'+i,()=>reader.coerce(value));caught('list-'+i,()=>reader.list(value));});
row('assign-xml',reader.assign(xmlDocument));row('assign-null',reader.assign(null));row('assign-undefined',reader.assign(undefined));
row('attributes',reader.attributes(xmlDocument));row('missing',reader.attributes(new api.XML('<type/>')));
row('selected',reader.selected(xmlDocument));
const lookup=api.as3CreateDynamicObject();for(const [key,value] of [['first',11],['second',22],['nested',33]])api.as3SetProperty(lookup,key,value);
row('lookup',reader.lookup(xmlDocument,lookup));row('empty-selected',reader.selected(new api.XML('<type/>')));
caught('null-attribute',()=>reader.attributes(null));caught('null-descendants',()=>reader.selected(null));
globalThis.result=rows;
