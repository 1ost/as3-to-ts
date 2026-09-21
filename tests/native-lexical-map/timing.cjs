const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const compiler=path.resolve(__dirname,'../..'),parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit'));
const evidence=path.join(__dirname,'timing-evidence'),read=p=>fs.readFileSync(p,'utf8'),json=p=>JSON.parse(read(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(path.join(evidence,'handoff.json')),'40da095c5aa69a903aa894a3e3eec4eaff3dacf70963731374b25078132d47b4');
const handoff=json(path.join(evidence,'handoff.json')),manifest=json(path.join(evidence,'research-files.json'));assert.equal(sha(path.join(evidence,'research-files.json')),handoff.manifest.sha256);
assert.equal(sha(path.join(evidence,'research-evidence.zip')),handoff.archive.sha256);
function authenticate(name){assert.equal(sha(path.join(evidence,name)),manifest.find(x=>x.path===name).sha256,name);}
authenticate('authentication.json');authenticate('metadata.json');const auth=json(path.join(evidence,'authentication.json')),metadata=json(path.join(evidence,'metadata.json'));
const results=[];for(const item of auth.fullSources){const name='options/native-typed-locals-structural-'+item.qname+'.options.json';authenticate(name);const options=json(path.join(evidence,name));
 assert.equal(Object.keys(options.nativeCallableClasses).length,5);assert.equal(Object.keys(options.nativeCallableMetadata.classes).length,5);
 for(const s of auth.fullSources){assert.equal(hash(options.nativeCallableClasses[s.qname]),s.sha256);assert.deepEqual(options.nativeCallableMetadata.classes[s.qname],metadata.classes[s.qname]);}
 const before=JSON.stringify(options);let error;try{emit(parse(item.path,options.nativeCallableClasses[item.qname]),options.nativeCallableClasses[item.qname],options);}catch(e){error=String(e);}assert(error,item.qname+' unexpectedly admitted');assert.equal(JSON.stringify(options),before);
 const derived=/TweenLite$|SimpleTimeline$/.test(item.qname);assert.match(error,derived?/Object-root declaration required/:/foreign local reference/);
 if(item.qname.endsWith('PropTween')){assert.match(error,/source-map declaration: com.greensock.plugins.TweenPlugin/);assert(!error.includes('nonpublic source members'));}
 results.push({qname:item.qname,sourceSHA256:item.sha256,sourceMapCount:5,metadataCount:5,status:'held',error});
}
const cache=path.join(compiler,'.cache/native-lexical-map');fs.mkdirSync(cache,{recursive:true});const run=fs.mkdtempSync(path.join(cache,'timing-'));fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({originalResearchSHA256:sha(path.join(evidence,'handoff.json')),scope:'Complete maintained five-class source and metadata maps, no pruning or source substitution. Diagnostic only; no whole timing admission.',results},null,2));console.log(JSON.stringify({run,results}));
