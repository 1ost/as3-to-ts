"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repository = path.resolve(__dirname, "../..");
const executable = path.join(repository, "bin", "as3-frontend");
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

function canonical(value) {
    if (value === null || typeof value === "boolean" || typeof value === "string" || typeof value === "number") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

function authenticateSecondaryPackage(runtimeRoot, receipt) {
    const packageBytes = fs.readFileSync(path.join(runtimeRoot, receipt.packageMetadata.path));
    assert.equal(packageBytes.length, receipt.packageMetadata.bytes, "package metadata byte drift");
    assert.equal(sha256(packageBytes), receipt.packageMetadata.sha256, "package metadata hash drift");
    const actual = [];
    const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(absolute);
        else if (entry.isFile() && entry.name.endsWith(".js")) {
            const bytes = fs.readFileSync(absolute);
            actual.push({ path: path.relative(runtimeRoot, absolute).split(path.sep).join("/"),
                bytes: bytes.length, sha256: sha256(bytes) });
        }
    });
    walk(runtimeRoot);
    actual.sort((left, right) => Buffer.compare(Buffer.from(left.path,"utf8"),Buffer.from(right.path,"utf8")));
    assert.deepEqual(actual, receipt.executableClosure, "executable closure missing, extra, or drifted");
    assert.equal(sha256(Buffer.from(`${canonical(receipt.executableClosure)}\n`)), receipt.executableClosureSha256,
        "executable closure receipt hash drift");
    assert.deepEqual(receipt.executableClosure.find(item => item.path === receipt.runtimeAuthority.path),
        receipt.runtimeAuthority, "runtime authority is outside executable closure");
    for (const exported of receipt.exports) {
        const relative = exported.javascriptPath.replace(/^__as3_runtime\//, "");
        assert.deepEqual(receipt.executableClosure.find(item => item.path === relative),
            { path: relative, bytes: exported.javascriptBytes, sha256: exported.javascriptSha256 },
            "export module is outside executable closure");
    }
}

function fixture(t) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "as3-source-closure-")));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const application = path.join(root, "achievement"), bootstrap = path.join(root, "main");
    fs.mkdirSync(application); fs.mkdirSync(bootstrap);
    const applicationBytes = Buffer.from("package { import achievement.ui.AchievementPresentationPart; public class AchievementModule { private var value:AchievementPresentationPart; public function AchievementModule() {} } }\n");
    const bootstrapBytes = Buffer.from("package achievement.ui { public class AchievementPresentationPart { public function AchievementPresentationPart() {} } }\n");
    fs.writeFileSync(path.join(application, "A.as"), applicationBytes);
    fs.writeFileSync(path.join(bootstrap, "B.as"), bootstrapBytes);
    const document = {
        schema: "as3-authenticated-source-closure@1",
        profileSha256: "a".repeat(64),
        roots: [
            { module: "application", path: "achievement", sourcePrefix: "game-client/game_modules/recovered/achievement_module/src/",
                files: [{ path: "A.as", bytes: applicationBytes.length, sha256: sha256(applicationBytes),
                    qnames: ["AchievementModule"], localDependencies: ["achievement.ui.AchievementPresentationPart"] }] },
            { module: "bootstrap", path: "main", sourcePrefix: "game-client/main_swf/src/",
                files: [{ path: "B.as", bytes: bootstrapBytes.length, sha256: sha256(bootstrapBytes),
                    qnames: ["achievement.ui.AchievementPresentationPart"], localDependencies: [] }] },
        ],
    };
    return { root, application, bootstrap, document };
}

function includeFixture(t) {
    const state=fixture(t);
    const applicationBytes=Buffer.from("package { import achievement.ui.AchievementPresentationPart; public class AchievementModule { include \"member.as\"; public function AchievementModule() {} } }\n");
    const fragmentBytes=Buffer.from("private var value:AchievementPresentationPart;\n");
    fs.writeFileSync(path.join(state.application,"A.as"),applicationBytes);
    fs.writeFileSync(path.join(state.application,"member.as"),fragmentBytes);
    const directive="include \"member.as\"",start=applicationBytes.toString("utf8").indexOf(directive);
    state.document.schema="as3-authenticated-source-closure@2";
    state.document.roots[0].files[0].bytes=applicationBytes.length;
    state.document.roots[0].files[0].sha256=sha256(applicationBytes);
    state.document.roots[0].includes={fragments:[{path:"member.as",bytes:fragmentBytes.length,sha256:sha256(fragmentBytes)}],
        edges:[{directiveEnd:start+directive.length,directiveStart:start,ownerPath:"A.as",specifier:"member.as",
            targetPath:"member.as",targetSha256:sha256(fragmentBytes)}]};
    state.document.roots[1].includes={edges:[],fragments:[]};
    return state;
}

function writeCanonical(file, value) {
    const bytes = Buffer.from(`${canonical(value)}\n`);
    fs.writeFileSync(file, bytes);
    return { path: path.basename(file), sha256: sha256(bytes) };
}

function syntheticProfile(state, applicationStart = null) {
    const profileRoot = path.join(state.root, "profile");
    fs.mkdirSync(profileRoot);
    const sourceCensus = { as3SourceCapabilities: { apis: [], memberUses: [] } };
    const targetCapabilities = { capabilities: [], schema: "laya-authored-content-capabilities@1" };
    const censusRef = writeCanonical(path.join(profileRoot, "census.json"), sourceCensus);
    const targetRef = writeCanonical(path.join(profileRoot, "target.json"), targetCapabilities);
    const mappingRef = writeCanonical(path.join(profileRoot, "mapping.json"), {
        mappings: [], schema: "as3-source-to-laya-capability-map@1",
    });
    const rawGraphRef = writeCanonical(path.join(profileRoot, "graph.json"), {
        edges: [{ from: "AchievementModule", to: "achievement.ui.AchievementPresentationPart" }], schema: "synthetic-dependency-graph@1",
    });
    const semanticGraphRef = writeCanonical(path.join(profileRoot, "semantic-graph.json"), {
        edges: [{ from: "AchievementModule", to: "achievement.ui.AchievementPresentationPart" }], schema: "synthetic-semantic-graph@1",
    });
    const sourceManifestRef = writeCanonical(path.join(profileRoot, "sources.json"), {
        files: ["app/A.as", "boot/B.as"], schema: "synthetic-source-manifest@1",
    });
    const appHash = state.document.roots[0].files[0].sha256;
    const bootstrapHash = state.document.roots[1].files[0].sha256;
    const aNode = "1111111111111111", bNode = "2222222222222222";
    const localTypes = {
        schema: "as3-application-local-type-map@1",
        dependencyGraphRawSha256: rawGraphRef.sha256,
        dependencyGraphSemanticSha256: semanticGraphRef.sha256,
        sourceManifestSha256: sourceManifestRef.sha256,
        sourceRoots: { application: "app/", bootstrap: "boot/" },
        targetRoots: { application: "generated/application/", bootstrap: "generated/bootstrap/" },
        entryCount: 2,
        entries: [
            { componentId: "scc-00001", graphSourceSha256: sha256("AchievementModule->achievement.ui.AchievementPresentationPart"), importable: true,
                module: "application", nodeId: aNode, prerequisites: [bNode], qname: "AchievementModule",
                sourceContentSha256: appHash, sourcePath: "app/A.as", targetPath: "generated/application/AchievementModule.ts",
                topologicalLevel: 1, typeKind: "class" },
            { componentId: "scc-00000", graphSourceSha256: sha256("achievement.ui.AchievementPresentationPart"), importable: true,
                module: "bootstrap", nodeId: bNode, prerequisites: [], qname: "achievement.ui.AchievementPresentationPart",
                sourceContentSha256: bootstrapHash, sourcePath: "boot/B.as", targetPath: "generated/bootstrap/achievement/ui/AchievementPresentationPart.ts",
                topologicalLevel: 0, typeKind: "class" },
        ],
    };
    const localTypesRef = writeCanonical(path.join(profileRoot, "local-types.json"), localTypes);
    let sourceIncludesRef;
    if(state.document.schema==="as3-authenticated-source-closure@2"
        && state.document.roots.some(root=>root.includes.fragments.length)) {
        const inspected=spawnSync(process.execPath,[path.join(repository,"lib/source-includes.js"),"--inventory-request"],{
            cwd:repository,input:JSON.stringify({sourceRoot:state.application,roots:["A.as"]}),encoding:"utf8",timeout:30_000,
        });
        assert.equal(inspected.status,0,inspected.stderr);
        const inventory=JSON.parse(inspected.stdout);
        assert.deepEqual(state.document.roots[0].includes.edges,inventory.edges);
        assert.deepEqual(state.document.roots[0].includes.fragments,inventory.fragments);
        sourceIncludesRef=writeCanonical(path.join(profileRoot,"source-includes.json"),inventory);
    }
    const parameterlessConstructor = name => ({ fieldType: null, kind: "constructor", modifiers: ["public"],
        name, namespaceName: null, parameters: [], readonly: false, returnType: null });
    const localMembers = {
        completeCount: 2, declarationWorkerSha256: "d".repeat(64), entryCount: 2, heldCount: 0,
        localTypeMapSha256: localTypesRef.sha256, schema: "as3-application-local-member-map@1",
        sourceCensusSha256: censusRef.sha256,
        ...(sourceIncludesRef?{sourceIncludesSha256:sourceIncludesRef.sha256}:{}),
        entries: [
            { declaration: { baseQNames: [], interfaceQNames: [], members: [
                { fieldType: "achievement.ui.AchievementPresentationPart", kind: "field", modifiers: ["private"], name: "value",
                    namespaceName: null, parameters: [], readonly: false, returnType: null },
                parameterlessConstructor("AchievementModule")], packageInitializer: null }, holdCode: null, holdSha256: null,
                module: "application", nodeId: aNode, qname: "AchievementModule", sourceContentSha256: appHash,
                status: "complete", typeKind: "class" },
            { declaration: { baseQNames: [], interfaceQNames: [], members: [parameterlessConstructor("AchievementPresentationPart")],
                packageInitializer: null }, holdCode: null, holdSha256: null, module: "bootstrap", nodeId: bNode,
                qname: "achievement.ui.AchievementPresentationPart", sourceContentSha256: bootstrapHash, status: "complete", typeKind: "class" },
        ],
    };
    const localMembersRef = writeCanonical(path.join(profileRoot, "local-members.json"), localMembers);
    const predicates = { hashMode: "canonical-lf-utf8", schema: "laya-flash-runtime-type-predicates@1", types: [] };
    const predicatesRef = writeCanonical(path.join(profileRoot, "predicates.json"), predicates);
    const runtimeLockRef = writeCanonical(path.join(profileRoot, "runtime-lock.json"), {
        layaRevision: "e".repeat(40), predicateAuthorityCanonicalLfSha256: predicatesRef.sha256,
        predicateAuthorityEntryCount: 0, predicateAuthorityQNames: [], schema: "as3-application-runtime-type-authority-lock@1",
    });
    const timerRef = writeCanonical(path.join(profileRoot, "timer.json"), {
        exports: [], module: "@test/as3-runtime/AS3Timer", schema: "as3-native-timer-authority@1",
        sourcePath: "src/hardened-runtime/AS3Timer.ts",
        sourceSha256: sha256(fs.readFileSync(path.join(repository, "src/hardened-runtime/AS3Timer.ts"))),
    });
    const sourceMembersRef = writeCanonical(path.join(profileRoot, "source-members.json"), {
        entries: [{ baseQName: null, ownInstanceMemberNames: [], qname: "Object" }], entryCount: 1,
        generator: "air-sdk-swfdump-abc@1", schema: "as3-source-member-authority@1",
        sourceArtifactSha256: sha256("synthetic source-member fixture"),
    });
    const files = { capabilityMapping: mappingRef, dependencyGraphRaw: rawGraphRef,
        dependencyGraphSemantic: semanticGraphRef, localMemberMap: localMembersRef, localTypeMap: localTypesRef,
        nativeTimerAuthority: timerRef, runtimeTypeAuthorityLock: runtimeLockRef,
        runtimeTypePredicates: predicatesRef, sourceManifest: sourceManifestRef, sourceMemberAuthority: sourceMembersRef,
        ...(sourceIncludesRef?{sourceIncludes:sourceIncludesRef}:{}) };
    const profile = {
        applicationId: "source-closure-test", counts: { localMembersComplete: 2, localMembersHeld: 0,
            localTypes: 2, mappedMembers: 0, mappedTypes: 0, sourceMemberTypes: 1 }, files,
        runtimePackage: "@test/as3-runtime", runtimePredicateQNames: [],
        schema: applicationStart===null?"as3-application-profile-lock@1":"as3-application-profile-lock@2",
        ...(applicationStart===null?{}:{applicationStart}),
        sourceCensusSha256: censusRef.sha256, sourceRoots: localTypes.sourceRoots,
        targetCapabilitiesSha256: targetRef.sha256, targetRoots: localTypes.targetRoots, typeScriptVersion: "4.9.5",
    };
    const profileRef = writeCanonical(path.join(profileRoot, "profile-lock.json"), profile);
    state.document.profileSha256 = profileRef.sha256;
    state.document.roots[0].sourcePrefix = "app/";
    state.document.roots[1].sourcePrefix = "boot/";
    return { profileRoot, profile: path.join(profileRoot, profileRef.path),
        census: path.join(profileRoot, censusRef.path), target: path.join(profileRoot, targetRef.path) };
}

function invoke(state, mutate) {
    const document = structuredClone(state.document);
    mutate(document);
    const closure = path.join(state.root, `closure-${crypto.randomUUID()}.json`);
    fs.writeFileSync(closure, `${canonical(document)}\n`);
    return spawnSync(process.execPath, [executable, "qualify", state.root, path.join(state.root, crypto.randomUUID()),
        "--source-census", path.join(state.root, "missing-census.json"),
        "--target-capabilities", path.join(state.root, "missing-target.json"),
        "--profile-lock", path.join(state.root, "missing-profile.json"), "--source-closure", closure], {
        cwd: repository, encoding: "utf8", timeout: 10_000, windowsHide: true,
    });
}

function invokeAuthenticated(state, authority, operation, outputName, mutate = () => {}) {
    const document = structuredClone(state.document);
    mutate(document);
    const closure = path.join(state.root, `closure-${outputName}.json`);
    fs.writeFileSync(closure, `${canonical(document)}\n`);
    return spawnSync(process.execPath, [executable, operation, state.root, path.join(state.root, outputName),
        "--source-census", authority.census, "--target-capabilities", authority.target,
        "--profile-lock", authority.profile, "--source-closure", closure], {
        cwd: repository, encoding: "utf8", timeout: 30_000, windowsHide: true,
    });
}

function sourcePlan(state,mutate=()=>{}) {
    const plan=structuredClone(state.document);plan.schema="as3-authenticated-source-plan@1";
    for(const root of plan.roots) {
        root.includes??={edges:[],fragments:[]};
        for(const file of root.files) {
            file.allowedLocalDependencies=file.localDependencies;delete file.localDependencies;
        }
    }
    mutate(plan);return plan;
}

function invokePlan(state,authority,outputName,mutate=()=>{}) {
    const plan=sourcePlan(state,mutate),planPath=path.join(state.root,`plan-${outputName}.json`);
    fs.writeFileSync(planPath,`${canonical(plan)}\n`);
    return spawnSync(process.execPath,[executable,"qualify",state.root,path.join(state.root,outputName),
        "--source-census",authority.census,"--target-capabilities",authority.target,
        "--profile-lock",authority.profile,"--source-plan",planPath],{
        cwd:repository,encoding:"utf8",timeout:30_000,windowsHide:true,
    });
}

function invokeSecondary(state, authority, outputName, mutateRequest = () => {},mutateProvider=()=>{}) {
    const closure = path.join(state.root, `closure-${outputName}.json`);
    const closureBytes = Buffer.from(`${canonical(state.document)}\n`);
    fs.writeFileSync(closure, closureBytes);
    const provider={commandSha256:sha256(fs.readFileSync(path.join(repository,"lib/command.js"))),commit:"1".repeat(40),
        packageLockSha256:sha256(fs.readFileSync(path.join(repository,"package-lock.json"))),
        parserWorkerSha256:sha256(fs.readFileSync(path.join(repository,"lib/parser-worker.js"))),
        repository:"https://github.com/zeff9801/as3-to-ts",schema:"as3-compiler-provider-authority@1"};
    mutateProvider(provider);
    const providerPath=path.join(state.root,`provider-${outputName}.json`),providerBytes=Buffer.from(`${canonical(provider)}\n`);
    fs.writeFileSync(providerPath,providerBytes);
    const request = {
        applicationId: "source-closure-test",
        compilerProviderSha256:sha256(providerBytes),
        exports: [{ qname: "AchievementModule" }, { qname: "achievement.ui.AchievementPresentationPart" }],
        profileSha256: state.document.profileSha256,
        schema: "as3-secondary-authority-request@1",
        sourceClosureSha256: sha256(closureBytes),
    };
    mutateRequest(request);
    const requestPath = path.join(state.root, `secondary-${outputName}.json`);
    fs.writeFileSync(requestPath, `${canonical(request)}\n`);
    return spawnSync(process.execPath, [executable, "transpile", state.root, path.join(state.root, outputName),
        "--source-census", authority.census, "--target-capabilities", authority.target,
        "--profile-lock", authority.profile, "--source-closure", closure, "--secondary-authority", requestPath,
        "--compiler-provider",providerPath], {
        cwd: repository, encoding: "utf8", timeout: 30_000, windowsHide: true,
    });
}

test("authenticated multi-root closure rejects reordered roots before authority loading", t => {
    const state = fixture(t), result = invoke(state, document => document.roots.reverse());
    assert.equal(result.status, 6, result.stderr);
    assert.match(result.stderr, /root order must be application then bootstrap/);
});

test("authenticated multi-root closure rejects path escape", t => {
    const state = fixture(t), result = invoke(state, document => { document.roots[0].files[0].path = "../A.as"; });
    assert.equal(result.status, 6, result.stderr);
    assert.match(result.stderr, /escapes its source root/);
});

test("authenticated multi-root closure rejects source drift", t => {
    const state = fixture(t), result = invoke(state, document => { document.roots[0].files[0].sha256 = "b".repeat(64); });
    assert.equal(result.status, 6, result.stderr);
    assert.match(result.stderr, /content drift/);
});

test("authenticated multi-root closure rejects duplicate QName across roots", t => {
    const state = fixture(t), result = invoke(state, document => { document.roots[1].files[0].qnames = ["AchievementModule"]; });
    assert.equal(result.status, 6, result.stderr);
    assert.match(result.stderr, /duplicate source QName/);
});

test("authenticated multi-root closure rejects missing local dependency", t => {
    const state = fixture(t), result = invoke(state, document => { document.roots[0].files[0].localDependencies = ["missing.C"]; });
    assert.equal(result.status, 6, result.stderr);
    assert.match(result.stderr, /missing local dependency missing\.C/);
});

test("valid authenticated closure reaches exact profile authority gate", t => {
    const state = fixture(t), result = invoke(state, () => {});
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /application profile lock does not exist/);
});

test("real synthetic profile qualifies and transpiles exact application/bootstrap roots", t => {
    const state = fixture(t), authority = syntheticProfile(state);
    const qualified = invokeAuthenticated(state, authority, "qualify", "qualified");
    assert.equal(qualified.status, 0, qualified.stderr);
    const qualification = JSON.parse(fs.readFileSync(path.join(state.root, "qualified", "manifest.json")));
    assert.equal(qualification.sourceClosureSha256.length, 64);
    assert.deepEqual(qualification.files.map(file => [file.sourcePath, file.status]), [
        ["app/A.as", "admitted"], ["boot/B.as", "admitted"],
    ]);
    const transpiled = invokeAuthenticated(state, authority, "transpile", "transpiled");
    assert.equal(transpiled.status, 0, transpiled.stderr);
    assert.doesNotMatch(fs.readFileSync(path.join(state.root, "closure-transpiled.json"), "utf8"),
        new RegExp(state.root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const manifest = JSON.parse(fs.readFileSync(path.join(state.root, "transpiled", "manifest.json")));
    assert.doesNotMatch(JSON.stringify(manifest), new RegExp(state.root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.deepEqual(manifest.files.map(file => file.sourcePath), ["app/A.as", "boot/B.as"]);
    const a = fs.readFileSync(path.join(state.root, "transpiled", "__as3_runtime/application/AchievementModule.ts"), "utf8");
    assert.match(a, /import \{ AchievementPresentationPart \} from "\.\/achievement\/ui\/AchievementPresentationPart";/);
});

test("profile v2 authenticates the exact application start and manifest artifact identities",t=>{
    const state=fixture(t),contract={schema:"as3-application-start-contract@1",qname:"AchievementModule",
        exportName:"startAS3Application",constructorArguments:[],cancellation:"abort-signal-before-construction@1",
        result:"constructed-instance"},authority=syntheticProfile(state,contract),result=invokeAuthenticated(state,authority,"transpile","start-v2");
    assert.equal(result.status,0,result.stderr);
    const output=path.join(state.root,"start-v2"),manifest=JSON.parse(fs.readFileSync(path.join(output,"manifest.json"))),
        evidence=manifest.applicationStart,entry=fs.readFileSync(path.join(output,evidence.applicationEntry.path));
    assert.deepEqual(evidence.contract,{...contract,constructorModulePath:"application/AchievementModule.ts"});
    assert.equal(evidence.profileSha256,manifest.profileLockSha256);
    assert.equal(evidence.typeAuthoritySha256,manifest.runtimeAuthoritySha256);
    assert.deepEqual(evidence.applicationEntry,{path:"__as3_runtime/ApplicationEntry.generated.js",bytes:entry.length,sha256:sha256(entry)});
    assert.deepEqual(evidence.constructorModule,{path:"__as3_runtime/application/AchievementModule.js",
        bytes:fs.statSync(path.join(output,"__as3_runtime/application/AchievementModule.js")).size,
        sha256:sha256(fs.readFileSync(path.join(output,"__as3_runtime/application/AchievementModule.js"))),exportName:"AchievementModule"});
    assert.match(entry.toString("utf8"),/exports\.startAS3Application = startAS3Application/);
});

test("profile v2 rejects widened start contracts and absent start QNames",t=>{
    const contract={schema:"as3-application-start-contract@1",qname:"AchievementModule",
        exportName:"startAS3Application",constructorArguments:[],cancellation:"abort-signal-before-construction@1",
        result:"constructed-instance"};
    {const state=fixture(t),authority=syntheticProfile(state,contract),profile=JSON.parse(fs.readFileSync(authority.profile));
        profile.applicationStart.extra=true;const profileRef=writeCanonical(authority.profile,profile);
        state.document.profileSha256=profileRef.sha256;
        const result=invokeAuthenticated(state,authority,"transpile","start-extra");
        assert.equal(result.status,6,result.stderr);assert.match(result.stderr,/profile lock has the wrong closed schema/);}
    {const state=fixture(t),authority=syntheticProfile(state,{...contract,qname:"MissingRoot"});
        const result=invokeAuthenticated(state,authority,"transpile","start-missing");
        assert.equal(result.status,4,result.stderr);assert.match(result.stderr,/application start QName must identify exactly one emitted declaration/);}
});

test("authenticated closure rejects profile hash and source-prefix drift", t => {
    const state = fixture(t), authority = syntheticProfile(state);
    const hash = invokeAuthenticated(state, authority, "qualify", "bad-profile", document => {
        document.profileSha256 = "f".repeat(64);
    });
    assert.equal(hash.status, 6, hash.stderr);
    assert.match(hash.stderr, /not bound to the selected application profile/);
    const prefix = invokeAuthenticated(state, authority, "qualify", "bad-prefix", document => {
        document.roots[1].sourcePrefix = "wrong/";
    });
    assert.equal(prefix.status, 6, prefix.stderr);
    assert.match(prefix.stderr, /bootstrap prefix differs/);
});

test("authenticated closure rejects semantic QName and dependency drift after parsing", t => {
    const state = fixture(t), authority = syntheticProfile(state);
    const qname = invokeAuthenticated(state, authority, "qualify", "qname-drift", document => {
        document.roots[0].files[0].qnames = ["feature.Wrong"];
        document.roots[0].files[0].localDependencies = [];
    });
    assert.equal(qname.status, 0, qname.stderr);
    const qnameReport = JSON.parse(fs.readFileSync(path.join(state.root, "qname-drift", "manifest.json")));
    assert.equal(qnameReport.files.find(file => file.sourcePath === "app/A.as").code, "HARDENED_SOURCE_CLOSURE_QNAME");

    const dependency = invokeAuthenticated(state, authority, "qualify", "dependency-drift", document => {
        document.roots[0].files[0].localDependencies = [];
    });
    assert.equal(dependency.status, 0, dependency.stderr);
    const dependencyReport = JSON.parse(fs.readFileSync(path.join(state.root, "dependency-drift", "manifest.json")));
    assert.equal(dependencyReport.files.find(file => file.sourcePath === "app/A.as").code,
        "HARDENED_SOURCE_CLOSURE_DEPENDENCIES");
});

test("authenticated closure forbids output overlap with bootstrap root", t => {
    const state = fixture(t), authority = syntheticProfile(state);
    const document = structuredClone(state.document), closure = path.join(state.root, "overlap-closure.json");
    fs.writeFileSync(closure, `${canonical(document)}\n`);
    const result = spawnSync(process.execPath, [executable, "qualify", state.root,
        path.join(state.bootstrap, "generated"), "--source-census", authority.census,
        "--target-capabilities", authority.target, "--profile-lock", authority.profile,
        "--source-closure", closure], { cwd: repository, encoding: "utf8", timeout: 30_000, windowsHide: true });
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /source and output directories must not overlap/);
});

test("authenticated source plan derives exact semantic dependencies before transpile",t=>{
    const state=fixture(t),authority=syntheticProfile(state);
    const qualified=invokePlan(state,authority,"planned",plan=>{
        plan.roots[0].files[0].allowedLocalDependencies.unshift("AchievementModule");
    });
    assert.equal(qualified.status,0,qualified.stderr);
    const output=path.join(state.root,"planned"),manifest=JSON.parse(fs.readFileSync(path.join(output,"manifest.json")));
    assert.equal(manifest.sourcePlanSha256.length,64);
    assert.equal(manifest.derivedSourceClosurePath,"derived-source-closure.json");
    const derivedBytes=fs.readFileSync(path.join(output,manifest.derivedSourceClosurePath));
    assert.equal(sha256(derivedBytes),manifest.derivedSourceClosureSha256);
    assert.doesNotMatch(derivedBytes.toString("utf8"),new RegExp(state.root.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
    const derived=JSON.parse(derivedBytes);
    assert.equal(derived.schema,"as3-authenticated-source-closure@2");
    assert.deepEqual(derived.roots[0].files[0].localDependencies,["achievement.ui.AchievementPresentationPart"]);
    assert.deepEqual(derived.roots.map(root=>root.includes),[{edges:[],fragments:[]},{edges:[],fragments:[]}]);
    const transpiled=spawnSync(process.execPath,[executable,"transpile",state.root,path.join(state.root,"planned-transpile"),
        "--source-census",authority.census,"--target-capabilities",authority.target,
        "--profile-lock",authority.profile,"--source-closure",path.join(output,manifest.derivedSourceClosurePath)],{
        cwd:repository,encoding:"utf8",timeout:30_000,windowsHide:true,
    });
    assert.equal(transpiled.status,0,transpiled.stderr);
    derived.roots[0].files[0].localDependencies.unshift("AchievementModule");
    const overApprox=path.join(state.root,"over-approx-derived.json");fs.writeFileSync(overApprox,`${canonical(derived)}\n`);
    const rejected=spawnSync(process.execPath,[executable,"transpile",state.root,path.join(state.root,"over-approx-output"),
        "--source-census",authority.census,"--target-capabilities",authority.target,
        "--profile-lock",authority.profile,"--source-closure",overApprox],{
        cwd:repository,encoding:"utf8",timeout:30_000,windowsHide:true,
    });
    assert.equal(rejected.status,4,rejected.stderr);assert.match(rejected.stderr,/semantic local dependencies differ/);
});

test("source plan fails closed on semantic dependency escape and cannot transpile directly",t=>{
    const state=fixture(t),authority=syntheticProfile(state);
    const held=invokePlan(state,authority,"plan-held",plan=>{plan.roots[0].files[0].allowedLocalDependencies=[];});
    assert.equal(held.status,0,held.stderr);
    const manifest=JSON.parse(fs.readFileSync(path.join(state.root,"plan-held","manifest.json")));
    assert.equal(manifest.files.find(file=>file.sourcePath==="app/A.as").code,"HARDENED_SOURCE_PLAN_DEPENDENCIES");
    assert.equal(manifest.derivedSourceClosurePath,undefined);
    const planPath=path.join(state.root,"direct-plan.json");fs.writeFileSync(planPath,`${canonical(sourcePlan(state))}\n`);
    const direct=spawnSync(process.execPath,[executable,"transpile",state.root,path.join(state.root,"direct-plan-output"),
        "--source-census",authority.census,"--target-capabilities",authority.target,
        "--profile-lock",authority.profile,"--source-plan",planPath],{cwd:repository,encoding:"utf8"});
    assert.equal(direct.status,2,direct.stderr);assert.match(direct.stderr,/valid only for qualify/);
});

test("multi-root include authority derives and transpiles the exact fragment and edge closure",t=>{
    const state=includeFixture(t),authority=syntheticProfile(state);
    const qualified=invokePlan(state,authority,"include-plan",plan=>{
        plan.roots[0].files[0].allowedLocalDependencies.unshift("AchievementModule");
    });
    assert.equal(qualified.status,0,qualified.stderr);
    const manifest=JSON.parse(fs.readFileSync(path.join(state.root,"include-plan","manifest.json")));
    assert.equal(manifest.files.find(file=>file.sourcePath==="app/A.as").status,"admitted");
    assert.deepEqual(manifest.includedFragments.map(item=>item.sourcePath),["app/member.as"]);
    const derivedPath=path.join(state.root,"include-plan",manifest.derivedSourceClosurePath);
    const derived=JSON.parse(fs.readFileSync(derivedPath));
    assert.deepEqual(derived.roots[0].includes,state.document.roots[0].includes);
    assert.deepEqual(derived.roots[0].files[0].localDependencies,["achievement.ui.AchievementPresentationPart"]);
    const transpiled=spawnSync(process.execPath,[executable,"transpile",state.root,path.join(state.root,"include-transpile"),
        "--source-census",authority.census,"--target-capabilities",authority.target,"--profile-lock",authority.profile,
        "--source-closure",derivedPath],{cwd:repository,encoding:"utf8",timeout:30_000,windowsHide:true});
    assert.equal(transpiled.status,0,transpiled.stderr);
    const emitted=fs.readFileSync(path.join(state.root,"include-transpile","__as3_runtime/application/AchievementModule.ts"),"utf8");
    assert.match(emitted,/value: AchievementPresentationPart/);
});

test("multi-root include closure rejects fragment, edge, and root-ownership drift",t=>{
    const state=includeFixture(t),authority=syntheticProfile(state);
    const fragment=invokeAuthenticated(state,authority,"qualify","include-fragment-drift",document=>{
        document.roots[0].includes.fragments[0].sha256="0".repeat(64);
    });
    assert.equal(fragment.status,6,fragment.stderr);assert.match(fragment.stderr,/fragment content drift/);
    const edge=invokeAuthenticated(state,authority,"qualify","include-edge-drift",document=>{
        document.roots[0].includes.edges[0].targetSha256="0".repeat(64);
    });
    assert.equal(edge.status,6,edge.stderr);assert.match(edge.stderr,/edges differ from the exact profile-authority projection/);
    const ownership=invokeAuthenticated(state,authority,"qualify","include-owner-drift",document=>{
        document.roots[1].includes.edges=document.roots[0].includes.edges;document.roots[0].includes.edges=[];
    });
    assert.equal(ownership.status,6,ownership.stderr);assert.match(ownership.stderr,/include edge is invalid/);
});

test("secondary authority publishes an inert ordered receipt bound to exact output bytes", t => {
    const state = fixture(t), authority = syntheticProfile(state);
    const result = invokeSecondary(state, authority, "secondary-output");
    assert.equal(result.status, 0, result.stderr);
    const output = path.join(state.root, "secondary-output"), manifest = JSON.parse(fs.readFileSync(path.join(output,"manifest.json")));
    assert.equal(manifest.secondaryAuthorityReceiptPath,"__as3_runtime/SecondaryAuthority.receipt.json");
    const receiptBytes = fs.readFileSync(path.join(output,manifest.secondaryAuthorityReceiptPath));
    assert.equal(sha256(receiptBytes),manifest.secondaryAuthorityReceiptSha256);
    const receipt = JSON.parse(receiptBytes);
    assert.equal(receipt.classification,"data-only-pre-import-authority");
    assert.equal(receipt.loadingPolicy,"authenticate-receipt-package-metadata-and-exact-executable-closure-before-import");
    assert.deepEqual(receipt.exports.map(item=>item.qname),["AchievementModule","achievement.ui.AchievementPresentationPart"]);
    assert.deepEqual(receipt.exports.map(item=>item.exportName),["AchievementModule","AchievementPresentationPart"]);
    assert.deepEqual(Object.keys(receipt.compiler).sort(),["parserWorkerSha256","toolVersion","typeScriptVersion"]);
    assert.equal(receipt.compilerProviderAuthoritySha256.length,64);
    assert.deepEqual(receipt.compilerProvider,{commit:"1".repeat(40),packageLockSha256:sha256(fs.readFileSync(path.join(repository,"package-lock.json"))),
        repository:"https://github.com/zeff9801/as3-to-ts"});
    assert.deepEqual(receipt.executableModules.map(item=>[item.qname,item.sourceModule]),[
        ["AchievementModule","application"],["achievement.ui.AchievementPresentationPart","bootstrap"]]);
    assert.deepEqual(receipt.executableModules.map(item=>Object.keys(item).sort()),[
        ["javascriptBytes","javascriptPath","javascriptSha256","qname","sourceModule"],
        ["javascriptBytes","javascriptPath","javascriptSha256","qname","sourceModule"]]);
    assert.deepEqual(receipt.runtimeAuthorityLinkage,{browserFactory:null,definedQNames:["AchievementModule"],
        externalQNames:["achievement.ui.AchievementPresentationPart"],status:"held-import-free-browser-link-not-emitted"});
    for(const module of receipt.exports){
        const typescript=fs.readFileSync(path.join(output,module.typescriptPath));
        const javascript=fs.readFileSync(path.join(output,module.javascriptPath));
        assert.equal(typescript.length,module.typescriptBytes); assert.equal(sha256(typescript),module.typescriptSha256);
        assert.equal(javascript.length,module.javascriptBytes); assert.equal(sha256(javascript),module.javascriptSha256);
        const source=manifest.files.find(file=>file.sourcePath===module.sourcePath);
        assert.equal(source.sourceBytes,module.sourceBytes); assert.equal(source.sourceSha256,module.sourceSha256);
    }
    const runtimeRoot=path.join(output,"__as3_runtime");
    const javascript=[];
    const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).forEach(entry=>{
        const absolute=path.join(directory,entry.name);
        if(entry.isDirectory()) walk(absolute);
        else if(entry.isFile() && entry.name.endsWith(".js")){
            const bytes=fs.readFileSync(absolute);
            javascript.push({path:path.relative(runtimeRoot,absolute).split(path.sep).join("/"),bytes:bytes.length,sha256:sha256(bytes)});
        }
    });
    walk(runtimeRoot); javascript.sort((left,right)=>Buffer.compare(Buffer.from(left.path,"utf8"),Buffer.from(right.path,"utf8")));
    assert.deepEqual(receipt.executableClosure,javascript);
    assert.equal(receipt.executableClosureSha256,sha256(Buffer.from(`${canonical(javascript)}\n`)));
    const packageBytes=fs.readFileSync(path.join(runtimeRoot,"package.json"));
    assert.deepEqual(receipt.packageMetadata,{path:"package.json",bytes:packageBytes.length,sha256:sha256(packageBytes)});
    const closureBytes=fs.readFileSync(path.join(runtimeRoot,"AchievementModule.source-closure.json"));
    assert.deepEqual(receipt.sourceClosure,{path:"AchievementModule.source-closure.json",bytes:closureBytes.length,
        sha256:sha256(closureBytes)});
    assert.equal(receipt.sourceClosure.sha256,receipt.sourceClosureSha256);
    const authorityBytes=fs.readFileSync(path.join(runtimeRoot,"AS3Authority.generated.js"));
    assert.deepEqual(receipt.runtimeAuthority,{path:"AS3Authority.generated.js",bytes:authorityBytes.length,sha256:sha256(authorityBytes)});
    assert.equal(require(path.join(runtimeRoot,"AS3Authority.generated.js")).__as3CreatePrimarySecondaryLinkage,undefined,
        "legacy v1 output must not expose the browser primary-host adapter");
    assert.equal(fs.existsSync(path.join(output,"__as3_runtime/SecondaryAuthority.generated.js")),false);
    assert.equal(fs.existsSync(path.join(output,"__as3_runtime/AchievementModule.browser.mjs")),false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(output,"__as3_runtime/package.json"))).exports["./SecondaryAuthorityReceipt"],
        "./SecondaryAuthority.receipt.json");
    authenticateSecondaryPackage(runtimeRoot,receipt);
    const victim=path.join(runtimeRoot,receipt.exports[0].javascriptPath.replace(/^__as3_runtime\//,""));
    const victimBytes=fs.readFileSync(victim);
    fs.renameSync(victim,`${victim}.held`);
    assert.throws(()=>authenticateSecondaryPackage(runtimeRoot,receipt),/missing, extra, or drifted/);
    fs.renameSync(`${victim}.held`,victim);
    const extra=path.join(runtimeRoot,"Extra.js");
    fs.writeFileSync(extra,"module.exports = {};\n");
    assert.throws(()=>authenticateSecondaryPackage(runtimeRoot,receipt),/missing, extra, or drifted/);
    fs.unlinkSync(extra);
    fs.writeFileSync(victim,Buffer.concat([victimBytes,Buffer.from("\n")]));
    assert.throws(()=>authenticateSecondaryPackage(runtimeRoot,receipt),/missing, extra, or drifted/);
    fs.writeFileSync(victim,victimBytes);
});

test("secondary authority rejects binding drift, reordered exports, and missing output", t => {
    const state = fixture(t), authority = syntheticProfile(state);
    const profile = invokeSecondary(state,authority,"secondary-profile-drift",request=>{request.profileSha256="8".repeat(64);});
    assert.equal(profile.status,6,profile.stderr); assert.match(profile.stderr,/not bound to the selected profile and source closure/);
    const closure = invokeSecondary(state,authority,"secondary-closure-drift",request=>{request.sourceClosureSha256="7".repeat(64);});
    assert.equal(closure.status,6,closure.stderr); assert.match(closure.stderr,/not bound to the selected profile and source closure/);
    const providerIdentity=invokeSecondary(state,authority,"secondary-provider-identity",request=>{
        request.compilerProviderSha256="0".repeat(64);
    });
    assert.equal(providerIdentity.status,6,providerIdentity.stderr);
    assert.match(providerIdentity.stderr,/authority bytes differ from the pinned request/);
    const reordered = invokeSecondary(state,authority,"secondary-reordered",request=>{request.exports.reverse();});
    assert.equal(reordered.status,6,reordered.stderr); assert.match(reordered.stderr,/must be AchievementModule then/);
    const wrong = invokeSecondary(state,authority,"secondary-wrong",request=>{request.exports[1].qname="missing.C";});
    assert.equal(wrong.status,6,wrong.stderr); assert.match(wrong.stderr,/must be AchievementModule then/);
    const assertedProvider = invokeSecondary(state,authority,"secondary-provider",request=>{
        request.provider={repository:"forged",commit:"0".repeat(40),packageLockSha256:"9".repeat(64)};
    });
    assert.equal(assertedProvider.status,6,assertedProvider.stderr);
    assert.match(assertedProvider.stderr,/wrong canonical closed schema/);
    const providerDrift=invokeSecondary(state,authority,"secondary-provider-drift",()=>{},provider=>{
        provider.commandSha256="0".repeat(64);
    });
    assert.equal(providerDrift.status,6,providerDrift.stderr);
    assert.match(providerDrift.stderr,/differs from the executing compiler bytes/);
});
