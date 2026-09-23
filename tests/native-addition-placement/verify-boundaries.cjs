const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('node:assert/strict');
const compiler=path.resolve(__dirname,'../..'),ts=require(path.join(compiler,'node_modules/typescript')),parse=require(path.join(compiler,'lib/parse')),emit=require(path.join(compiler,'lib/emit'));
cp.execFileSync(process.env.PYTHON,[path.join(__dirname,'verify-originals.py')],{encoding:'utf8',windowsHide:true});
const K=require(path.join(compiler,'lib/syntax/nodeKind')).default,S=ts.SyntaxKind,reports=[];
for(const [folder,name] of [['native-typed-locals','TypedLocals'],['native-addition-review','LocalReview'],['native-addition-placement','Placement']]){
 const here=path.join(compiler,'tests',folder),evidence=path.join(here,'evidence'),source=fs.readFileSync(path.join(evidence,'sources/original/probe',name+'.as'),'utf8');
 const metadata=JSON.parse(cp.execFileSync(process.env.PYTHON,[path.join(here,'extract-metadata.py'),evidence],{encoding:'utf8',windowsHide:true})),qname='probe.'+name;
 const root=parse(name+'.as',source);let originalPlus=0,originalWildcardCompounds=0;const walk=n=>{if(!n)return;if(n.kind===K.ADD)originalPlus+=n.children.filter(c=>c.kind===K.OP&&c.text==='+').length;if(name==='Placement'&&n.kind===K.ASSIGN&&n.children[1].text==='+=')originalWildcardCompounds++;n.children.forEach(walk)};walk(root);
 const generated=emit(root,source,{customVisitors:[],definitionsByNamespace:{probe:[name]},nativeClassInitialization:{classes:{[qname]:'lazy'}},nativeCallableClasses:{[qname]:source},nativeCallableMetadata:{module:'./AS3MethodBinding',classes:metadata.classes},nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableCoercionModule:'./AS3MethodBinding',nativeCallableStringModule:'./AS3String',nativeArrayCreationModule:'./AS3ArrayCreation',nativeLexicalMembersModule:'./AS3LexicalMembers',nativeTypedLocals:true,nativeTypedLocalAdditionModule:'./AS3Addition'});
 const file=ts.createSourceFile('Generated.ts',generated,ts.ScriptTarget.Latest,true),aliases=[];
 for(const statement of file.statements)if(statement.kind===S.ImportDeclaration&&statement.moduleSpecifier.text==='./AS3Addition'&&statement.importClause&&statement.importClause.namedBindings&&statement.importClause.namedBindings.elements)
  for(const specifier of statement.importClause.namedBindings.elements)if(specifier.propertyName&&specifier.propertyName.text==='as3Add')aliases.push(specifier.name.text);
 let sourceCalls=0,generatedNumericPlus=0;const scan=n=>{if(n.kind===S.CallExpression&&n.expression.kind===S.Identifier&&aliases.includes(n.expression.text))sourceCalls++;if(n.kind===S.BinaryExpression&&n.operatorToken.kind===S.PlusToken)generatedNumericPlus++;ts.forEachChild(n,scan)};scan(file);
 assert.equal(sourceCalls,originalPlus+originalWildcardCompounds,name+' source operator ownership');if(name==='TypedLocals')assert(generatedNumericPlus>0,'Generated numeric update arithmetic must remain separate');
 assert(aliases.every(alias=>!source.includes(alias)),'Compiler alias must avoid complete-source names');
 reports.push({name,originalPlus,originalWildcardCompounds,sourceHelperCalls:sourceCalls,remainingGeneratedPlus:generatedNumericPlus,sourceSHA256:crypto.createHash('sha256').update(source).digest('hex')});
}
const dir=path.join(compiler,'.cache/native-addition-placement');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'source-boundaries.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
