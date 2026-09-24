const assert=require('node:assert/strict'),parse=require('../../lib/parse'),K=require('../../lib/syntax/nodeKind').default;
// Source grammar boundaries: the NEW span excludes operations on its result.
const cases=[
 ['new C() as C','RELATION','new C()'],['new C() is C','RELATION','new C()'],
 ['new C()+1','ADD','new C()'],['new C?1:2','CONDITIONAL','new C'],
 ['new C().value','DOT','new C()'],['new C()[0]','ARRAY_ACCESSOR','new C()'],
 ['new C()()','CALL','new C()'],['new (factory())()','NEW','new (factory())()'],
 ['new packageName.C()','NEW','new packageName.C()'],['new table[key]()','NEW','new table[key]()'],
 ['new new C()()','NEW','new new C()()'],['new C/*c*/(1/*a*/)/*b*/as C','RELATION','new C/*c*/(1/*a*/)'],
 ['new Vector.<int>(2)[0]','ARRAY_ACCESSOR','new Vector.<int>(2)']
];
const find=(n,kind)=>{if(!n)return null;if(n.kind===kind)return n;for(const child of n.children){const found=find(child,kind);if(found)return found;}return null;};
for(const [expression,outer,construction]of cases){
 const source='package {public class P {public function f():* {return '+expression+';}}}',root=parse('P.as',source);
 const returned=find(root,K.RETURN).children[0];assert.equal(K[returned.kind],outer,expression);
 const node=find(returned,K.NEW);assert.equal(source.slice(node.start,node.end),construction,expression);
}
console.log(JSON.stringify({parserCases:cases.length}));
