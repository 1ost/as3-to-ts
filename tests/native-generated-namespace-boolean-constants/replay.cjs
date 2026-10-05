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
const identity = 'flashx.textLayout.elements.Configuration';
const out=fs.mkdtempSync(path.join(compiler,'.cache/native-generated-namespace-boolean-constants/configuration-'));
const adapterFile=path.resolve(process.env.OP2_TLF_ADAPTER || 'C:/Users/admin/Desktop/GITHUB REPO/op2-html5/as3-to-layaair-porting-kit/tools/adapt_native_tlf_features.mjs');
let adaptNativeTLFFeatures, derivation;

function emitDiagnostic(addProvider, adapt=false) {
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
    input.classScriptSources.push(identity);
    if(adapt){const result=adaptNativeTLFFeatures(identity,input.sources[identity]);input.sources[identity]=result.unit;derivation=result.derivation;}
    const options = structuredClone(replay.options);
    assert.equal(input.providers[qname], undefined);
    if (addProvider) {
        // A deliberately unqualified mapping, confined to this subprocess.
        input.providers[qname] = {module: '../engine/src/layaAir/flash/utils/AS3CanonicalCapabilitiesReference', exportName: 'Capabilities'};
        options.importModules[qname] = input.providers[qname].module;
        options.nativeCapabilitiesReferenceModule = input.providers[qname].module;
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
        const file=path.join(out,adapt?'Configuration-native.ts':'Configuration.ts');fs.writeFileSync(file,output);
        return {status:'emitted',characters:output.length,file,sha256:sha(output)};
    } catch (error) {
        return {status: 'held', phase, message: error.message};
    }
}

async function main(){
({adaptNativeTLFFeatures}=await import(require('node:url').pathToFileURL(adapterFile).href));
const baseline=emitDiagnostic(false),unqualifiedProvider=emitDiagnostic(true),adaptedProvider=emitDiagnostic(true,true);

const sources=Object.entries(replay.input.sources).map(([identity,u])=>{assert.equal(sha(u.source),u.sourceSha256);return {identity,sha256:u.sourceSha256};});
assert.equal(sources.length,1356);assert.equal(replay.input.classScriptSources.length,95);
const inputs=[path.join(replayDir,'report.json.gz'),path.join(compiler,'src/emit/emitter.ts'),path.join(compiler,'lib/emit/emitter.js'),replay.baseline.file,path.join(replayDir,'pin.json'),adapterFile,__filename].map(file=>({file,sha256:sha(fs.readFileSync(file))}));
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({identity,sourceCount:sources.length,baselineClassScriptCount:95,classScriptCount:96,sources,inputs,baseline,unqualifiedProvider,adaptedProvider,derivation,productionProviderPromoted:false},null,2));
console.log(JSON.stringify({out,baseline,unqualifiedProvider,adaptedProvider}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
