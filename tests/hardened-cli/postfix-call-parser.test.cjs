'use strict';
const test=require('node:test'),assert=require('assert/strict'),path=require('path'),fs=require('fs'),os=require('os');
const root=path.resolve(__dirname,'../..');
test('postfix calls retain nested receiver, key and argument expressions inside their statement',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'postfix-parser-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const bundle=path.join(dir,'parser.cjs');
 require('esbuild').buildSync({stdin:{contents:'exports.parse=require("./src/parse/index").default; exports.kind=require("./src/syntax/nodeKind").nodeKindName;',resolveDir:root,sourcefile:'postfix.js'},outfile:bundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent'});const {parse,kind}=require(bundle);
 const source='package {public class Probe {public function run():void {if(flag) answer=owner()[key()](arg()); else answer=other()()[key](first(),second()); after();}}}';
 const tree=parse('Probe.as',source),nodes=[];function visit(n){if(!n||typeof n!=='object')return;n.kind=kind(n.kind);nodes.push(n);for(const c of n.children||[])visit(c);}visit(tree);
 const calls=nodes.filter(n=>n.kind==='CALL');
 const first=calls.find(n=>source.slice(n.start,n.end)==='owner()[key()](arg())');assert.ok(first);
 assert.equal(first.children.length,2);assert.equal(first.children[0].kind,'ARRAY_ACCESSOR');assert.equal(first.children[0].children[0].kind,'CALL');assert.equal(first.children[0].children[1].kind,'CALL');assert.equal(first.children[1].kind,'ARGUMENTS');
 assert.ok(calls.some(n=>source.slice(n.start,n.end)==='other()()[key](first(),second())'));
 assert.ok(calls.some(n=>source.slice(n.start,n.end)==='after()'));
 assert.equal(nodes.filter(n=>n.kind==='ENCAPSULATED').length,0);assert.equal(nodes.filter(n=>n.kind==='IDENTIFIER'&&n.text==='else').length,0);
 for(const expression of ['owner()[key()](,arg())','owner()[key()](arg()','owner()[key()(arg())'])assert.throws(()=>parse('Bad.as','package {class Bad {function f():void {'+expression+';}}}'));
});
