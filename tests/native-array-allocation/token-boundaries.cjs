// Compiler syntax regression; original runtime replay is recorded separately.
const assert=require('node:assert/strict'),path=require('node:path');
const compiler=path.resolve(__dirname,'../..'),ts=require(path.join(compiler,'node_modules/typescript'));
const parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit'));
const cases=[
 ['compact-return','return[1];',ts.SyntaxKind.ReturnStatement],
 ['empty-return','return[];',ts.SyntaxKind.ReturnStatement],
 ['nested-return','return[[1],2];',ts.SyntaxKind.ReturnStatement],
 ['compact-throw','throw[1];',ts.SyntaxKind.ThrowStatement],
 ['typeof-return','return typeof[1];',ts.SyntaxKind.ReturnStatement],
 ['indexed-return','return[1][0];',ts.SyntaxKind.ReturnStatement],
 ['parenthesized-index','return([1])[0];',ts.SyntaxKind.ReturnStatement]
];
for(const [name,body,kind] of cases){
 const source='package{public class Subject{public function Subject(){}public function value():*{'+body+'}}}';
 let generated;try{generated=emit(parse('Subject.as',source),source,{customVisitors:[],definitionsByNamespace:{},nativeClassInitialization:{classes:{Subject:'lazy'}},nativeCallableMethodBindingModule:'./CommonProvider',nativeCallableCoercionModule:'./CommonProvider',nativeCallableClasses:{Subject:source},nativeArrayCreationModule:'./ArrayFactory'});}catch(error){error.message=name+': '+error.message;throw error;}
 const tree=ts.createSourceFile('Subject.ts',generated,ts.ScriptTarget.Latest,true);
 assert.deepEqual(tree.parseDiagnostics,[],name);
 let method;
 function find(node){
  if(ts.isCallExpression(node)&&node.arguments.length===3&&ts.isStringLiteral(node.arguments[1])&&node.arguments[1].text==='value'&&ts.isObjectLiteralExpression(node.arguments[2])){
   const property=node.arguments[2].properties.find(p=>p.name&&p.name.getText(tree)==='value');
   if(property&&ts.isFunctionExpression(property.initializer))method=property.initializer;
  }
  ts.forEachChild(node,find);
 }
 find(tree);assert(method,name+': missing authored method');
 assert.equal(method.body.statements.length,1,name);
 assert.equal(method.body.statements[0].kind,kind,name+': keyword merged with factory');
 assert(method.body.statements[0].expression,name+': missing expression');
 assert.doesNotMatch(generated,/\b(?:return|throw|typeof)__as3_source_arrayLiteral/);
 for(const target of [ts.ScriptTarget.ES5,ts.ScriptTarget.ES2015])assert.deepEqual(ts.transpileModule(generated,{compilerOptions:{target,module:ts.ModuleKind.CommonJS},reportDiagnostics:true}).diagnostics,[],name);
}
console.log(JSON.stringify({ok:true,syntaxBoundaryCases:cases.length,sourceTargets:['ES5','ES2015'],runtimeEvidence:false}));
