// Separate observer. All five complete AIR subjects are emitted unchanged.
const nc=load('nativeClass'),klass=name=>nc.readNativeClass(load(name)[name]);
const rows=[],row=(id,value)=>rows.push({id,value});
const Trace=klass('StaticTrace');
row('before-class-value',Trace.events.slice());
const Initialization=klass('PrivateStaticInitialization');
row('after-class-value',Trace.events.slice());
const state=Initialization.read();row('private-initializers',state);
row('after-read',Trace.events.slice());
const again=Initialization.read();row('initializer-once',[state[0]===again[0],state[2]===again[2],Trace.events.slice()]);
function observe(type,label){
 row(label+'-default',[type.peek()===null,type.count()]);
 const direct=new type();row(label+'-direct',[direct.sawNull,type.peek()===null,type.count()]);
 const first=type.inst;row(label+'-first',[first!==direct,first.sawNull,type.peek()===first,type.count()]);
 row(label+'-repeat',[type.inst===first,type.count()]);
 try{new type();row(label+'-duplicate','accepted');}
 catch(error){row(label+'-duplicate',[api.as3GetProperty(error,'name'),api.as3GetProperty(error,'message'),type.count(),type.peek()===first]);}
 try{type.assign({});row(label+'-invalid','accepted');}
 catch(error){row(label+'-invalid',[api.as3GetProperty(error,'name'),api.as3GetProperty(error,'errorID'),
  api.as3IsSourceErrorInstance(error)&&api.sourceErrorParent(error)===api.getAS3SourceErrorPrototype('TypeError'),type.peek()===first]);}
 row(label+'-undefined',[type.assign(undefined)===undefined,type.peek()===null,type.count()]);
 const next=type.inst;row(label+'-reset',[next!==first,next.sawNull,type.peek()===next,type.count()]);
 row(label+'-null',[type.assign(null)===null,type.peek()===null,type.count()]);
 row(label+'-restore',[type.assign(first)===first,type.inst===first,type.count()]);
 row(label+'-replace',[type.assign(direct)===direct,type.inst===direct,type.count()]);
}
const Private=klass('PrivateSingleton');observe(Private,'private');
const Protected=klass('ProtectedSingleton');observe(Protected,'protected');
row('separate-classes',[Private.peek()!==Protected.peek(),Private.count(),Protected.count()]);
try{klass('PrivateStaticRetry').read();row('retry-first','accepted');}
catch(error){row('retry-first',[error===Trace.failure,Trace.references.length]);}
try{klass('PrivateStaticRetry').read();row('retry-second','accepted');}
catch(error){row('retry-second',[error===Trace.failure,Trace.references.length,Trace.references[0]!==Trace.references[1]]);}
Trace.fail=false;
const success=klass('PrivateStaticRetry').read();
row('retry-success',[Trace.references.length,success[0]===Trace.references[2],success[0]!==Trace.references[1],success[0]!==success[1],success[0].length,success[1].length]);
const repeated=klass('PrivateStaticRetry').read();
row('retry-once',[Trace.references.length,success[0]===repeated[0],success[1]===repeated[1]]);
globalThis.result=rows;
