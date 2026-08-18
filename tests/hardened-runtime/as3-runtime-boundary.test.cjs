"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

function npmCli() {
    const candidates = [process.env.npm_execpath,
        path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js")].filter(Boolean);
    const found = candidates.find(candidate => fs.existsSync(candidate));
    assert.ok(found, "an exact local npm CLI is required for the packed-package boundary gate");
    return found;
}

function write(file, content) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf8");
}

function createLayaPackage(consumerRoot) {
    const root = path.join(consumerRoot, "node_modules/laya");
    write(path.join(root, "package.json"), JSON.stringify({ name: "laya", version: "0.0.0", type: "commonjs" }));
    const authority = JSON.parse(fs.readFileSync(path.join(ROOT, "config/runtime-type-predicates.json"), "utf8"));
    const byName = new Map(authority.types.map(row => [row.sourceQName, row]));
    for (const row of authority.types) {
        const relative = row.targetModule.slice("src/layaAir/".length, -3);
        const baseName = row.heritageClosure[0];
        const base = baseName === undefined ? "" : `const {${byName.get(baseName).constructorExport}}=require(${JSON.stringify(`laya/${byName.get(baseName).targetModule.slice("src/layaAir/".length, -3)}`)});`;
        const heritage = baseName === undefined ? "" : ` extends ${byName.get(baseName).constructorExport}`;
        const baseCall = baseName === undefined ? "" : "super(...args);";
        write(path.join(root, `${relative}.js`), `${base}const brand=new WeakSet();class ${row.constructorExport}${heritage}{constructor(...args){${baseCall}brand.add(this)}}function ${row.predicateExport}(value){return typeof value==='object'&&value!==null&&brand.has(value)}module.exports={${row.constructorExport},${row.predicateExport}};\n`);
    }
}

test("real CLI authority package installs, seals, bundles, and exposes no registrar", () => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "as3-runtime-package-"));
    try {
        const source = path.join(output, "source");
        const generated = path.join(output, "generated");
        write(path.join(source, "Demo.as"), "package game { public class Demo { public function Demo() {} public function probe(value:Demo):Boolean { var values:Vector.<Demo> = new Vector.<Demo>(); values.push(value); return value is Demo; } } }\n");
        const census = process.env.HARDENED_SOURCE_CAPABILITY_CENSUS;
        const capabilities = process.env.HARDENED_TARGET_CAPABILITIES;
        assert.ok(census && capabilities, "exact historical capability authorities are required");
        const result = childProcess.spawnSync(process.execPath, [path.join(ROOT, "bin/as3-frontend"), "transpile", source, generated,
            "--source-census", census, "--target-capabilities", capabilities],
        { cwd: output, encoding: "utf8", timeout: 30_000, windowsHide: true });
        assert.equal(result.status, 0, result.stderr);
        const manifest = JSON.parse(fs.readFileSync(path.join(generated, "manifest.json"), "utf8"));
        assert.equal(manifest.runtimeAuthorityQNames.length, 28);
        assert.ok(manifest.runtimeAuthorityQNames.includes("game.Demo"));
        const packageRoot = path.join(generated, "__as3_runtime");
        assert.ok(fs.existsSync(path.join(packageRoot, "AS3Authority.generated.js")));
        assert.equal(fs.existsSync(path.join(packageRoot, "internal/AS3TypeRegistry.js")),false);
        assert.equal(fs.existsSync(path.join(packageRoot, "internal/AS3TypeRegistry.ts")),false);
        assert.ok(fs.existsSync(path.join(packageRoot, "ApplicationEntry.generated.js")));
        const packed = JSON.parse(childProcess.execFileSync(process.execPath,
            [npmCli(), "pack", packageRoot, "--json", "--pack-destination", output],
        { cwd: output, encoding: "utf8" }));
        assert.equal(packed.length, 1);
        const packedFiles = packed[0].files.map(item => item.path.replace(/\\/g, "/"));
        assert.ok(packedFiles.includes("AS3Authority.generated.js"));
        assert.ok(packedFiles.includes("ApplicationEntry.generated.js"));
        assert.ok(packedFiles.includes("application/game/Demo.js"));
        assert.ok(packedFiles.includes("AS3Timer.js"));
        assert.equal(packedFiles.some(file => file.startsWith("internal/") || file === "AS3Type.js"
            || file === "AS3Vector.js" || file === "AS3MethodClosure.js"),false);
        assert.equal(packedFiles.some(file => file.endsWith(".ts")), false);
        const consumerRoot = path.join(output, "consumer");
        fs.mkdirSync(consumerRoot);
        write(path.join(consumerRoot, "package.json"), '{"private":true}');
        childProcess.execFileSync(process.execPath,
            [npmCli(), "install", path.join(output, packed[0].filename), "--ignore-scripts", "--no-audit", "--no-fund"],
        { cwd: consumerRoot, stdio: "inherit" });
        createLayaPackage(consumerRoot);
        const consumer = path.join(consumerRoot, "consumer.cjs");
        write(consumer, `const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const resolved=require.resolve('@bleach/as3-runtime/AS3Type');assert.equal(require.resolve('@bleach/as3-runtime/AS3Vector'),resolved);assert.equal(require.resolve('@bleach/as3-runtime/AS3MethodClosure'),resolved);for(const extension of ['js','ts']){const internal=path.join(path.dirname(resolved),'internal','AS3TypeRegistry.'+extension);assert.equal(fs.existsSync(internal),false);assert.throws(()=>require(internal),e=>e.code==='MODULE_NOT_FOUND');}const originalFreeze=Object.freeze;const originalAssign=Object.assign;const originalDefineProperty=Object.defineProperty;const originalCreate=Object.create;const priorInstallerDescriptor=Reflect.getOwnPropertyDescriptor(Object.prototype,'installAS3TypeAuthority');let capturedInstaller=false;function inspect(value){if(value&&typeof value==='object'){const descriptor=Reflect.getOwnPropertyDescriptor(value,'installAS3TypeAuthority');if(descriptor&&typeof descriptor.value==='function')capturedInstaller=true;}}originalDefineProperty(Object.prototype,'installAS3TypeAuthority',{configurable:true,set(value){if(typeof value==='function')capturedInstaller=true;}});Object.freeze=function(value){inspect(value);return Reflect.apply(originalFreeze,Object,[value]);};Object.assign=function(target,...sources){sources.forEach(inspect);return Reflect.apply(originalAssign,Object,[target,...sources]);};Object.defineProperty=function(target,key,descriptor){inspect(target);if(key==='installAS3TypeAuthority'&&typeof descriptor.value==='function')capturedInstaller=true;return Reflect.apply(originalDefineProperty,Object,[target,key,descriptor]);};Object.create=function(prototype,...rest){inspect(prototype);return Reflect.apply(originalCreate,Object,[prototype,...rest]);};const api=require('@bleach/as3-runtime/AS3Type');Object.freeze=originalFreeze;Object.assign=originalAssign;Object.defineProperty=originalDefineProperty;Object.create=originalCreate;if(priorInstallerDescriptor)originalDefineProperty(Object.prototype,'installAS3TypeAuthority',priorInstallerDescriptor);else delete Object.prototype.installAS3TypeAuthority;assert.equal(capturedInstaller,false);assert.equal(api.as3CanConstructAs,undefined);assert.equal(Object.isFrozen(api.AS3Vector),true);assert.equal(Object.isFrozen(api.AS3Vector.prototype),true);assert.throws(()=>Object.defineProperty(api.AS3Vector.prototype,'push',{value(){throw new Error('override')}}),TypeError);assert.throws(()=>Object.defineProperty(api.AS3Vector,'from',{value(){throw new Error('override')}}),TypeError);let hostileOverrideCalls=0;class EvilVector extends api.AS3Vector{push(){hostileOverrideCalls+=1;return 0}}assert.throws(()=>new EvilVector(api.AS3VectorPolicies.int),/final and cannot be subclassed/);assert.equal(hostileOverrideCalls,0);const entry=require('@bleach/as3-runtime/ApplicationEntry');const {Demo}=entry.AS3_APPLICATION_MODULES[0];const demo=new Demo();assert.equal(api.as3Is(demo,api.as3ClassType('game.Demo',Demo)),true);assert.equal(demo.probe(demo),true);const values=new api.AS3Vector(api.as3VectorReference('game.Demo',Demo));values.push(demo);assert.equal(values[0],demo);const demoPath=path.join(path.dirname(resolved),'application','game','Demo.js');const demoModule=require(demoPath);assert.deepEqual(Object.keys(demoModule).sort(),['Demo','as3ConstructionTarget','isAS3ClassInstance','isAS3ConstructionProof'].sort());assert.equal(demoModule.as3ConstructionTarget(demo),null);let traps=0;const hostile=new Proxy({}, {get(){traps+=1;throw new Error('trap')},getPrototypeOf(){traps+=1;throw new Error('trap')}});assert.equal(demoModule.as3ConstructionTarget(hostile),null);assert.equal(demoModule.isAS3ConstructionProof(hostile),false);assert.equal(traps,0);assert.throws(()=>api.as3PrepareConstruction(Demo,Demo,{}),/proof/);assert.throws(()=>api.as3InitializeInstanceFields({},Demo),/construction/);assert.equal(api.as3RegisterClass,undefined);assert.equal(api.installAS3TypeAuthority,undefined);assert.throws(()=>require('@bleach/as3-runtime/internal/AS3TypeRegistry'),e=>e.code==='ERR_PACKAGE_PATH_NOT_EXPORTED');assert.throws(()=>require('@bleach/as3-runtime/application/game/Demo'),e=>e.code==='ERR_PACKAGE_PATH_NOT_EXPORTED');require('@bleach/as3-runtime/AS3Authority');\n`);
        childProcess.execFileSync(process.execPath, [consumer], { cwd: consumerRoot, stdio: "inherit" });
        const timerConsumer = path.join(consumerRoot, "timer-consumer.cjs");
        write(timerConsumer, `"use strict";const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const runtime=require.resolve('@bleach/as3-runtime/AS3Type');const timerPath=require.resolve('@bleach/as3-runtime/AS3Timer');assert.notEqual(timerPath,runtime);assert.equal(timerPath,path.join(path.dirname(runtime),'AS3Timer.js'));for(const extension of ['js','ts'])assert.equal(fs.existsSync(path.join(path.dirname(runtime),'internal','AS3TimerRuntime.'+extension)),false);assert.throws(()=>require('@bleach/as3-runtime/internal/AS3TimerRuntime'),error=>error.code==='ERR_PACKAGE_PATH_NOT_EXPORTED');const timer=require('@bleach/as3-runtime/AS3Timer');const absolute=require(timerPath);assert.equal(absolute,timer);assert.deepEqual(Object.keys(timer),['clearTimeout','setTimeout']);assert.equal(Object.getPrototypeOf(timer),null);assert.equal(Object.isFrozen(timer),true);assert.equal(timer.AS3TimerRuntime,undefined);for(const key of Object.keys(timer)){const descriptor=Object.getOwnPropertyDescriptor(timer,key);assert.equal(typeof descriptor.value,'function');assert.equal(descriptor.writable,false);assert.equal(descriptor.configurable,false);assert.equal(Reflect.set(timer,key,()=>{throw new Error('intercepted')}),false);assert.throws(()=>Object.defineProperty(timer,key,{value(){throw new Error('intercepted')}}),TypeError);}const id=timer.setTimeout(()=>{throw new Error('cancel failed')},1000);assert.equal(Number.isInteger(id)&&id>0&&id<=0xffffffff,true);timer.clearTimeout(id);timer.clearTimeout(id);\n`);
        childProcess.execFileSync(process.execPath, [timerConsumer], { cwd: consumerRoot, stdio: "inherit" });
        const mutationConsumer = path.join(consumerRoot, "mutation-consumer.cjs");
        write(mutationConsumer, `"use strict";const assert=require('node:assert/strict');const api=require('@bleach/as3-runtime/AS3Type');const helpers=['as3RejectConstructorArity','as3InitializeInstanceFields','as3PrepareConstruction','as3CancelPreparedConstruction','as3EnterConstruction','as3AbortConstruction','as3CompleteConstruction'];assert.equal(Object.isFrozen(api),true);let calls=0;const hostile=()=>{calls+=1;throw new Error('hostile helper');};for(const name of helpers){const descriptor=Object.getOwnPropertyDescriptor(api,name);assert.equal(typeof descriptor.value,'function',name);assert.equal(descriptor.writable,false,name);assert.equal(descriptor.configurable,false,name);assert.equal(Reflect.set(api,name,hostile),false,name);assert.equal(Reflect.set(new Proxy(api,{}),name,hostile),false,name);assert.equal(Reflect.deleteProperty(api,name),false,name);assert.throws(()=>Object.defineProperty(api,name,{value:hostile}),TypeError,name);assert.equal(api[name],descriptor.value,name);}const entry=require('@bleach/as3-runtime/ApplicationEntry');const {Demo}=entry.AS3_APPLICATION_MODULES[0];const value=new Demo();assert.equal(value.probe(value),true);assert.equal(calls,0);\n`);
        childProcess.execFileSync(process.execPath, [mutationConsumer], { cwd: consumerRoot, stdio: "inherit" });
        const browserEntry = path.join(consumerRoot, "browser-entry.cjs");
        write(browserEntry, `const entry=require('@bleach/as3-runtime/ApplicationEntry');const api=require('@bleach/as3-runtime/AS3Type');const {Demo}=entry.AS3_APPLICATION_MODULES[0];const demo=new Demo();if(!api.as3Is(demo,api.as3ClassType('game.Demo',Demo))||!demo.probe(demo))throw new Error('authority did not seal');globalThis.__as3AuthorityBundled=true;\n`);
        const bundle = path.join(output, "application-bundle.cjs");
        const meta = path.join(output, "application-bundle-meta.json");
        childProcess.execFileSync(process.execPath,
            [path.join(ROOT, "node_modules/esbuild/bin/esbuild"), browserEntry, "--bundle", "--platform=browser", "--format=cjs",
                `--outfile=${bundle}`, `--metafile=${meta}`], { cwd: consumerRoot, stdio: "inherit" });
        const metadata = JSON.parse(fs.readFileSync(meta, "utf8"));
        const registryInputs = Object.keys(metadata.inputs).filter(input => input.replace(/\\/g, "/").endsWith("/internal/AS3TypeRegistry.js"));
        assert.equal(registryInputs.length, 0, "the packed runtime must not expose a standalone registry module");
        assert.equal(Object.keys(metadata.inputs).filter(input => input.replace(/\\/g, "/")
            .endsWith("/AS3Authority.generated.js")).length,1);
        const bundled = fs.readFileSync(bundle, "utf8");
        assert.match(bundled, /installAS3TypeAuthority/);
        assert.match(bundled, /AS3_TYPE_AUTHORITY_SHA256/);
        childProcess.execFileSync(process.execPath, [bundle], { cwd: consumerRoot, stdio: "inherit" });
        const packageManifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
        assert.equal(Object.keys(packageManifest.exports).some(key => key.includes("internal")), false);
    } finally {
        fs.rmSync(output, { recursive: true, force: true });
    }
});
