const fs=require('fs'),path=require('path'),assert=require('assert'),cp=require('child_process'),vm=require('vm');
const owningCompiler=path.resolve(__dirname,'../..'),compiler=path.resolve(process.env.COMPILER_CHECKOUT||owningCompiler);
const engineCheckout=path.resolve(process.env.LAYAAIR_CHECKOUT||path.join(owningCompiler,'../LayaAir-op2'));
const ts=require(path.join(compiler,'node_modules/typescript')),modern=require(path.join(engineCheckout,'node_modules/typescript'));
const esbuild=require(path.join(engineCheckout,'node_modules/esbuild'));
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright',{paths:[owningCompiler,engineCheckout]}));
const {fixture}=require(path.join(compiler,'tests/native-instance-initializers/callable-fixture'));
const {verify,authenticateMetadata,hash}=require('./evidence.cjs'),drivers=require('./drivers.cjs');
const engineCommit='ebf256ec0a2458b54203f3f7410a67d13d1ec0c3';
const modules=['AS3MethodBinding','AS3Coercion','AS3Property','AS3Invocation','AS3Class','AS3DynamicObject','AS3DeclarationType','AS3Type','FlashTypeMetadata'];
const output=path.join(owningCompiler,'.cache/native-class-metadata');fs.mkdirSync(output,{recursive:true});
const run=fs.mkdtempSync(path.join(output,'run-'));
const providerRoot=process.env.ENGINE_SOURCE_OVERRIDE?path.resolve(process.env.ENGINE_SOURCE_OVERRIDE):path.join(run,'engine');
if(!process.env.ENGINE_SOURCE_OVERRIDE) {
    fs.mkdirSync(providerRoot);
    const archive=cp.execFileSync('git',['archive','--format=tar',engineCommit,'src/layaAir/flash/utils'],{cwd:engineCheckout,maxBuffer:32*1024*1024});
    cp.execFileSync('tar',['-xf','-','-C',providerRoot],{input:archive});
}
const utils=path.join(providerRoot,'src/layaAir/flash/utils');
const bundled=esbuild.buildSync({stdin:{contents:modules.map(name=>'export * from "./src/layaAir/flash/utils/'+name+'";').join('\n'),
    resolveDir:providerRoot,loader:'ts'},bundle:true,write:false,metafile:true,format:'cjs',platform:'node',target:'es2015'});
const commonSource='(function(){var module={exports:{}};'+bundled.outputFiles[0].text+';Object.assign(exports,module.exports);})();';
const diagnostics=program=>modern.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file&&path.relative(run,d.file.fileName),text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));
const provider=modern.createProgram(modules.map(name=>path.join(utils,name+'.ts')),{target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,
    declaration:true,emitDeclarationOnly:true,lib:['lib.es2020.d.ts'],rootDir:utils,outDir:path.join(run,'provider')});
assert.deepStrictEqual(diagnostics(provider),[]);assert.equal(provider.emit().emitSkipped,false);
function check(group,actual,expected) {
    assert.deepStrictEqual(actual.rows,expected.rows,group+' source rows');
    if(group==='lifecycle') {
        assert.deepStrictEqual(actual.lifecycle,expected.lifecycle,'source lifecycle');
        assert.deepStrictEqual(actual.operation,expected.operation,'source delete/in trace');
        assert.deepStrictEqual(actual.boundaries,{classIdentity:true,prototypeWritable:false,declaredInstance:true,
            forgedInstance:false,coercionIdentity:true,constructedInstance:true});
    } else assert.deepStrictEqual(actual.boundaries,{forgedIs:false,forgedAsNull:true});
}
async function main() {
    const evidence={lifecycle:verify('lifecycle'),predicates:verify('predicates')};
    assert.equal(evidence.lifecycle.expected.rows.length,9);assert.equal(evidence.lifecycle.expected.lifecycle.length,14);assert.equal(evidence.predicates.expected.rows.length,12);
    const reports=[],browser=await chromium.launch({headless:true});
    try {
        for(const [group,providerModule] of [['lifecycle','./AS3MethodBinding'],['predicates','./AS3MethodBinding'],['predicates','./CommonProvider']]) for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]) {
            const input=evidence[group],dir=path.join(run,group+'-'+target+'-'+providerModule.slice(2));fs.mkdirSync(dir);
            const authenticated=authenticateMetadata(input,input.metadata);authenticated.module=providerModule;
            const native=providerModule==='./AS3MethodBinding'?fixture(target,input.sources,commonSource,authenticated):
                require('./provider-variant.cjs').fixture(compiler,target,input.sources,commonSource,authenticated);
            Object.assign(native.context,{readTestClass:native.get,testCommon:native.common});
            const driver='('+drivers[group].toString()+')(readTestClass,testCommon)';
            const actual=JSON.parse(vm.runInContext('JSON.stringify('+driver+')',native.context));
            fs.writeFileSync(path.join(dir,'node.json'),JSON.stringify(actual,null,2)+'\n');check(group,actual,input.expected);
            const generated={};
            for(const name of ['bound','classBound','nativeClass','callableClass'])generated[name]=fs.readFileSync(path.join(compiler,'utils',name+'.ts'),'utf8');
            Object.assign(generated,native.generated);
            for(const [name,source] of Object.entries(generated))fs.writeFileSync(path.join(dir,name+'.ts'),source);
            fs.writeFileSync(path.join(dir,'AS3MethodBinding.d.ts'),modules.map(name=>'export * from "../provider/'+name+'";').join('\n')+'\n');
            if(providerModule!=='./AS3MethodBinding')fs.writeFileSync(path.join(dir,'CommonProvider.d.ts'),'export * from "./AS3MethodBinding";\n');
            fs.writeFileSync(path.join(dir,'Consumer.ts'),"import {Subject} from './Subject';import {readNativeClass} from './nativeClass';const value:Subject=new (readNativeClass(Subject))();\n");
            const program=modern.createProgram(fs.readdirSync(dir).filter(name=>name.endsWith('.ts')).map(name=>path.join(dir,name)),
                {target,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,lib:['lib.es2020.d.ts'],experimentalDecorators:true,noEmit:true});
            const strictDiagnostics=diagnostics(program);fs.writeFileSync(path.join(dir,'types.json'),JSON.stringify(strictDiagnostics,null,2)+'\n');assert.deepStrictEqual(strictDiagnostics,[]);
            const specs=[{name:'AS3MethodBinding',code:commonSource}];
            for(const [name,source] of Object.entries(generated)) {
                const built=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});
                assert.deepStrictEqual(built.diagnostics,[]);specs.push({name,code:built.outputText});
            }
            const script=`{const modules=new Map(),specs=${JSON.stringify(specs)};for(const spec of specs)modules.set(spec.name,{});modules.set('CommonProvider',modules.get('AS3MethodBinding'));for(const spec of specs)new Function('exports','require',spec.code)(modules.get(spec.name),request=>{const name=request.split('/').pop();if(!modules.has(name))throw Error(request);return modules.get(name);});const readTestClass=name=>modules.get('nativeClass').readNativeClass(modules.get(name)[name]),testCommon=modules.get('AS3MethodBinding');globalThis.result=${driver};}`;
            fs.writeFileSync(path.join(dir,'browser.js'),script);
            const page=await browser.newPage(),pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));
            await page.addScriptTag({content:script});const browserActual=await page.evaluate(()=>globalThis.result);
            fs.writeFileSync(path.join(dir,'browser.json'),JSON.stringify(browserActual,null,2)+'\n');assert.deepStrictEqual(pageErrors,[]);check(group,browserActual,input.expected);await page.close();
            reports.push({group,target,providerModule,receiptSHA256:input.receiptSHA256,rows:input.expected.rows.length,lifecycleSteps:(input.expected.lifecycle||[]).length,
                operationTrace:!!input.expected.operation,nodeMatched:true,chromeMatched:true,strictDiagnostics,bundleSHA256:hash(script)});
        }
        const guards=require('./guards.cjs').run(compiler,evidence.lifecycle);
        const report={scope:'Authenticated public source Class metadata, source operations, retry lifecycle and mixed predicates; broader metadata and source operations remain held',
            engineCommit:process.env.ENGINE_SOURCE_OVERRIDE?null:engineCommit,engineSourceOverride:!!process.env.ENGINE_SOURCE_OVERRIDE,
            compilerOverride:compiler!==owningCompiler,compilerTypeScript:ts.version,strictTypeScript:modern.version,
            strictNullChecks:false,declarationAdaptation:false,browser:browser.version(),reports,guards,
            compilerInputs:['src/emit/emitter.ts','src/emit/native-callable-classes.ts','src/emit/native-class-metadata.ts','src/emit/native-source-operations.ts','lib/emit/emitter.js','lib/emit/native-callable-classes.js','lib/emit/native-class-metadata.js','lib/emit/native-source-operations.js','utils/callableClass.ts','tests/native-instance-initializers/callable-fixture.js'].map(file=>({path:file,sha256:hash(fs.readFileSync(path.join(compiler,file)))})),
            providerInputs:provider.getSourceFiles().filter(file=>file.fileName.startsWith(utils)).map(file=>({path:path.relative(providerRoot,file.fileName).replace(/\\/g,'/'),sha256:hash(fs.readFileSync(file.fileName))}))};
        fs.writeFileSync(path.join(run,'report.json'),JSON.stringify(report,null,2)+'\n');
        console.log(JSON.stringify({evidence:run,sourceFlows:9,lifecycleSteps:14,operationTraces:1,predicates:12,strictSurfaces:reports.length,guards:guards.length,engineCommit:report.engineCommit}));
    } finally {await browser.close();}
}
main().catch(error=>{console.error(error);console.error('Evidence: '+run);process.exitCode=1;});
