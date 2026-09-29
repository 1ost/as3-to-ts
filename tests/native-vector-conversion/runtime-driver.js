const nc=load('nativeClass'),Consumer=nc.readNativeClass(load('Consumer').Consumer),c=new Consumer(),rows=[],f=function(){return 'called';};
const ints=api.as3VectorFromValues(api.as3VectorPrimitiveSpec('int'),[1,2]);ints.fixed=true;
const strings=api.as3VectorFromValues(api.as3VectorPrimitiveSpec('String'),['3','4']),sparse=new Array(3);sparse[1]='6';
const inputs=[[],[1,'2',null,undefined,-1,3.5],[f,null,undefined],null,undefined,{}, {length:2,0:'7',1:'8'},'12',7,ints,strings,sparse];
for(const kind of ['int','uint','number','boolean','string','object','function'])for(let i=0;i<inputs.length;i++){
 const input=inputs[i];try{const v=c[kind+'Values'](input),out=[];for(let j=0;j<v.length;j++){const value=v[j];out.push(value===f?'function':value===undefined?'undefined':typeof value==='number'&&isNaN(value)?'NaN':value);}rows.push({id:kind+':'+i,value:['ok',v===input,v.fixed,out]});}
 catch(e){if(!api.as3IsSourceErrorInstance(e))throw e;rows.push({id:kind+':'+i,value:[e.name,e.errorID]});}
}
for(const size of [0,2.9,'2',null,undefined]){const log=[],like={get length(){log.push('length');return size;},0:'9',1:'10'};try{const r=c.intValues(like);rows.push({id:'length:'+rows.length,value:[log,r.length,r.toString()]});}catch(e){rows.push({id:'length:'+rows.length,value:[log,e.name,e.errorID]});}}
// Host controls distinguish indexed Flash conversion from JavaScript iteration.
let traps=0;const like={length:2,0:'5',1:'6',get [Symbol.iterator](){traps++;throw Error('iterator observed');}};
if(c.intValues(like).toString()!=='5,6'||traps!==0)throw Error('iterator consulted');
let reads=[];const bad={length:2,get 0(){reads.push(0);return 7;},get 1(){reads.push(1);return f;}};
let failed=false;try{c.functionValues(bad);}catch(e){failed=api.as3IsSourceErrorInstance(e)&&e.errorID===1034;}if(!failed||reads.join()!=='0')throw Error('conversion continued after failure');
failed=false;try{api.as3VectorConvert({},[]);}catch(e){failed=true;}if(!failed)throw Error('forged specialization accepted');
globalThis.result=rows;
