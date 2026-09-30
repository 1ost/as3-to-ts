'use strict';
const assert=require('assert/strict'),path=require('path'),api=require('../../lib');
const {compile,sources,hash}=require('./compile.cjs');
module.exports=(dir,target,config)=>{
 const results=[];
 const reject=(name,action)=>{let error;try{action();}catch(e){error=String(e.message);}assert.match(error||'',/AS3_[A-Z_]+UNSUPPORTED/,name);results.push({name,error});};
 for(const [name,plan]of [['copied-plan',{...config.plan}],['serialized-plan',JSON.parse(JSON.stringify(config.plan))]])reject(name,()=>api.emitNativeSourceClassModule({...config,plan}));
 reject('conflicting-uri',()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...config.emitterOptions,namespaceUris:{'cases.alpha':'urn:wrong'}}}));
 for(const [name,q,from,to]of [
 ['Boolean-String-pair','DistinctAccessor','set implied(value:*)','set implied(value:String)'],
 ['String-int-original-rejection','CoercedAccessor','get numberValue():*','get numberValue():String'],
 ['overridden-setter-type','DistinctGrandchild','set implied(value:*)','set implied(value:Boolean)'],
 ['overridden-getter-type','DistinctChild','get implied():Boolean','get implied():*'],
 ['missing-getter-override','DistinctChild','override alpha function get','alpha function get'],
 ['missing-setter-override','DistinctGrandchild','override alpha function set','alpha function set'],
 ['missing-ancestor-half','DistinctGrandchild','set implied(value:*)','set absent(value:*)'],
 ['static-incompatible-pair','CoercedAccessor','set staticValue(value:*)','set staticValue(value:int)'],
 ['duplicate-getter','DistinctAccessor','public function get publicValue()','alpha function get implied()']
 ]){const key='cases.'+q,original=sources[key].source;assert(original.includes(from),name);const source=original.replace(from,to);reject(name,()=>compile(path.join(dir,name),target,{...sources,[key]:{source,sourceSha256:hash(source)}}));}
 assert.equal(results.length,12);return results;
};
