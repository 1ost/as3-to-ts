// Observer adaptation only; original Signal subjects are emitted unchanged.
const p=load('AS3Property'),nc=load('nativeClass'),errors=load('AS3SourceError'),inv=load('AS3Invocation');
const get=name=>nc.readNativeClass(load(name)[name],'value');
const Signal=get('Signal'),OnceSignal=get('OnceSignal'),Slot=get('Slot');
const reg=fn=>inv.registerAS3Function(fn,load('AS3ScriptGlobal').getAS3BuiltinScriptGlobal(),fn.length);
const rows=[],sentinel={};let events=[];
function encode(v){return v===undefined?'undefined':Array.isArray(v)?v.map(encode):v;}
const row=(id,value)=>rows.push({id,value:encode(value)});
function listener(label){return reg(function(...args){events.push([label,args]);});}
function failure(fn){try{fn();return [];}catch(e){return e===sentinel?['sentinel']:errors.isAS3SourceError(e)?[p.as3GetProperty(e,'name'),p.as3GetProperty(e,'errorID')]:[e.name,e.errorID];}}
function dispatch(id,signal,args){events=[];const error=failure(()=>signal.dispatch.apply(signal,args));row(id,[events.slice(),signal.numListeners,error]);}

   var s=new Signal(),a=listener("a"),b=listener("b");
   var first=s.add(a),second=s.add(b);
   row("duplicate-listener",[s.add(a)===first,s.numListeners,first.once,first.enabled]);
   dispatch("dispatch-zero",s,[]);dispatch("dispatch-one",s,[1]);dispatch("dispatch-two",s,[1,2]);
   dispatch("dispatch-three",s,[1,2,3]);dispatch("dispatch-four",s,[1,2,3,4]);
   second.enabled=false;dispatch("disabled",s,[7]);second.enabled=true;
   first.params=[8,9];dispatch("appended-params",s,[7]);
   first.params.push(10);dispatch("params-reference",s,[]);first.params=[];dispatch("empty-params",s,[7]);first.params=null;
   row("remove-result",[s.remove(b)===second,s.remove(b)===null,s.numListeners]);first.remove();
   dispatch("empty-after-remove",s,[]);
   var once=new OnceSignal(),o=listener("once"),onceSlot=once.addOnce(o);
   row("duplicate-once",[once.addOnce(o)===onceSlot,once.numListeners,onceSlot.once]);
   dispatch("once-first",once,[1]);dispatch("once-second",once,[2]);
   var seen=new Signal();seen.addOnce(reg(function(){events.push(["inside-once",seen.numListeners]);}));
   dispatch("once-removed-before-call",seen,[]);
   var disabledOnce=new Signal(),ds=disabledOnce.addOnce(listener("disabled-once"));ds.enabled=false;
   dispatch("disabled-once-retained",disabledOnce,[]);ds.enabled=true;dispatch("enabled-once-removed",disabledOnce,[]);
   var conflict=new Signal(),same=listener("same");conflict.addOnce(same);
   row("once-then-add-error",[failure(reg(function(){conflict.add(same);})),conflict.numListeners]);
   conflict.removeAll();conflict.add(same);
   row("add-then-once-error",[failure(reg(function(){conflict.addOnce(same);})),conflict.numListeners]);
   row("null-listener",failure(reg(function(){s.add(null);})));
   row("null-slot-signal",failure(reg(function(){new Slot(a,null);})));
   var replacement=new Signal(),old=listener("old"),fresh=listener("fresh");
   var changed=replacement.add(old);changed.listener=fresh;
   row("listener-replacement-identity",[changed.listener===fresh,replacement.remove(old)===null,replacement.numListeners]);
   dispatch("listener-replacement-call",replacement,[3]);
   row("listener-null-rejected",[failure(reg(function(){changed.listener=null;})),changed.listener===fresh]);changed.remove();
   dispatch("replacement-removed",replacement,[]);
   var removing=new Signal(),removed=listener("removed");removing.add(removed);
   removing.add(reg(function(){events.push(["remover"]);removing.remove(removed);}));
   dispatch("remove-during-dispatch",removing,[]);dispatch("after-dispatch-removal",removing,[]);
   var adding=new Signal(),late=listener("late");adding.add(listener("early"));
   adding.add(reg(function(){events.push(["adder"]);adding.add(late);}));
   dispatch("add-during-dispatch",adding,[]);dispatch("after-dispatch-add",adding,[]);
   var clearing=new Signal();clearing.add(listener("survivor"));
   clearing.add(reg(function(){events.push(["clearer"]);clearing.removeAll();}));
   dispatch("clear-during-dispatch",clearing,[]);dispatch("after-dispatch-clear",clearing,[]);
   var throwing=new Signal();throwing.add(listener("after-throw"));
   throwing.addOnce(reg(function(){events.push(["thrower"]);throw sentinel;}));
   dispatch("throwing-once",throwing,[]);dispatch("after-throwing-once",throwing,[]);
   var typed=new Signal(String,Number);typed.add(listener("typed"));
   dispatch("typed-valid",typed,["value",7]);dispatch("typed-null",typed,[null,null]);
   dispatch("typed-extra",typed,["value",7,true]);dispatch("typed-too-few",typed,["value"]);
   dispatch("typed-wrong",typed,[7,7]);dispatch("typed-undefined",typed,[undefined,7]);
   var types=[String];var arrayTyped=new Signal(types);arrayTyped.add(listener("array-typed"));types[0]=Number;
   dispatch("value-classes-input-copy",arrayTyped,["value"]);
   arrayTyped.valueClasses[0]=Number;dispatch("value-classes-getter-reference",arrayTyped,[8]);
   row("invalid-value-class",failure(reg(function(){new Signal("String");})));
   var directSignal=new Signal(),direct=new Slot(listener("direct"),directSignal);
   events=[];direct.execute0();direct.execute1(4);direct.params=[5];direct.execute0();direct.execute1(4);direct.execute([2,3]);
   row("direct-slot-entry-points",events.concat());
   
globalThis.result=rows;
