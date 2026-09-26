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
    nativeTweenSourcePlans: { source: 'fixture', calls: [{ start: 0, end: 1 }] },
};
const tweenSource = `package probe {
 public class TweenMigration {
  public function run(target:Object, duration:Number, vars:Object):Object {
   return TweenMax.to(target, duration, vars);
  }
  public function lite(target:Object, duration:Number, vars:Object):Object {
   return TweenLite.to(target, duration, vars);
  }
  public function shadow(TweenMax:Function, target:Object, duration:Number, vars:Object):Object {
   return TweenMax.to(target, duration, vars);
  }
 }
}`;
const tweenOutput = generate(tweenSource, tweenOptions);
assert.match(tweenOutput, /FlashTweenRuntime as __as3_FlashTweenRuntime/);
assert.match(tweenOutput, /__as3_FlashTweenRuntime\.current\(\)\.to\(target, duration, vars\)/);
assert.match(tweenOutput, /__as3_FlashTweenRuntime\.current\(\)\.toLite\(target, duration, vars\)/);
assert.match(tweenOutput, /return TweenMax\.to\(target, duration, vars\)/);
for (const name of ['TweenMax', 'TweenLite']) {
    const imported = tweenSource.replace('package probe {', 'package probe { import com.greensock.' + name + ';');
    const output = generate(imported, tweenOptions);
    assert.doesNotMatch(output, new RegExp('import \\{ ' + name + ' \\}'));
    assert.strictEqual((output.match(/__as3_FlashTweenRuntime\.current\(\)\.to(?:Lite)?\(/g) || []).length, 2);
    assert.match(output, /return TweenMax\.to\(target, duration, vars\)/, 'parameter shadows imported migration');
    const other = generate(imported.replace('com.greensock.', 'other.'), tweenOptions);
    assert.match(other, new RegExp('import \\{ ' + name + ' \\}'));
    assert.strictEqual((other.match(/__as3_FlashTweenRuntime\.current\(\)\.to(?:Lite)?\(/g) || []).length, 1,
        'unrelated imported Class must not migrate');
    assert.match(generate(imported, {...tweenOptions, nativeTweenModule: undefined}),
        new RegExp('import \\{ ' + name + ' \\}'), 'migration remains opt-in');
}
assert.throws(() => generate(tweenSource, {
    ...tweenOptions,
    nativeTweenModule: './other',
}), /AS3_TWEEN_UNSUPPORTED/);

for (const expression of ['TweenMax', 'TweenMax.from(target, duration, vars)', 'new TweenMax(target, duration, vars)']) {
    const source = `package probe { import com.greensock.TweenMax; public class Held {
      public function run(target:Object,duration:Number,vars:Object):Object { return ${expression}; }
    } }`;
    assert.throws(()=>generate(source,tweenOptions), /AS3_TWEEN_UNSUPPORTED/);
}
console.log('Native imported tween routing passed');

const querySource = `package probe { import com.greensock.TweenMax;
 public class Query {
  public function run(target:Object):Array { return TweenMax.getTweensOf(target); }
  public function shadow(TweenMax:*, target:Object):* { return TweenMax.getTweensOf(target); }
 }
}`;
const queryOutput = generate(querySource, tweenOptions);
assert.match(queryOutput, /__as3_FlashTweenRuntime\.current\(\)\.getTweensOf\(target\)/);
assert.match(queryOutput, /return TweenMax\.getTweensOf\(target\)/, 'parameter retains ownership');
for (const args of ['', 'target, true', 'target, false']) {
    assert.throws(() => generate(querySource.replace('getTweensOf(target)', `getTweensOf(${args})`), tweenOptions),
        /AS3_TWEEN_UNSUPPORTED: getTweensOf requires exactly one target argument/);
}
for (const expression of ['TweenMax.getTweensOf', 'new TweenMax(target)', 'new TweenMax.getTweensOf(target)', 'TweenMax.isTweening(target)']) {
    assert.throws(() => generate(querySource.replace('TweenMax.getTweensOf(target)', expression), tweenOptions), /AS3_TWEEN_UNSUPPORTED/);
}
for (const source of [querySource.replace('import com.greensock.TweenMax;', ''),
    querySource.replace('com.greensock.TweenMax', 'other.TweenMax')]) {
    assert.doesNotMatch(generate(source, tweenOptions), /current\(\)\.getTweensOf/);
}
assert.doesNotMatch(generate(querySource, {...tweenOptions, nativeTweenModule: undefined}), /current\(\)\.getTweensOf/);
assert.throws(() => generate(querySource.replace(/TweenMax/g, 'TweenLite'), tweenOptions), /AS3_TWEEN_UNSUPPORTED/);
console.log('Native imported tween query routing and guards passed');
