const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{createHash}=require('node:crypto');
const compiler=path.resolve(__dirname,'../..'),baseline=path.resolve(process.argv[2]||'');
assert.ok(process.argv[2],'Pass the independently built baseline lib directory');
const hash=text=>createHash('sha256').update(text).digest('hex');
const {verify}=require('../native-class-metadata/evidence.cjs');
const versions=[baseline,path.join(compiler,'lib')].map(root=>({parse:require(path.join(root,'parse')),emit:require(path.join(root,'emit'))}));
const results=[];
function compare(name,sources,metadata){
 const classes=Object.fromEntries(Object.keys(sources).map(q=>[q,'lazy']));
 for(const [qname,source] of Object.entries(sources)){
  const outcomes=versions.map(api=>{try{return {output:api.emit(api.parse(qname+'.as',source),source,{customVisitors:[],definitionsByNamespace:{},nativeClassInitialization:{classes},nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableClasses:sources,nativeCallableMetadata:metadata})};}catch(error){return {error:error.message};}});
  assert.deepEqual(outcomes[1],outcomes[0],name+':'+qname);
  results.push({name,qname,...(outcomes[0].error?{error:outcomes[0].error}:{outputSha256:hash(outcomes[0].output)})});
 }
}
for(const group of ['lifecycle','predicates']){
 const input=verify(group);
 compare(group+'-metadata',input.sources,{module:'./AS3MethodBinding',classes:input.metadata.classes});
}
compare('plain',{'plain.Subject':'package plain { public class Subject { public var n:int=1; public function Subject() {} public function read():int { return n; } } }'});
for(const expression of ['Subject.prototype','Subject.call(null)','Subject.apply(null,[])','Subject.bind(null)']){
 const before=results.length;
 compare('plain-rejection',{'plain.Subject':'package plain { public class Subject { public function Subject() { '+expression+'; } } }'});
 assert.match(results[before].error,/direct callable-constructor invocation\/prototype manipulation/);
}
const report={baseline,baselineCallableSha256:hash(fs.readFileSync(path.join(baseline,'emit/native-callable-classes.js'))),currentCallableSha256:hash(fs.readFileSync(path.join(compiler,'lib/emit/native-callable-classes.js'))),results};
const out=path.join(compiler,'.cache/callable-analysis-equivalence.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out,identicalOutputs:results.filter(r=>r.outputSha256).length,identicalRejections:results.filter(r=>r.error).length}));
