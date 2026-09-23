const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('node:assert/strict'),crypto=require('crypto');
const compiler=path.resolve(__dirname,'../..'),parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit'));
const evidence=path.join(__dirname,'unit-evidence');
const source=fs.readFileSync(path.join(evidence,'sources/original/probe/LexicalUnit.as'),'utf8');
const metadata=JSON.parse(cp.execFileSync(process.env.PYTHON||'python',[path.join(__dirname,'extract-metadata.py'),evidence],{encoding:'utf8',windowsHide:true}));
const qname='probe.LexicalUnit',original='var secret:* = "local"; return secret;';
function options(text){const classes=structuredClone(metadata.classes);classes[qname].sourceSha256=crypto.createHash('sha256').update(text).digest('hex');return {customVisitors:[],definitionsByNamespace:{probe:['LexicalUnit']},nativeClassInitialization:{classes:{[qname]:'lazy'}},nativeCallableClasses:{[qname]:text},nativeCallableMetadata:{module:'./AS3MethodBinding',classes},nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableStringModule:'./AS3String',nativeArrayCreationModule:'./AS3ArrayCreation',nativeLexicalMembersModule:'./AS3LexicalMembers'}};
// These source mutations verify rejection boundaries, not additional runtime passes.
const cases=[
 ['earlier-private-read','var before:* = secret; var secret:* = "local"; return [before,secret];'],
 ['earlier-protected-read','var before:* = amount; var amount:* = "local"; return [before,amount];'],
 ['earlier-public-read','var before:* = publicValue; var publicValue:* = "local"; return [before,publicValue];'],
 ['self-initializer','var secret:* = secret; return secret;'],
 ['uninitialized','var secret:*; return secret;'],
 ['conditional','if (false) {var secret:* = "local";} return secret;'],
 ['catch-declaration','try {throw "caught";} catch(e:*) {var secret:* = "local";} return secret;'],
 ['loop-declaration','while (false) {var secret:* = "local";} return secret;'],
 ['multiple-declarations','var before:* = secret, secret:* = "local"; return [before,secret];'],
 ['repeated-declaration','var secret:* = "first"; var secret:* = "second"; return secret;'],
 ['earlier-method-value','var before:* = secretMethod; var secretMethod:* = "local"; return before;'],
 ['earlier-method-call','var before:* = secretMethod(1); var secretMethod:* = "local"; return before;'],
];
for(const [id,body] of cases){const text=source.replace(original,body);assert.notEqual(text,source);assert.throws(()=>emit(parse('LexicalUnit.as',text),text,options(text)),/AS3_LEXICAL_COMPILER_UNSUPPORTED: member\/local declaration-order lookup held/,id);}
assert.doesNotThrow(()=>emit(parse('LexicalUnit.as',source),source,options(source)));
// Authenticate and reject the complete original 89-case class, without editing
// its methods, source hash, or reflected public declaration surface.
const heldEvidence=path.join(__dirname,'declaration-order-evidence');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(sha(path.join(heldEvidence,'files.json')),'07b756a43c8c1da5a8e9745d9b64391d76cb35d9dc69cb68848ca936fb50c0f3');
for(const file of JSON.parse(fs.readFileSync(path.join(heldEvidence,'files.json'))))assert.equal(sha(path.join(heldEvidence,file.path)),file.sha256,file.path);
const captures=['capture-e','capture-f'];let originalRows;
for(const name of captures){
 const capture=path.join(heldEvidence,name),raw=JSON.parse(fs.readFileSync(path.join(capture,'flash.json')));
 assert.equal(raw.rows.length,89);if(originalRows)assert.deepEqual(raw.rows,originalRows);originalRows=raw.rows;
 const text=fs.readFileSync(path.join(capture,'sources/original/probe/DeclarationOrder.as'),'utf8');
 const captured=JSON.parse(cp.execFileSync(process.env.PYTHON||'python',[path.join(__dirname,'extract-metadata.py'),capture],{encoding:'utf8',windowsHide:true}));
 const heldOptions=options(text);heldOptions.definitionsByNamespace={probe:['DeclarationOrder']};
 heldOptions.nativeClassInitialization.classes={'probe.DeclarationOrder':'lazy'};
 heldOptions.nativeCallableClasses={'probe.DeclarationOrder':text};heldOptions.nativeCallableMetadata.classes=captured.classes;
 assert.throws(()=>emit(parse('DeclarationOrder.as',text),text,heldOptions),/AS3_LEXICAL_COMPILER_UNSUPPORTED: member\/local declaration-order lookup held/);
}
const out=path.join(compiler,'.cache/native-lexical-members');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'declaration-order-guards.json'),JSON.stringify({scope:'Complete-source rejection checks; no additional native runtime admission',rejected:cases.map(x=>x[0]),existingCompleteUnitAccepted:true,originalClass:'probe.DeclarationOrder',originalRows:89,originalCaptures:captures,originalClassStatus:'complete-source-held'},null,2));
console.log(JSON.stringify({rejected:cases.length,existingCompleteUnitAccepted:true,originalRows:89,originalClassStatus:'complete-source-held'}));
