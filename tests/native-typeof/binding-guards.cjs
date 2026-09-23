const fs=require('fs'),path=require('path'),assert=require('assert');
const {hash}=require('./evidence.cjs');
exports.run=function(compiler,evidence) {
 const parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit')),passed=[];
 function compile(source,sources=evidence.sources) {
  sources={...sources,'consumer.Subject':source};const classes=Object.fromEntries(Object.keys(sources).map(q=>[q,'lazy']));
  const metadata=JSON.parse(JSON.stringify(evidence.metadata));metadata.classes['consumer.Subject'].sourceSha256=hash(source);
  return emit(parse('Subject.as',source),source,{customVisitors:[],definitionsByNamespace:{},nativeClassInitialization:{classes},nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableClasses:sources,nativeCallableMetadata:{module:'./AS3MethodBinding',classes:metadata.classes}});
 }
 const original=evidence.sources['consumer.Subject'];
 for(const [label,source,name] of [
  ['foreign lowercase not imported',original.replace('import foreign.visible;',''),'visible'],
  ['foreign wildcard absent',original.replace('import wildpkg.*;',''),'wild'],
  ['wrong explicit package',original.replace('import foreign.visible;','import absent.visible;'),'visible'],
  ['wrong wildcard package',original.replace('import wildpkg.*;','import absent.*;'),'wild'],
  ['missing same-package declaration',original.replace('return typeof Peer;','return typeof peer;'),'peer'],
  ['unbound conditional branch',original.replace('return typeof (Class);','return typeof (true ? Class : absentName);'),'absentName']]) {
  assert.throws(()=>compile(source),new RegExp('unresolved typeof operand: '+name));passed.push(label);
 }
 const generated=compile(original);
 assert(generated.includes('AS3Int as __as3_typeof_builtin_int'));
 assert(generated.includes('AS3Uint as __as3_typeof_builtin_uint'));
 assert(generated.includes('AS3ClassType as __as3_typeof_builtin_Class'));
 passed.push('actual common builtin identities imported before legacy integer rewrite');
 const collision=compile(original.replace('return typeof int;', 'var __as3_typeof_builtin_int:*=7;var __as3_typeof_classValue:*=9;return typeof int;'));
 assert(collision.includes('AS3Int as __as3_typeof_builtin_int_'));
 assert(collision.includes('as3AsClass as __as3_typeof_classValue_'));
 passed.push('authored helper-name collisions retain distinct compiler aliases');
 const hiddenSource='package foreign {public class hidden {public function hidden(){}}}';
 assert.throws(()=>compile(original.replace('return typeof (Class);','return typeof hidden;'),{...evidence.sources,'foreign.hidden':hiddenSource}),/unresolved typeof operand: hidden/);
 passed.push('reviewed lowercase foreign.hidden fails before unimported class can be admitted');
 const dir=path.join(__dirname,'original/binding-errors'),file=path.join(dir,'compilation.json');
 assert.equal(hash(fs.readFileSync(file)),fs.readFileSync(path.join(dir,'compilation.sha256'),'utf8').trim());
 const records=JSON.parse(fs.readFileSync(file,'utf8'));
 for(const record of records)for(const source of record.files)assert.equal(hash(fs.readFileSync(path.join(dir,source.path))),source.sha256);
 assert.equal(records[0].case,'unimported');assert.notEqual(records[0].exitCode,0);assert(records[0].stderr.includes('Access of undefined property hidden.'));
 assert.equal(records[1].case,'builtins');assert.equal(records[1].exitCode,0);
 passed.push('original foreign-name rejection and builtin acceptance authenticated');
 return passed;
};
