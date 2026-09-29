const fs=require('fs'),path=require('path'),z=require('zlib'),c=require('crypto'),assert=require('assert/strict');
const hash=b=>c.createHash('sha256').update(b).digest('hex'),root=path.resolve(__dirname,'../..'),pin=require('./construction-pin.json');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
for(const [file,digest]of Object.entries(pin.runners))assert.equal(hash(fs.readFileSync(path.join(root,file))),digest,file);
const reports={};for(const [file,digest]of Object.entries(pin.reports)){const bytes=fs.readFileSync(path.join(__dirname,file));assert.equal(hash(bytes),digest);reports[file]=JSON.parse(z.gunzipSync(bytes));}
const vectors=reports['construction-vectors.json.gz'],subclasses=reports['construction-subclasses.json.gz'];
assert.equal(vectors.construction,true);assert.equal(vectors.combined,true);assert.equal(vectors.rejectionGuards,10);assert.equal(vectors.comparisonNegativeControls,3);assert.deepEqual(vectors.typecheck.diagnostics,[]);
assert.deepEqual(vectors.results.map(r=>r.target),[1,2]);for(const row of vectors.results)assert.deepEqual(row.web,require(path.join(engine,'tests/nativeFlashOracle/movieclip-vectors/verify.cjs')));
assert.equal(subclasses.vectors,true);assert.deepEqual(subclasses.results.map(r=>r.target),['ES5','ES2015']);
for(const row of subclasses.results){assert.deepEqual(row.web.rows,require(path.join(engine,'tests/nativeFlashOracle/movieclip-source-surface/verify.cjs')).filter(r=>r.id.startsWith('subclass-')));assert.equal(row.web.guards.length,5);assert.equal(row.mutations,2);assert.deepEqual(row.diagnostics,[]);}
console.log(JSON.stringify({status:'passed',vectorRows:39,constructionRows:2,targets:2,compilerGuards:10}));
