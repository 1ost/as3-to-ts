const assert=require('assert/strict'),path=require('path'),{compile,sources,hash}=require('./compile.cjs');
module.exports=(dir,target)=>{
 const result=[];
 for(const [name,qname,from,to,pattern] of [
 ['getter-needs-override','Child','override public function get container','public function get container',/matching nonfinal parent half/],
 ['new-setter-cannot-override','Child','public function set container','override public function set container',/matching nonfinal parent half/],
 ['final-getter','Base','public function get container','final public function get container',/matching nonfinal parent half/],
 ['return-type-mismatch','Child','get container():Sprite','get container():DisplayObject',/incompatible accessor half types|duplicate or incompatible|matching nonfinal parent half/],
 ['setter-type-mismatch','Grand','container(value:Sprite)','container(value:DisplayObject)',/matching nonfinal parent half/],
 ['base-cannot-override','Base','public function get container','override public function get container',/override without source public ancestor/]
 ]){
 const changed={...sources},key='cases.'+qname,source=sources[key].source;
 assert.equal(source.split(from).length,2);const altered=source.replace(from,to);changed[key]={source:altered,sourceSha256:hash(altered)};
 let error;try{compile(path.join(dir,name),target,changed);}catch(e){error=String(e.message);}
 assert.match(error||'',pattern,name);result.push({name,error,sourceSha256:hash(altered)});
 }
 return result;
};
