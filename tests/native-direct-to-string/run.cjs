const assert = require('assert');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const ClassList = require('../../lib/emit/classlist').default;

const options = {
    lineSeparator: '\n',
    useNamespaces: false,
    customVisitors: [],
    definitionsByNamespace: {},
    importModules: { 'flash.utils.describeType': './describeType' },
    nativeReflectionQueryModule: './AS3ReflectionQuery',
};

function generate(source, opts = options) {
    const previousList = ClassList.classList;
    const previousScanning = ClassList.isScanning;
    try {
        ClassList.classList = [];
        ClassList.isScanning = true;
        emit(parse('ReflectionQuery.as', source), source, opts);
        ClassList.optimize();
        ClassList.isScanning = false;
        return emit(parse('ReflectionQuery.as', source), source, opts);
    } finally {
        ClassList.classList = previousList;
        ClassList.isScanning = previousScanning;
    }
}
const directStringOptions = {
    ...options,
    importModules: { 'compiler.AS3String': './AS3String' },
    nativeReflectionQueryModule: undefined,
    nativeDirectToStringModule: './AS3String',
};
const directStringSource = `package probe {
 public class DirectString {
  public function direct(value:Object):Object { return value.toString(); }
  public function argument(value:Object):Object { return value.toString(1); }
  public function receiver():Object { return getValue().toString(); }
  public function consume(value:Object):String { return echo(value.toString()); }
  private function echo(value:String):String { return value; }
  private function getValue():Object { return this; }
 }
}`;
const directStringOutput = generate(directStringSource, directStringOptions);
assert.match(directStringOutput, /as3InvokeToString as __as3_as3InvokeToString/);
assert.match(directStringOutput, /__as3_as3InvokeToString\(value\)/);
assert.match(directStringOutput, /__as3_as3InvokeToString\(this\.getValue\(\)\)/);
assert.match(directStringOutput, /\(<any>__as3_as3InvokeToString\(value\)\)/);
assert.match(directStringOutput, /value\.toString\(1\)/);
assert.strictEqual((directStringOutput.match(/this\.getValue\(\)/g) || []).length, 1,
    'direct toString receiver must be evaluated once');
assert.throws(() => generate(directStringSource, {
    ...directStringOptions,
    nativeDirectToStringModule: './other',
}), /AS3_DIRECT_TOSTRING_UNSUPPORTED/);


const fs=require('fs'),path=require('path');
const engine=path.resolve('../LayaAir-op2'),ts=require(path.join(engine,'node_modules/typescript')),esbuild=require(path.join(engine,'node_modules/esbuild'));
const base=path.resolve('.cache/native-direct-to-string');fs.mkdirSync(base,{recursive:true});const out=fs.mkdtempSync(path.join(base,'run-'));
const modulePath=file=>{const r=path.relative(out,file).replaceAll('\\','/').replace(/\.ts$/,'');return r.startsWith('.')?r:'./'+r;};
const provider=modulePath(path.join(engine,'src/layaAir/flash/utils/AS3String.ts'));
const actual=generate(directStringSource,{...directStringOptions,importModules:{'compiler.AS3String':provider},nativeDirectToStringModule:provider,
 decoratorModules:Object.fromEntries(['bound','classBound'].map(n=>[n,modulePath(path.resolve('utils',n+'.ts'))]))});
const filePath=path.join(out,'DirectString.ts');fs.writeFileSync(filePath,actual);
const program=ts.createProgram([filePath,...['glsl.d.ts','spine.d.ts'].map(f=>path.join(engine,'src/layaAir/tslibs',f))],{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,experimentalDecorators:true,noEmit:true,skipLibCheck:true,lib:['lib.es2020.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']});
const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,code:d.code,text:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
fs.writeFileSync(path.join(out,'types.json'),JSON.stringify(diagnostics,null,2));assert.deepStrictEqual(diagnostics,[]);
const control=path.join(out,'UnknownBoundary.ts');
fs.writeFileSync(control,actual.replaceAll('(<any>__as3_as3InvokeToString(value))','__as3_as3InvokeToString(value)'));
const controlProgram=ts.createProgram([control,...program.getRootFileNames().filter(f=>f.endsWith('.d.ts'))],program.getCompilerOptions());
assert.ok(ts.getPreEmitDiagnostics(controlProgram).some(d=>d.code===2345&&d.file&&path.resolve(d.file.fileName)===control),
 'Removing the generated boundary must restore the unknown-to-String argument error');
for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
 const output=ts.transpileModule(actual,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
 const bundle=esbuild.buildSync({stdin:{contents:output,resolveDir:out,loader:'js'},bundle:true,write:false,format:'cjs',platform:'node',loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}}).outputFiles[0].text;
 const m={exports:{}};new Function('module','exports','require',bundle)(m,m.exports,require);const subject=new m.exports.DirectString();
 let calls=0;const sentinel={marker:1};assert.strictEqual(subject.direct({toString(){calls++;return sentinel;}}),sentinel);assert.equal(calls,1);
 assert.strictEqual(subject.consume({toString(){return 'observed';}}),'observed');
 assert.strictEqual(subject.direct({toString(){return 17;}}),17);
}
console.log(JSON.stringify({out,typeErrors:diagnostics.length,targets:['ES5','ES2015'],runtime:'Node',scope:'Type-only boundary; raw custom returns and single invocation preserved'}));
