'use strict';
const assert=require('assert/strict'),path=require('path');
const api=require('../../lib');
const {compile,sources,hash}=require('./compile.cjs');
module.exports=function guards(dir,target,config){
 const results=[];
 const reject=(name,action)=>{let error;try{action();}catch(e){error=String(e.message);}assert.match(error||'',/AS3_[A-Z_]+UNSUPPORTED/,name);results.push({name,error});};
 for(const [name,plan]of [['copied-plan',{...config.plan}],['serialized-plan',JSON.parse(JSON.stringify(config.plan))]])
  reject(name,()=>api.emitNativeSourceClassModule({...config,plan}));
 reject('conflicting-uri',()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...config.emitterOptions,namespaceUris:{'cases.alpha':'urn:wrong'}}}));
 const mutate=(q,from,to)=>{const original=sources[q].source;assert(original.includes(from));const source=original.replace(from,to);return {...sources,[q]:{source,sourceSha256:hash(source)}};};
 for(const [name,q,from,to]of [
  ['final-getter','cases.RegistryBase','alpha function get count()','final alpha function get count()'],
  ['setter-type','cases.RegistryBase','alpha function set count(n:int)','alpha function set count(n:String)'],
  ['method-signature','cases.RegistryChild','override beta function read():String','override beta function read(n:int):String'],
  ['missing-override','cases.RegistryChild','override beta function read()','beta function read()'],
  ['missing-accessor-half','cases.RegistryGrandchild','override alpha function set count(n:int)','override alpha function set absent(n:int)'],
  ['merged-uris','cases.alpha','urn:op2:namespace-traits:a','urn:op2:namespace-traits:b'],
  ['super-arity','cases.NamespaceChild','super.alpha::read(9)','super.alpha::read(9,9)']
 ])reject(name,()=>compile(path.join(dir,name),target,mutate(q,from,to)));
 return results;
};
