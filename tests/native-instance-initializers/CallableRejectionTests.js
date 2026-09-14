const assert=require('assert'), parse=require('../../lib/parse'),emit=require('../../lib/emit');
function generate(source,sources,classes) {
    return emit(parse('C.as',source),source,{customVisitors:[],definitionsByNamespace:{},
        nativeClassInitialization:{classes:classes||Object.fromEntries(Object.keys(sources).map(key=>[key,'lazy']))},nativeCallableMethodBindingModule:"./AS3MethodBinding",nativeCallableCoercionModule:"./AS3MethodBinding",nativeCallableClasses:sources});
}
let count=0;
for(const body of [
    'public function C(){super();super();}',
    'public function C(){if(true)super();}',
    'public function C(){super();return 1;}',
    'public function C(value:String){super();}',
    'public function C(...rest){super();}',
    'public function C(){super();} public function f():*{return super.f();}',
    'public function C(){super();} public static function f():*{return C.call({});}',
    'public function C(){super();} public static function f():*{return C.apply({},[]);}',
    'public function C(){super();} public static function f():*{return (C).call({});}',
    'public function C(){super();} public static function f():*{return ((C)).apply({},[]);}',
    'public function C(){super();} public static function f():*{return C.prototype;}',
    'public var constructor:*; public function C(){super();}',
    'public var x:int; public function C(){super();}',
    'public const y:int=1; public function C(){super();}',
    'public static var prototype:*; public function C(){super();}',
    'public static var call:*; public function C(){super();}',
    'public static var apply:*; public function C(){super();}',
    'public static var bind:*; public function C(){super();}',
    ''
]) {
    const source='package p {public class C extends Base {'+body+'}}';
    const base='package p {public class Base {public var x:int; public function f():*{return null;}}}';
    assert.throws(()=>generate(source,{'p.C':source,'p.Base':base}),/AS3_CALLABLE_CLASS_UNSUPPORTED/);count++;
}
for(const provider of ['NativeBase','Array','Object']) {
    const source='package p {public class C extends '+provider+' {public function C(){super();}}}';
    assert.throws(()=>generate(source,{'p.C':source},{'p.C':'lazy',['p.'+provider]:'ready'}),/AS3_CALLABLE_CLASS_UNSUPPORTED/);count++;
}
const source='package p {public class C {}}';
assert.throws(()=>generate(source,{'p.C':source+' '}),/AS3_CALLABLE_CLASS_UNSUPPORTED/);count++;
for (const module of [undefined, null, '', ' ', 1, {}, 'bad\nmodule']) {
    assert.throws(()=>emit(parse('C.as',source),source,{customVisitors:[],definitionsByNamespace:{},
        nativeClassInitialization:{classes:{'p.C':'lazy'}},nativeCallableClasses:{'p.C':source},
        nativeCallableMethodBindingModule:module}),/common AS3MethodBinding module/);count++;
}
console.log(count+' closed-chain/source-constructor unsupported cases rejected');
