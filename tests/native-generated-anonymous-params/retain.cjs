// Pass runtime, Object-return and nested-anonymous report.json paths, in that order.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const args=process.argv.slice(2);assert.equal(args.length,3);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const packet=(name,value)=>{const b=z.gzipSync(JSON.stringify(value));fs.writeFileSync(path.join(__dirname,name+'.json.gz'),b);fs.writeFileSync(path.join(__dirname,name+'-pin.json'),JSON.stringify({sha256:hash(b)},null,2)+'\n');};
packet('runtime',JSON.parse(fs.readFileSync(args[0])));
packet('regressions',{object:JSON.parse(fs.readFileSync(args[1])),nested:JSON.parse(fs.readFileSync(args[2]))});
fs.writeFileSync(path.join(__dirname,'baseline-pin.json'),JSON.stringify({compilerCommit:'f8c121a4a32adc0edc81ee4aefcd096c0e25e44b',files:Object.fromEntries(['baseline.cjs','baseline.log','run.cjs','source/cases/Parameters.as'].map(n=>[n,hash(fs.readFileSync(path.join(__dirname,n)))]))},null,2)+'\n');
