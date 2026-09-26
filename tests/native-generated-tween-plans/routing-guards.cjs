const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const parse=require('../../lib/parse'),emit=require('../../lib/emit'),K=require('../../lib/syntax/nodeKind').default,ClassList=require('../../lib/emit/classlist').default;
const original=fs.readFileSync(path.join(__dirname,'BezierMigration.as'),'utf8');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
function generate(source){
 const calls=[];const ast=parse('guard.as',source);
 function walk(n){if(!n)return;if(n.kind===K.CALL&&source.slice(n.start,n.end).startsWith('TweenMax.to('))calls.push({start:n.start,end:n.end,callSha256:hash(source.slice(n.start,n.end)),initialization:['scaleX','alpha','bezier','scaleY']});n.children.forEach(walk);}walk(ast);
 const options={customVisitors:[],definitionsByNamespace:{},nativeTweenModule:'./FlashTweenRuntime',nativeTweenSourcePlans:{source,calls}};
 ClassList.classList=[];ClassList.isScanning=true;
 try{emit(ast,source,options);ClassList.optimize();ClassList.isScanning=false;return emit(parse('guard.as',source),source,options);}finally{ClassList.classList=[];ClassList.isScanning=false;}
}
assert.match(generate(original),/__vars.sourcePlan/);
const variants=[
 original.replace('com.greensock.TweenMax','other.TweenMax'),
 original.replace('import com.greensock.TweenMax;',''),
 original.replace('start(target:Object','start(TweenMax:*,target:Object'),
 original.replace('return TweenMax.to(target','return new TweenMax.to(target'),
 original.replace('alpha:1,bezier:points','sourcePlan:null,alpha:1,bezier:points'),
 original.replace('alpha:1,bezier:points','alpha:1,alpha:2,bezier:points'),
 original.replace('alpha:1,bezier:points','alpha:1,points:points'),
 original.replace('scaleY:1,overwrite:0','scaleZ:1,overwrite:0'),
 original.replace('TweenMax.to(target,.4,{','TweenMax.to(target,.4,{}, {'),
];
for(const source of variants)assert.throws(()=>generate(source),/AS3_TWEEN_UNSUPPORTED/);
console.log(JSON.stringify({routingGuards:variants.length}));
