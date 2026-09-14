const fs=require('fs'),path=require('path'),assert=require('assert'),cp=require('child_process'),vm=require('vm');
const owningCompiler=path.resolve(__dirname,'../..'),compiler=path.resolve(process.env.COMPILER_CHECKOUT||owningCompiler);
const engineCheckout=path.resolve(process.env.LAYAAIR_CHECKOUT||path.join(owningCompiler,'../LayaAir-op2'));
const ts=require(path.join(compiler,'node_modules/typescript')),modern=require(path.join(engineCheckout,'node_modules/typescript'));
const esbuild=require(path.join(engineCheckout,'node_modules/esbuild'));
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright',{paths:[owningCompiler,engineCheckout]}));
const {verify,authenticateMetadata,hash}=require('./evidence.cjs');
const engineCommit='3d7c64062e899c8aaf4abd141da5c0d4c01f2a4d';
const providerModules=['AS3MethodBinding','AS3Coercion','AS3Property','AS3Invocation','AS3Class','AS3DynamicObject','AS3DeclarationType','AS3Type','FlashTypeMetadata','AS3TypeOf'];
const runtimeModules=providerModules.concat('XML');
const output=path.join(owningCompiler,'.cache/native-typeof');fs.mkdirSync(output,{recursive:true});
const run=fs.mkdtempSync(path.join(output,'run-')),providerRoot=path.join(run,'engine');fs.mkdirSync(providerRoot);
const archive=cp.execFileSync('git',['archive','--format=tar',engineCommit,'src'],{cwd:engineCheckout,maxBuffer:128*1024*1024});
cp.execFileSync('tar',['-xf','-','-C',providerRoot],{input:archive});
fs.symlinkSync(path.join(engineCheckout,'node_modules'),path.join(providerRoot,'node_modules'),'junction');
const utils=path.join(providerRoot,'src/layaAir/flash/utils');
const bundled=esbuild.buildSync({stdin:{contents:runtimeModules.map(name=>'export * from "./src/layaAir/flash/utils/'+name+'";').join('\n'),
    resolveDir:providerRoot,loader:'ts'},bundle:true,write:false,metafile:true,format:'cjs',platform:'node',target:'es2015'});
const commonSource='(function(){var module={exports:{}};'+bundled.outputFiles[0].text+';Object.assign(exports,module.exports);})();';
const diagnostics=program=>modern.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file&&path.relative(run,d.file.fileName),text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));
const config=modern.readConfigFile(path.join(providerRoot,'src/layaAir/tsconfig.json'),modern.sys.readFile);assert(!config.error);
const options=modern.convertCompilerOptionsFromJson(config.config.compilerOptions,path.join(providerRoot,'src/layaAir')).options;
const ambient=modern.sys.readDirectory(path.join(providerRoot,'src/layaAir/tslibs'),['.d.ts']).concat(modern.sys.readDirectory(path.join(engineCheckout,'node_modules/@webgpu/types'),['.d.ts']));
const provider=modern.createProgram(providerModules.map(name=>path.join(utils,name+'.ts')).concat(ambient),
    {...options,target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,composite:false,
        types:['node'],typeRoots:[path.join(engineCheckout,'node_modules/@types')],
        declaration:true,emitDeclarationOnly:true,lib:['lib.es2020.d.ts','lib.dom.d.ts'],rootDir:path.join(providerRoot,'src'),outDir:path.join(run,'provider')});
const providerDiagnostics=diagnostics(provider);fs.writeFileSync(path.join(run,'provider-diagnostics.json'),JSON.stringify(providerDiagnostics,null,2));
assert.deepStrictEqual(providerDiagnostics,[]);assert.equal(provider.emit().emitSkipped,false);
async function main() {
    const evidence=verify('typeof'),arrayHeld=verify('array-typed-journal');assert.equal(evidence.expected.rows.length,32);
    assert.deepStrictEqual(arrayHeld.expected.rows,evidence.expected.rows,'journal source capture comparison');
    const reports=[],browser=await chromium.launch({headless:true});
    try {
        for(const group of ['typeof','binding']) {
        const evidence=verify(group);
        const driver=group==='typeof'?require('./driver.cjs'):new Function('readTestClass', 'const Subject=readTestClass("Subject");return '+JSON.stringify(evidence.expected.rows.map(row=>row[0]))+'.map(name=>[name,Subject[name]()]);');
        for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]) for(const moduleName of ['./AS3MethodBinding','./CommonProvider']) {
            const dir=path.join(run,group+'-'+target+'-'+moduleName.slice(2));fs.mkdirSync(dir);
            const metadata=authenticateMetadata(evidence,evidence.metadata);metadata.module=moduleName;
            const native=require('./fixture.cjs').fixture(compiler,target,evidence.sources,commonSource,metadata);
            Object.assign(native.context,{readTestClass:native.get,testCommon:native.common});
            const expression='('+driver.toString()+')(readTestClass,testCommon)';
            const actual=JSON.parse(vm.runInContext('JSON.stringify('+expression+')',native.context));
            fs.writeFileSync(path.join(dir,'node.json'),JSON.stringify(actual,null,2));assert.deepStrictEqual(actual,evidence.expected.rows);
            const generated={};for(const name of ['bound','classBound','nativeClass','callableClass'])generated[name]=fs.readFileSync(path.join(compiler,'utils',name+'.ts'),'utf8');Object.assign(generated,native.generated);
            for(const [name,source] of Object.entries(generated))fs.writeFileSync(path.join(dir,name+'.ts'),source);
            fs.writeFileSync(path.join(dir,'AS3MethodBinding.d.ts'),providerModules.map(name=>'export * from "../provider/layaAir/flash/utils/'+name+'";').join('\n'));
            fs.writeFileSync(path.join(dir,'CommonProvider.d.ts'),'export * from "./AS3MethodBinding";');
            if(group==='binding') {
                // Preserve the emitted explicit-package import. Supply its real source
                // and helper modules at that path; do not rewrite generated imports.
                const foreign=path.join(run,'foreign');fs.mkdirSync(foreign,{recursive:true});
                for(const name of ['visible','bound','classBound','nativeClass','callableClass'])
                    fs.copyFileSync(path.join(dir,name+'.ts'),path.join(foreign,name+'.ts'));
                for(const name of ['AS3MethodBinding','CommonProvider'])
                    fs.copyFileSync(path.join(dir,name+'.d.ts'),path.join(foreign,name+'.d.ts'));
            }
            fs.writeFileSync(path.join(dir,'Consumer.ts'),"import {Subject} from './Subject';import {readNativeClass} from './nativeClass';const value:Subject=new (readNativeClass(Subject))();const kind:string=readNativeClass(Subject)."+(group==='typeof'?'classType':'builtinClass')+"();");
            const program=modern.createProgram(fs.readdirSync(dir).filter(name=>name.endsWith('.ts')).map(name=>path.join(dir,name)).concat(ambient),
                {target,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,skipLibCheck:true,types:['node'],typeRoots:[path.join(engineCheckout,'node_modules/@types')],lib:['lib.es2020.d.ts','lib.dom.d.ts'],experimentalDecorators:true,noEmit:true});
            const strictDiagnostics=diagnostics(program);fs.writeFileSync(path.join(dir,'types.json'),JSON.stringify(strictDiagnostics,null,2));assert.deepStrictEqual(strictDiagnostics,[]);
            const specs=[{name:'AS3MethodBinding',code:commonSource}];for(const [name,source] of Object.entries(generated)){const built=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});assert.deepStrictEqual(built.diagnostics,[]);specs.push({name,code:built.outputText});}
            const script=`{const modules=new Map(),specs=${JSON.stringify(specs)};for(const spec of specs)modules.set(spec.name,{});modules.set('CommonProvider',modules.get('AS3MethodBinding'));for(const spec of specs)new Function('exports','require',spec.code)(modules.get(spec.name),request=>{const name=request.split('/').pop();if(!modules.has(name))throw Error(request);return modules.get(name);});const readTestClass=name=>modules.get('nativeClass').readNativeClass(modules.get(name)[name]),testCommon=modules.get('AS3MethodBinding');globalThis.result=${expression};}`;
            fs.writeFileSync(path.join(dir,'browser.js'),script);const page=await browser.newPage(),pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));
            await page.addScriptTag({content:script});const browserActual=await page.evaluate(()=>globalThis.result);fs.writeFileSync(path.join(dir,'browser.json'),JSON.stringify(browserActual,null,2));assert.deepStrictEqual(pageErrors,[]);assert.deepStrictEqual(browserActual,evidence.expected.rows);await page.close();
            reports.push({group,target,moduleName,nodeMatched:true,chromeMatched:true,rows:actual.length,strictDiagnostics,bundleSHA256:hash(script)});
        }
        }
        const guards=require('./guards.cjs').run(compiler,evidence).concat(require('./binding-guards.cjs').run(compiler,verify('binding'))),held=[];
        for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]) {
            const native=require('./fixture.cjs').fixture(compiler,target,arrayHeld.sources,commonSource,authenticateMetadata(arrayHeld,arrayHeld.metadata));
            assert.throws(()=>native.get('Subject'),/Unsupported source property representation: missing or invalid declared type/);
            held.push({target,scope:'Array-typed journal field',receiptSHA256:arrayHeld.receiptSHA256,
                reason:'Typed reference property trait lowering is required before this original class can initialize'});
        }
        const report={scope:'Original source typeof, exact binding and public readonly getters; unresolved identifiers reject at compile time',engineCommit,receiptSHA256:evidence.receiptSHA256,bindingReceiptSHA256:verify('binding').receiptSHA256,
            compilerTypeScript:ts.version,strictTypeScript:modern.version,strictNullChecks:false,skipLibCheck:true,declarationAdaptation:false,browser:browser.version(),reports,guards,held,
            compilerInputs:['src/emit/emitter.ts','src/emit/native-callable-classes.ts','src/emit/native-class-metadata.ts','src/emit/native-source-operations.ts','src/emit/native-typeof.ts','lib/emit/emitter.js','lib/emit/native-callable-classes.js','lib/emit/native-class-metadata.js','lib/emit/native-source-operations.js','lib/emit/native-typeof.js'].map(file=>({path:file,sha256:hash(fs.readFileSync(path.join(compiler,file)))})),
            providerInputs:provider.getSourceFiles().filter(file=>file.fileName.startsWith(providerRoot)).map(file=>({path:path.relative(providerRoot,file.fileName).replace(/\\/g,'/'),sha256:hash(fs.readFileSync(file.fileName))}))};
        fs.writeFileSync(path.join(run,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({evidence:run,rows:62,strictSurfaces:8,guards:guards.length,engineCommit}));
    }finally{await browser.close();}
}
main().catch(error=>{console.error(error);console.error('Evidence: '+run);process.exitCode=1;});
