const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require(path.resolve('../LayaAir-op2/node_modules/typescript'));
const source=fs.readFileSync(path.resolve('utils/callableClass.ts'),'utf8');
const moduleOutput={exports:{}};
new Function('module','exports',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText)(moduleOutput,moduleOutput.exports);
const intrinsics=moduleOutput.exports.callableClassIntrinsics;
let invoked=0;function Subject(){invoked++;}
Object.defineProperty(Subject,'name',{get(){throw Error('host name read');}});
assert.equal(intrinsics.constructorIdentity(Subject),Subject);
assert.equal(invoked,0,'identity projection must not execute a constructor');
assert.throws(()=>intrinsics.enter(Object.create(Subject.prototype),Subject),e=>e.errorID===1006,'projection cannot grant constructor registration');
function InvalidPrototype(){} InvalidPrototype.prototype=1;
for(const invalid of [null,undefined,{}, {prototype:{}}, ()=>{}, (function Other(){}).bind(null), InvalidPrototype])
 assert.throws(()=>intrinsics.constructorIdentity(invalid),TypeError);
console.log(JSON.stringify({constructorIdentityControls:10,hostNameAccess:false,constructorEffects:invoked}));
