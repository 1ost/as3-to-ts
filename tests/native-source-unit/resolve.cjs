const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const m=require('../../lib/emit/native-source-unit'),K=require('../../lib/syntax/nodeKind').default;
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2'),evidence=path.join(engine,'tests/nativeFlashOracle/file-local-classes');
const rows=require(path.join(evidence,'verify.cjs')),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const read=q=>{const s=fs.readFileSync(path.join(evidence,'source',q.replaceAll('.','/')+'.as'),'utf8');return m.readNativeSourceUnit(q,s,hash(s));};
const a=read('localcases.First'),b=read('localcases.Second'),ah=a.declarations[1],bh=b.declarations[1],child=a.declarations[2];
const known=new Set(['localcases.First','localcases.Second','choices.inside.Value','choices.outside.Value']);
const resolve=(u,d)=>m.nativeSourceUnitResolver(u,d,n=>known.has(n));
assert.equal(resolve(a,a.declarations[0])('Helper'),ah);assert.equal(resolve(a,child)('Helper'),ah);assert.equal(resolve(b,b.declarations[0])('Helper'),bh);
assert.notEqual(ah,bh);assert.equal(resolve(b,bh)('Child'),'Child');assert.equal(resolve(a,ah)('localcases.Helper'),'localcases.Helper');
assert.equal(resolve(a,a.declarations[0])('Value'),'choices.inside.Value');assert.equal(resolve(a,ah)('Value'),'choices.outside.Value');
assert.equal(rows.find(r=>r.id==='package-import').value,'inside');assert.equal(rows.find(r=>r.id==='file-import').value,'outside');
assert.equal(resolve(b,bh)('Value'),'Value');assert.equal(resolve(a,ah)('int'),'int');assert.equal(resolve(a,a.declarations[0])('First'),'localcases.First');
let references=0;
for(const [unit,helper]of [[a,ah],[b,bh]])for(const d of unit.declarations){
 const refs=m.nativeSourceUnitReferences(unit,d,n=>known.has(n));references+=refs.length;
 for(const r of refs){if(r.spelling==='Helper')assert.equal(r.identity,helper);assert(Object.isFrozen(r));}assert(Object.isFrozen(refs));
}
const base=m.nativeSourceUnitReferences(a,child,n=>known.has(n)).find(r=>r.spelling==='Helper');assert.equal(base.identity,ah);
const vector=m.nativeSourceUnitNode(a,a.declarations[0]);let vectors=0;const walk=n=>{if(n.kind===K.VECTOR){const t=n.findChild(K.TYPE);const ref=m.nativeSourceUnitReferences(a,a.declarations[0],n=>known.has(n)).find(r=>r.start===t.start&&r.end===t.end);assert.equal(ref.identity,ah);vectors++;}n.children.forEach(walk);};walk(vector);assert.equal(vectors,2);
let guards=0;const reject=fn=>{assert.throws(fn,/AS3_SOURCE_UNIT_UNSUPPORTED/);guards++;};
reject(()=>m.nativeSourceUnitResolver(a,bh,()=>true));reject(()=>m.nativeSourceUnitReferences({...a},ah,()=>true));
const collision=a.source.replace('import choices.inside.Value;','import choices.inside.Value; import elsewhere.Helper;');const c=m.readNativeSourceUnit(a.owner,collision,hash(collision));reject(()=>resolve(c,c.declarations[0])('Helper'));
const ambiguous=a.source.replace('import choices.inside.Value;','import choices.inside.Value; import choices.outside.Value;');const d=m.readNativeSourceUnit(a.owner,ambiguous,hash(ambiguous));reject(()=>resolve(d,d.declarations[0])('Value'));
console.log(JSON.stringify({qualification:'private declaration and source type resolution, not runtime emission',references,vectors,guards,flashRows:rows.length}));
