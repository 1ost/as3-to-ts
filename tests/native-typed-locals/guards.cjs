const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('node:assert/strict');
const compiler=path.resolve(__dirname,'../..'),parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit')),evidence=path.join(__dirname,'evidence');
const source=fs.readFileSync(path.join(evidence,'sources/original/probe/TypedLocals.as'),'utf8'),qname='probe.TypedLocals';
const document=JSON.parse(cp.execFileSync(process.env.PYTHON,[path.join(__dirname,'extract-metadata.py'),evidence],{encoding:'utf8'}));
function options(text=source){const classes=structuredClone(document.classes);classes[qname].sourceSha256=crypto.createHash('sha256').update(text).digest('hex');return {customVisitors:[],definitionsByNamespace:{probe:['TypedLocals']},nativeClassInitialization:{classes:{[qname]:'lazy'}},nativeCallableClasses:{[qname]:text},nativeCallableMetadata:{module:'./AS3MethodBinding',classes},nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableStringModule:'./AS3String',nativeArrayCreationModule:'./AS3ArrayCreation',nativeLexicalMembersModule:'./AS3LexicalMembers',nativeTypedLocals:true,nativeTypedLocalAdditionModule:'./AS3Addition'}}
const checks=[];function reject(id,text,re){assert.throws(()=>emit(parse('TypedLocals.as',text),text,options(text)),re,id);checks.push(id);}
for(const [id,key]of [['explicit-opt-in','nativeTypedLocals'],['lexical-required','nativeLexicalMembersModule'],['number-provider-required','nativeCallableCoercionModule'],['string-provider-required','nativeCallableStringModule'],['addition-provider-required','nativeTypedLocalAdditionModule']]){const o=options();delete o[key];assert.throws(()=>emit(parse('TypedLocals.as',source),source,o),/UNSUPPORTED/);checks.push(id);}
for(const [id,from,to,re]of [
 ['foreign-reference','var n:Number;','var n:Foreign;',/foreign local reference/],
 ['Function-reference','var n:Number;','var n:Function;',/foreign local reference/],
 ['qualified-reference','var n:Number;','var n:foreign.Number;',/foreign local reference/],
 ['const-local','var n:Number;','const n:Number=3;',/typed local const/],
 ['conflicting-declarations','var n:Number;','var n:Number;var n:*;',/conflicting local/],
 ['parameter-redeclaration','if(flag){var n:Number=3;','var flag:Number;if(flag){var n:Number=3;',/local\/parameter redeclaration/],
 ['catch-redeclaration','catch(n:*){inside=n;}','catch(n:*){var n:int;inside=n;}',/local\/catch redeclaration/],
 ['enumeration-for-in','var n:Number;','var n:Number;for(n in {}){}',/enumeration targets/],
 ['enumeration-for-each','var n:Number;','var n:Number;for each(n in []){}',/enumeration targets/],
 ['destructuring','var n:Number;','var n:Number;[n]=[1];',/destructuring targets|Parse Error/],
 ['logical-write','var n:Number;','var n:Number;n||=1;',/typed logical assignment/],
 ['nonnumeric-update','var s:String;','var s:String;s++;',/nonnumeric local update/],
 ['catch-write','catch(n:*){inside=n;}','catch(n:*){inside=n;n=3;}',/catch-shadow writes/],
 ['catch-update','catch(n:*){inside=n;}','catch(n:*){inside=n;n++;}',/catch-shadow writes/],
 ['typed-return','public function case0():*','public function case0():Number',/typed and void method returns/],
 ['typed-parameter','flag:*','flag:Boolean',/typed method parameter/],
 ['anonymous-function','var n:Number;','var n:Number;var f:*=function():*{return n;};',/anonymous\/nested/],
 ['member-local-collision','public class TypedLocals {','public class TypedLocals { private var n:Number;',/declaration-order lookup/],
 ['accessor','public function case0():*','public function get case0():*',/accessor entry/],
 ['ancestry','public class TypedLocals {','public class TypedLocals extends Object {',/Object-root/],
]){assert(source.includes(from),id);reject(id,source.replace(from,to),re);}
const bad=options();bad.nativeCallableMetadata.classes[qname].sourceSha256='0'.repeat(64);assert.throws(()=>emit(parse('TypedLocals.as',source),source,bad),/exact authenticated source/);checks.push('source-authentication');
const generated=emit(parse('TypedLocals.as',source),source,options());assert(generated.includes('.as3CoerceReference(')&&generated.includes('.array)'));assert(generated.includes('.as3Add('));checks.push('captured-array-authority','common-addition-provider');
const out=path.join(compiler,'.cache/native-typed-locals');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'guards.json'),JSON.stringify({checks,scope:'Complete-source rejection controls; no additional native runtime admission'},null,2));console.log(JSON.stringify({guards:checks.length}));
