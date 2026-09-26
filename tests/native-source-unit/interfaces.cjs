const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const model=require('../../lib/emit/native-source-unit'),K=require('../../lib/syntax/nodeKind').default;
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const evidence=path.join(engine,'tests/nativeFlashOracle/file-local-interfaces');
const rows=require(path.join(evidence,'verify.cjs')),row=id=>rows.find(r=>r.id===id).value;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const read=q=>{const text=fs.readFileSync(path.join(evidence,'source',q.replaceAll('.','/')+'.as'),'utf8');return model.readNativeSourceUnit(q,text,hash(text));};
const first=read('localinterfaces.First'),second=read('localinterfaces.Second'),base=read('contracts.IBase');
const declaration=(unit,name)=>unit.declarations.find(d=>d.name===name);
const a=declaration(first,'IValue'),b=declaration(second,'IValue'),localBase=declaration(first,'ILocalBase');
assert.equal(a.kind,'interface');assert.equal(a.packageQName,null);assert.equal(b.packageQName,null);
assert.notEqual(a,b);assert.deepEqual(row('interface-identities'),[true,true,true]);
assert.deepEqual([a.reflectedName,b.reflectedName,localBase.reflectedName],row('interface-names'));
assert.deepEqual(row('cross-is'),[false,false,false]);
for(const id of ['global-lookup','qualified-lookup','package-lookup'])assert.deepEqual(row(id),['ReferenceError',1065]);
const known=new Set([first.owner,second.owner,base.owner]);
let interfaces=0,references=0;
for(const unit of [first,second,base])for(const d of unit.declarations){
 const resolve=model.nativeSourceUnitResolver(unit,d,n=>known.has(n));
 if(unit===first){assert.equal(resolve('IValue'),a);assert.equal(resolve('ILocalBase'),localBase);}
 if(unit===second){assert.equal(resolve('IValue'),b);assert.equal(resolve('ILocalBase'),'ILocalBase');}
 const node=model.nativeSourceUnitNode(unit,d);
 if(d.kind==='interface'){
  interfaces++;
  const original=unit.source.slice(node.start,node.end);
  assert.match(original,/^(?:public\s+)?interface\s+\w+/,'interface declaration must include its opening keyword');
  assert(original.endsWith('}'));
  const name=node.findChild(K.NAME);
  assert.equal(unit.source.slice(name.start,name.end),d.name,'interface name must point to its original token');
  for(const parent of node.findChildren(K.EXTENDS))
   assert.equal(unit.source.slice(parent.start,parent.end),parent.text,'base reference must point to its original token');
  if(d===a)assert.deepEqual(node.findChildren(K.EXTENDS).map(n=>resolve(n.text)),['contracts.IBase',localBase]);
 }
 for(const ref of model.nativeSourceUnitReferences(unit,d,n=>known.has(n))){
  references++;
  // Untyped constructors carry a zero-width implicit wildcard in the parser.
  if(ref.start===ref.end)assert.equal(ref.spelling,'*');
  else assert.equal(unit.source.slice(ref.start,ref.end),ref.spelling,'type references must retain original offsets');
  if(ref.spelling==='IValue')assert.equal(ref.identity,unit===first?a:b);
 }
}
let guards=0;const reject=fn=>{assert.throws(fn,/AS3_SOURCE_UNIT_UNSUPPORTED/);guards++;};
reject(()=>model.nativeSourceUnitNode(first,b));reject(()=>model.nativeSourceUnitNode(first,{...a}));
reject(()=>model.nativeSourceUnitResolver(second,a,()=>true));
reject(()=>model.nativeSourceUnitAst(JSON.parse(JSON.stringify(first))));
const detached=model.nativeSourceUnitNode(first,a);detached.start=0;detached.children.length=0;
assert.equal(model.nativeSourceUnitNode(first,a).findChildren(K.EXTENDS).length,2);
// Modifiers must still be included; public interface inheritance
// uses the same parser and must retain both comma-separated reference spans.
const decorated='package p {public interface I extends q.Base, q.Other {function take(n:int):void;}}';
const unit=model.readNativeSourceUnit('p.I',decorated,hash(decorated)),node=model.nativeSourceUnitNode(unit,unit.declarations[0]);
assert.match(decorated.slice(node.start,node.end),/^public interface/);
for(const ref of node.findChildren(K.EXTENDS))assert.equal(decorated.slice(ref.start,ref.end),ref.text);
assert.equal(node.findChildren(K.EXTENDS).length,2);
console.log(JSON.stringify({qualification:'source interface identity, lexical ownership and original declaration/reference spans; runtime emission remains held',flashRows:rows.length,interfaces,references,guards}));
