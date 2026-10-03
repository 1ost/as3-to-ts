const assert=require('node:assert/strict'),path=require('node:path');
const {compile,hash}=require('./compile.cjs');
module.exports=(dir,target)=>{
 const cases=[
  ['protected-return','protected function choose():Vector.<int>{return null;}'],
  ['internal-return','internal function choose():Vector.<int>{return null;}'],
  ['private-constant','private const items:Vector.<int>=null;'],
  ['unknown-element','private function choose():Vector.<Absent>{return null;}'],
  ['anonymous-return','public function choose():Function{return function():Vector.<int>{return null;};}'],
  ['nested-element','private function choose():Vector.<Vector.<int>>{return null;}']
 ];
 const results=[];
 for(const [id,body]of cases){
  const source='package cases {public class Guard {'+body+'}}';let message;
  try{compile(path.join(dir,id),target,{'cases.Guard':{source,sourceSha256:hash(source)}});}catch(error){message=error.message;}
  assert.match(message||'',/AS3_[A-Z_]+UNSUPPORTED/,id);results.push({id,message});
 }
 return results;
};
