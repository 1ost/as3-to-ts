const assert = require('assert');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const ClassList = require('../../lib/emit/classlist').default;

const options = {
    lineSeparator: '\n',
    useNamespaces: false,
    customVisitors: [],
    definitionsByNamespace: {},
    importModules: { 'flash.utils.describeType': './describeType' },
    nativeReflectionQueryModule: './AS3ReflectionQuery',
};

function generate(source, opts = options) {
    const previousList = ClassList.classList;
    const previousScanning = ClassList.isScanning;
    try {
        ClassList.classList = [];
        ClassList.isScanning = true;
        emit(parse('ReflectionQuery.as', source), source, opts);
        ClassList.optimize();
        ClassList.isScanning = false;
        return emit(parse('ReflectionQuery.as', source), source, opts);
    } finally {
        ClassList.classList = previousList;
        ClassList.isScanning = previousScanning;
    }
}

const tweenOptions = {
    ...options,
    importModules: { 'migration.FlashTweenRuntime': './FlashTweenRuntime' },
    nativeReflectionQueryModule: undefined,
    nativeTweenModule: './FlashTweenRuntime',
};

module.exports=function(){
 let checks=0;
 const source='package probe { import com.greensock.TweenMax; public class Delayed {public function run(delay:Number,callback:Function):Object {return TweenMax.delayedCall(delay,callback);}}}';
 assert.match(generate(source,tweenOptions),/current\(\)\.delayedCall\(delay,callback\)/);
 const reject=(s,re=/AS3_TWEEN_UNSUPPORTED/)=>{assert.throws(()=>generate(s,tweenOptions),re);checks++;};
 for(const args of ['', 'delay', 'delay,callback,[],false', 'delay,callback,null,false', 'delay,callback,[],null,true'])
  reject(source.replace('delayedCall(delay,callback)','delayedCall('+args+')'),/delayedCall requires two or three arguments/);
 for(const expr of ['TweenMax.delayedCall','new TweenMax.delayedCall(delay,callback)','TweenMax','new TweenMax(delay,callback)'])
  reject(source.replace('TweenMax.delayedCall(delay,callback)',expr));
 reject(source.replaceAll('TweenMax','TweenLite'));
 for(const changed of [source.replace('import com.greensock.TweenMax;',''),source.replace('com.greensock.TweenMax','other.TweenMax'),source.replace('run(delay:Number','run(TweenMax:*,delay:Number'),source.replace('public function run','private var TweenMax:Object; public function run')]){
  const output=generate(changed,tweenOptions);assert.doesNotMatch(output,/current\(\)\.delayedCall/);assert.match(output,/TweenMax\.delayedCall/);checks++;
 }
 assert.doesNotMatch(generate(source,{...tweenOptions,nativeTweenModule:undefined}),/current\(\)\.delayedCall/);checks++;
 return checks;
};
if(require.main===module)console.log(JSON.stringify({guards:module.exports()}));
