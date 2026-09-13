'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'as3-relation-'));
fs.writeFileSync(path.join(output, 'tsconfig.json'), JSON.stringify({compilerOptions: {
    target:'ES2022', module:'CommonJS', strict:true, skipLibCheck:true,
    rootDir:path.join(root,'src'), outDir:output,
}, files:[path.join(root,'src/hardened-runtime/AS3Coerce.ts')]}));
cp.execFileSync(process.execPath, [path.join(root,'node_modules/typescript-4-9/bin/tsc'), '-p', path.join(output,'tsconfig.json')], {stdio:'inherit'});
const {as3Relation} = require(path.join(output,'hardened-runtime/AS3Coerce.js'));
const registry = require(path.join(output,'hardened-runtime/internal/AS3TypeRegistry.js'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
class DynamicRelationProbe {}
const row = {kind:'class',qname:'DynamicRelationProbe',base:null,interfaces:[],sourceSha256:'a'.repeat(64),fields:[],objectTraits:{dynamic:false,members:[]}};
const metadata = {schema:'as3-runtime-type-authority@1',qnames:[row.qname],entries:[row]};
registry.installAS3TypeAuthority({schema:metadata.schema,sha256:sha(JSON.stringify(metadata)),qnames:metadata.qnames,entries:[{
    ...row,constructor:DynamicRelationProbe,predicate:value=>value instanceof DynamicRelationProbe,
    constructionTarget:null,constructionProof:null,
}]});
test.after(() => fs.rmSync(output,{recursive:true,force:true}));
test('ordered comparisons preserve AIR values and conversion order', () => {
 const laya=process.env.HARDENED_FIXTURE_LAYA;assert.ok(laya,'Laya fixture required');
 const dir=path.join(laya,'tests/nativeFlashOracle/dynamic-relation');
 const golden=JSON.parse(fs.readFileSync(path.join(dir,'native-air.json')));
 assert.equal(sha(fs.readFileSync(path.join(dir,'DynamicRelationProbe.as'))),golden.sourceFiles['DynamicRelationProbe.as']);
 assert.equal(sha(fs.readFileSync(path.join(dir,'scenario.json'))),golden.scenarioSha256);
 for(let mode=0;mode<17;mode++) {
  const result=[];
  for(const op of ['<','<=','>','>=']) {
   const events=[];const operand=(label,value)=>({valueOf(){events.push(label);return value;}});
   let [a,b]=[[0,3],['12','3'],['12',3],[null,0],[undefined,0],[NaN,1],[true,1],[[],0],[[2],3]][mode]||[0,3];
   if(mode===9){a=operand('left',2);b=operand('right',3);}
   if(mode===10){a=operand('left','12');b=operand('right','3');}
   if(mode===11){a={valueOf(){events.push('value');return {};},toString(){events.push('text');return '2';}};b=3;}
   if(mode===12){a={valueOf(){events.push('throw');throw new Error('comparison');}};b=operand('right',3);}
   if(mode===13){a=Infinity;b=Infinity;}
   if(mode===14){a=-0;b=0;}
   if(mode===15){a={};b={};}
   if(mode===16){a=operand('left',2);b=operand('right',3);}
   const evaluated=(label,value)=>{events.push(label);return value;};
   try{result.push(mode===16 ? as3Relation(evaluated('eval-left',a),evaluated('eval-right',b),op) : as3Relation(a,b,op));}catch(error){result.push(error.name,error.message);}
   result.push(events.join('|'));
  }
  assert.deepEqual(result,golden.capture.state.observations.find(row=>row.id==='relation-'+mode).result,'mode '+mode);
 }
});
test('host-only values cannot silently enter AS3 comparison',()=>{
 for(const value of [1n,Symbol('host')])for(const op of ['<','<=','>','>='])
  assert.throws(()=>as3Relation(value,0,op),{name:'AS3ObjectDispatchUnavailable'});
});
