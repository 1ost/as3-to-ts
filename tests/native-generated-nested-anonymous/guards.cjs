const assert=require('node:assert/strict'),path=require('node:path'),api=require('../../lib');
const {compile,hash}=require('./compile.cjs');
module.exports=(dir,target,config,sources)=>{
 const results=[];const reject=(name,action)=>{let message;try{action();}catch(error){message=error.message;}assert.match(message||'',/AS3_[A-Z_]+UNSUPPORTED/,name);results.push({name,message});};
 for(const [name,plan]of [['copied-plan',{...config.plan}],['serialized-plan',JSON.parse(JSON.stringify(config.plan))]])reject(name,()=>api.emitNativeSourceClassModule({...config,plan}));
 reject('missing-typed-locals',()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...config.emitterOptions,nativeTypedLocals:false}}));
 for(const [name,from,to]of [
  ['dynamic-this-property','_calls++;','this._calls++;'],
  ['arguments-object','_calls++;','_calls+=arguments.length;'],
  ['intermediate-shadow','middle+=extra;','var middle:uint=0;middle+=extra;'],
  ['root-shadow','middle+=extra;','var outer:uint=0;middle+=extra;'],
  ['named-nested-function','middle+=extra;','function named():void{};middle+=extra;'],
  ['primitive-parameter','function(extra:*):*','function(extra:Boolean):*'],
  ['nested-catch-closure','var middle:uint=step;','var middle:uint=step;try{}catch(error:Error){var held:Function=function():void{};}'],
  ['nested-constant','middle+=extra;','const held:uint=1;middle+=extra;']
 ]){const original=sources['cases.NestedClosure'].source;assert(original.includes(from),name);const source=original.replace(from,to);reject(name,()=>compile(path.join(dir,name),target,{'cases.NestedClosure':{source,sourceSha256:hash(source)}}));}
 assert.equal(results.length,11);return results;
};
