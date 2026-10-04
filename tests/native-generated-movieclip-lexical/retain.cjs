const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),z=require('node:zlib'),crypto=require('node:crypto');
const files=process.argv.slice(2);assert.equal(files.length,3,'runtime, chained-references, static-getter-receiver reports');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),reports=files.map(f=>JSON.parse(fs.readFileSync(f)));
const bytes=z.gzipSync(JSON.stringify({runtime:reports[0],regressions:{'chained-references':reports[1],'static-getter-receiver':reports[2]}}));
fs.writeFileSync(path.join(__dirname,'runtime.json.gz'),bytes);fs.writeFileSync(path.join(__dirname,'runtime-pin.json'),JSON.stringify({sha256:hash(bytes)},null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'baseline-pin.json'),JSON.stringify({compilerCommit:'3b77842dd4ec73810667f46cb5bcd6b134b4e9eb',files:Object.fromEntries(['baseline.cjs','baseline.log','run.cjs',...['Base','Reader','Probe'].map(n=>'source/cases/'+n+'.as')].map(n=>[n,hash(fs.readFileSync(path.join(__dirname,n)))]))},null,2)+'\n');
