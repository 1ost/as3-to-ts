'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const ts = require('typescript-4-9');
const ROOT = path.resolve(__dirname, '../..');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file).exports;
  const module = {exports: {}};
  modules.set(file, module);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS}, reportDiagnostics: true
  });
  assert.equal(compiled.diagnostics.length, 0);
  Function('require', 'module', 'exports', '__dirname', compiled.outputText)(name => name.startsWith('.')
    ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name), module, module.exports,
    path.basename(file) === 'reflection-provider-authority.ts' ? path.join(ROOT, 'lib') : path.dirname(file));
  return module.exports;
}
const api = load(path.join(ROOT, 'src/hardened/native-describe-type-authority.ts'));
const sources = load(path.join(ROOT, 'src/hardened/source-member-authority.ts'));
const providers = load(path.join(ROOT, 'src/hardened/reflection-provider-authority.ts'));
const SDK = 'e0f81fdb2029d2bb16e6987c8d85d4eba5eedfa3a23ed6e7f780bf6eb67b0546';
const DECLARATION = '9166be1cec8a61485506033aa85d40f838b74ba8487cde153fe25e98295a0b16';
function minimalLoadedSource() {
  const json = canonical({schema: 'as3-source-member-authority@1', generator: 'air-sdk-swfdump-abc@1',
    sourceArtifactSha256: SDK, entryCount: 1,
    entries: [{qname: 'Object', baseQName: null, ownInstanceMemberNames: []}]}) + '\n';
  return sources.loadSourceMemberAuthority(json, sha(json), sha);
}
test('describeType is disabled without native proof and rejects forged source/provider objects', () => {
  const source = minimalLoadedSource();
  assert.equal(api.hasNativeDescribeTypeAuthority(undefined), false);
  assert.equal(api.hasNativeDescribeTypeAuthority(source), false);
  assert.equal(api.hasNativeDescribeTypeAuthority({...source}), false);
  assert.throws(() => api.verifyNativeDescribeTypeAuthority({...source}, '/unread', '{}', '{}', {}, '{}'));
  assert.throws(() => api.verifyNativeDescribeTypeAuthority(source, '/unread', '{}', '{}', {}, '{}'), /verified target/);
  assert.equal(api.hasNativeDescribeTypeAuthority(source), false);
});

// Opt-in actual provider/SDK test. Never replaces the verifier's private brands with mocks.
const configured = process.env.HARDENED_FIXTURE_LAYA && process.env.HARDENED_FIXTURE_AIR_SDK
  && process.env.HARDENED_DESCRIBE_TYPE_PROFILE;
test('native describeType producer and verifier bind actual SDK *, shared provider and all input pins',
  {skip: !configured}, t => {
  const laya = fs.realpathSync(process.env.HARDENED_FIXTURE_LAYA);
  const sdk = fs.realpathSync(process.env.HARDENED_FIXTURE_AIR_SDK);
  const retained = fs.realpathSync(process.env.HARDENED_DESCRIBE_TYPE_PROFILE);
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'native-describe-type-')));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const declaration = path.join(retained, 'sdk-source/scripts/flash/utils/describeType.as');
  const signatures = path.join(retained, 'sdk-signatures.json');
  assert.equal(sha(fs.readFileSync(declaration)), DECLARATION);
  assert.match(fs.readFileSync(declaration, 'utf8'), /public function describeType\(value:\*\) : XML/);
  const sourceFile = path.join(retained, 'source-members.json');
  const sourceJson = fs.readFileSync(sourceFile, 'utf8');
  const freshSource = () => sources.loadSourceMemberAuthority(sourceJson, sha(sourceJson), sha);
  const targetPath = path.join(laya, 'docTool/architecture/authored-content-capabilities.json');
  const targetJson = fs.readFileSync(targetPath, 'utf8');
  const capability = JSON.parse(targetJson).capabilities.find(row => row.id === 'api.flash.utils');
  const rows = ['createFlashReflectionMetadata', 'describeTypeXml'].map(name => capability.obligations.find(row => row.export === name));
  assert.ok(rows.every(Boolean));
  const targetSources = {};
  for (const row of rows) {
    const result = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools/resolve-laya-export.cjs')], {
      input: JSON.stringify({root: laya, facade: {module: row.module, export: row.export, sha256: row.sha256}, candidates: [row]}),
      encoding: 'utf8', timeout: 30000
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const [file, hash] of Object.entries(JSON.parse(result.stdout).inputs))
      targetSources[path.relative(laya, file).split(path.sep).join('/')] = hash;
  }
  const providerProof = {schema: 'as3-reflection-provider-target@1', targetCapabilitiesSha256: sha(targetJson),
    targetCapabilityId: 'api.flash.utils', targets: rows.map(({module, export: name, signature, sha256}) =>
      ({module, export: name, signature, sha256})), targetSources};
  const provider = providers.loadReflectionProviderTarget(canonical(providerProof) + '\n', targetPath, targetJson);
  const script = `import importlib.util,json,sys\nfrom pathlib import Path\ns=importlib.util.spec_from_file_location('producer',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nbefore=list(Path(sys.argv[2]).iterdir());inputs=m.inspect_native_describe_type_inputs(Path(sys.argv[3]));assert list(Path(sys.argv[2]).iterdir())==before\nr=m.produce_native_describe_type_profile(profile_root=Path(sys.argv[2]),air_sdk=Path(sys.argv[3]),sdk_declaration=Path(sys.argv[4]),sdk_signatures=Path(sys.argv[5]));assert r["generatorInputs"]==inputs;print(json.dumps(r))`;
  function produce(out, source = declaration, input = signatures) {
    fs.mkdirSync(out);
    return cp.spawnSync(process.env.PYTHON || 'python3', ['-B', '-c', script,
      path.join(ROOT, 'tools/native_describe_type_profile.py'), out, sdk, source, input], {encoding: 'utf8', timeout: 15000});
  }
  const output = path.join(dir, 'valid');
  const generated = produce(output);
  assert.equal(generated.status, 0, generated.stdout + generated.stderr);
  const receipt = JSON.parse(generated.stdout);
  const proofPath = path.join(output, receipt.file.path);
  const proofJson = fs.readFileSync(proofPath, 'utf8');
  assert.equal(sha(proofJson), receipt.file.sha256);
  const proof = JSON.parse(proofJson), manifest = receipt.manifestPins;
  const verify = (s, p = proof, m = manifest, v = provider, target = targetJson) =>
    api.verifyNativeDescribeTypeAuthority(s, output, canonical(p) + '\n', canonical(m) + '\n', v, target);
  const loaded = freshSource();
  verify(loaded);
  assert.equal(api.hasNativeDescribeTypeAuthority(loaded), true);
  assert.equal(api.hasNativeDescribeTypeAuthority({...loaded}), false);
  const rejects = (p, m = manifest, v = provider, target = targetJson) => {
    const s = freshSource(); assert.throws(() => verify(s, p, m, v, target));
    assert.equal(api.hasNativeDescribeTypeAuthority(s), false);
  };
  rejects(proof, manifest, {...provider});
  rejects(proof, manifest, provider, targetJson + ' ');
  rejects({...proof, sourceArtifactSha256: '0'.repeat(64)});
  rejects({...proof, declarationSha256: '0'.repeat(64)});
  rejects({...proof, declarationPath: '../escape.as'});
  rejects({...proof, signaturesPath: '/absolute/signatures.json'});
  rejects({...proof, declarationPath: 'missing.as'});
  for (const key of Object.keys(manifest)) rejects(proof, {...manifest, [key]: '0'.repeat(64)});
  const missingPin = {...manifest}; delete missingPin.nativeDescribeTypeDeclarationSha256; rejects(proof, missingPin);
  const linked = path.join(output, 'linked.as'); fs.symlinkSync(declaration, linked);
  rejects({...proof, declarationPath: 'linked.as'});
  const copiedDeclaration = path.join(output, proof.declarationPath);
  fs.appendFileSync(copiedDeclaration, '\n'); rejects(proof);
  fs.copyFileSync(declaration, copiedDeclaration);
  const badSignatures = path.join(output, 'missing-input.json');
  const input = JSON.parse(fs.readFileSync(signatures, 'utf8'));
  for (const key of Object.keys(input.inputs)) if (key.endsWith('/sdk-source/scripts/flash/utils/describeType.as')) delete input.inputs[key];
  fs.writeFileSync(badSignatures, JSON.stringify(input));
  const badHash = sha(fs.readFileSync(badSignatures));
  rejects({...proof, signaturesPath: 'missing-input.json', signaturesSha256: badHash}, {...manifest, nativeSignaturesSha256: badHash});
  const missing = produce(path.join(dir, 'producer-missing'), declaration, badSignatures);
  assert.notEqual(missing.status, 0); assert.match(missing.stderr, /not bound to SDK extraction/);
  const changed = path.join(dir, 'changed.as');
  fs.writeFileSync(changed, fs.readFileSync(declaration, 'utf8').replace('value:*', 'value:Class'));
  const badSource = produce(path.join(dir, 'producer-changed'), changed);
  assert.notEqual(badSource.status, 0); assert.match(badSource.stderr, /requires native requalification/);
});
