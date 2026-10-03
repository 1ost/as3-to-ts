'use strict';
const assert=require('assert/strict'),path=require('path'),api=require('../../lib');
const {compile,sources,hash}=require('./compile.cjs');
module.exports=(dir,target,config)=>{
 const results=[];
 const reject=(name,action)=>{let error;try{action();}catch(e){error=String(e.message);}assert.match(error||'',/AS3_[A-Z_]+UNSUPPORTED/,name);results.push({name,error});};
 for(const [name,plan]of [['copied-plan',{...config.plan}],['serialized-plan',JSON.parse(JSON.stringify(config.plan))]])reject(name,()=>api.emitNativeSourceClassModule({...config,plan}));
 for(const [name,q,from,to]of [
 ['existing-getter-needs-override','ReadChild','override public function get value','public function get value'],
 ['new-setter-cannot-override','ReadChild','public function set value','override public function set value'],
 ['existing-setter-needs-override','WriteChild','override public function set value','public function set value'],
 ['new-getter-cannot-override','WriteChild','public function get value','override public function get value'],
 ['final-parent-getter','ReadBase','public function get value','final public function get value'],
 ['final-parent-setter','WriteBase','public function set value','final public function set value'],
 ['base-half-cannot-override','ReadBase','public function get value','override public function get value'],
 ['typed-pair-mismatch','ReadChild','set value(item:Object)','set value(item:Boolean)'],
 ['inherited-half-type-mismatch','ReadGrand','get value():Object','get value():Number'],
 ['duplicate-getter','ReadChild','override public function get value():Object{return super.value;}','override public function get value():Object{return super.value;} override public function get value():Object{return super.value;}']
 ]){const key='cases.'+q,original=sources[key].source;assert(original.includes(from),name);const source=original.replace(from,to);reject(name,()=>compile(path.join(dir,name),target,{...sources,[key]:{source,sourceSha256:hash(source)}}));}
 assert.equal(results.length,12);return results;
};
