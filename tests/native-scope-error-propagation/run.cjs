'use strict';
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict');
const {compile,hash,root}=require('../native-generated-error-event-references/compile.cjs');
const file=require.resolve('../../lib/emit/emitter'),emitter=require(file),saved=emitter.emit;
const raw=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const cleanup='        catch (error) {\n            this.scope = scope;\n            throw error;\n        }\n';
const needle='            body(scope);\n        }\n';
assert.equal(raw.split(needle).length,2);
const old=raw.replace(cleanup,'');
const current=process.argv.includes('--candidate')?old.replace(needle,needle+cleanup):raw;
assert(current.includes(cleanup),'Build the primary-error preservation fix first');
const load=source=>{const m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(source,file);return m.exports.emit;};
const oldEmit=load(old),fixedEmit=load(current);
const cache=path.join(root,'.cache/native-scope-error-propagation');fs.mkdirSync(cache,{recursive:true});const out=fs.mkdtempSync(path.join(cache,'run-'));
const bodies={direct:'new IOErrorEvent("x");',tryBody:'try {new IOErrorEvent("x");} catch(error:*) {}',catchBody:'try {throw null;} catch(error:*) {new IOErrorEvent("x");}',nestedCatch:'try {throw null;} catch(outer:*) {try {throw null;} catch(inner:*) {new IOErrorEvent("x");}}',catchArity:'try {throw null;} catch(error:*) {IOErrorEvent(error,error);}',validCatch:'try {throw null;} catch(error:*) {var typed:IOErrorEvent=error as IOErrorEvent;}'};
const expected='AS3_ERROREVENT_SUBTYPE_UNSUPPORTED: cast requires one argument and no construction',results=[];
try{for(const target of ['ES5','ES2015'])for(const [name,body]of Object.entries(bodies)){
 const source='package model {import flash.events.IOErrorEvent; public class Probe {public function Probe(){super();} public function run():void {'+body+'}}}',selected={'model.Probe':{source,sourceSha256:hash(source)}},dir=path.join(out,target,name);
 const run=emit=>{emitter.emit=emit;try{return {artifact:compile(dir,target,selected).artifact};}catch(error){return {error:String(error.message)};}};
 const baseline=run(oldEmit),fixed=run(fixedEmit);
 if(name==='validCatch'){assert(fixed.artifact);assert.deepEqual(fixed.artifact,baseline.artifact);}
 else{assert.equal(fixed.error,expected,name);assert.equal(baseline.error,['catchBody','nestedCatch','catchArity'].includes(name)?'Mismatched enterScope() / exitScope().':expected,name);}
 results.push({target,name,source,sourceSha256:hash(source),baseline:baseline.error||'emitted',fixed:fixed.error||'emitted'});
}}finally{emitter.emit=saved;}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({kind:'compiler diagnostic regression, not runtime qualification',candidate:process.argv.includes('--candidate'),results,compilerEmitterSha256:hash(raw)},null,2));
console.log(JSON.stringify({out,targets:2,cases:results.length,appliedOldCleanupControls:6,validOutputUnchanged:true}));
