const assert=require('node:assert/strict'),path=require('node:path'),api=require('../../lib');
const {compile,sources,hash}=require('./compile.cjs');
module.exports=(dir,target,config)=>{
 const rows=[],reject=(name,fn)=>{let error;try{fn();}catch(e){error=e.message;}assert.match(error||'',/AS3_[A-Z_]+UNSUPPORTED/,name);rows.push({name,error});};
 for(const [name,plan]of [['copied-plan',{...config.plan}],['serialized-plan',JSON.parse(JSON.stringify(config.plan))]])reject(name,()=>api.emitNativeSourceClassModule({...config,plan}));
 for(const [name,q,from,to]of [
  ['setter-needs-override','Child','override public function set','public function set'],
  ['getter-needs-override','Grand','override public function get','public function get'],
  ['setter-type-mismatch','Child','set value(item:Data)','set value(item:Other)'],
  ['getter-type-mismatch','Grand','get value():Data','get value():Other'],
  ['final-setter','Base','public function set','final public function set'],
  ['final-getter','Base','public function get','final public function get'],
  ['base-cannot-override','Base','public function get','override public function get'],
  ['duplicate-getter','Grand','return super.value;}','return super.value;} override public function get value():Data{return super.value;}']
 ]){const key='cases.'+q,old=sources[key].source;assert(old.includes(from));const source=old.replace(from,to);reject(name,()=>compile(path.join(dir,name),target,{...sources,[key]:{source,sourceSha256:hash(source)}}));}
 return rows;
};
