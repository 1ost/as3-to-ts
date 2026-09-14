// Read-only integration evidence. All application AS3 and provider code is
// loaded intact from caller-selected checkouts; no source substitutions/stubs.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');

const [op2Argument, engineArgument] = process.argv.slice(2);
assert.ok(op2Argument && engineArgument, 'usage: node RecoveredTlfIntegration.js <OP2 checkout> <LayaAir checkout>');
const op2 = path.resolve(op2Argument);
const engine = path.resolve(engineArgument);
const ts = require(path.join(engine, 'node_modules/typescript'));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const kit = path.join(op2, 'as3-to-layaair-porting-kit');
const reconciliation = readJson(path.join(kit, '.local/recovery/namespace-reconciliation/report.json'));
const record = reconciliation.files.find(file => file.qname === 'flashx.textLayout.conversion.ImportExportConfiguration');
assert.ok(record);
const sourceFile = path.resolve(op2, record.source);
assert.strictEqual(hash(sourceFile), record.source_sha256);
const moduleRecord = readJson(path.join(kit, '.local/recovery/modules/cn/kyiax/game/modules/main/MainModule/latest.json'));
assert.strictEqual(moduleRecord.identity.binary_sha256, reconciliation.module_sha256);
assert.ok(record.raw.includes('/' + moduleRecord.attempt + '/source/'), 'recovery authority changed');
const infoFile = path.join(path.dirname(path.resolve(op2, record.raw)), 'FlowElementInfo.as');
const infoRecord = moduleRecord.sources.files.find(file => file.path === 'scripts/flashx/textLayout/conversion/FlowElementInfo.as');
assert.ok(infoRecord);
assert.strictEqual(hash(infoFile), infoRecord.sha256);
const namespaceFile = path.resolve(op2, reconciliation.namespace_declaration);
assert.strictEqual(hash(namespaceFile), reconciliation.namespace_declaration_sha256);
const uri = reconciliation.namespace_uri;
assert.strictEqual(uri, 'http://ns.adobe.com/textLayout/internal/2008');

const modules = new Map();
const context = vm.createContext({});
const mappedFiles = {
  bound: path.resolve(__dirname, '../../utils/bound.ts'),
  classBound: path.resolve(__dirname, '../../utils/classBound.ts'),
  getQualifiedClassName: path.join(engine, 'src/layaAir/flash/utils/getQualifiedClassName.ts'),
  FlowElementInfo: infoFile,
  tlf_internal: namespaceFile
};
const generatedSources = new Map();
function load(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file);
  const original = fs.readFileSync(file, 'utf8');
  const source = file.endsWith('.as') ? emit(parse(path.basename(file), original), original, {
    lineSeparator: '\n', definitionsByNamespace: {}, customVisitors: [],
    namespaceUris: { 'flashx.textLayout.tlf_internal': uri }
  }) : original;
  if (file.endsWith('.as')) {
    assert.doesNotMatch(source, /\bsuper\s*\(/, file);
    generatedSources.set(file, source);
  }
  const result = ts.transpileModule(source, { fileName: file + '.ts', compilerOptions: {
    target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
    useDefineForClassFields: false
  }, reportDiagnostics: true });
  assert.deepStrictEqual(result.diagnostics, [], file);
  const exports = {};
  modules.set(file, exports);
  const resolveModule = request => {
    const name = request.endsWith('classBound') ? 'classBound'
      : request.endsWith('bound') ? 'bound' : request.split('/').pop();
    if (mappedFiles[name]) return load(mappedFiles[name]);
    // Engine internals retain their real relative module resolution.
    if (file.startsWith(engine + path.sep) && request.startsWith('.')) {
      return load(path.resolve(path.dirname(file), request + '.ts'));
    }
    throw new Error('Unmapped real dependency: ' + request);
  };
  vm.runInContext('(function(exports, require) {\n' + result.outputText + '\n})', context,
    { filename: file + '.generated.js' })(exports, resolveModule);
  return exports;
}

const { ImportExportConfiguration } = load(sourceFile);
const { FlowElementInfo } = load(infoFile);
const config = new ImportExportConfiguration();
const parser = input => ({ parsed: input });
const exporter = input => ({ exported: input });
config.addIEInfo('array', Array, parser, exporter);
const info = config.lookup('array');
assert.ok(info instanceof FlowElementInfo);
assert.strictEqual(info.flowClass, Array);
assert.strictEqual(info.flowClassName, 'Array');
assert.strictEqual(info.parser, parser);
assert.strictEqual(info.exporter, exporter);
assert.strictEqual(config.lookupByClass('Array'), info);
assert.strictEqual(config.lookupName('Array'), 'array');
assert.strictEqual(config.lookup('missing'), undefined);
assert.strictEqual(new ImportExportConfiguration().lookup('array'), undefined);
assert.strictEqual(config.flowElementInfoList, undefined);
assert.strictEqual(Object.getOwnPropertySymbols(config).length, 3);
const detachedLookup = config.lookup;
assert.strictEqual(detachedLookup.call(null, 'array'), info);
config.addIEInfo(null, String, parser, exporter);
assert.strictEqual(config.lookupByClass('String').flowClass, String);
assert.strictEqual(config.lookupName('String'), undefined);

// Integrity after execution: neither source nor recovery evidence was patched.
assert.strictEqual(hash(sourceFile), record.source_sha256);
assert.strictEqual(hash(infoFile), infoRecord.sha256);
const output = generatedSources.get(sourceFile);
console.log(JSON.stringify({ status: 'passed', scope: 'isolated compiler/provider execution, not game admission',
  target: 'ES2015 native classes', configurationSourceSha256: record.source_sha256,
  flowElementInfoSourceSha256: infoRecord.sha256,
  namespaceSourceSha256: reconciliation.namespace_declaration_sha256,
  namespaceMemberKeys: (output.match(/const __as3_namespace_member_/g) || []).length,
  result: 'complete recovered constructors, three namespace fields, six selectors, real FlowElementInfo and Laya reflection passed'
}, null, 2));
