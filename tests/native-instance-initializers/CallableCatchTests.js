const assert=require('assert'),ts=require('typescript'),parse=require('../../lib/parse'),emit=require('../../lib/emit');
function output(body,native=true){
 const source='package fixture {public class Subject {public function Subject(){'+body+'}}}';
 const options={customVisitors:[],definitionsByNamespace:{}};
 if(native)Object.assign(options,{nativeClassInitialization:{classes:{'fixture.Subject':'lazy'}},nativeCallableMethodBindingModule:'./AS3MethodBinding',nativeCallableClasses:{'fixture.Subject':source}});
 return emit(parse('Subject.as',source),source,options);
}
const wildcard='try {throw null;} catch (value : /* source comment */ *) {}';
for(const native of [false,true]){
 const text=output(wildcard,native);
 const parsed=ts.createSourceFile('Subject.ts',text,ts.ScriptTarget.ES2015,true);
 assert.deepStrictEqual(parsed.parseDiagnostics,[]);
 let catches=0;const walk=node=>{if(node.kind===ts.SyntaxKind.CatchClause){catches++;assert.equal(node.variableDeclaration.type,undefined);}ts.forEachChild(node,walk);};walk(parsed);assert.equal(catches,1);
}
for(const body of [
 'try {} catch (e:Error) {}',
 'try {} catch (e:Object) {}',
 'try {} catch (e:int) {}',
 'try {} catch (e:String) {}',
 'try {} catch (a:*) {} catch (b:*) {}',
 'try {} catch (a:Error) {} catch (b:*) {}',
 'try {} catch (a:*) {} catch (b:Error) {}',
 'try {} finally {try {} catch (e:Error) {}}',
])assert.throws(()=>output(body),/AS3_CALLABLE_CLASS_UNSUPPORTED: (typed catch|multiple catch clauses)/);
console.log(JSON.stringify({wildcardModes:2,nativeRejections:8}));
