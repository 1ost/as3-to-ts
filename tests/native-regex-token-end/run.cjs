const assert=require('assert/strict'),parse=require('../../lib/parse'),emit=require('../../lib/emit'),ts=require('typescript');
const literals=['/a/g','/b/im','/c/mig','/[a-z\\/]+/gi','/plain/'];
const source='package {public class RegexTokens {public function run():*{var values:Array=['+literals.join(',')+'];var n:Number=8 / 2;return [values,/end/g.test("end"),"literal /g",n];}}}';
const output=emit(parse('RegexTokens.as',source),source,{customVisitors:[]});
const ast=ts.createSourceFile('RegexTokens.ts',output,ts.ScriptTarget.Latest,true),found=[];
function walk(n){if(n.kind===ts.SyntaxKind.RegularExpressionLiteral)found.push(n.text);ts.forEachChild(n,walk);}walk(ast);
assert.deepEqual(found,[...literals,'/end/g']);
for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015]){
 const result=ts.transpileModule(output,{compilerOptions:{target,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}});
 assert.doesNotThrow(()=>new Function(result.outputText)); // Includes following delimiters, calls and division.
}
console.log('Six regex tokens retain exact flags; complete generated JS parses on ES5/ES2015.');
