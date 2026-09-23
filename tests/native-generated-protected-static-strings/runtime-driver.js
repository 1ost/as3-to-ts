const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const StaticStrings=klass('StaticStrings'),DerivedStrings=klass('DerivedStrings'),ValueSpy=klass('ValueSpy');
var rows=[],derived=new DerivedStrings();
rows.push({id:"initial",value:[StaticStrings.before,StaticStrings.changed,StaticStrings.after,StaticStrings.read(),derived.inherited()]});
var values=["changed",null,undefined,17,true,new ValueSpy()];
for(var i=0;i<values.length;i++){
 var result=StaticStrings.write(values[i]);
 rows.push({id:"write:"+i,value:[result===values[i],StaticStrings.read(),derived.inherited()]});
}
rows.push({id:"spy-calls",value:values[5].calls});
rows.push({id:"inherited-write",value:[derived.replace("inherited"),StaticStrings.read(),new DerivedStrings().inherited()]});
rows.push({id:"named",value:StaticStrings.named("TEXT")});
var spy=new ValueSpy(),written=StaticStrings.writeNamed("TEXT",spy);
rows.push({id:"named-write",value:[written===spy,spy.calls,StaticStrings.read()]});
rows.push({id:"remove",value:[StaticStrings.remove("TEXT"),StaticStrings.read()]});
var hidden=api.as3GetProperty(StaticStrings,"TEXT");
rows.push({id:"external",value:[hidden===undefined,hidden===null]});
globalThis.result=rows;
