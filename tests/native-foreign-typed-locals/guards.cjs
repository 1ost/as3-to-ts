const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto');
const {domain,input,options,api,parse,emit,root,compiler,out}=require('./emit-domain.cjs');
const clone=x=>JSON.parse(JSON.stringify(x)),q='refs.Entry',source=domain.sources[q],records=[];
const original=()=>{const value=clone(input);delete value.metadata.nativeDeclarationDomain;return value;};
function check(id,f){f();records.push({id,pass:true});}
function rejected(id,mutate,pattern){check(id,()=>{const v=original();mutate(v);let caught;try{const d=api.createNativeDeclarationDomain(v);for(const [name,s]of Object.entries(d.sources))emit(parse(name+'.as',s),s,options(d));}catch(e){caught=String(e);}assert(caught,'unexpected admission');if(pattern)assert.match(caught,pattern);});}
function change(v,old,text){assert(v.sources[q].includes(old));v.sources[q]=v.sources[q].replace(old,text);v.metadata.classes[q].sourceSha256=crypto.createHash('sha256').update(v.sources[q]).digest('hex');}
check('exact-domain-repeat-emission',()=>{for(const [name,s]of Object.entries(domain.sources))assert.equal(emit(parse(name+'.as',s),s,options()),emit(parse(name+'.as',s),s,options()));});
check('domain-no-lazy-class-read',()=>assert.doesNotMatch(domain.moduleSource,/readNativeClass|from ["']\.\/(?:Peer|DeferredPeer)["']/));
check('no-domain-foreign-local-remains-held',()=>{const o=options();o.nativeCallableMetadata=clone(input.metadata);o.nativeCallableClasses=input.sources;assert.throws(()=>emit(parse(q+'.as',source),source,o),/foreign local reference identity held/);});
check('copied-domain-metadata-rejected',()=>{const o=options();o.nativeCallableMetadata=clone(domain.metadata);assert.throws(()=>emit(parse(q+'.as',source),source,o));});
check('changed-complete-source-table-rejected',()=>{const o=options();o.nativeCallableClasses={...domain.sources,[q]:source+' '};assert.throws(()=>emit(parse(q+'.as',source),source,o),/planned source bytes changed/);});
check('source-drift-without-authentication-rejected',()=>{const v=original();v.sources[q]+=' ';assert.throws(()=>api.createNativeDeclarationDomain(v),/exact authenticated source bytes/);});
rejected('missing-target-source-and-metadata',v=>{delete v.sources['refs.Peer'];delete v.metadata.classes['refs.Peer'];},/unresolved|unknown qualified/);
rejected('missing-target-metadata',v=>delete v.metadata.classes['refs.Peer'],/exact complete/);
rejected('swapped-namesake-metadata',v=>v.metadata.classes['refs.Peer']=v.metadata.classes['elsewhere.Peer']);
rejected('qualified-reference-without-import',v=>{change(v,'import refs.Peer;','');change(v,'var item:Peer;','var item:elsewhere.Peer;');},/lacks source import/);
rejected('ambiguous-bare-import',v=>change(v,'import refs.Peer;','import refs.Peer;import elsewhere.Peer;'),/ambiguous source annotation/);
for(const name of ['Array','Number','String'])rejected('builtin-namesake-'+name,v=>{change(v,'import refs.Peer;','import refs.Peer;import other.'+name+';');change(v,'var item:Peer;','var item:'+name+';');},/builtin-name annotation remains held/);
for(const [id,body,pattern] of [
 ['compound','var item:Peer=value;item+=value;return item;',/reference local compound operation held/],
 ['prefix','var item:Peer=value;++item;return item;',/nonnumeric local update held/],
 ['postfix','var item:Peer=value;item--;return item;',/nonnumeric local update held/],
 ['const','const item:Peer=value;return item;',/typed local const held/],
 ['enumeration','var item:Peer;for(item in value){}return item;',/source enumeration targets held/],
 ['destructuring','var item:Peer;[item]=value;return item;',/source destructuring targets held/],
 ['catch-shadow-write','var item:Peer=value;try{throw value;}catch(item:*){item=value;}return item;',/catch-shadow writes held/],
 ['parameter-redeclaration','var value:Peer;return value;',/typed local\/parameter redeclaration held/],
 ['nested-function','var item:Peer=value;var fn:*=function():*{return item;};return item;',/anonymous\/nested/]
])rejected(id,v=>change(v,'var item:Peer=value;return item;',body),pattern);
rejected('typed-method-parameter-still-held',v=>change(v,'initialize(value:*)','initialize(value:Peer)'),/method parameter/);
rejected('typed-method-return-still-held',v=>change(v,'initialize(value:*):*','initialize(value:*):Peer'),/method returns held/);
rejected('foreign-constructor-parameter-still-held',v=>change(v,'function Entry()','function Entry(value:Peer)'),/constructor|metadata|parameter/);
check('declaration-and-reference-records-frozen',()=>{assert(Object.isFrozen(domain.bindings));assert(Object.isFrozen(domain.references));for(const r of domain.references)assert(Object.isFrozen(r));});
check('every-reference-coercion-uses-domain-token',()=>{const ts=require(path.join(compiler,'node_modules/typescript')),text=fs.readFileSync(path.join(out,'refs.Entry.ts'),'utf8'),file=ts.createSourceFile('Entry.ts',text,ts.ScriptTarget.Latest,true),calls=[];const walk=n=>{if(n.kind===ts.SyntaxKind.CallExpression&&n.expression.name&&n.expression.name.text==='as3CoerceReference')calls.push(n);ts.forEachChild(n,walk);};walk(file);assert(calls.length>5);for(const c of calls){assert.equal(c.arguments.length,2);assert.match(c.arguments[1].getText(file),/^__as3_callable_declarationDomain\.type\d+$/);}});
fs.writeFileSync(path.join(compiler,'.cache/native-foreign-typed-locals/guards.json'),JSON.stringify({records,syntheticSourceRejections:true,originalFidelityClaim:false},null,2));console.log(JSON.stringify({guards:records.length}));
