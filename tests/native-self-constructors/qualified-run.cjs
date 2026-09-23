const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto'),cp=require('child_process'),vm=require('vm');
const here=__dirname,compiler=path.resolve(here,'../..'),run=path.resolve(process.argv[2]);
const engine=process.env.LAYA_ENGINE_REPOSITORY||path.resolve(compiler,'../LayaAir-op2');
const ts=require(path.join(compiler,'node_modules/typescript')),modern=require(path.join(engine,'node_modules/typescript'));
const parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit'));
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const records=[];
for(const [name,receiptHash,className='String'] of [['self','787760ad078772537bd2525a3f0b3509c8e524e1784f42ab73c52c82314821ee'],['wildcard','b21a5910e884a74c5123f9edb3d305ffd7419e9fa196f7d9176dcdb7b911e5c5'],['Number','f17a7f4be86b090406b1627f1ebf5865833479f8b216b6b839a95e9060fdcec0','Number'],['Boolean','f17a7f4be86b090406b1627f1ebf5865833479f8b216b6b839a95e9060fdcec0','Boolean']]){
 const isDefault=className!=='String',qname='probe.'+className;
 const evidence=path.join(here,'qualified-evidence',isDefault?'defaults':name),receipt=path.join(evidence,'provenance.json');assert.equal(sha(receipt),receiptHash);
 for(const f of JSON.parse(fs.readFileSync(receipt)).files){const rel=f.path.replaceAll('\\','/'),p=fs.existsSync(path.join(evidence,rel))?path.join(evidence,rel):path.join(evidence,'sources',rel);assert.equal(sha(p),f.sha256);}
 const original=JSON.parse(fs.readFileSync(path.join(evidence,'flash.json'))),source=fs.readFileSync(path.join(evidence,'sources/original/probe',className+'.as'),'utf8');
 const metadata=JSON.parse(cp.execFileSync(process.env.PYTHON||'python',[path.join(here,'extract-metadata.py'),evidence],{encoding:'utf8'}));
 const options={customVisitors:[],definitionsByNamespace:{probe:[className]},nativeClassInitialization:{classes:{[qname]:'lazy'}},nativeCallableClasses:{[qname]:source},nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableStringModule:'./AS3String',nativeCallableMetadata:{module:'./AS3MethodBinding',classes:metadata.classes}};
 const output=emit(parse(className+'.as',source),source,options);
 assert(!output.includes('stringString'));assert(output.includes('.as3CoerceReference('));assert(!output.includes('__as3_callable_string(value)'));
 if(!isDefault){
  const wrong=source.replaceAll('probe.String','String'),wrongOptions=structuredClone(options);wrongOptions.nativeCallableClasses['probe.String']=wrong;wrongOptions.nativeCallableMetadata.classes['probe.String'].sourceSha256=crypto.createHash('sha256').update(wrong).digest('hex');
  assert.throws(()=>emit(parse('String.as',wrong),wrong,wrongOptions),/ambiguous unqualified own\/builtin type String/);
 }
 records.push({name,className,isDefault,source,output,expected:isDefault?original.rows.filter(row=>row.id.startsWith(className+'/')):original.rows,receiptHash});
}
(async()=>{const browser=await chromium.launch({headless:true}),reports=[];try{
 for(const target of [1,2]){
  const dir=path.join(run,'target-'+target);let bundle=fs.readFileSync(path.join(dir,'bundle.js'),'utf8');assert(bundle.endsWith('}'));
  let extra='globalThis.qualifiedRows={};';
  for(const record of records){
   const compiled=ts.transpileModule(record.output,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});assert.deepEqual(compiled.diagnostics,[]);
   fs.writeFileSync(path.join(dir,'Qualified'+record.name+'.ts'),record.output);
   extra+='{const exports={};new Function("exports","require",'+JSON.stringify(compiled.outputText)+')(exports,r=>modules.get(r.split("/").pop()));const S=modules.get("nativeClass").readNativeClass(exports['+JSON.stringify(record.className)+']),v=new S(),rows=[];function row(id,f){try{rows.push({id,value:f()});}catch(e){rows.push({id,error:e.errorID,name:e.name});}}';
   const offset=record.isDefault?1:0;
   if(record.isDefault)extra+='row('+JSON.stringify(record.expected[0].id)+',()=>modules.get("AS3MethodBinding").as3GetProperty(S,"stored")===null);';
   extra+='row('+JSON.stringify(record.expected[offset].id)+',()=>v.next===null);row('+JSON.stringify(record.expected[offset+1].id)+',()=>new S(v).next===v);row('+JSON.stringify(record.expected[offset+2].id)+',()=>new S({}).next);globalThis.qualifiedRows['+JSON.stringify(record.name)+']=rows;}';
  }
  bundle=bundle.slice(0,-1)+extra+'}';fs.writeFileSync(path.join(dir,'qualified-bundle.js'),bundle);
  const context=vm.createContext({});vm.runInContext(bundle,context);const node=JSON.parse(JSON.stringify(context.qualifiedRows));
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.addScriptTag({content:bundle});const web=await page.evaluate(()=>globalThis.qualifiedRows);await page.close();assert.deepEqual(errors,[]);
  for(const record of records){assert.deepEqual(node[record.name],record.expected);assert.deepEqual(web[record.name],record.expected);}
  const program=modern.createProgram(fs.readdirSync(dir).filter(n=>n.endsWith('.ts')).map(n=>path.join(dir,n)),{target:modern.ScriptTarget.ES2021,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,lib:['lib.es2021.d.ts','lib.dom.d.ts'],experimentalDecorators:true,noEmit:true});
  const diagnostics=modern.getPreEmitDiagnostics(program).map(d=>({code:d.code,message:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));assert.deepEqual(diagnostics,[]);
  reports.push({target,node,chromium:web,diagnostics,bundleSHA256:sha(path.join(dir,'qualified-bundle.js'))});
 }
 const report={ok:true,originalRows:14,reports,receipts:records.map(r=>r.receiptHash),scope:'Authenticated qualified own references and static/instance defaults; ambiguous unqualified reflected-own type rejected'};
 fs.writeFileSync(path.join(run,'qualified-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,originalRows:14,report:path.join(run,'qualified-report.json')}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
