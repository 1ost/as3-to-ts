const assert=require('assert/strict'),path=require('path'),api=require('../../lib');
const {compile,sources,hash}=require('./compile.cjs');
module.exports=(dir,target,config)=>{
 const results=[];const reject=(name,action)=>{let message;try{action();}catch(error){message=error.message;}assert.match(message||'',/AS3_[A-Z_]+UNSUPPORTED/,name);results.push({name,message});};
 for(const [name,plan] of [['copied-plan',{...config.plan}],['serialized-plan',JSON.parse(JSON.stringify(config.plan))]])reject(name,()=>api.emitNativeSourceClassModule({...config,plan}));
 reject('missing-typed-locals',()=>api.emitNativeSourceClassModule({...config,emitterOptions:{...config.emitterOptions,nativeTypedLocals:false}}));
 for(const [name,from,to] of [
  ['dynamic-this-property','_pending=0;','this._pending=0;'],
  ['arguments-object','_pending=0;','_pending=arguments.length;'],
  ['super-call','_pending=0;','super.record("bad");'],
  ['nested-lambda','_pending=0;','var nested:Function=function():void{};'],
  ['local-shadows-outer','var selected:Object=_values[name];','var name:Object=_values[name];'],
  ['vector-local','var selected:Object=_values[name];','var selected:Vector.<Object>=null;'],
  ['local-constant','var selected:Object=_values[name];','const selected:Object=_values[name];'],
  ['primitive-parameter','return function():void','return function(value:Boolean):void'],
  ['static-instance-capture','public function begin(name:String)','public static function begin(name:String)']
 ]){const original=sources['cases.MemberClosure'].source;assert(original.includes(from),name);const source=original.replace(from,to);reject(name,()=>compile(path.join(dir,name),target,{...sources,'cases.MemberClosure':{source,sourceSha256:hash(source)}}));}
 assert.equal(results.length,12);return results;
};
