const assert=require('assert/strict'),api=require('../../lib'),fs=require('fs'),Module=require('module'),path=require('path');
const {sources,hash}=require('./compile.cjs');const declarations=require('../../lib/emit/native-generated-declarations');
module.exports=config=>{
 const guards=[],input=declarations.nativeGeneratedDeclarationInputs(config.plan,config.plan.scope),q='client.Factory';
 const identities=plan=>plan.namespaceKeys.map(k=>[k.uri,k.name]);
 const expected=[['urn:op2:private-helper','calculate'],['urn:op2:private-helper','extra'],['urn:op2:private-helper','fresh'],['urn:op2:private-helper','read'],['urn:op2:private-helper','value'],['urn:op2:private-other','calculate']];
 assert.deepEqual(identities(config.plan),expected);guards.push('exact deduplicated URI and name keys');
 const reversed=Object.fromEntries(Object.entries(sources).reverse());assert.deepEqual(declarations.createNativeGeneratedDeclarationPlan({...input,sources:reversed}).namespaceKeys,config.plan.namespaceKeys);guards.push('source order independent keys');
 assert.throws(()=>declarations.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,[q]:{...sources[q],source:sources[q].source+'\n'}}}),/sha|hash/i);guards.push('changed source rejected');
 const changed=sources[q].source.replace('import scope.other;','import missing.other;');assert.notEqual(changed,sources[q].source);
 assert.throws(()=>declarations.createNativeGeneratedDeclarationPlan({...input,sources:{...sources,[q]:{source:changed,sourceSha256:hash(changed)}}}),/private member requires a planned source namespace/);guards.push('unplanned namespace rejected');
 const file=require.resolve('../../lib/emit/native-generated-declarations'),source=fs.readFileSync(file,'utf8');
 const start=source.indexOf('        // Ancestry contains public package identities only.'),end=source.indexOf('        namespaceKeys =',start);assert.ok(start>=0&&end>start);
 const mutant=source.slice(0,start)+source.slice(end),m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(mutant,file);
 const old=m.exports.createNativeGeneratedDeclarationPlan(input);assert.deepEqual(identities(old),[['urn:op2:private-helper','read'],['urn:op2:private-helper','value']]);assert.notDeepEqual(identities(old),expected);guards.push('mutation: restored planner omits private member keys');
 return guards;
};
