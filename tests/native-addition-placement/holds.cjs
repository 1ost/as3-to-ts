const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('node:assert/strict');
const compiler=path.resolve(__dirname,'../..'),parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');assert.equal(sha(path.join(__dirname,'held-files.json')),'56276886c790519ef639c094de0cabcd4c9fd75cba88fe0b9ac5f37eb6fb3e80');
for(const f of JSON.parse(fs.readFileSync(path.join(__dirname,'held-files.json'),'utf8')))assert.equal(sha(path.join(__dirname,f.path)),f.sha256,f.path);
const reports=[];
for(const folder of ['held-evidence','held-repeat-evidence']){
 const evidence=path.join(__dirname,folder),source=fs.readFileSync(path.join(evidence,'sources/original/probe/Placement.as'),'utf8'),qname='probe.Placement';
 const metadata=JSON.parse(cp.execFileSync(process.env.PYTHON,[path.join(__dirname,'extract-metadata.py'),evidence],{encoding:'utf8',windowsHide:true}));
 const options={customVisitors:[],definitionsByNamespace:{probe:['Placement']},nativeClassInitialization:{classes:{[qname]:'lazy'}},nativeCallableClasses:{[qname]:source},nativeCallableMetadata:{module:'./AS3MethodBinding',classes:metadata.classes},nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableStringModule:'./AS3String',nativeArrayCreationModule:'./AS3ArrayCreation',nativeLexicalMembersModule:'./AS3LexicalMembers',nativeTypedLocals:true,nativeTypedLocalAdditionModule:'./AS3Addition'};
 assert.throws(()=>emit(parse('Placement.as',source),source,options),/AS3_LEXICAL_COMPILER_UNSUPPORTED: typed method parameter entry held/);
 const original=JSON.parse(fs.readFileSync(path.join(evidence,'flash.json'),'utf8'));assert.equal(original.rows.length,32);
 reports.push({folder,sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),rows:original.rows.length,hold:'Existing explicit wildcard method parameter annotation required',nativeRowsAdmitted:0});
}
const out=path.join(compiler,'.cache/native-addition-placement');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'complete-source-holds.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
