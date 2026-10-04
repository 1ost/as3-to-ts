const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),z=require('node:zlib');
const root=path.resolve(__dirname,'../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function check(r,dir,guards,mode){
 const expected=require(path.join(dir,'verify.cjs'));
 for(const [name,file]of [['runnerSha256','run.cjs'],['observerSha256','observer.ts'],...(r.guardsSha256?[['guardsSha256','guards.cjs']]:[])])assert.equal(r[name],hash(fs.readFileSync(path.join(dir,file))));
 for(const input of r.compilerInputs)assert.equal(hash(fs.readFileSync(path.join(root,input.file),'utf8').replace(/\r\n/g,'\n')),input.sha256,input.file);
 for(const [q,s]of Object.entries(r.cohorts.subject))assert.equal(hash(fs.readFileSync(path.join(dir,'source',q+'.as'))),s.sourceSha256);
 assert.deepEqual(r.results.map(x=>x.target),['ES5','ES2015']);
 for(const x of r.results){
  assert.deepEqual(x.node,x.web);assert.deepEqual(x.web.rows,expected);assert.equal(x.rejectionGuards,guards);assert.equal(x.mutations,1);assert.equal(x.artifacts.subject.generatedSources.length,2);assert(x.typechecks.length>0);
  for(const t of x.typechecks){assert.deepEqual(t.diagnostics,[]);assert.equal(t.guards,guards);}
  assert.equal(x.controls.length,1);
  for(const c of x.controls){assert.equal(c.applied,2);assert.equal(c.mode,mode);assert.deepEqual(c.node,c.result);assert.notDeepEqual(c.result.rows,expected);}
 }
}
function current(r){for(const x of r.results)for(const i of [...x.bundleInputs,...x.typechecks.flatMap(t=>t.inputs)])assert.equal(hash(fs.readFileSync(i.file)),i.sha256,i.file);}
function read(name){const b=fs.readFileSync(path.join(__dirname,name+'.json.gz'));assert.equal(hash(b),require('./'+name+'-pin.json').sha256);return JSON.parse(z.gunzipSync(b));}
const r=read('runtime');assert.equal(typeof r.guardsSha256,'string');check(r,__dirname,10,'drop-leaves');
const a=read('regressions');check(a,path.join(__dirname,'../native-xml-lexical'),8,'wrong-child');
if(process.argv.includes('--check-current')){current(r);current(a);}
console.log(JSON.stringify({airRows:16,targets:2,realms:2,guardsPerTarget:10,mutationsPerTarget:1,typeErrors:0,adjacentAirRows:10}));
