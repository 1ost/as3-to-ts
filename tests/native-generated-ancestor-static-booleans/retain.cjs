const fs=require('fs'),path=require('path'),z=require('zlib'),crypto=require('crypto'),cp=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2-display-accessor-review');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const names=['ancestor','booleans','strings','constants','vectors'];assert.equal(process.argv.length,7,'pass five completed report.json paths');
const reports=Object.fromEntries(names.map((name,i)=>[name,JSON.parse(fs.readFileSync(process.argv[i+2]))]));
const files=[];function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else if(/.(ts|js|cjs)$/.test(item.name))files.push(file);}}
walk(path.join(root,'src'));walk(path.join(root,'utils'));
for(const name of ['ancestor-static-booleans','protected-static-booleans','protected-static-strings','protected-constants','static-vector-storage'])walk(path.join(root,'tests/native-generated-'+name));
for(const name of ['package.json','package-lock.json','tsconfig.json'])if(fs.existsSync(path.join(root,name)))files.push(path.join(root,name));
const inputs=files.map(file=>({file:path.relative(root,file).replaceAll('\\','/'),sha256:hash(fs.readFileSync(file))}));
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'baseline.json')));
const document={engine,engineCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),inputs,baseline,reports};
const bytes=z.gzipSync(JSON.stringify(document),{level:9});fs.writeFileSync(path.join(__dirname,'report.json.gz'),bytes);
fs.writeFileSync(path.join(__dirname,'pin.json'),JSON.stringify({sha256:hash(bytes)},null,2)+'\n');
require('./verify.cjs');
