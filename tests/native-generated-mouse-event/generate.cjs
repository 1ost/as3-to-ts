const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const engine=path.resolve(process.env.LAYA_ENGINE_REPOSITORY||'../LayaAir-op2');
const rows=require(path.join(engine,'tests/nativeFlashOracle/mouse-event-properties/verify.cjs'));
const tree=rows.find(r=>r.id==='instance-reflection').value;
const traits=tree.children.filter(n=>['accessor','method'].includes(n.tag)).map(n=>({
 name:n.attributes.name,kind:n.tag,declaredBy:n.attributes.declaredBy,
 ...(n.tag==='accessor'?{type:n.attributes.type,access:n.attributes.access}:{parameterCount:n.children.filter(c=>c.tag==='parameter').length})
}));
const source='// Projected from the retained mouse-event-properties original AIR instance tree.\n'+
 'export const nativeMouseEventTraits: ReadonlyArray<{name:string;kind:string;declaredBy:string;type?:string;access?:string;parameterCount?:number}> = '+JSON.stringify(traits,null,2)+';\n';
const file=path.resolve(__dirname,'../../src/emit/native-mouseevent-traits.ts');
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),source);
else if(require.main===module)fs.writeFileSync(file,source);
module.exports=traits;
