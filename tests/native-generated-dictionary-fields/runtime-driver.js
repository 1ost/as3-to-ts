// Separate observer; both complete source subjects are emitted unchanged.
const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const rows=[],subject=new (klass('Child'))();
const get=(o,k)=>api.as3GetProperty(o,k),obj=()=>api.as3CreateDynamicObject();
for(const prefix of ['private','protected','public','bare','inherited']){
 const a=obj(),b=obj(),value=obj();
 const invoke=(suffix,...args)=>api.as3CallValue(get(subject,prefix+suffix),()=>args);
 rows.push({id:prefix+'-missing',value:[invoke('Read',a)===undefined,invoke('Has',a)]});
 rows.push({id:prefix+'-identity',value:[invoke('Put',a,value)===value,invoke('Read',a)===value,invoke('Read',b)===undefined,invoke('Has',a),invoke('Has',b)]});
 rows.push({id:prefix+'-delete',value:[invoke('Remove',a),invoke('Read',a)===undefined,invoke('Has',a),invoke('Remove',a)]});
 rows.push({id:prefix+'-null',value:[invoke('Put',null,17),invoke('Read',null),invoke('Read','null')]});
 rows.push({id:prefix+'-number',value:[invoke('Put',3,'three'),invoke('Read','3'),invoke('Has',3)]});
 invoke('Put','sum',4);rows.push({id:prefix+'-addition',value:[invoke('Add','sum','x'),invoke('Read','sum')]});
 invoke('Put','fn',get(subject,'plus'));rows.push({id:prefix+'-call',value:invoke('Call','fn',5)});
 rows.push({id:prefix+'-method-key',value:[invoke('Put','get',19),invoke('Read','get'),invoke('Has','get'),invoke('Remove','get')]});
}
rows.push({id:'switch-put',value:subject.switchPut(obj(),obj())});
rows.push({id:'switch-add',value:subject.switchAdd(obj())});
rows.push({id:'switch-call',value:subject.switchCall()});
rows.push({id:'switch-key',value:subject.switchKey()});
rows.push({id:'addition-key-count',value:subject.addKey()});
rows.push({id:'addition-getter-count',value:subject.addGetter()});
const shadow=obj();api.as3SetProperty(shadow,'name','public');rows.push({id:'shadow',value:subject.shadow(shadow,'name')});
globalThis.result=rows;
