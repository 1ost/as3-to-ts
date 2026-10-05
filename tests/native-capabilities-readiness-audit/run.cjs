// Read-only readiness diagnostic. No provider or runtime qualification is granted.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const vm = require('node:vm');
const compiler = path.resolve(__dirname, '../..');
const engine = path.resolve(compiler, '../engine');
const replayDir = path.join(compiler, 'tests/native-generated-urlrequest-type-tests/original-replay');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const replayBytes = fs.readFileSync(path.join(replayDir, 'report.json.gz'));
const replay = JSON.parse(zlib.gunzipSync(replayBytes));
assert.equal(sha(replayBytes), require(path.join(replayDir, 'pin.json')).sha256);
const qname = 'flash.system.Capabilities';
const identity = replay.emission.identity;

function emitDiagnostic(addProvider) {
    const api = require(path.join(compiler, 'lib'));
    const parse = require(path.join(compiler, 'lib/parse'));
    const declarations = require(path.join(compiler, 'lib/emit/native-generated-declarations'));
    const baselineBytes = fs.readFileSync(replay.baseline.file);
    assert.equal(sha(baselineBytes), replay.baseline.sha256);
    const packet = JSON.parse(zlib.gunzipSync(baselineBytes));
    const baseline = JSON.parse(Buffer.from(packet.files.find(x => x.file === packet.reportFile).base64, 'base64'));
    assert.deepEqual(replay.input.sources, baseline.input.sources);
    assert.deepEqual(replay.input.classScriptSources, baseline.input.classScriptSources);
    const input = structuredClone(replay.input);
    const options = structuredClone(replay.options);
    assert.equal(input.providers[qname], undefined);
    if (addProvider) {
        // A deliberately unqualified mapping, confined to this subprocess.
        input.providers[qname] = {module: '../engine/src/layaAir/flash/system/Capabilities', exportName: 'Capabilities'};
        options.importModules[qname] = input.providers[qname].module;
    }
    let phase = 'plan';
    try {
        const plan = api.createNativeGeneratedDeclarationPlan(input);
        const imports = {...options.importModules};
        [...plan.bindings.map(b => b.qname), ...plan.privateBindings.map(b => b.identity)]
            .forEach((q, i) => imports[q] = './__native_class_' + i);
        declarations.nativeGeneratedInterfaceBindings(plan)
            .forEach((b, i) => imports[b.qname] = './__native_interface_' + i);
        const source = input.sources[identity].source;
        phase = 'emission';
        const output = api.Emitter.emit(parse(identity + '.as', source), source, {
            ...options, customVisitors: [], importModules: imports,
            nativeTweenSourcePlans: baseline.tweenSourcePlans[identity],
            nativeGeneratedDeclarations: {plan, module: './__native_declarations', declarationIdentity: identity},
            nativeReferenceCoercion: {...options.nativeReferenceCoercion, plan, module: './__native_declarations'},
            nativeVectorTypes: {...options.nativeVectorTypes, plan}
        });
        return {status: 'emitted', characters: output.length};
    } catch (error) {
        return {status: 'held', phase, message: error.message};
    }
}

if (process.argv.includes('--baseline') || process.argv.includes('--unqualified-provider')) {
    console.log(JSON.stringify(emitDiagnostic(process.argv.includes('--unqualified-provider'))));
    process.exit(0);
}

// Existing retention verification authenticates all compiler source/lib inputs,
// original sources and helper bytes; it performs no build or provider promotion.
cp.execFileSync(process.execPath, [path.join(replayDir, 'verify.cjs'), '--check-current'], {stdio: 'pipe'});
const engineCommit = '7d0e97587611013bea23e8a7bf36e377763f18a7';
assert.equal(cp.execFileSync('git', ['rev-parse', 'HEAD'], {cwd: engine, encoding: 'utf8'}).trim(), engineCommit);
assert.equal(cp.execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'src'], {cwd: engine, encoding: 'utf8'}).trim(), '');

const references = [];
const featureGateReferences = [];
for (const [owner, unit] of Object.entries(replay.input.sources)) {
    assert.equal(sha(unit.source), unit.sourceSha256);
    unit.source.split(/\r?\n/).forEach((text, index) => {
        // Textual inventory includes imports and bracket syntax, not just dot reads.
        if (/\bCapabilities\b/.test(text)) references.push({owner, line: index + 1, text: text.trim(), sourceSha256: unit.sourceSha256});
        if (/\bplayerEnables(?:Argo|Spicy)Features\b/.test(text))
            featureGateReferences.push({owner, line: index + 1, text: text.trim(), sourceSha256: unit.sourceSha256});
    });
}
const capabilitySource = fs.readFileSync(path.join(engine, 'src/layaAir/flash/system/Capabilities.ts'), 'utf8');
const ts = require(path.join(engine, 'node_modules/typescript'));
const js = ts.transpileModule(capabilitySource, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
const nativeHostDiagnostics = [];
for (const [host, navigator] of [
    ['no-navigator', undefined], ['windows', {platform: 'Win32', userAgent: 'Windows NT 10.0'}],
    ['mac', {platform: 'MacIntel', userAgent: 'Macintosh; Intel Mac OS X'}],
    ['android', {platform: 'Linux armv8l', userAgent: 'Android'}],
    ['ios', {platform: 'iPhone', userAgent: 'iPhone'}], ['linux', {platform: 'Linux', userAgent: 'Linux'}]
]) {
    const context = {exports: {}, navigator};
    vm.runInNewContext(js, context);
    const C = context.exports.Capabilities;
    const version = C.version.split(' ')[1].split(',');
    // Mirror only the numeric predicate on this native string; not AIR evidence.
    const atLeast = (major, minor) => (Number(version[0]) | 0) > major
        || (Number(version[0]) | 0) === major && (Number(version[1]) | 0) >= minor;
    nativeHostDiagnostics.push({host, os: C.os, isMac: C.os.search('Mac OS') > -1, version: C.version,
        atLeast10_1: atLeast(10, 1), atLeast10_2: atLeast(10, 2),
        hasAccessibilityPresent: 'hasAccessibility' in C, touchScreenTypePresent: 'touchScreenType' in C});
}
const diagnostics = {};
for (const [name, flag] of [['baseline', '--baseline'], ['unqualifiedProvider', '--unqualified-provider']])
    diagnostics[name] = JSON.parse(cp.execFileSync(process.execPath, [__filename, flag], {encoding: 'utf8'}));
assert.deepEqual(diagnostics.baseline, {status: 'held', phase: 'emission', message: replay.emission.message});
assert.deepEqual(diagnostics.unqualifiedProvider, {status: 'held', phase: 'emission',
    message: 'AS3_GENERATED_LEXICAL_UNSUPPORTED: static lexical primitive initializer requires qualification'});

const files = [
    [engine, 'src/layaAir/flash/system/Capabilities.ts'],
    [engine, 'src/layaAir/flash/accessibility/AccessibilityImplementation.ts'],
    [engine, 'src/layaAir/flash/accessibility/AccessibilityProperties.ts'],
    [engine, 'src/layaAir/flash/display/InteractiveObject.ts'],
    [compiler, 'src/emit/native-generated-lexical.ts'],
    [compiler, 'src/emit/native-class-initializers.ts'],
    [compiler, 'src/emit/emitter.ts']
].map(([root, file]) => ({repository: root === engine ? 'engine' : 'compiler', file, sha256: sha(fs.readFileSync(path.join(root, file)))}));
const report = {
    schema: 1, kind: 'readiness-diagnostic-only', providerPromotion: false,
    compilerImplementation: '89d3a1b6d3f85683900d330b2d0b82d85bf83d5b', engineCommit,
    replay: {file: 'tests/native-generated-urlrequest-type-tests/original-replay/report.json.gz', sha256: sha(replayBytes)},
    toolSha256: sha(fs.readFileSync(__filename)), files,
    sourceCount: Object.keys(replay.input.sources).length, classScriptCount: replay.input.classScriptSources.length,
    references, featureGateReferences, nativeHostDiagnostics, diagnostics,
    qualification: {AIR: 'not-run', browser: 'not-run', generatedTypeCheck: 'not-run', fullFactory: 'not-run', realH5: 'not-run'}
};
const target = path.join(__dirname, 'report.json');
if (process.argv.includes('--record')) fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
else assert.deepEqual(report, JSON.parse(fs.readFileSync(target, 'utf8')));
console.log(JSON.stringify({status: process.argv.includes('--record') ? 'recorded' : 'verified',
    sourceCount: report.sourceCount, classScriptCount: report.classScriptCount,
    capabilityReferences: references.length, diagnostics, providerPromotion: false}));
