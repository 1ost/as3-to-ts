const assert=require('assert/strict'),api=require('../../lib'),{sources,hash}=require('./compile.cjs');
const {createNativeSourceAncestryPlan}=require('../../lib/emit/native-source-ancestry');
module.exports=config=>{
 const types=createNativeSourceAncestryPlan({sources}).classes['model.Holder'].types.filter(v=>v.name==='paragraph');
 assert.deepEqual(types.map(v=>[v.namespaceUri||null,v.type]),[['urn:op2:chain-other','*'],[null,'compose.Composer']]);
 assert.throws(()=>api.emitNativeSourceClassModule({...config,plan:{...config.plan}}),/AS3_.*UNSUPPORTED/);
 return ['namespace getter type remains URI-qualified','copied declaration plan rejected'];
};
