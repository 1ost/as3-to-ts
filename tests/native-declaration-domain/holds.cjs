require('./verify-evidence.cjs');
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('node:assert/strict'),crypto=require('crypto');
const root=__dirname,compiler=path.resolve(root,'../..'),api=require(path.join(compiler,'lib/index')),capture=path.join(root,'held-capture');
const metadata=JSON.parse(cp.execFileSync(process.env.PYTHON,[path.join(root,'extract-metadata.py'),capture],{encoding:'utf8',windowsHide:true}));
const sources=Object.fromEntries(Object.keys(metadata.classes).map(q=>[q,fs.readFileSync(path.join(capture,'sources/original',q.replaceAll('.','/')+'.as'),'utf8')]));
const captures=JSON.parse(fs.readFileSync(path.join(capture,'flash.json')));
const rows=[];for(const q of ['probe.ForeignLocals','probe.QualifiedLocals','probe.SamePackage','cycle.A','cycle.B','init.DeferredHolder','foreign.Child']){
 let error;try{api.createNativeDeclarationDomain({module:'./declarationDomain',sources:{[q]:sources[q]},metadata:{module:'./AS3MethodBinding',classes:{[q]:metadata.classes[q]}},lexicalModule:'./AS3LexicalMembers',typedLocals:true});}catch(e){error=String(e);}
 assert.match(error,q==='foreign.Child'?/Object-root/:/foreign local reference identity/);rows.push({qname:q,completeSource:true,sourceSha256:crypto.createHash('sha256').update(sources[q]).digest('hex'),error});
}
const cache=path.join(compiler,'.cache/native-declaration-domain');fs.mkdirSync(cache,{recursive:true});fs.writeFileSync(path.join(cache,'holds.json'),JSON.stringify({sourceRows:captures.rows.length,heldCompleteClasses:rows,initializationRows:'All seven original initialization/local rows remain held. The new 16-row fixture has separate generated Class-cycle observations; it does not replay foreign typed-local methods.'},null,2));console.log(JSON.stringify({heldClasses:rows.length}));
