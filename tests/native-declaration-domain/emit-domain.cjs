require('./verify-evidence.cjs');
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('node:assert/strict');
const root=__dirname,compiler=path.resolve(root,'../..');
const api=require(path.join(compiler,'lib/index')),parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit'));
const evidence=path.join(root,'capture-a');
const metadata=JSON.parse(cp.execFileSync(process.env.PYTHON,[path.join(root,'extract-metadata.py'),evidence],{encoding:'utf8',windowsHide:true}));
const sources=Object.fromEntries(Object.keys(metadata.classes).map(q=>[q,fs.readFileSync(path.join(evidence,'sources/original',q.replaceAll('.','/')+'.as'),'utf8')]));
const input={module:'./declarationDomain',sources,metadata:{module:'./AS3MethodBinding',classes:metadata.classes},lexicalModule:'./AS3LexicalMembers',typedLocals:true};
const domain=api.createNativeDeclarationDomain(input);
const definitionsByNamespace={};for(const q of Object.keys(sources)){const i=q.lastIndexOf('.'),p=q.slice(0,i);(definitionsByNamespace[p]??=[]).push(q.slice(i+1));}
function options(d=domain){return {customVisitors:[],definitionsByNamespace,nativeClassInitialization:{classes:Object.fromEntries(Object.keys(d.sources).map(q=>[q,'lazy']))},nativeCallableClasses:d.sources,nativeCallableMetadata:d.metadata,nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableStringModule:'./AS3String',nativeArrayCreationModule:'./AS3ArrayCreation',nativeLexicalMembersModule:'./AS3LexicalMembers',nativeTypedLocals:true,nativeTypedLocalAdditionModule:'./AS3Addition'};}
// Output ownership belongs to this build caller, not a process-global QName map.
function writeDomain(plan,file,outputs){const resolved=path.resolve(file),owner=outputs.get(resolved);if(owner&&owner!==plan)throw Error('declaration domain output already owned by another plan');outputs.set(resolved,plan);fs.mkdirSync(path.dirname(resolved),{recursive:true});fs.writeFileSync(resolved,plan.moduleSource);}
const out=path.join(compiler,'.cache/native-declaration-domain/generated');fs.mkdirSync(out,{recursive:true});const outputs=new Map();writeDomain(domain,path.join(out,'declarationDomain.ts'),outputs);
for(const [q,s] of Object.entries(domain.sources)){const generated=emit(parse(q+'.as',s),s,options());fs.writeFileSync(path.join(out,q+'.ts'),generated);}
fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify({bindings:domain.bindings,references:domain.references},null,2));
console.log(JSON.stringify({classes:domain.bindings.length,references:domain.references.length}));
module.exports={domain,input,options,api,parse,emit,root,compiler,metadata,writeDomain};
