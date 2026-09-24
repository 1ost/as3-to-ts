const assert=require('node:assert/strict'),parse=require('../../lib/parse'),emit=require('../../lib/emit');
const moduleName='./DefinitionRegistry';
const options={customVisitors:[],importModules:{'flash.utils.getDefinitionByName':moduleName},definitionsByNamespace:{'flash.utils':['getDefinitionByName']}};
const source=(body,imports='import flash.utils.getDefinitionByName;',params='name:String')=>
 `package cases {${imports} public class Guard {public function run(${params}):Object {${body}}}}`;
const compile=(input,opts=options)=>emit(parse('Guard.as',input),input,opts);
let rejected=0;
for(const input of [
 source('return getDefinitionByName;'),
 source('return getDefinitionByName.call(null,name);'),
 source('return new getDefinitionByName(name);'),
 source('getDefinitionByName=null;return null;'),
 source('return getDefinitionByName(name);',''),
 source('return flash.utils.getDefinitionByName(name);'),
]){assert.throws(()=>compile(input),/AS3_DEFINITION_LOOKUP_UNSUPPORTED/);rejected++;}
assert.throws(()=>compile(source('return getDefinitionByName(name);'),{...options,importModules:{'flash.utils.getDefinitionByName':'bad"module'}}),/MODULE_UNSUPPORTED/);rejected++;
assert.throws(()=>compile(source('return getDefinitionByName(name);'),{...options,useNamespaces:true}),/AS3_DEFINITION_LOOKUP_UNSUPPORTED/);rejected++;
const local=compile(source('return getDefinitionByName(name);','import flash.utils.getDefinitionByName;','getDefinitionByName:Function,name:String'));
assert.ok(!local.includes('AS3Utils'));assert.match(local,/return getDefinitionByName\(name\)/);
const other=compile(source('return getDefinitionByName(name);','import other.getDefinitionByName;'),{...options,importModules:{...options.importModules,'other.getDefinitionByName':'./other'}});
assert.ok(!other.includes('AS3Utils'));assert.ok(!other.includes('__as3_getDefinitionByName'));assert.match(other,/from "\.\/other"/);
const collision=compile(source('var __as3_getDefinitionByName:String="collision";return getDefinitionByName(name);'));
assert.match(collision,/getDefinitionByName as __as3_getDefinitionByName_/);
const wildcard=compile(source('return getDefinitionByName(name);','import flash.utils.*;'));
assert.match(wildcard,/return __as3_getDefinitionByName\(name\)/);
const parenthesized=compile(source('return (getDefinitionByName)(name);'));
assert.match(parenthesized,/return \(__as3_getDefinitionByName\)\(name\)/);
const objectMember=compile(source('return flash.utils.getDefinitionByName(name);','','flash:Object,name:String'));
assert.match(objectMember,/return flash.utils.getDefinitionByName\(name\)/);
const legacy=compile(source('return getDefinitionByName(name);'),{...options,importModules:{}});
assert.match(legacy,/AS3Utils.getDefinitionByName/);
console.log(JSON.stringify({rejected,shadowAndAliasChecks:7}));
module.exports={rejected,shadowAndAliasChecks:7};
