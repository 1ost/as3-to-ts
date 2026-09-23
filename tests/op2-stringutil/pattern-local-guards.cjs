const assert=require('node:assert/strict'),crypto=require('node:crypto');
module.exports=function({api,parse,emit,options,provider}) {
 const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
 const ordinary='public function f(input:*):Boolean {var p:RegExp=/a/g;return p.test(input);}';
 const make=(body,changes={})=>{
  const source='package patterns {public class Guard {'+body+'}}';
  const plan=api.createNativeGeneratedDeclarationPlan({scope:'pattern-local-guards',providerModule:provider('AS3GeneratedClass'),
   patternProviderModule:provider('AS3StringIntrinsics'),sources:{'patterns.Guard':{source,sourceSha256:hash(source)}},...changes});
  return {source,plan};
 };
 const generate=(pair,changes={})=>emit(parse('Guard.as',pair.source),pair.source,{...options,
  nativeGeneratedDeclarations:{plan:pair.plan,module:'./guard'},nativeReferenceCoercion:{plan:pair.plan,module:'./guard',coercionModule:provider('AS3Type')},...changes});
 const accepted=make(ordinary);assert.equal(accepted.plan.patternLocals.length,1);
 assert.equal(accepted.plan.references.filter(r=>r.kind==='pattern-local').length,1);
 const output=generate(accepted);assert.match(output,/sourcePatternTest/);assert.match(output,/compileSourceStringPattern/);
 assert.doesNotMatch(output,/:\s*RegExp|\/a\/g/);
 let guards=0;
 for(const body of [
  ordinary.replace('return p.test(input);','p=/b/;return p.test(input);'),
  ordinary.replace('return p.test(input);','var alias:*=p;return p.test(input);'),
  ordinary.replace('return p.test(input);','return Boolean(p);'),
  ordinary.replace('return p.test(input);','return p is RegExp;'),
  ordinary.replace('return p.test(input);','return typeof p=="object";'),
  ordinary.replace('return p.test(input);','p.lastIndex=1;return p.test(input);'),
  ordinary.replace('return p.test(input);','var method:*=p.test;return method(input);'),
  ordinary.replace('p.test(input)','p["test"](input)'),
  ordinary.replace('p.test(input)','new p.test(input)'),
  ordinary.replace('p.test(input)','p.test(input,1)'),
  ordinary.replace('var p:RegExp=/a/g;','p.test(input);var p:RegExp=/a/g;'),
  ordinary.replace('var p:RegExp=/a/g;','if(input){var p:RegExp=/a/g;}'),
  ordinary.replace('var p:RegExp=/a/g;','var p:RegExp;'),
  ordinary.replace('var p:RegExp=/a/g;','var p:RegExp=new RegExp("a","g");'),
  ordinary.replace('/a/g','/a/i'),
  ordinary.replace('var p:RegExp=/a/g;','var p:RegExp=/a/g;var p:RegExp=/b/;'),
  ordinary.replace('input:*','input:*,p:*'),
  ordinary.replace('return p.test(input);','try{throw input;}catch(p:*){return p.test(input);}'),
  ordinary.replace('return p.test(input);','function nested():Boolean{return p.test(input);}return nested();'),
  ordinary.replace('return p.test(input);','var fn:Function=function():Boolean{return p.test(input);};return fn();'),
  'private var p:*;'+ordinary,
  ordinary.replace('return p.test(input);','for each(p in input){}return p.test(input);'),
  ordinary.replace('return p.test(input);','return true;')
 ]){
  assert.notEqual(body,ordinary);
  const pair=make(body);assert.equal(pair.plan.patternLocals.length,0,body);
  assert.throws(()=>generate(pair),/AS3_[A-Z_]+UNSUPPORTED/,body);guards++;
 }
 for(const changes of [{nativeStringIntrinsicsModule:undefined},{nativeStringIntrinsicsModule:'./wrong'}, {nativeTypedLocals:false}]){
  assert.throws(()=>generate(accepted,changes),/AS3_[A-Z_]+UNSUPPORTED/);guards++;
 }
 const absent=make(ordinary,{patternProviderModule:undefined});
 assert.equal(absent.plan.patternLocals.length,0);assert.throws(()=>generate(absent),/AS3_[A-Z_]+UNSUPPORTED/);guards++;
 const foreign='package patterns {public class RegExp {public function RegExp(){super();}}}';
 const own=make(ordinary);const shadow=make(ordinary,{sources:{'patterns.Guard':{source:own.source,sourceSha256:hash(own.source)},'patterns.RegExp':{source:foreign,sourceSha256:hash(foreign)}}});
 assert.equal(shadow.plan.patternLocals.length,0);guards++;
 assert.ok(Object.isFrozen(accepted.plan.patternLocals));assert.ok(Object.isFrozen(accepted.plan.patternLocals[0].calls));
 assert.throws(()=>generate({...accepted,plan:{...accepted.plan}}),/AS3_[A-Z_]+UNSUPPORTED/);guards++;
 return guards;
};
