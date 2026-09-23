require('./verify-evidence.cjs');
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=__dirname,compiler=path.resolve(root,'../..');
const api=require(path.join(compiler,'lib/index')),parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit'));
const metadata=JSON.parse(cp.execFileSync(process.env.PYTHON,[path.join(root,'extract-metadata.py'),path.join(root,'capture-c')],{encoding:'utf8'}));
const sources=Object.fromEntries(Object.keys(metadata.classes).map(q=>[q,fs.readFileSync(path.join(root,'capture-c/sources/original',q.replaceAll('.','/')+'.as'),'utf8')]));
const input={module:'./declarationDomain',sources,metadata:{module:'./AS3MethodBinding',classes:metadata.classes},lexicalModule:'./AS3LexicalMembers',typedLocals:true};
const domain=api.createNativeDeclarationDomain(input),definitionsByNamespace={};
for(const q of Object.keys(sources)){const i=q.lastIndexOf('.'),p=q.slice(0,i);(definitionsByNamespace[p]??=[]).push(q.slice(i+1));}
function options(d=domain){return {customVisitors:[],definitionsByNamespace,nativeClassInitialization:{classes:Object.fromEntries(Object.keys(d.sources).map(q=>[q,'lazy']))},nativeCallableClasses:d.sources,nativeCallableMetadata:d.metadata,nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableStringModule:'./AS3String',nativeArrayCreationModule:'./AS3ArrayCreation',nativeLexicalMembersModule:'./AS3LexicalMembers',nativeTypedLocals:true,nativeTypedLocalAdditionModule:'./AS3Addition'};}
const out=path.join(compiler,'.cache/native-foreign-typed-locals/generated');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'declarationDomain.ts'),domain.moduleSource);
for(const [q,s] of Object.entries(sources))fs.writeFileSync(path.join(out,q+'.ts'),emit(parse(q+'.as',s),s,options()));
fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify({bindings:domain.bindings,references:domain.references},null,2));
console.log(JSON.stringify({classes:domain.bindings.length,references:domain.references.length}));
module.exports={domain,input,options,api,parse,emit,root,compiler,out};
