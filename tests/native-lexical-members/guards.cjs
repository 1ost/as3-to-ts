const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('node:assert/strict'),crypto=require('crypto');
const compiler=path.resolve(__dirname,'../..'),parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit'));
const source=fs.readFileSync(path.join(__dirname,'unit-evidence/sources/original/probe/LexicalUnit.as'),'utf8');
const document=JSON.parse(cp.execFileSync(process.env.PYTHON||'python',[path.join(__dirname,'extract-metadata.py'),path.join(__dirname,'unit-evidence')],{encoding:'utf8',windowsHide:true}));
const qname='probe.LexicalUnit';
function options(text=source){const classes=JSON.parse(JSON.stringify(document.classes));classes[qname].sourceSha256=crypto.createHash('sha256').update(text).digest('hex');return {customVisitors:[],definitionsByNamespace:{probe:['LexicalUnit']},nativeClassInitialization:{classes:{[qname]:'lazy'}},nativeCallableClasses:{[qname]:text},nativeCallableMetadata:{module:'./AS3MethodBinding',classes},nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableStringModule:'./AS3String',nativeArrayCreationModule:'./AS3ArrayCreation',nativeLexicalMembersModule:'./AS3LexicalMembers'}}
const checks=[];function reject(id,fn,re){assert.throws(fn,re,id);checks.push(id)}
for(const [id,modify,re] of [
 ['opt-in-required',o=>delete o.nativeLexicalMembersModule,/nonpublic source members/],
 ['source-hash',o=>o.nativeCallableMetadata.classes[qname].sourceSha256='0'.repeat(64),/exact authenticated source/],
 ['missing-metadata',o=>delete o.nativeCallableMetadata,/authenticated source/],
 ['missing-callable-source',o=>delete o.nativeCallableClasses,/authenticated lazy callable source|callable source classes/],
 ['invalid-provider-module',o=>o.nativeLexicalMembersModule='bad\npath',/explicit common/],
 ['source-namespaces-mode',o=>o.useNamespaces=true,/authenticated lazy callable source|callable source classes/],
 ['public-projection-missing',o=>o.nativeCallableMetadata.classes[qname].metadata.instance.methods.pop(),/complete source member surface/],
]){const o=options();modify(o);reject(id,()=>emit(parse('LexicalUnit.as',source),source,o),re)}
for(const [id,from,to,re] of [
 ['derived','class LexicalUnit {','class LexicalUnit extends Object {',/Object-root/],
 ['internal','private var secret','internal var secret',/internal\/custom/],
 ['custom-namespace','private var secret','custom var secret',/internal\/custom|AS3_NAMESPACE/],
 ['lexical-const','private var secret','private const secret',/lexical const/],
 ['accessor','public function read():*','public function get read():*',/accessor entry/],
 ['typed-return','public function read():*','public function read():Number',/typed and void method returns/],
 ['void-return','private function secretMethod():*','private function secretMethod():void',/typed and void method returns/],
 ['typed-parameter','amountMethod(value:*)','amountMethod(value:Number)',/typed method parameter/],
 ['optional-parameter','amountMethod(value:*)','amountMethod(value:* = 1)',/optional method defaults/],
 ['rest-parameter','amountMethod(value:*)','amountMethod(...value)',/rest method parameters/],
 ['typed-local','var secret:* = "local"','var secret:String = "local"',/typed local initialization/],
 ['foreign-reference','private var secret:Number','private var secret:LexicalUnit',/lexical foreign reference/],
 ['anonymous-function','return this.secret;','return function():* {return 1;};',/anonymous\/nested/],
 ['private-method-write','return this.secret;','return this.secretMethod = null;',/method assignment/],
 ['private-compound','return this.secret;','return this.secret += 1;',/lexical compound/],
 ['private-update','return this.secret;','return this.secret++;',/lexical delete\/update/],
 ['private-delete','return this.secret;','return delete this.secret;',/lexical delete\/update/],
 ['Class-instance-mix','return this.secret;','return LexicalUnit.secret;',/instance lexical declaration through Class/],
 ['instance-static-mix','return this.secret;','return this.token;',/static lexical declaration through instance/],
 ['typed-local-const','var secret:* = "local"','const secret:String = "local"',/typed local initialization/],
 ['dynamic-update','return this[key];','return this[key]++;',/namespace property update/],
 ['unqualified-call','return this[key];','return key();',/source caller context/],
 ['dynamic-in','return this[key];','return key in this;',/namespace membership\/deletion/],
]){assert(source.includes(from),id);const text=source.replace(from,to);reject(id,()=>emit(parse('LexicalUnit.as',text),text,options(text)),re)}
// Retained complete 26-row first fixture remains held, rather than selecting its supported methods.
const first=path.join(__dirname,'evidence'),firstSource=fs.readFileSync(path.join(first,'sources/original/probe/LexicalRoot.as'),'utf8');
const firstMetadata=JSON.parse(cp.execFileSync(process.env.PYTHON||'python',[path.join(__dirname,'extract-metadata.py'),first],{encoding:'utf8',windowsHide:true}));
const firstOptions=options();firstOptions.nativeCallableClasses={'probe.LexicalRoot':firstSource};firstOptions.nativeClassInitialization.classes={'probe.LexicalRoot':'lazy'};firstOptions.nativeCallableMetadata.classes=firstMetadata.classes;firstOptions.definitionsByNamespace={probe:['LexicalRoot']};
reject('complete-original-anonymous-fixture-held',()=>emit(parse('LexicalRoot.as',firstSource),firstSource,firstOptions),/anonymous\/nested/);
const generated=emit(parse('LexicalUnit.as',source),source,options());
assert(generated.includes('.symbol()'));assert(!/=Symbol\(\)/.test(generated));checks.push('native-Symbol-captured-outside-source');
assert(generated.indexOf('.enterInstance(this)')<generated.indexOf('.initializeAS3LexicalInstance('));checks.push('source-entry-before-lexical-defaults');
const register=generated.indexOf('.registerAS3LexicalMembers('),lastWrite=generated.lastIndexOf('.as3SetLexicalMember(');assert(register<lastWrite);checks.push('lexical-publication-before-static-initializer');
const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'unit-evidence/flash.json'))).rows;let negatives=0;
for(const mutate of [r=>r.pop(),r=>r.reverse(),r=>r.find(x=>x.id==='catch-after').value='caught',r=>r.find(x=>x.id==='static-closure').value[2]=false]){const changed=structuredClone(expected);mutate(changed);assert.throws(()=>assert.deepEqual(changed,expected));negatives++;}
const out=path.join(compiler,'.cache/native-lexical-members');fs.mkdirSync(out,{recursive:true});const report=path.join(out,'guards.json');fs.writeFileSync(report,JSON.stringify({checks,negativeComparisons:negatives,firstFixtureRows:26,firstFixtureStatus:'complete-source-held'},null,2));console.log(JSON.stringify({report,checks:checks.length,negativeComparisons:negatives}));
