'use strict';
const assert=require('assert/strict'),path=require('path'),api=require('../../lib');
const {compile,sources,hash}=require('./compile.cjs');
module.exports=(dir,target,config)=>{
 const results=[];
 const reject=(name,action)=>{let error;try{action();}catch(e){error=String(e.message);}assert.match(error||'',/AS3_[A-Z_]+UNSUPPORTED/,name);results.push({name,error});};
 for(const [name,plan]of [['copied-plan',{...config.plan}],['serialized-plan',JSON.parse(JSON.stringify(config.plan))]])reject(name,()=>api.emitNativeSourceClassModule({...config,plan}));
 for(const [name,q,from,to]of [
 ['missing-override','ProtectedChild','override protected function get','protected function get'],
 ['final-ancestor','ProtectedBase','protected function get','final protected function get'],
 ['root-override','ProtectedBase','protected function get','override protected function get'],
 ['private-getter','ProtectedBase','protected function get','private function get'],
 ['static-getter','ProtectedBase','protected function get','protected static function get'],
 ['nonboolean-getter','ProtectedBase','get abstract():Boolean','get abstract():uint'],
 ['override-type-mismatch','ProtectedChild','get abstract():Boolean','get abstract():uint'],
 ['getter-parameter','ProtectedBase','get abstract()','get abstract(value:Boolean)'],
 ['root-super','ProtectedBase','return raw;','return super.abstract;'],
 ['readonly-write','ProtectedBase','return abstract;','abstract=true;return abstract;'],
 ['readonly-update','ProtectedBase','return abstract;','abstract++;return abstract;'],
 ['getter-call','ProtectedBase','return abstract;','return abstract();'],
 ['getter-delete','ProtectedBase','return abstract;','delete abstract;return abstract;'],
 ['setter-half-held','ProtectedBase','public function twice()', 'protected function set abstract(value:Boolean):void {} public function twice()']
 ]){const key='cases.'+q,original=sources[key].source;assert(original.includes(from),name);const source=original.replace(from,to);reject(name,()=>compile(path.join(dir,name),target,{...sources,[key]:{source,sourceSha256:hash(source)}}));}
 assert.equal(results.length,16);return results;
};
