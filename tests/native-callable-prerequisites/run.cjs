const fs = require('fs'), path = require('path'), assert = require('assert');
const crypto = require('crypto'), cp = require('child_process'), vm = require('vm');
const compiler = path.resolve(__dirname, '../..');
const engine = path.resolve(compiler, '../LayaAir-op2');
const ts = require(path.join(compiler, 'node_modules/typescript'));
const modern = require(path.join(engine, 'node_modules/typescript'));
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || require.resolve('playwright', {paths:[compiler,engine]}));
const parse = require(path.join(compiler, 'lib/parse'));
const emit = require(path.join(compiler, 'lib/emit'));
const common = require('../native-instance-initializers/common-runtime');
const expectedCommit = 'd3db69240e22575d48828ae95b1243bc6e593ed1';
assert.equal(common.commit, expectedCommit);
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const read = file => fs.readFileSync(file, 'utf8');
const json = file => JSON.parse(read(file));
const output = path.join(compiler, '.cache/native-callable-prerequisites');
fs.mkdirSync(output, {recursive:true});
const run = fs.mkdtempSync(path.join(output, 'run-'));
const groups = {
    numeric: {namespace:'numeric', names:['NumberSubject','Required','IntegerSubject','NumericBase','Derived','Rebind'], count:101},
    'early-return': {namespace:'early', names:['Journal','Subject','Child'], count:14},
    'wildcard-catch': {namespace:'catching', names:['Journal','Subject'], count:12},
    'merge-interactions': {namespace:'early', names:['Journal','Subject','Child'], count:18}
};
// The original absolute paths are historical provenance only. Validation and execution
// use authenticated copies in this directory, never another application's checkout.
for (const index of json(path.join(__dirname, 'evidence-index.json')).groups) {
    const file = path.join(__dirname, index.receipt);
    assert.equal(hash(fs.readFileSync(file)), index.sha256, index.receipt);
    const receipt = json(file), directory = path.dirname(file);
    for (const item of receipt.files) {
        const retained = path.resolve(directory, item.path);
        assert(retained.startsWith(directory + path.sep), item.path);
        assert.equal(hash(fs.readFileSync(retained)), item.sha256, retained);
    }
    const original = json(path.join(directory, 'provenance.json'));
    for (const item of receipt.files.filter(item => item.originalPath)) {
        const authority = original.files.find(entry => entry.path === item.originalPath);
        assert(authority, item.originalPath);
        assert.equal(authority.sha256, item.sha256, item.originalPath);
    }
    const expected = json(path.join(directory, 'flash.json')).rows;
    assert.equal(expected.length, groups[index.group].count);
    assert.equal(receipt.rowCount, expected.length);
    Object.assign(groups[index.group], {directory, expected, receiptSHA256:index.sha256});
}
for (const name of Object.keys(groups)) assert(groups[name].directory, name);

const providerSource = path.join(run, 'engine');
fs.mkdirSync(providerSource);
const archive = cp.execFileSync('git', ['archive', '--format=tar', common.commit, 'src/layaAir/flash/utils'],
    {cwd:engine, maxBuffer:32*1024*1024});
cp.execFileSync('tar', ['-xf', '-', '-C', providerSource], {input:archive});
const utils = path.join(providerSource, 'src/layaAir/flash/utils');
const declarations = path.join(run, 'provider');
function errors(program) {
    return modern.getPreEmitDiagnostics(program).map(d => ({code:d.code,
        file:d.file && path.relative(run,d.file.fileName).replace(/\\/g,'/'),
        text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));
}
const provider = modern.createProgram(['AS3MethodBinding','AS3Coercion'].map(n => path.join(utils,n+'.ts')),
    {target:modern.ScriptTarget.ES2020,module:modern.ModuleKind.CommonJS,declaration:true,
        emitDeclarationOnly:true,lib:['lib.es2020.d.ts'],rootDir:utils,outDir:declarations});
assert.deepStrictEqual(errors(provider), []);
assert.equal(provider.emit().emitSkipped, false);
const providerInputs = provider.getSourceFiles().filter(f => f.fileName.startsWith(utils)).map(f =>
    ({path:path.relative(providerSource,f.fileName).replace(/\\/g,'/'),sha256:hash(fs.readFileSync(f.fileName))}));
const commonSource = common.source();

function earlyDriver() {
    const get = name => modules.get('nativeClass').readNativeClass(modules.get(name)[name]);
    const Subject=get('Subject'), Child=get('Child'), Journal=get('Journal'), actual=[];
    for (const type of [Subject,Child]) for (let mode=0;mode<=6;mode++) {
        Journal.rows=[];
        try { const value=new type(mode); Journal.rows.push('result:'+value.stage+(type===Child?':'+value.ownStage:'')); }
        catch (error) { Journal.rows.push('thrown:'+(error===Journal.thrown)); }
        actual.push({child:type===Child,mode,trace:Array.from(Journal.rows)});
    }
    globalThis.result=actual;
}
function catchDriver() {
    const get = name => modules.get('nativeClass').readNativeClass(modules.get(name)[name]);
    const Subject=get('Subject'), Journal=get('Journal'), actual=[], values=[undefined,null,{label:'original'},'text',17,true];
    for (let i=0;i<values.length;i++) for (let mode=0;mode<2;mode++) {
        Journal.rows=[]; Journal.expected=values[i];
        try { const item=new Subject(values[i],mode); Journal.rows.push('survived:'+item.survived); }
        catch (error) { Journal.rows.push('escaped:'+(error===values[i])); }
        actual.push({index:i,mode,trace:Array.from(Journal.rows)});
    }
    globalThis.result=actual;
}
function driver(name) {
    if(name==='numeric') return read(path.join(__dirname,'numeric-driver.js.txt'))+'\nglobalThis.result=globalThis.numericRows;';
    if(name==='merge-interactions') return read(path.join(__dirname,'merge-driver.js.txt'))
        .replace(/modules\.([A-Za-z]+)/g, (_,name) => 'modules.get('+JSON.stringify(name)+')');
    return '('+(name==='early-return'?earlyDriver:catchDriver).toString()+')();';
}
async function main() {
    const reports=[], browser=await chromium.launch({headless:true});
    try {
        for (const [name,group] of Object.entries(groups)) for (const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]) {
            const dir=path.join(run,name+'-'+target); fs.mkdirSync(dir);
            const sources=Object.fromEntries(group.names.map(n => [group.namespace+'.'+n,
                read(path.join(group.directory,'sources',group.namespace,n+'.as'))]));
            const classes=Object.fromEntries(Object.keys(sources).map(n => [n,'lazy']));
            const specs=[];
            function add(name,source,typescript=true) {
                let code=source;
                if (typescript) {
                    const result=ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true},reportDiagnostics:true});
                    assert.deepStrictEqual(result.diagnostics,[]);code=result.outputText;
                }
                fs.writeFileSync(path.join(dir,name+(typescript?'.ts':'.js')),source);
                specs.push({name,code});
            }
            add('AS3MethodBinding',commonSource,false);
            if(name==='numeric') {
                classes['numeric.Recorder']='ready';
                add('Recorder',read(path.join(__dirname,'numeric-recorder.js.txt')),false);
                fs.writeFileSync(path.join(dir,'Recorder.d.ts'),'export declare class Recorder {static rows:any[];static bits(value:any):string;static record(label:string,a:number,b:number,args:any):void;}\n');
            }
            for(const helper of ['bound','classBound','nativeClass','callableClass']) add(helper,read(path.join(compiler,'utils',helper+'.ts')));
            for(const className of group.names) {
                const source=sources[group.namespace+'.'+className];
                add(className,emit(parse(className+'.as',source),source,{customVisitors:[],
                    definitionsByNamespace:name==='numeric'?{numeric:['Recorder']}:{},
                    nativeClassInitialization:{classes},nativeCallableClasses:sources,
                    nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding'}));
            }
            fs.writeFileSync(path.join(dir,'AS3MethodBinding.d.ts'),'export * from "../provider/AS3MethodBinding";\nexport * from "../provider/AS3Coercion";\n');
            const program=modern.createProgram(fs.readdirSync(dir).filter(n=>n.endsWith('.ts')).map(n=>path.join(dir,n)),
                {target,module:modern.ModuleKind.CommonJS,strict:true,strictNullChecks:false,lib:['lib.es2015.d.ts'],experimentalDecorators:true,noEmit:true});
            const diagnostics=errors(program);
            fs.writeFileSync(path.join(dir,'types.json'),JSON.stringify(diagnostics,null,2)+'\n');
            assert.deepStrictEqual(diagnostics,[]);
            const script=`{const modules=new Map();const specs=${JSON.stringify(specs)};for(const spec of specs)modules.set(spec.name,{});for(const spec of specs)new Function('exports','require',spec.code)(modules.get(spec.name),request=>{const name=request.split('/').pop();if(!modules.has(name))throw Error(request);return modules.get(name);});${driver(name)}}`;
            fs.writeFileSync(path.join(dir,'bundle.js'),script);
            const context=vm.createContext({}); vm.runInContext(script,context);
            const nodeRows=JSON.parse(JSON.stringify(context.result));
            fs.writeFileSync(path.join(dir,'node.json'),JSON.stringify(nodeRows,null,2)+'\n');
            assert.deepStrictEqual(nodeRows,group.expected);
            const page=await browser.newPage(),pageErrors=[];
            page.on('pageerror',error=>pageErrors.push(String(error)));
            await page.addScriptTag({content:script});
            const chromeRows=await page.evaluate(()=>globalThis.result);
            fs.writeFileSync(path.join(dir,'browser.json'),JSON.stringify(chromeRows,null,2)+'\n');
            assert.deepStrictEqual(pageErrors,[]); assert.deepStrictEqual(chromeRows,group.expected);
            await page.close();
            reports.push({group:name,target,rows:group.expected.length,nodeMatched:true,chromeMatched:true,
                strictDiagnostics:diagnostics,receiptSHA256:group.receiptSHA256,bundleSHA256:hash(script)});
            console.log(JSON.stringify(reports[reports.length-1]));
        }
        fs.writeFileSync(path.join(run,'report.json'),JSON.stringify({scope:'Bounded constructor prerequisites; not complete compiler or game admission',
            engineCommit:common.commit,compilerTypeScript:ts.version,strictTypeScript:modern.version,browser:browser.version(),
            declarationAdaptation:false,providerInputs,compilerInputs:['src/emit/native-callable-classes.ts','src/emit/emitter.ts','lib/emit/native-callable-classes.js','lib/emit/emitter.js','utils/callableClass.ts'].map(file=>({path:file,sha256:hash(fs.readFileSync(path.join(compiler,file)))})),reports},null,2)+'\n');
        console.log('Evidence: '+run);
    } finally { await browser.close(); }
}
main().catch(error=>{console.error(error); console.error('Evidence: '+run); process.exitCode=1;});
