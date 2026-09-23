const fs=require('fs'),path=require('path'),assert=require('assert');
const compiler=path.resolve(__dirname,'../compiler-super-method/candidate'),parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit'));
const root='package held { public class Root {public function Root(){} public function target():Boolean{return true;} } }';
const rows=[];
for(const [name,shadow] of [['field','public var target:Function;'],['getter','public function get target():Function{return null;}'],['private','private function target():Boolean{return false;}'],['static','public static function target():Boolean{return false;}']]){
 const sources={'held.Root':root,'held.Base':'package held {public class Base extends Root {public function Base(){super();} '+shadow+'}}','held.Child':'package held {public class Child extends Base {public function Child(){super();} public function run():Boolean{return super.target();}}}'};
 const source=sources['held.Child'];
 assert.throws(()=>emit(parse('Child.as',source),source,{customVisitors:[],definitionsByNamespace:{},nativeClassInitialization:{classes:Object.fromEntries(Object.keys(sources).map(key=>[key,'lazy']))},nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableClasses:sources}),e=>{rows.push({name,error:String(e)});return String(e).includes('AS3_CALLABLE_CLASS_UNSUPPORTED');});
}
fs.writeFileSync(path.join(__dirname,'rejections.json'),JSON.stringify({scope:'conservative unsupported-shape rejection, not AS3 source validity evidence',rows},null,2));console.log(JSON.stringify(rows));
