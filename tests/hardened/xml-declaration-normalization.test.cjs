'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),test=require('node:test'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
test('XML source leaves authenticate declarations without executable XML admission',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xml-declaration-test-'));
 try {
  const bundle=path.join(dir,'api.cjs');require('esbuild').buildSync({stdin:{contents:'export {default as parse} from "./src/parse/index"; export * from "./src/hardened/parser-normalizer"; export * from "./src/hardened/local-declarations"; export * from "./src/hardened/adapter"; export * from "./src/hardened/ledger";',resolveDir:root},outfile:bundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
  const api=require(bundle),sourceCensusJson=JSON.stringify({as3SourceCapabilities:{apis:[],memberUses:[]}}),targetCapabilitiesJson=JSON.stringify({capabilities:[]}),mappingJson=JSON.stringify({mappings:[],schema:'as3-source-to-laya-capability-map@1'})+'\n';
  const nativeTimerAuthorityJson=fs.readFileSync(path.join(root,"config/native-timer-authority.json"),"utf8").replace(/\r\n?/g,"\n");
  const authority=api.loadCapabilityAuthority({applicationProfile:true,sourceCensusJson,sourceCensusSha256:sha(sourceCensusJson),targetCapabilitiesJson,targetCapabilitiesSha256:sha(targetCapabilitiesJson),mappingJson,mappingSha256:sha(mappingJson),nativeTimerAuthorityJson,nativeTimerAuthoritySha256:sha(nativeTimerAuthorityJson)},sha);
  for(const literal of ['<root>\n<icon iconUrl="miniStar"/>\n</root>','<root>\n<icon iconUrl="miniStar">{1 + 2}</icon>\n</root>']){
   const source='package p {\n public class Markup {\n public static function setBase(value:Object):void {}\n public function markup():Object {\n var result:Object = '+literal+';\n return result;\n }\n }\n}\n';
   const ast=api.normalizeParserAst(api.parse('Markup.as',source),source,sha),leaf=ast.nodes.find(n=>n.kind==='XML_LITERAL');
   assert.ok(leaf);assert.equal(leaf.text,literal);assert.equal(source.slice(leaf.span.start,leaf.span.end),literal);assert.equal(ast.sourceSha256,sha(source));
   assert.deepEqual(api.normalizeParserAst(api.parse('Markup.as',source),source,sha),ast);
   const declaration=api.extractLocalDeclaration(ast,source,sha,'Markup.as');assert.equal(declaration.members.find(m=>m.name==='setBase').returnType,'void');
   assert.throws(()=>api.adaptNormalizedParserAst(ast,authority,source,sha),e=>e.name==='HardenedSemanticError'&&/XML_LITERAL/.test(e.message));
  const changed=source.replace('miniStar','otherStar');assert.throws(()=>api.extractLocalDeclaration(ast,changed,sha,'Markup.as'));
  const tree=api.parse('Markup.as',source);function corrupt(n){if(n.text===literal)n.text='<root/>';for(const c of n.children||[])corrupt(c);}corrupt(tree);
  assert.throws(()=>api.normalizeParserAst(tree,source,sha),e=>e.name==='ParserNormalizationError');
 }
  const descendantSource='package p {\n public class ReflectionHolder {\n public static function inspect(value:XML):String {\n var properties:XMLList = value..accessor.(@access != "writeonly") + value..variable;\n return "";\n }\n }\n}\n';
  const descendantAst=api.normalizeParserAst(api.parse('ReflectionHolder.as',descendantSource),descendantSource,sha);
  assert.equal(descendantAst.nodes.filter(n=>n.kind==='E4X_DESCENDANT').length,2);
  const descendantDeclaration=api.extractLocalDeclaration(descendantAst,descendantSource,sha,'ReflectionHolder.as');
  assert.equal(descendantDeclaration.members.find(m=>m.name==='inspect').returnType,'String');
  assert.throws(()=>api.adaptNormalizedParserAst(descendantAst,authority,descendantSource,sha),e=>e.name==='HardenedSemanticError');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('authenticated static XML leaves lower through the shared LayaAir provider',
    {skip:!process.env.HARDENED_FIXTURE_LAYA},()=>{
 const laya=fs.realpathSync.native(process.env.HARDENED_FIXTURE_LAYA),dir=fs.mkdtempSync(path.join(os.tmpdir(),'xml-static-literal-test-'));
 const bundle=path.join(root,'.cache','xml-static-literal-api-'+process.pid+'.cjs');
 try {
  const produced=spawnSync('python3',['-B','-c',
   'from reflection_provider_profile import produce_xml_static_literal_provider_profile; import sys; produce_xml_static_literal_provider_profile(profile_root=sys.argv[1],laya_root=sys.argv[2])',dir,laya],
   {cwd:root,env:{...process.env,PYTHONPATH:path.join(root,'tools')},encoding:'utf8',timeout:120000});
  assert.equal(produced.status,0,produced.stderr);
  const targetPath=path.join(laya,'docTool/architecture/authored-content-capabilities.json');
  const targetJson=fs.readFileSync(targetPath,'utf8'),proof=fs.readFileSync(path.join(dir,'xml-static-literal-provider.json'),'utf8');
  fs.mkdirSync(path.dirname(bundle),{recursive:true});require('esbuild').buildSync({stdin:{contents:'export {default as parse} from "./src/parse/index"; export * from "./src/hardened/parser-normalizer"; export * from "./src/hardened/adapter"; export * from "./src/hardened/ledger"; export * from "./src/hardened/emitter"; export * from "./src/hardened/xml-static-literal-provider-authority";',resolveDir:root},outfile:bundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
  const api=require(bundle),provider=api.loadXMLStaticLiteralProviderTarget(proof,targetPath,targetJson);
  const sourceCensusJson=JSON.stringify({as3SourceCapabilities:{apis:[],memberUses:[]}}),mappingJson=JSON.stringify({mappings:[],schema:'as3-source-to-laya-capability-map@1'})+'\n';
  const nativeTimerAuthorityJson=fs.readFileSync(path.join(root,'config/native-timer-authority.json'),'utf8').replace(/\r\n?/g,'\n');
  const authority=api.loadCapabilityAuthority({applicationProfile:true,sourceCensusJson,sourceCensusSha256:sha(sourceCensusJson),targetCapabilitiesJson:targetJson,targetCapabilitiesSha256:sha(targetJson),mappingJson,mappingSha256:sha(mappingJson),nativeTimerAuthorityJson,nativeTimerAuthoritySha256:sha(nativeTimerAuthorityJson),xmlStaticLiteralProvider:provider},sha);
  const literal='<root>\n  <icon iconUrl="miniStar" iconType="uiSkin" iconStr=":]"/>\n</root>';
  const source='package p { public class Markup { public function markup():Object { var result:Object = '+literal+'; return result; } } }';
  const ast=api.normalizeParserAst(api.parse('Markup.as',source),source,sha);
  const semantic=api.adaptNormalizedParserAst(ast,authority,source,sha);
  const output=api.emitSemanticProgram(semantic,{compiler:require('typescript-4-9'),expectedTypeScriptVersion:'4.9.5',sha256:sha}).code;
  assert.match(output,/as3XMLStaticLiteral as __as3XMLStaticLiteral/);
  assert.match(output,/from "laya\/flash\/utils\/AS3XML"/);
  assert.match(output,/__as3XMLStaticLiteral\("<root>\\n  <icon/);
  assert.ok(output.includes('iconUrl=\\"miniStar\\"') && output.includes('iconType=\\"uiSkin\\"'));
  const dynamic=source.replace('iconStr=":]"','iconStr="{1 + 2}"');
  assert.throws(()=>api.adaptNormalizedParserAst(api.normalizeParserAst(api.parse('Markup.as',dynamic),dynamic,sha),authority,dynamic,sha),
   error=>error.code==='HARDENED_XML_STATIC_LITERAL_DYNAMIC');
  const tampered=JSON.parse(proof),module='src/layaAir/flash/utils/AS3XML.ts';tampered.targetSources[module]='0'.repeat(64);
  assert.throws(()=>api.loadXMLStaticLiteralProviderTarget(JSON.stringify(tampered),targetPath,targetJson),
   error=>error.code==='HARDENED_XML_STATIC_LITERAL_PROVIDER_AUTHORITY');
 }finally{fs.rmSync(bundle,{force:true});fs.rmSync(dir,{recursive:true,force:true});}
});
