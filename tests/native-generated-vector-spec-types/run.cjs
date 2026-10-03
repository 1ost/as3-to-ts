const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const api=require('../../lib');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-string-methods-review');
const ts=require(path.join(engine,'node_modules/typescript'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const root=path.resolve('.cache/native-generated-vector-spec-types');fs.mkdirSync(root,{recursive:true});
const out=fs.mkdtempSync(path.join(root,'run-'));
const provider=name=>path.relative(out,path.join(engine,'src/layaAir/flash/utils',name)).replaceAll('\\','/');
const kinds={String:'string',Boolean:'boolean',int:'number',uint:'number',Number:'number'};
const source='package cases { public class Probe {'+Object.keys(kinds).map((kind,i)=>' public var field'+i+':Vector.<'+kind+'>;').join('')+' } }';
const plan=api.createNativeGeneratedDeclarationPlan({scope:'vector-spec-types',sources:{'cases.Probe':{source,sourceSha256:hash(source)}},providerModule:provider('AS3GeneratedClass'),vectorProviderModule:provider('AS3Vector')});
const declarations=path.join(out,'declarations.ts'),consumer=path.join(out,'consumer.ts');
fs.writeFileSync(declarations,plan.moduleSource);
const lines=[`import {AS3Vector,as3VectorCreate,as3VectorConvert,as3VectorFromValues} from ${JSON.stringify(provider('AS3Vector'))};`,
 `import * as specs from './declarations';`];
let checks=0;
for(const [kind,type]of Object.entries(kinds)){
 const name=plan.vectors.find(v=>v.identity==='Vector.<'+kind+'>').specExport;
 const spec='specs.'+name;
 lines.push(`declare function take${kind}(value:AS3Vector<${type}>):void;`);
 for(const call of [`as3VectorCreate(${spec})`,`as3VectorConvert(${spec},[])`,`as3VectorFromValues(${spec},[])`]){lines.push(`take${kind}(${call});`);checks++;}
 lines.push(`const item${kind}:${type}=as3VectorConvert(${spec},[])[0];`);checks++;
 // A blanket any specialization would incorrectly accept this call.
 const wrong=type==='number'?'string':'number';
 lines.push(`declare function wrong${kind}(value:AS3Vector<${wrong}>):void;`,
  '// @ts-expect-error incompatible element type must remain rejected',
  `wrong${kind}(as3VectorConvert(${spec},[]));`);
}
fs.writeFileSync(consumer,lines.join('\n'));
const options={target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,noEmit:true,skipLibCheck:true};
function check(){const program=ts.createProgram([consumer,declarations],options);return ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));}
assert.deepEqual(check(),[]);
const old=plan.moduleSource.replace(/as3VectorPrimitiveSpec<(string|boolean|number)>/g,'as3VectorPrimitiveSpec');
fs.writeFileSync(declarations,old);
const held=check();assert.equal(held.length,20);assert(held.every(d=>[2322,2345].includes(d.code)&&d.message.includes('unknown')));
fs.writeFileSync(declarations,plan.moduleSource);
// Type arguments must not alter the JS that creates runtime specialization tokens.
for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
 const compile=source=>ts.transpileModule(source,{compilerOptions:{target,module:ts.ModuleKind.CommonJS}}).outputText;
 assert.equal(compile(plan.moduleSource),compile(old));
}
// Ambiguous imported builtin spellings must retain the existing planner hold.
const shadows={
 'objects.String':'package objects { public class String {} }',
 'cases.Shadow':'package cases { import objects.String; public class Shadow { public var values:Vector.<String>; } }'
};
assert.throws(()=>api.createNativeGeneratedDeclarationPlan({scope:'vector-shadow',sources:Object.fromEntries(Object.entries(shadows).map(([q,source])=>[q,{source,sourceSha256:hash(source)}])),providerModule:provider('AS3GeneratedClass'),vectorProviderModule:provider('AS3Vector')}),/ambiguous builtin type/);
const result={out,scalarKinds:5,positiveChecks:checks,negativeChecks:5,revertedTypeErrors:held.length,identicalRuntimeTargets:['ES5','ES2015'],sourceShadowChecks:1};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
