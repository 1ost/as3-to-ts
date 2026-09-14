const fs=require('fs'),path=require('path'),assert=require('assert'),cp=require('child_process'),vm=require('vm');
const owningCompiler=path.resolve(__dirname,'../..');
const compiler=path.resolve(process.env.COMPILER_CHECKOUT||owningCompiler);
const engine=path.resolve(owningCompiler,'../LayaAir-op2');
const ts=require(path.join(compiler,'node_modules/typescript'));
const modern=require(path.join(engine,'node_modules/typescript'));
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||require.resolve('playwright',{paths:[owningCompiler,engine]}));
const {fixture}=require(path.join(compiler,'tests/native-instance-initializers/callable-fixture'));
const common=require('../native-instance-initializers/common-runtime');
const {verify,verifyReview,hash}=require('./evidence.cjs');
assert.equal(common.commit,'d3db69240e22575d48828ae95b1243bc6e593ed1');
const evidence=verify();
const reviewEvidence=verifyReview();
console.log(JSON.stringify({originalRows:evidence.expected.length,directRows:evidence.direct.length,held:evidence.receipt.held}));
const output=path.join(owningCompiler,'.cache/native-super-methods');fs.mkdirSync(output,{recursive:true});
const run=fs.mkdtempSync(path.join(output,'run-'));
const names=['Journal','Base','Middle','Leaf','Grandchild'];
const commonSource=common.source();
const archived=path.join(run,'engine');fs.mkdirSync(archived);
const archive=cp.execFileSync('git',['archive','--format=tar',common.commit,'src/layaAir/flash/utils'],{cwd:engine,maxBuffer:32*1024*1024});
cp.execFileSync('tar',['-xf','-','-C',archived],{input:archive});
const utils=path.join(archived,'src/layaAir/flash/utils');
function errors(program) {return modern.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file&&path.relative(run,d.file.fileName),text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));}
const provider=modern.createProgram(['AS3MethodBinding','AS3Coercion'].map(name=>path.join(utils,name+'.ts')),
    {target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,declaration:true,emitDeclarationOnly:true,
        lib:['lib.es2020.d.ts'],rootDir:utils,outDir:path.join(run,'provider')});
assert.deepStrictEqual(errors(provider),[]);assert.equal(provider.emit().emitSkipped,false);
function rejections() {
    const base='package reject {public class Base {public function Base(){} public function method(flag:Boolean=false):Boolean{return flag;}}}';
    const rejected={detached:'public function check():Function{return super.method;}',computed:'public function check():Boolean{return super["method"]();}',
        extra:'public function check():Boolean{return super.method(true,false);}',missing:'public function check():Boolean{return super.missing();}',
        nested:'public function check():Function{return function():Boolean{return super.method();};}',constructor:'public function Child(){super();super.method();}'};
    const results=[];
    function reject(name,sourceMap) {
        assert.throws(()=>fixture(ts.ScriptTarget.ES2015,sourceMap,commonSource),error=>{
            results.push({name,error:String(error)});return /AS3_CALLABLE_CLASS_UNSUPPORTED/.test(String(error));});
    }
    for(const [name,body] of Object.entries(rejected)) reject(name,{'reject.Base':base,'reject.Child':
        'package reject {public class Child extends Base {'+(name==='constructor'?'':'public function Child(){super();}')+body+'}}'});
    for(const [name,signature,call] of [
        ['number','public function method(flag:Number):Number{return flag;}','super.method(1)'],
        ['required','public function method(flag:Boolean):Boolean{return flag;}','super.method()'],
        ['getter','public function get method():Boolean{return true;}','super.method()'],
        ['private','private function method():Boolean{return true;}','super.method()'],
        ['rest','public function method(...flags):Boolean{return true;}','super.method()']]) {
        reject(name,{'reject.Base':'package reject {public class Base {public function Base(){} '+signature+'}}',
            'reject.Child':'package reject {public class Child extends Base {public function Child(){super();} public function check():* {return '+call+';}}}'});
    }
    assert.equal(results.length,11);
    const root='package held { public class Root {public function Root(){} public function target():Boolean{return true;} } }';
    for(const [name,shadow] of [['field','public var target:Function;'],['getter','public function get target():Function{return null;}'],['private','private function target():Boolean{return false;}'],['static','public static function target():Boolean{return false;}']]) {
        reject('review-shadow-'+name,{'held.Root':root,'held.Base':'package held {public class Base extends Root {public function Base(){super();} '+shadow+'}}',
            'held.Child':'package held {public class Child extends Base {public function Child(){super();} public function run():Boolean{return super.target();}}}'});
    }
    assert.equal(results.length,15);return results;
}
async function main() {
    const reports=[],browser=await chromium.launch({headless:true});
    try {
        for(const [group,evidence] of [['direct',verify()],['independent-review',reviewEvidence]]) for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]) {
            const sources=Object.fromEntries(names.map(name=>['superprobe.'+name,fs.readFileSync(path.join(evidence.directory,'sources/superprobe',name+'.as'),'utf8')]));
            const dir=path.join(run,group+'-'+target);fs.mkdirSync(dir);
            const native=fixture(target,sources,commonSource);
            const Grandchild=native.get('Grandchild');
            if(group==='direct') new Grandchild().run();
            else {const one=new Grandchild();one.identity='one';one.run();const two=new Grandchild();two.identity='two';const detached=two.run;detached.call(one);}
            const actual=JSON.parse(JSON.stringify(native.get('Journal').rows));
            fs.writeFileSync(path.join(dir,'node.json'),JSON.stringify(actual,null,2)+'\n');
            assert.deepStrictEqual(actual,evidence.direct);
            const generated={};
            for(const name of ['bound','classBound','nativeClass','callableClass'])generated[name]=fs.readFileSync(path.join(compiler,'utils',name+'.ts'),'utf8');
            Object.assign(generated,native.generated);
            for(const [name,source] of Object.entries(generated))fs.writeFileSync(path.join(dir,name+'.ts'),source);
            fs.writeFileSync(path.join(dir,'AS3MethodBinding.d.ts'),'export * from "../provider/AS3MethodBinding";\nexport * from "../provider/AS3Coercion";\n');
            fs.writeFileSync(path.join(dir,'Consumer.ts'),"import {Grandchild} from './Grandchild';import {Leaf} from './Leaf';import {readNativeClass} from './nativeClass';const instance:Leaf=new (readNativeClass(Grandchild))();instance.run();"+(group==='direct'?"const value:string=instance.zero();":"const value:boolean=instance.selected();")+'\n');
            const program=modern.createProgram(fs.readdirSync(dir).filter(name=>name.endsWith('.ts')).map(name=>path.join(dir,name)),
                {target,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,lib:['lib.es2015.d.ts'],experimentalDecorators:true,noEmit:true});
            const diagnostics=errors(program);fs.writeFileSync(path.join(dir,'types.json'),JSON.stringify(diagnostics,null,2)+'\n');assert.deepStrictEqual(diagnostics,[]);
            const specs=[{name:'AS3MethodBinding',code:commonSource}];
            for(const [name,source] of Object.entries(generated)) {
                const built=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});
                assert.deepStrictEqual(built.diagnostics,[]);specs.push({name,code:built.outputText});
            }
            const driver=group==='direct'?'new Grandchild().run();':"const one=new Grandchild();one.identity='one';one.run();const two=new Grandchild();two.identity='two';const detached=two.run;detached.call(one);";
            const script=`{const modules=new Map();const specs=${JSON.stringify(specs)};for(const spec of specs)modules.set(spec.name,{});for(const spec of specs)new Function('exports','require',spec.code)(modules.get(spec.name),request=>{const name=request.split('/').pop();if(!modules.has(name))throw Error(request);return modules.get(name);});const read=modules.get('nativeClass').readNativeClass,Grandchild=read(modules.get('Grandchild').Grandchild);${driver}globalThis.result=read(modules.get('Journal').Journal).rows;}`;
            fs.writeFileSync(path.join(dir,'browser.js'),script);
            const page=await browser.newPage(),pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));
            await page.addScriptTag({content:script});const browserRows=await page.evaluate(()=>globalThis.result);
            fs.writeFileSync(path.join(dir,'browser.json'),JSON.stringify(browserRows,null,2)+'\n');
            assert.deepStrictEqual(pageErrors,[]);assert.deepStrictEqual(browserRows,evidence.direct);await page.close();
            reports.push({group,target,receiptSHA256:evidence.receiptHash,originalRows:evidence.expected.length,directRows:evidence.direct.length,heldRows:evidence.receipt.held,nodeMatched:true,chromeMatched:true,strictDiagnostics:diagnostics,bundleSHA256:hash(script)});
        }
        const rejected=rejections();
        const report={scope:'Direct lexical super method calls only; detached super reads remain held',
            receiptSHA256:evidence.receiptHash,compilerOverride:compiler!==owningCompiler,engineCommit:common.commit,
            compilerTypeScript:ts.version,strictTypeScript:modern.version,declarationAdaptation:false,browser:browser.version(),
            compilerInputs:['src/emit/native-callable-classes.ts','lib/emit/native-callable-classes.js','utils/callableClass.ts'].map(file=>({path:file,sha256:hash(fs.readFileSync(path.join(compiler,file)))})),
            providerInputs:provider.getSourceFiles().filter(f=>f.fileName.startsWith(utils)).map(f=>({path:path.relative(archived,f.fileName),sha256:hash(fs.readFileSync(f.fileName))})),reports,rejected};
        fs.writeFileSync(path.join(run,'report.json'),JSON.stringify(report,null,2)+'\n');
        console.log(JSON.stringify({reports,rejections:rejected.length,evidence:run}));
    } finally {await browser.close();}
}
main().catch(error=>{console.error(error);console.error('Evidence: '+run);process.exitCode=1;});
