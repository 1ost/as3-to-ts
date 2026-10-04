const read=load('nativeClass').readNativeClass,Base=read(load('Base').Base),Child=read(load('Child').Child);
const a=new Base(),b=new Base(),c=new Child(),d=new Child(),rows=[];
rows.push({id:'initial',value:a.read(b)});a.setValue(true);
rows.push({id:'changed',value:a.read(b)});rows.push({id:'same',value:a.read(a)});
rows.push({id:'child-base',value:c.read(d)});c.setValue(true);
rows.push({id:'child-base-changed',value:c.read(d)});
rows.push({id:'child-private',value:c.own(d)});c.change();
rows.push({id:'child-private-changed',value:c.own(d)});
rows.push({id:'child-base-preserved',value:c.read(c)});globalThis.result=rows;
