const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const api = require('../../lib');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const source = text => ({source: text, sourceSha256: sha(text)});
const sources = {
  'cases.Root': source('package cases { public class Root {} }'),
  'cases.Retry': source('package cases { public class Retry extends Root {} }'),
  'cases.IPeer': source('package cases { public interface IPeer { function get value():Number; function set value(v:Number):void; function read():Number; } }')
};
const input = {
  scope: 'retry-interface-peers', sources,
  providerModule: './AS3GeneratedClass', interfaceProviderModule: './AS3Type',
  lexicalProviderModule: './AS3LexicalMembers', scriptGlobalProviderModule: './AS3ScriptGlobal',
  scriptDomainProvider: {module:'./domain', exportName:'scriptDomain'},
  inheritScriptClasses: true, classScriptSources: ['cases.Retry']
};
const message = /Class script retries with internal declarations in their package require qualification/;
function run(create = api.createNativeGeneratedDeclarationPlan) {
  const plan = create(input);
  assert.equal(plan.interfaces.length, 1);
  assert.equal(plan.bindings.length, 2);
  const checks = ['implicit-public-interface-getter-setter-method'];
  for (const visibility of ['', 'static ', 'internal ']) {
    for (const member of ['var value:Number;', 'const value:Number=1;', 'function read():Number {return 1;}',
      'function get value():Number {return 1;}', 'function set value(v:Number):void {}']) {
      const peer = source('package cases { public class Peer { ' + visibility + member + ' } }');
      assert.throws(() => create({...input, sources:{...sources, 'cases.Peer':peer}}),
        visibility ? message : /Class member modifier \(public, private, internal\) is required|Class script retries with internal declarations in their package require qualification/);
      checks.push((visibility || 'default ') + member);
    }
  }
  // An interface must not erase the guard on the selected class or its source base.
  for (const q of ['cases.Root', 'cases.Retry']) {
    const changed = source(sources[q].source.replace('{}', '{internal var secret:Number;}'));
    assert.throws(() => create({...input, sources:{...sources, [q]:changed}}), message);
    checks.push('internal-on-' + q);
  }
  assert.throws(() => create({...input, classScriptSources:['cases.IPeer']}), /AS3_GENERATED_DECLARATIONS_UNSUPPORTED/);
  checks.push('interface-cannot-be-class-script');
  // Interface contract validation remains in force independently of peer filtering.
  const broken = source('package cases { public class Retry extends Root implements IPeer {} }');
  assert.throws(() => create({...input, sources:{...sources, 'cases.Retry':broken}}), /AS3_GENERATED_INTERFACE_CONTRACT_UNSUPPORTED: missing public instance interface member/);
  checks.push('missing-interface-implementation');
  const implemented = source('package cases { public class Retry extends Root implements IPeer { public function get value():Number {return 1;} public function set value(v:Number):void {} public function read():Number {return 1;} } }');
  assert.doesNotThrow(() => create({...input, sources:{...sources, 'cases.Retry':implemented}}));
  checks.push('public-interface-implementation');
  return checks;
}
module.exports = {run, input};
if (require.main === module) {
  const checks = run();
  // Compile the old guard in an isolated CommonJS module without changing disk inputs.
  const file = require.resolve('../../lib/emit/native-generated-declarations');
  const original = fs.readFileSync(file, 'utf8');
  const needle = /if \(cls.kind === nodeKind_1.default.INTERFACE\)\s+return;/;
  const at = original.indexOf('// Interface signatures are implicitly public');
  assert.ok(at >= 0);
  const tail = original.slice(at);
  assert.ok(needle.test(tail));
  const mutated = original.slice(0, at) + tail.replace(needle, 'if (false) return;');
  assert.notEqual(mutated, original);
  const Module = require('node:module'), isolated = new Module(file, module);
  isolated.filename = file; isolated.paths = Module._nodeModulePaths(path.dirname(file));
  isolated._compile(mutated, file);
  assert.throws(() => run(isolated.exports.createNativeGeneratedDeclarationPlan), message);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  const report = {status:'passed', checks, mutation:'restored-interface-misclassification-rejected',
    compilerSha256:sha(original), runnerSha256:sha(fs.readFileSync(__filename)), input};
  if (process.argv.includes('--retain')) fs.writeFileSync(path.join(__dirname,'plan-report.json'), JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
