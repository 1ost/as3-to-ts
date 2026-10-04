package { public class FieldReadsProbe { public function snapshot():Object {return {ready:true,failure:"",observations:observe()};} private function observe():Array {
var rows:Array=[],s:FieldReads=new FieldReads();
s.reset([{value:7}],{entry:{value:9}});
rows.push({id:"field-size",value:s.size()});
rows.push({id:"field-explicit-size",value:s.explicitSize()});
rows.push({id:"field-shared-size",value:s.sharedSize()});
rows.push({id:"field-explicit-shared-size",value:s.explicitSharedSize()});
rows.push({id:"field-shadow",value:s.shadow([1,2,3])});
rows.push({id:"field-index",value:s.index(0)});
rows.push({id:"field-named",value:s.named("entry")});
try{s.index(4);}catch(e1:Error){rows.push({id:"field-missing-index",value:[e1.name,e1.errorID]});}
try{s.named("missing");}catch(e2:Error){rows.push({id:"field-missing-name",value:[e2.name,e2.errorID]});}
rows.push({id:"field-array-effect",value:[s.arrayEffect(),s.effects]});
try{s.size();}catch(e3:Error){rows.push({id:"field-null-size",value:[e3.name,e3.errorID]});}
try{s.explicitSize();}catch(e4:Error){rows.push({id:"field-null-explicit-size",value:[e4.name,e4.errorID]});}
rows.push({id:"field-object-effect",value:[s.objectEffect(),s.effects]});
try{s.named("entry");}catch(e5:Error){rows.push({id:"field-null-registry",value:[e5.name,e5.errorID]});}
s.reset([null],{entry:null});
try{s.index(0);}catch(e6:Error){rows.push({id:"field-null-element",value:[e6.name,e6.errorID]});}
try{s.named("entry");}catch(e7:Error){rows.push({id:"field-null-entry",value:[e7.name,e7.errorID]});}
s.reset(null,null);
try{s.sharedSize();}catch(e8:Error){rows.push({id:"field-null-shared",value:[e8.name,e8.errorID]});}
try{s.explicitSharedSize();}catch(e9:Error){rows.push({id:"field-null-explicit-shared",value:[e9.name,e9.errorID]});}
return rows;
} } }