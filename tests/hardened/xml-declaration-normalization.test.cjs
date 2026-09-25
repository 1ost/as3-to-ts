'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),test=require('node:test');
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
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
