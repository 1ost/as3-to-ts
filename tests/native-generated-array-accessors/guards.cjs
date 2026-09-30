'use strict';
const assert=require('assert/strict'),path=require('path'),api=require('../../lib');
const {compile,sources,hash}=require('./compile.cjs');
module.exports=(dir,target,config)=>{
 const results=[];
 const reject=(name,action)=>{let error;try{action();}catch(e){error=String(e.message);}assert.match(error||'',/AS3_[A-Z_]+UNSUPPORTED/,name);results.push({name,error});};
 for(const [name,plan]of [['copied-plan',{...config.plan}],['serialized-plan',JSON.parse(JSON.stringify(config.plan))]])reject(name,()=>api.emitNativeSourceClassModule({...config,plan}));
 for(const [name,q,from,to]of [
 ['missing-setter-override','ArrayChild','override public function set','public function set'],
 ['missing-getter-override','ArrayGrand','override public function get','public function get'],
 ['final-setter','ArrayBase','public function set values','final public function set values'],
 ['final-getter','ArrayBase','public function get values','final public function get values'],
 ['root-override','ArrayBase','public function get values','override public function get values'],
 ['incompatible-half','ArrayChild','set values(value:Array)','set values(value:Object)'],
 ['incompatible-pair','ArrayBase','set values(value:Array)','set values(value:Boolean)'],
 ['super-update','ArrayChild','super.values=value;','super.values++;'],
 ['root-super','ArrayBase','return raw;','return super.values;'],
 ['getter-parameters','ArrayBase','get values()','get values(unused:Array)']
 ]){const key='cases.'+q,original=sources[key].source;assert(original.includes(from),name);const source=original.replace(from,to);reject(name,()=>compile(path.join(dir,name),target,{...sources,[key]:{source,sourceSha256:hash(source)}}));}
 assert.equal(results.length,12);return results;
};
