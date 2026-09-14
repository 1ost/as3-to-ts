const assert=require('assert');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const vm=require('vm');
const ts=require('typescript');
const parse=require('../../lib/parse');
const emit=require('../../lib/emit');
const oracle=path.join(__dirname,'oracle'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const raw=fs.readFileSync(path.join(oracle,'receipt.json'));
assert.equal(sha(raw),'22ef06a8313ed681467abdf9d06545af5b4c5cdcfe9276ee54bc2cb2621a9452','Changed/unreviewed Flash receipt');
const receipt=JSON.parse(raw);assert.equal(receipt.schema,1);
for(const file of receipt.files)assert.equal(sha(fs.readFileSync(path.join(oracle,file.path))),file.sha256,file.path);
assert.equal(sha(fs.readFileSync(path.join(__dirname,'RetainFlashAssignments.js'))),receipt.retentionScriptSHA256);
const assignments=JSON.parse(fs.readFileSync(path.join(oracle,'assignment-flash.json'))),objects=JSON.parse(fs.readFileSync(path.join(oracle,'object-flash.json')));
assert.equal(assignments.length,12);assert.equal(objects.length,162);
const source=`package retained {
 public class Value {
  public var stored:*;public var log:Array=[];
  public function Value(initial:*){stored=initial;}
  public function get v():*{log.push("get");return stored;}
  public function set v(value:*):void{log.push("set");stored=value;}
  public function rhs():*{log.push("rhs");return 11;}
 }
 public class Projection {
  public function operation(value:Value,op:String):* {var result:*;if(op=="or")result=(value.v ||= value.rhs());else result=(value.v &&= value.rhs());return result;}
  public function integers():Array{var s:int=0;var a:*=(s ||= 4294967295);var u:uint=0;var b:*=(u ||= -1.75);return [s,a,u,b];}
  public function boolean():Array{var flag:Boolean=false;var result:*=(flag ||= {});return [flag,result];}
  public function object(value:Object,op:String,rhs:Function):Array{var result:*;if(op=="or")result=(value ||= rhs());else result=(value &&= rhs());return [value,result];}
 }
}`;
const generated=emit(parse('Projection.as',source),source,{lineSeparator:'\n',customVisitors:[],definitionsByNamespace:{}});
let checks=0;
for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
 const context=vm.createContext({}),modules=new Map();
 function load(source,name){const result=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});assert.deepEqual(result.diagnostics,[]);
  const exports={};vm.runInContext('(function(exports,require){\n'+result.outputText+'\n})',context)(exports,key=>{const name=key.endsWith('classBound')?'classBound':key.endsWith('bound')?'bound':key.split('/').pop();assert(modules.has(name),key);return modules.get(name);});modules.set(name,exports);return exports;}
 for(const name of ['bound','classBound'])load(fs.readFileSync(path.resolve(__dirname,'../../utils',name+'.ts'),'utf8'),name);
 const {Value,Projection}=load(generated.replace(/^\s*import .*\bValue\b[^\r\n]*$/gm,''),'Projection'),subject=new Projection();
 for(const row of assignments.slice(0,10)){
  const value=new Value(row.initial),result=subject.operation(value,row.op);
  assert.deepStrictEqual({initial:row.initial,op:row.op,result,stored:value.stored,log:Array.from(value.log)},row);checks++;
 }
 const integer=assignments[10];assert.deepStrictEqual(Array.from(subject.integers()),[integer.signed,integer.signedResult,integer.unsigned,integer.unsignedResult]);checks++;
 const boolean=assignments[11],booleanResult=subject.boolean();assert.deepStrictEqual(Array.from(booleanResult),[boolean.booleanValue,boolean.booleanResult]);assert.equal(typeof booleanResult[1],boolean.booleanType);checks++;
 const inputs=[undefined,null,0,false,'',1,'value',{},[]];
 const describe=value=>value===null?{kind:'null'}:value===undefined?{kind:'undefined'}:['string','number','boolean'].includes(typeof value)?{kind:typeof value,value}:{kind:Array.isArray(value)?'array':'object'};
 for(const row of objects){
  const initial=inputs[row.initialIndex],next=inputs[row.rhsIndex],effects=[];
  // The oracle initializes `var value:Object=initial` before the operation.
  // Supply that documented precondition; this test does not admit generic
  // variable/parameter initialization coercion beyond logical assignment.
  const before=initial===undefined?null:initial;
  const [stored,result]=subject.object(before,row.op,()=>{effects.push('rhs');return next;});
  assert.deepStrictEqual({initialIndex:row.initialIndex,rhsIndex:row.rhsIndex,op:row.op,before:describe(before),stored:describe(stored),result:describe(result),sameStoredResult:stored===result,storedIsInitial:stored===initial,storedIsRhs:stored===next,effects},row);checks++;
 }
}
console.log(checks+' retained actual Flash logical-assignment comparisons passed across ES5/ES2015 (no live Flash rerun)');
