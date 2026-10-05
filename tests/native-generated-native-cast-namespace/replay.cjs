// Original-source emission replay; temporary Capabilities mapping is not production authority.
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
const out=fs.mkdtempSync(path.join(compiler,'.cache/native-generated-native-cast-namespace/replay-'));

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
        const file=path.join(out,'InlineGraphicElement.ts');fs.writeFileSync(file,output);
        return {status:'emitted',characters:output.length,file,sha256:sha(output)};
    } catch (error) {
        return {status: 'held', phase, message: error.message};
    }
}

const baseline=emitDiagnostic(false),unqualifiedProvider=emitDiagnostic(true);
assert.equal(baseline.message,'AS3_CLASS_INITIALIZER_UNSUPPORTED: unresolved class-value identity: Capabilities');assert.equal(unqualifiedProvider.status,'emitted');
const sources=Object.entries(replay.input.sources).map(([identity,u])=>{assert.equal(sha(u.source),u.sourceSha256);return {identity,sha256:u.sourceSha256};});
assert.equal(sources.length,1356);assert.equal(replay.input.classScriptSources.length,95);
const inputs=[path.join(replayDir,'report.json.gz'),path.join(compiler,'src/emit/emitter.ts'),path.join(compiler,'lib/emit/emitter.js'),__filename].map(file=>({file,sha256:sha(fs.readFileSync(file))}));
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({identity,sourceCount:sources.length,classScriptCount:95,sources,inputs,baseline,unqualifiedProvider,productionProviderPromoted:false},null,2));
console.log(JSON.stringify({out,baseline,unqualifiedProvider}));
