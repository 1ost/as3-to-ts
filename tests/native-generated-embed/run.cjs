const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const api = require('../../lib'), parse = require('../../lib/parse'), emit = require('../../lib/emit'), legacyTs = require('typescript');
const engine = path.resolve(process.env.LAYA_ENGINE_REPOSITORY || '../LayaAir-op2');
const assets = path.resolve(process.argv[2] || path.join(engine, '.local/embedded-symbol-catalog-2/native'));
const ts = require(path.join(engine, 'node_modules/typescript')), esbuild = require(path.join(engine, 'node_modules/esbuild'));
const packet = path.join(engine, 'tests/nativeFlashOracle/authored-typed-wrappers');
const expected = require(path.join(packet, 'verify.cjs'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const cache = path.resolve('.cache/native-generated-embed'); fs.mkdirSync(cache, {recursive:true});
const out = fs.mkdtempSync(path.join(cache, 'run-'));
const modulePath = file => {const relative = path.relative(out, file).replaceAll('\\','/').replace(/\.ts$/,''); return relative.startsWith('.') ? relative : './'+relative;};
const provider = name => modulePath(path.join(engine, 'src/layaAir/flash/utils', name+'.ts'));
const manifest = JSON.parse(fs.readFileSync(path.join(assets, 'bootstrap-assets.json')));
const catalog = JSON.parse(fs.readFileSync(path.join(assets, 'catalog.json')));
const provenance = JSON.parse(fs.readFileSync(path.join(packet, 'source-provenance.json')));
assert.equal(manifest.source.sha256, provenance.find(p=>p.path.endsWith('.swf')).sha256);
const sources = {};
for (const item of provenance.filter(p=>p.path.endsWith('.as'))) {
    const bytes = fs.readFileSync(path.join(packet, 'source', item.path)); assert.equal(hash(bytes), item.sha256);
    const qname = item.path.slice(0,-3).replaceAll('/','.');
    const root = manifest.roots.find(r=>r.className===qname); assert(root);
    assert.equal(root.sourceSha256, item.sha256);
    assert.equal(catalog.bundles.find(b=>b.linkage===root.linkage).sourceSha256, manifest.source.sha256);
    sources[qname] = {source:bytes.toString('utf8'),sourceSha256:item.sha256,
        authoredSymbol:{source:'/_assets/assets.swf',linkage:root.linkage,sourceSha256:manifest.source.sha256}};
}
assert.equal(Object.keys(sources).length,8);
const providers = {
    'flash.display.MovieClip':{module:provider('AS3GeneratedMovieClipConstruction'),exportName:'MovieClip',nativeBase:'MovieClip'},
    'flash.display.DisplayObject':{module:provider('AS3CanonicalDisplayReference'),exportName:'DisplayObject'},
    'flash.display.DisplayObjectContainer':{module:modulePath(path.join(engine,'src/layaAir/flash/display/DisplayObjectContainer.ts')),exportName:'DisplayObjectContainer'},
    'flash.display.Graphics':{module:provider('AS3CanonicalGraphicsReference'),exportName:'Graphics'},
    'flash.display.Shader':{module:modulePath(path.join(engine,'src/layaAir/flash/display/Shader.ts')),exportName:'Shader'},
    'flash.accessibility.AccessibilityImplementation':{module:provider('AS3CanonicalAccessibilityReference'),exportName:'AccessibilityImplementation'},
    'flash.geom.Rectangle':{module:provider('AS3CanonicalRectangleReference'),exportName:'Rectangle'},
    'flash.text.TextField':{module:provider('AS3CanonicalTextFieldReference'),exportName:'TextField'},
    'flash.display.Sprite':{module:modulePath(path.join(engine,'src/layaAir/flash/display/Sprite.ts')),exportName:'Sprite'},
    'flash.display.Scene':{module:provider('AS3CanonicalSceneConstruction'),exportName:'Scene'},
};
for(const [name,owner] of [['ContextMenu','flash.ui'],['LoaderInfo','flash.display'],['Stage','flash.display']])
    providers[owner+'.'+name]={module:provider('AS3CanonicalSpriteOwnerReferences'),exportName:name};
for(const [name,owner] of [['Transform','flash.geom'],['SoundTransform','flash.media'],['TextSnapshot','flash.text'],['AccessibilityProperties','flash.accessibility']])
    providers[owner+'.'+name]={module:provider('AS3CanonicalSpriteValueReferences'),exportName:name};
const input = {scope:'original-embed-wrappers',sources,providers,providerModule:provider('AS3GeneratedClass'),interfaceProviderModule:provider('AS3Type')};
const plan = api.createNativeGeneratedDeclarationPlan(input);
let guards=0;
const owner='cn.kyiax.gui.basis.UI_CheatPanel', original=sources[owner];
function reject(record, patch={}) {
    assert.throws(()=>api.createNativeGeneratedDeclarationPlan({...input,...patch,sources:{[owner]:record}}), /AS3_GENERATED_DECLARATIONS_UNSUPPORTED/); guards++;
}
reject({...original,authoredSymbol:undefined});
for(const authoredSymbol of [null,{}, {...original.authoredSymbol,source:'wrong.swf'}, {...original.authoredSymbol,linkage:'wrong'},
    {...original.authoredSymbol,sourceSha256:'A'.repeat(64)}, {...original.authoredSymbol,extra:true}]) reject({...original,authoredSymbol});
reject({...original,referenceOnly:true});
reject({...original,source:original.source.replace('[Embed', '[Other') ,sourceSha256:hash(original.source.replace('[Embed','[Other'))});
for(const metadata of ['[Embed(source="/_assets/assets.swf",symbol="symbol19",source="/_assets/assets.swf")]',
    '[Embed(source="/_assets/assets.swf",symbol="symbol19",)]', '[Embed(source="/_assets/assets.swf",symbol=lookup())]',
    '[Embed(source="/_assets/assets.swf",symbol="symbol19",mimeType="application/octet-stream")]']) {
    const source=original.source.replace(/\[Embed[^\]]*\]/,metadata);reject({...original,source,sourceSha256:hash(source)});
}
let reads=0;reject({...original,authoredSymbol:{...original.authoredSymbol,get sourceSha256(){reads++;return manifest.source.sha256;}}});assert.equal(reads,0);
reject({...original,sourceSha256:'a'.repeat(64)});
const noBase=original.source.replace('extends MovieClip','extends Object');
reject({...original,source:noBase,sourceSha256:hash(noBase)});
const duplicate=original.source.replace('[Embed', '[Embed(source="/_assets/assets.swf", symbol="symbol19")]\n[Embed');
reject({...original,source:duplicate,sourceSha256:hash(duplicate)});
const reordered=original.source.replace(/\[Embed[^\]]*\]/,"[Embed(symbol='symbol19', source='/_assets/assets.swf')]");
api.createNativeGeneratedDeclarationPlan({...input,sources:{[owner]:{...original,source:reordered,sourceSha256:hash(reordered)}}});
const mutable={...original,authoredSymbol:{...original.authoredSymbol}};
const snapshotted=api.createNativeGeneratedDeclarationPlan({...input,sources:{[owner]:mutable}});
mutable.authoredSymbol.linkage='changed-after-plan';
assert(!snapshotted.moduleSource.includes('changed-after-plan'));guards++;
const helpers=Object.fromEntries(['bound','classBound','nativeClass','callableClass'].map(n=>[n,modulePath(path.resolve('utils',n+'.ts'))]));
const definitionsByNamespace={'cn.kyiax.gui.basis':Object.keys(sources).map(q=>q.split('.').pop())};
const options={customVisitors:[],definitionsByNamespace,
    importModules:{...Object.fromEntries(Object.entries(providers).map(([q,p])=>[q,p.module])),
        ...Object.fromEntries(Object.keys(sources).map(q=>[q,'./'+q.split('.').pop()])),
        'compiler.AS3Class':provider('AS3Class'),'compiler.AS3Invocation':provider('AS3Invocation')},
    decoratorModules:{bound:helpers.bound,classBound:helpers.classBound},nativeClassHelperModules:{nativeClass:helpers.nativeClass,callableClass:helpers.callableClass},
    nativeGeneratedDeclarations:{plan,module:'./declarations'},nativeClassTraitsModule:provider('AS3GeneratedClass'),
    nativeLexicalMembersModule:provider('AS3LexicalMembers'),nativeGeneratedPropertyModule:provider('AS3Property'),
    nativeDynamicPropertyReadsModule:provider('AS3Property'),nativeDynamicPropertyWritesModule:provider('AS3Property'),
    nativeCallableMethodBindingModule:provider('AS3MethodBinding'),nativeCallableCoercionModule:provider('AS3Coercion'),nativeCallableStringModule:provider('AS3String'),
    nativeReferenceCoercion:{plan,module:'./declarations',coercionModule:provider('AS3Type')}};
fs.writeFileSync(path.join(out,'declarations.ts'),plan.moduleSource);
const emitted=[];
for(const [qname,record]of Object.entries(sources)) {
    const output=emit(parse(qname+'.as',record.source),record.source,options),file=path.join(out,qname.split('.').pop()+'.ts');
    fs.writeFileSync(file,output);emitted.push({qname,file,sourceSha256:record.sourceSha256,outputSha256:hash(output)});
}
const files=[path.join(out,'declarations.ts'),...emitted.map(e=>e.file),...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f))];
const typeOptions={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,strict:true,strictNullChecks:false,useUnknownInCatchVariables:false,useDefineForClassFields:false,moduleResolution:ts.ModuleResolutionKind.NodeJs,resolveJsonModule:true,esModuleInterop:true,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2022.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']};
const diagnostics=ts.getPreEmitDiagnostics(ts.createProgram(files,typeOptions)).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
fs.writeFileSync(path.join(out,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepEqual(diagnostics,[]);
const driver=fs.readFileSync(path.join(__dirname,'driver.ts'),'utf8').replaceAll('ENGINE',modulePath(engine));
fs.writeFileSync(path.join(out,'driver.ts'),driver);
const rootClasses=manifest.roots.map(root=>({...root,local:root.className.split('.').pop()}));
fs.writeFileSync(path.join(out,'wrappers.ts'),'import {readNativeClass} from '+JSON.stringify(helpers.nativeClass)+';\n'
    +emitted.map(e=>'import {'+e.qname.split('.').pop()+'} from "./'+e.qname.split('.').pop()+'";').join('\n')
    +'\nexport const roots=['+rootClasses.map(r=>'{...'+JSON.stringify(r)+',ctor:readNativeClass('+r.local+')}').join(',')+'];');
async function main(){
    const {chromium}=require(path.join(engine,'node_modules/playwright'));
    const server=require('node:http').createServer((req,res)=>{try{
        const url=new URL(req.url,'http://localhost').pathname;
        if(url.startsWith('/assets/')){const file=path.resolve(assets,decodeURIComponent(url.slice(8)));assert(file.startsWith(assets+path.sep));res.end(fs.readFileSync(file));}
        else res.end('<html><link rel="icon" href="data:,"><body></body></html>');
    }catch(error){res.statusCode=500;res.end(String(error));}});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const {createLayaSourceAliasPlugin}=await import(require('node:url').pathToFileURL(path.join(engine,'tests/nativeCanonicalSpriteClass/laya-source-alias.mjs')));
    const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']}),results=[];
    try{for(const target of [legacyTs.ScriptTarget.ES5,legacyTs.ScriptTarget.ES2015]){
        const built=await esbuild.build({entryPoints:[path.join(out,'driver.ts')],bundle:true,write:false,platform:'browser',format:'iife',target:'es2020',metafile:true,
            loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'},plugins:[{name:'compiler-target',setup(build){
                build.onLoad({filter:/\.ts$/},args=>{
                    if(!files.includes(args.path)&&!args.path.startsWith(path.resolve('utils')+path.sep))return;
                    const result=legacyTs.transpileModule(fs.readFileSync(args.path,'utf8'),{compilerOptions:{target,module:legacyTs.ModuleKind.ES2015,experimentalDecorators:true},reportDiagnostics:true});
                    assert.deepEqual(result.diagnostics,[]);return {contents:result.outputText,loader:'js',resolveDir:path.dirname(args.path)};
                });}},createLayaSourceAliasPlugin(engine)]});
        fs.writeFileSync(path.join(out,'bundle-'+target+'.js'),built.outputFiles[0].text);
        const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
        await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({content:built.outputFiles[0].text});
        await page.waitForFunction(()=>globalThis.embedResult||globalThis.embedError);
        const error=await page.evaluate(()=>globalThis.embedError),actual=await page.evaluate(()=>globalThis.embedResult);
        fs.writeFileSync(path.join(out,'result-'+target+'.json'),JSON.stringify({actual,error,errors},null,2));
        assert.equal(error,undefined);assert.deepEqual(errors,[]);assert.deepEqual(actual.rows,expected);assert.equal(actual.unbound.length,8);
        assert.equal(actual.exactNested.length,3);assert(actual.exactNested.every(Boolean));
        results.push({target,actual,inputs:Object.keys(built.metafile.inputs).map(file=>({file,sha256:hash(fs.readFileSync(file))}))});await page.close();
    }}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({emitted,results,guards,diagnostics,compilerAdmission:true},null,2));
    console.log(JSON.stringify({out,wrappers:8,rowsPerTarget:expected.length,targets:['ES5','ES2015'],guards,diagnostics:0}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
