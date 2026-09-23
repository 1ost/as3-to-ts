const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ts=require('typescript');
const parse=require('../../lib/parse');
const emit=require('../../lib/emit');
const K=require('../../lib/syntax/nodeKind').default;
const options={lineSeparator:'\n',customVisitors:[],definitionsByNamespace:{}};
const source=`package assignments {
 public class Value {
  private var target:Object;
  public function Value(target:Object){this.target=target;}
  public function get value():*{return this.target.value;}
  public function set value(next:*):void{this.target.value=next;}
 }
 public class Assignments {
  private function receive(callback:Function):Value{return new Value(callback());}
  public function localOr(value:*, rhs:Function):Array { var result:*=(value ||= rhs());return [value,result]; }
  public function localAnd(value:*, rhs:Function):Array {var result:*=(value &&= rhs());return [value,result];}
  public function signed(value:int,rhs:Function):Array {var result:*=(value ||= rhs());return [value,result];}
  public function unsigned(value:uint,rhs:Function):Array {var result:*=((value) ||= rhs());return [value,result];}
  public function boolean(value:Boolean,rhs:Function):Array{var result:*=(value ||= rhs());return [value,result];}
  public function object(value:Object,rhs:Function):Array{var result:*=(value &&= rhs());return [value,result];}
  public function dotOr(receiver:Function,rhs:Function):* {return (this.receive(receiver).value ||= rhs());}
  public function dotAnd(receiver:Function,rhs:Function):* {return (this.receive(receiver).value &&= rhs());}
  public function grouped(receiver:Function,rhs:Function):* {return (((this.receive(receiver).value)) ||= rhs());}
  public function nested(receiver:Function,second:Function,rhs:Function):* {return this.receive(receiver).value ||= this.receive(second).value ||= rhs();}
  public function lexical(receiver:Function,value:*):* {return this.receive(receiver).value ||= arguments[1];}
  public function branch(receiver:Function,rhs:Function):* {if(true){return this.receive(receiver).value ||= rhs();}return null;}
  public function collision(receiver:Function,rhs:Function):* {var __as3_logical_receiver_0:*=17;return this.receive(receiver).value ||= rhs()+__as3_logical_receiver_0;}
  public function castSet(receiver:Function,rhs:Function):* {return Object(receiver()).allowCodeImport = rhs();}
  public function castAdd(receiver:Function,rhs:Function):* {return Object(receiver()).value += rhs();}
  public function castCall(receiver:Function):* {return Object(receiver()).method();}
 }
}`;
function generate(text){return emit(parse('Assignments.as',text),text,options);}
const ast=parse('Assignments.as',source),operators=[];
(function walk(n){if(!n)return;if(n.kind===K.ASSIGN&&n.children[1])operators.push(n.children[1].text);n.children.forEach(walk);})(ast);
assert(operators.includes('||=')&&operators.includes('&&='),'logical assignments are actual assignment nodes');
const output=generate(source);
assert.deepEqual(ts.createSourceFile('Assignments.ts',output,ts.ScriptTarget.Latest,true).parseDiagnostics,[]);
assert.doesNotMatch(output,/\|\|=|&&=/,'TS2.4-compatible output must not retain modern assignment syntax');
let checks=0;
for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
 const context=vm.createContext({}),modules=new Map();
 function load(text,name){
  const result=ts.transpileModule(text,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});
  assert.deepEqual(result.diagnostics,[]);
  const exports={};vm.runInContext('(function(exports,require){\n'+result.outputText+'\n})',context)(exports,key=>{const name=key.endsWith('classBound')?'classBound':key.endsWith('bound')?'bound':key.split('/').pop();assert(modules.has(name),key);return modules.get(name);});
  modules.set(name,exports);return exports;
 }
 for(const name of ['bound','classBound'])load(fs.readFileSync(path.resolve(__dirname,'../../utils',name+'.ts'),'utf8'),name);
 const Subject=load(output.replace(/^\s*import .*\bValue\b[^\r\n]*$/gm,''),'Assignments').Assignments,subject=new Subject();
 for(const start of [undefined,null,false,0,-0,NaN,'',true,1,-1,'x',{},[]]){
  for(const operation of ['Or','And']){
   const selected=operation==='Or'?!start:!!start,log=[],replacement={marker:1};
   const expected=selected?replacement:start;
   const result=subject['local'+operation](start,()=>{log.push('rhs');return replacement;});
   assert.strictEqual(result[0],expected);assert.strictEqual(result[1],expected);
   assert.deepEqual(log,selected?['rhs']:[]);checks++;
   let value=start;
   const obj=Object.defineProperty({},'value',{get(){log.push('get');return value;},set(v){log.push('set');value=v;}});
   log.length=0;
   assert.strictEqual(subject['dot'+operation](()=>{log.push('receiver');return obj;},()=>{log.push('rhs');return replacement;}),expected);
   assert.strictEqual(value,expected);
   assert.deepEqual(log,selected?['receiver','get','rhs','set']:['receiver','get','set']);checks++;
  }
 }
 assert.deepEqual(Array.from(subject.signed(0,()=>4294967295)),[-1,-1]);
 assert.deepEqual(Array.from(subject.unsigned(0,()=>-1.75)),[4294967295,4294967295]);
 assert.deepEqual(Array.from(subject.signed(7,()=>{throw Error('must skip');})),[7,7]);checks+=3;
 assert.deepEqual(Array.from(subject.boolean(false,()=>({}))),[true,true]);checks++;
 assert.deepEqual(Array.from(subject.object({},()=>undefined)),[null,null]);checks++;
 assert.deepEqual(Array.from(subject.signed(4294967295,()=>{throw Error('must skip');})),[-1,-1]);checks++;
 assert.deepEqual(Array.from(subject.unsigned(-1.75,()=>{throw Error('must skip');})),[4294967295,4294967295]);checks++;
 assert.deepEqual(Array.from(subject.boolean({},()=>{throw Error('must skip');})),[true,true]);checks++;
 for(const method of ['grouped','branch']){
  let calls=0;const obj={value:null};assert.equal(subject[method](()=>{calls++;return obj;},()=>9),9);assert.equal(calls,1);assert.equal(obj.value,9);checks++;
 }
 const original={value:null},other={value:null};let receiver=original;
 assert.equal(subject.dotOr(()=>receiver,()=>{receiver=other;return 8;}),8);
 assert.equal(original.value,8);assert.equal(other.value,null);checks++;
 const nestedLog=[],a={value:null},b={value:null};
 assert.equal(subject.nested(()=>{nestedLog.push('first');return a;},()=>{nestedLog.push('second');return b;},()=>{nestedLog.push('rhs');return 4;}),4);
 assert.deepEqual(nestedLog,['first','second','rhs']);assert.equal(a.value,4);assert.equal(b.value,4);checks++;
 assert.equal(subject.lexical(()=>({value:null}),27),27,'capture must preserve original arguments');checks++;
 assert.equal(subject.collision(()=>({value:null}),()=>2),19,'generated names must not shadow source bindings');checks++;
 for(const phase of ['receiver','get','rhs','set']){
  const log=[],failure=Error(phase),o=Object.defineProperty({},'value',{get(){log.push('get');if(phase==='get')throw failure;return null;},set(){log.push('set');if(phase==='set')throw failure;}});
  assert.throws(()=>subject.dotOr(()=>{log.push('receiver');if(phase==='receiver')throw failure;return o;},()=>{log.push('rhs');if(phase==='rhs')throw failure;return 2;}),e=>e===failure);
  assert.deepEqual(log,['receiver','get','rhs','set'].slice(0,['receiver','get','rhs','set'].indexOf(phase)+1));checks++;
 }
 const castLog=[],castTarget=Object.defineProperty({},'allowCodeImport',{set(v){castLog.push('set:'+v);}});
 assert.equal(subject.castSet(()=>{castLog.push('receiver');return castTarget;},()=>{castLog.push('rhs');return true;}),true);
 assert.deepEqual(castLog,['receiver','rhs','set:true']);checks++;
 const addLog=[];let number=3;const addTarget=Object.defineProperty({},'value',{get(){addLog.push('get');return number;},set(v){addLog.push('set');number=v;}});
 assert.equal(subject.castAdd(()=>{addLog.push('receiver');return addTarget;},()=>{addLog.push('rhs');return 2;}),5);
 assert.deepEqual(addLog,['receiver','get','rhs','set']);assert.equal(number,5);checks++;
 const callTarget={marker:42,method(){assert.strictEqual(this,callTarget);return this.marker;}};
 assert.equal(subject.castCall(()=>callTarget),42,'cast grouping preserves call receiver');checks++;
 for(const [type,falsy,truthy,rhsValue,coerced] of [
  ['int',0,7,4294967295,-1],['uint',0,7,-1.75,4294967295],
  ['Boolean',false,true,{},true],['Object',null,{},undefined,null],['*',null,7,undefined,undefined]
 ])for(const reference of ['value','this.value'])for(const op of ['||=','&&=']){
  const accessorSource=`package accessors {public class Accessor {
   private var stored:*;public var log:Array=[];
   public function Accessor(initial:*){this.stored=initial;}
   public function get value():${type}{this.log.push("get");return this.stored;}
   public function set value(next:${type}):void{this.log.push("set");this.stored=next;}
   public function run(rhs:Function):*{return ${reference} ${op} rhs();}
   public function inspect():*{return this.stored;}
  }}`;
  const Accessor=load(generate(accessorSource),'Accessor').Accessor;
  for(const initial of [falsy,truthy]){
   const instance=new Accessor(initial),selected=op==='||='?!initial:!!initial;
   const expected=selected?coerced:initial;
   assert.strictEqual(instance.run(()=>{instance.log.push('rhs');return rhsValue;}),expected,type+' '+reference+' '+op);
   assert.strictEqual(instance.inspect(),expected);
   assert.deepEqual(Array.from(instance.log),selected?['get','rhs','set']:['get','set']);checks++;
  }
 }
 for(const reference of ['value','StaticAccessor.value']){
  const staticSource=`package accessors {public class StaticAccessor {
   public static var stored:*=0;public static var log:Array=[];
   public static function get value():uint{StaticAccessor.log.push("get");return StaticAccessor.stored;}
   public static function set value(next:uint):void{StaticAccessor.log.push("set");StaticAccessor.stored=next;}
   public static function run(rhs:Function):*{return ${reference} ||= rhs();}
  }}`;
  const Accessor=load(generate(staticSource),'StaticAccessor').StaticAccessor;
  assert.equal(Accessor.run(()=>{Accessor.log.push('rhs');return -1.75;}),4294967295);
  assert.equal(Accessor.stored,4294967295);assert.deepEqual(Array.from(Accessor.log),['get','rhs','set']);checks++;
 }
}
for(const expression of ['receiver()[key()] ||= rhs()','super.value ||= rhs()']){
 assert.throws(()=>generate('package p {public class C {public function f(receiver:Function,key:Function,rhs:Function):*{return '+expression+';}}}'),/AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED/);
}
for(const type of ['Number','String','Array','Function']){
 assert.throws(()=>generate('package p {public class C {public function f(value:'+type+',rhs:Function):*{return value ||= rhs();}}}'),/AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED.*coercion/);
}
for(const type of ['Number','String']){
 assert.throws(()=>generate('package p {public class Box {public var value:'+type+';} public class C {public function f(box:Box,rhs:Function):*{return box.value ||= rhs();}}}'),/AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED.*coercion/);
 for(const reference of ['value','this.value'])assert.throws(()=>generate('package p {public class C {public function get value():'+type+'{return null;}public function set value(next:'+type+'):void{}public function f(rhs:Function):*{return '+reference+' ||= rhs();}}}'),/AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED.*coercion/);
 for(const reference of ['value','C.value'])assert.throws(()=>generate('package p {public class C {public static function get value():'+type+'{return null;}public static function set value(next:'+type+'):void{}public static function f(rhs:Function):*{return '+reference+' ||= rhs();}}}'),/AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED.*coercion/);
}
for(const member of ['public function get value():*{return null;}','public function set value(next:*):void{}']){
 for(const reference of ['value','this.value'])assert.throws(()=>generate('package p {public class C {'+member+'public function f(rhs:Function):*{return '+reference+' ||= rhs();}}}'),/AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED.*trait/);
}
for(const members of ['public function value():void{}','public function get value():*{return null;}','private var value:*']){
 assert.throws(()=>generate('package p {public class Box {'+members+'}public class C {public function f(box:Box,rhs:Function):*{return box.value ||= rhs();}}}'),/AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED.*trait/);
}
assert.throws(()=>generate('package p {public class C {public function f(receiver:Function,rhs:Function):*{return receiver().value ||= rhs();}}}'),/AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED.*proven/);
console.log(checks+' native logical/cast assignment checks passed across ES5 and ES2015; computed/super targets explicitly rejected');
