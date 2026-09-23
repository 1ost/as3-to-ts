const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('node:assert/strict');
const compiler=path.resolve(__dirname,'../..'),parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit')),evidence=path.join(__dirname,'evidence');
const source=fs.readFileSync(path.join(evidence,'sources/original/probe/Placement.as'),'utf8'),qname='probe.Placement';
const metadata=JSON.parse(cp.execFileSync(process.env.PYTHON,[path.join(__dirname,'extract-metadata.py'),evidence],{encoding:'utf8',windowsHide:true}));
function options(text){const classes=structuredClone(metadata.classes);classes[qname].sourceSha256=crypto.createHash('sha256').update(text).digest('hex');return {customVisitors:[],definitionsByNamespace:{probe:['Placement']},nativeClassInitialization:{classes:{[qname]:'lazy'}},nativeCallableClasses:{[qname]:text},nativeCallableMetadata:{module:'./AS3MethodBinding',classes},nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableStringModule:'./AS3String',nativeArrayCreationModule:'./AS3ArrayCreation',nativeLexicalMembersModule:'./AS3LexicalMembers',nativeTypedLocals:true,nativeTypedLocalAdditionModule:'./AS3Addition'}}
const checks=[];
for(const[id,from,to,re]of[
 ['catch-local-redeclaration','catch(s:*){s="changed";','catch(s:*){var s:*="changed";',/local\/catch redeclaration/],
 ['nested-same-name-catch','catch(s:*){s="changed";','catch(s:*){try{throw "nested";}catch(s:*){s="changed";}',/nested catch write ownership/],
 ['catch-numeric-compound','catch(s:*){s="changed";','catch(s:*){s-=1;',/catch write operator/],
 ['catch-prefix-update','catch(s:*){s="changed";','catch(s:*){++s;',/catch write operator/],
 ['catch-postfix-update','catch(s:*){s="changed";','catch(s:*){s++;',/catch write operator/],
 ['catch-constant-outer','var s:*="outer";var inside:*;try{throw "x";}catch(s:*){s="changed";','const s:*="outer";var inside:*;try{throw "x";}catch(s:*){s="changed";',/non-wildcard outer catch write/],
 ['catch-field-write','catch(caught:*){caught="changed";inside=caught;}','catch(state:*){state="changed";inside=state;}',/catch-shadow field write/],
 ['unqualified-field-compound','public function case0(value:*):*{return "x"+value;}','public function case0(value:*):*{return state+=value;}',/UNSUPPORTED/],
 ['enumeration-write','var s:*="x";var r:*=s+=value;','var s:*="x";for(s in value){}var r:*=s+=value;',/enumeration targets/],
 ['nested-source-function','var s:*="x";var r:*=s+=value;','var s:*="x";var f:*=function():*{return s;};var r:*=s+=value;',/anonymous\/nested/]
]){assert(source.includes(from),id);const text=source.replace(from,to);assert.throws(()=>emit(parse('Placement.as',text),text,options(text)),re,id);checks.push(id);}
const generated=emit(parse('Placement.as',source),source,options(source));
assert(generated.includes('__as3_outer_wildcard_0_read'));assert(generated.includes('__as3_outer_wildcard_0_write_value'));
const out=path.join(compiler,'.cache/native-addition-placement');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'guards.json'),JSON.stringify({checks,scope:'Complete-source rejection controls, never additional native row admission'},null,2));console.log(JSON.stringify({guards:checks.length}));
