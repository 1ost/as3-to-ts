const assert=require('assert');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const ts=require('typescript');
const parse=require('../../lib/parse');
const emit=require('../../lib/emit');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../../../op2-html5'));
const sources=[
 ['game-client-flash/src/com/greensock/layout/core/LiquidData.as','4f3340cadc2ce66ba4721905c28f7867ae2692ce082c1285334edee499e7c6c7'],
 ['game-client-flash/src/cn/kyiax/yare/core/loader/parser/SWFResourceParser.as','295497a1a734ace5276059457fe10277ad260ddf45f1bbafe4ec77a94bac95cf']
];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
for(const [relative,expectedHash] of sources){
 const file=path.join(root,relative),raw=fs.readFileSync(file);assert.equal(sha(raw),expectedHash,'Changed maintained source: '+relative);
 const source=raw.toString('utf8'),output=emit(parse(path.basename(file),source),source,{lineSeparator:'\n',customVisitors:[],definitionsByNamespace:{}});
 assert.deepEqual(ts.createSourceFile(path.basename(file)+'.ts',output,ts.ScriptTarget.Latest,true).parseDiagnostics,[],relative);
 for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
  const result=ts.transpileModule(output,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});
  assert.deepEqual(result.diagnostics,[],relative);
 }
 console.log(JSON.stringify({source:relative,inputSHA256:sha(raw),outputSHA256:sha(output),syntaxPassed:true,runtimeAdmission:false}));
}
