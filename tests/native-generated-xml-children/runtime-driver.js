// Observer only: complete ChildrenReader AS3 supplies all tested subject methods.
const Reader=load('nativeClass').readNativeClass(load('ChildrenReader').ChildrenReader);
const reader=new Reader(),rows=[],row=(id,value)=>rows.push({id,value});
row('attributes',reader.attributes(new api.XML('<root id="12"/>')));
row('missing',reader.attributes(new api.XML('<root/>')));
row('special',reader.attributes(new api.XML('<root id="&amp;&lt;&gt;&quot;&apos;"/>')));
for(const numeric of ['2.75','4294967295','4294967296','-4294967297','0x10','Infinity'])row('int-'+numeric,reader.attributes(new api.XML('<root id="'+numeric+'"/>')));
row('children',reader.children(new api.XML('<root><x id="first"/><y id="second"/></root>')));
row('empty',reader.children(new api.XML('<root/>')));
const mixed=new api.XML('<root>before<x id="x"/><!--note--><![CDATA[raw<&]]><y id="y"/> after</root>');
row('mixed',reader.children(mixed));
row('nested',reader.nested(new api.XML('<root><g id="1"><x id="a"/><x id="b"/></g><g id="2"/><g id="3"><x id="c"/></g></root>')));
const seed=new api.XML('<seed id="seed"/>');
row('control',reader.control(new api.XML('<root><x id="one"/><x id="skip"/><x id="stop"/><x id="after"/></root>'),seed));
row('control-empty',reader.control(new api.XML('<root/>'),seed));
for(const [id,fn] of [['null-attribute',()=>reader.attributes(null)],['null-children',()=>reader.children(null)]]){
 try{fn();throw Error('accepted null');}catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;row(id,[e.name,e.errorID]);}
}
const original=mixed.children(),again=mixed.children();
row('name-element',reader.name(original.at(1)));
for(const i of [0,2,3]){try{reader.name(original.at(i));throw Error('accepted nameless node');}catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;row('name-leaf-'+i,[e.name,e.errorID]);}}
row('child-nodes',original.toArray().map((child,i)=>[child.nodeKind(),child.localName(),child.toString(),child.toXMLString(),child.parent()===mixed,child.childIndex(),child===again.at(i),child.copy().parent()===null]));
row('list-identity',[original===again,original.length,mixed.elements().length]);
globalThis.result=rows;
