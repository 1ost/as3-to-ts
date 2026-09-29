"use strict";

const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {spawnSync}=require("node:child_process");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const test=require("node:test");
const ts=require("typescript-4-9");

const repository=path.resolve(__dirname,"../.."),executable=path.join(repository,"bin/as3-frontend");
const qnames=["AchievementModule","achievement.commands.CmdGetKeepOnlineAchievements",
    "achievement.commands.CmdGetLastOnlineAchievements","achievement.mediator.AchievementPresentionMediator",
    "achievement.proxy.AchievementPresentionProxy","achievement.ui.AchievementPresentationPart"];
const relativePaths=["AchievementModule.as","achievement/commands/CmdGetKeepOnlineAchievements.as",
    "achievement/commands/CmdGetLastOnlineAchievements.as","achievement/mediator/AchievementPresentionMediator.as",
    "achievement/proxy/AchievementPresentionProxy.as","achievement/ui/AchievementPresentationPart.as"];
const sha256=value=>crypto.createHash("sha256").update(value).digest("hex");
function assertImportFreeFactory(source){
    const parsed=ts.createSourceFile("primary-host-bundle.mjs",source,ts.ScriptTarget.ES2020,true,ts.ScriptKind.JS);
    assert.equal(parsed.parseDiagnostics.length,0);
    let exportCount=0;
    for(const statement of parsed.statements){
        assert.equal(ts.isImportDeclaration(statement)||ts.isImportEqualsDeclaration(statement)||ts.isExportDeclaration(statement)
            ||ts.isExportAssignment(statement),false,"bundle has module dependency syntax");
        if(statement.modifiers?.some(item=>item.kind===ts.SyntaxKind.ExportKeyword))exportCount++;
    }
    const visit=node=>{
        assert.equal(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword,false,"bundle has dynamic import");
        assert.equal(ts.isTemplateExpression(node)||ts.isNoSubstitutionTemplateLiteral(node),false,"bundle has template literal");
        if(ts.isIdentifier(node)&&["require","module","exports","eval","Function","globalThis","window","self","process"].includes(node.text))
            assert.fail(`bundle has ambient ${node.text}`);
        if(ts.isStringLiteral(node)) {
            const raw=source.slice(node.getStart(parsed),node.end);
            assert.equal(JSON.parse(raw),node.text,`bundle string token is not AP JSON syntax: ${raw}`);
        }
        ts.forEachChild(node,visit);
    };visit(parsed);assert.equal(exportCount,1);
}
function canonical(value){
    if(value===null||typeof value==="boolean"||typeof value==="string"||typeof value==="number")return JSON.stringify(value);
    if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
    return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}
function writeCanonical(file,value){const bytes=Buffer.from(`${canonical(value)}\n`);fs.writeFileSync(file,bytes);return {path:path.basename(file),sha256:sha256(bytes)};}
function classSource(qname){
    const dot=qname.lastIndexOf("."),pkg=dot<0?"":qname.slice(0,dot),name=qname.slice(dot+1);
    const forwardImport=qname===qnames[1]?" import achievement.proxy.AchievementPresentionProxy;":"";
    const forwardMember=qname===qnames[1]
        ?" public function makeProxy():AchievementPresentionProxy { return new AchievementPresentionProxy(); }":"";
    return Buffer.from(`package${pkg?` ${pkg}`:""} {${forwardImport} public class ${name} { public function ${name}() {}${forwardMember} } }\n`);
}
function primaryEntry(){const source=Buffer.from("package mx.core { public class UIComponent { public function UIComponent() {} } }\n");
    return {kind:"class",qname:"mx.core.UIComponent",base:null,interfaces:[],sourceSha256:sha256(source),fields:[],
        objectTraits:{dynamic:false,members:[]},staticReflection:{variables:[]},
        staticCallTraits:{methods:[],noncallableNames:[],unsupportedNames:[]}};}
function primaryDigest(){const entry=primaryEntry();return sha256(JSON.stringify({schema:"as3-runtime-type-authority@1",qnames:[entry.qname],entries:[entry]}));}
function fixture(t){
    const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"as3-browser-linker-")));
    t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
    const app=path.join(root,"application"),boot=path.join(root,"bootstrap");fs.mkdirSync(app);fs.mkdirSync(boot);
    const files=qnames.map((qname,index)=>{
        const bytes=classSource(qname),target=path.join(app,...relativePaths[index].split("/"));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
        return {path:relativePaths[index],bytes:bytes.length,sha256:sha256(bytes),qnames:[qname],
            localDependencies:index===1?[qnames[4]]:[]};
    });
    const bootstrapBytes=Buffer.from("package mx.core { public class UIComponent { public function UIComponent() {} } }\n");
    fs.mkdirSync(path.join(boot,"mx/core"),{recursive:true});fs.writeFileSync(path.join(boot,"mx/core/UIComponent.as"),bootstrapBytes);
    const closure={schema:"as3-authenticated-source-closure@2",profileSha256:"0".repeat(64),roots:[
        {module:"application",path:"application",sourcePrefix:"game-client/game_modules/recovered/achievement_module/src/",files,includes:{edges:[],fragments:[]}},
        {module:"bootstrap",path:"bootstrap",sourcePrefix:"game-client/main_swf/src/",files:[{path:"mx/core/UIComponent.as",bytes:bootstrapBytes.length,
            sha256:sha256(bootstrapBytes),qnames:["mx.core.UIComponent"],localDependencies:[]}],includes:{edges:[],fragments:[]}},
    ]};
    return {root,closure};
}

function profile(state){
    const root=path.join(state.root,"profile");fs.mkdirSync(root);
    const census=writeCanonical(path.join(root,"census.json"),{as3SourceCapabilities:{apis:[],memberUses:[]}});
    const target=writeCanonical(path.join(root,"target.json"),{capabilities:[],schema:"laya-authored-content-capabilities@1"});
    const mapping=writeCanonical(path.join(root,"mapping.json"),{mappings:[],schema:"as3-source-to-laya-capability-map@1"});
    const rawGraph=writeCanonical(path.join(root,"raw-graph.json"),{edges:[],schema:"synthetic-dependency-graph@1"});
    const semanticGraph=writeCanonical(path.join(root,"semantic-graph.json"),{edges:[],schema:"synthetic-semantic-graph@1"});
    const manifest=writeCanonical(path.join(root,"sources.json"),{files:[...relativePaths.map(value=>"app/"+value),"boot/mx/core/UIComponent.as"],schema:"synthetic-source-manifest@1"});
    const rows=[...state.closure.roots[0].files.map((file,index)=>({file,module:"application",qname:qnames[index],nodeId:(index+1).toString(16).padStart(16,"0"),
        sourcePath:state.closure.roots[0].sourcePrefix+file.path,targetPath:`generated/application/${file.path.replace(/\.as$/,".ts")}`})),
        {file:state.closure.roots[1].files[0],module:"bootstrap",qname:"mx.core.UIComponent",nodeId:"0000000000000007",
            sourcePath:state.closure.roots[1].sourcePrefix+"mx/core/UIComponent.as",targetPath:"generated/bootstrap/mx/core/UIComponent.ts"}];
    const localTypes={schema:"as3-application-local-type-map@1",dependencyGraphRawSha256:rawGraph.sha256,
        dependencyGraphSemanticSha256:semanticGraph.sha256,sourceManifestSha256:manifest.sha256,sourceRoots:{application:state.closure.roots[0].sourcePrefix,bootstrap:state.closure.roots[1].sourcePrefix},
        targetRoots:{application:"generated/application/",bootstrap:"generated/bootstrap/"},entryCount:rows.length,entries:rows.map((row,index)=>({
            componentId:`scc-${String(index).padStart(5,"0")}`,graphSourceSha256:sha256(row.qname),importable:true,module:row.module,nodeId:row.nodeId,
            prerequisites:index===1?[rows[4].nodeId]:[],qname:row.qname,sourceContentSha256:row.file.sha256,sourcePath:row.sourcePath,targetPath:row.targetPath,
            topologicalLevel:index===1?1:0,typeKind:"class"}))};
    const localTypesRef=writeCanonical(path.join(root,"local-types.json"),localTypes);
    const constructor=name=>({fieldType:null,kind:"constructor",modifiers:["public"],name,namespaceName:null,parameters:[],readonly:false,returnType:null});
    const localMembers={completeCount:rows.length,declarationWorkerSha256:"d".repeat(64),entryCount:rows.length,heldCount:0,
        localTypeMapSha256:localTypesRef.sha256,schema:"as3-application-local-member-map@1",sourceCensusSha256:census.sha256,entries:rows.map(row=>({
            declaration:{baseQNames:[],interfaceQNames:[],members:[constructor(row.qname.slice(row.qname.lastIndexOf(".")+1)),
                ...(row.qname===qnames[1]?[{fieldType:null,kind:"method",modifiers:["public"],name:"makeProxy",namespaceName:null,parameters:[],readonly:false,
                    returnType:qnames[4]}]:[])],packageInitializer:null},
            holdCode:null,holdSha256:null,module:row.module,nodeId:row.nodeId,qname:row.qname,sourceContentSha256:row.file.sha256,status:"complete",typeKind:"class"}))};
    const localMembersRef=writeCanonical(path.join(root,"local-members.json"),localMembers);
    const predicates=writeCanonical(path.join(root,"predicates.json"),{hashMode:"canonical-lf-utf8",schema:"laya-flash-runtime-type-predicates@1",types:[]});
    const runtimeLock=writeCanonical(path.join(root,"runtime-lock.json"),{layaRevision:"e".repeat(40),predicateAuthorityCanonicalLfSha256:predicates.sha256,
        predicateAuthorityEntryCount:0,predicateAuthorityQNames:[],schema:"as3-application-runtime-type-authority-lock@1"});
    const timer=writeCanonical(path.join(root,"timer.json"),{exports:[],module:"@test/as3-runtime/AS3Timer",schema:"as3-native-timer-authority@1",
        sourcePath:"src/hardened-runtime/AS3Timer.ts",sourceSha256:sha256(fs.readFileSync(path.join(repository,"src/hardened-runtime/AS3Timer.ts")))});
    const sourceMembers=writeCanonical(path.join(root,"source-members.json"),{entries:[{baseQName:null,ownInstanceMemberNames:[],qname:"Object"}],entryCount:1,
        generator:"air-sdk-swfdump-abc@1",schema:"as3-source-member-authority@1",sourceArtifactSha256:sha256("browser linker fixture")});
    const profileDoc={applicationId:"achievement-browser-test",counts:{localMembersComplete:rows.length,localMembersHeld:0,localTypes:rows.length,mappedMembers:0,mappedTypes:0,sourceMemberTypes:1},
        files:{capabilityMapping:mapping,dependencyGraphRaw:rawGraph,dependencyGraphSemantic:semanticGraph,localMemberMap:localMembersRef,localTypeMap:localTypesRef,
            nativeTimerAuthority:timer,runtimeTypeAuthorityLock:runtimeLock,runtimeTypePredicates:predicates,sourceManifest:manifest,sourceMemberAuthority:sourceMembers},
        runtimePackage:"@test/as3-runtime",runtimePredicateQNames:[],schema:"as3-application-profile-lock@1",sourceCensusSha256:census.sha256,
        sourceRoots:localTypes.sourceRoots,targetCapabilitiesSha256:target.sha256,targetRoots:localTypes.targetRoots,typeScriptVersion:"4.9.5"};
    const lock=writeCanonical(path.join(root,"profile-lock.json"),profileDoc);state.closure.profileSha256=lock.sha256;
    return {census:path.join(root,census.path),target:path.join(root,target.path),lock:path.join(root,lock.path)};
}

function invoke(state,authority,name,mutate=()=>{}){
    const closurePath=path.join(state.root,`${name}-closure.json`),closureBytes=Buffer.from(`${canonical(state.closure)}\n`);fs.writeFileSync(closurePath,closureBytes);
    const provider={commandSha256:sha256(fs.readFileSync(path.join(repository,"lib/command.js"))),commit:"1".repeat(40),
        packageLockSha256:sha256(fs.readFileSync(path.join(repository,"package-lock.json"))),parserWorkerSha256:sha256(fs.readFileSync(path.join(repository,"lib/parser-worker.js"))),
        repository:"https://github.com/zeff9801/as3-to-ts",schema:"as3-compiler-provider-authority@1"};
    const providerPath=path.join(state.root,`${name}-provider.json`),providerBytes=Buffer.from(`${canonical(provider)}\n`);fs.writeFileSync(providerPath,providerBytes);
    const sources=state.closure.roots[0].files.map((file,index)=>({qname:qnames[index],path:state.closure.roots[0].sourcePrefix+file.path,sha256:file.sha256,bytes:file.bytes,
        swfDecompiledSha256:sha256("decompiled-"+index),swfDecompiledBytes:file.bytes+1,swfDecompiledNormalizedSha256:file.sha256,
        swfDecompiledNormalizedBytes:file.bytes,matchesSwfDecompilationAfterLineEndingNormalization:true}));
    const request={schema:"as3-secondary-browser-linker-request@2",applicationId:"achievement-browser-test",profileSha256:state.closure.profileSha256,
        sourceClosureSha256:sha256(closureBytes),compilerProviderSha256:sha256(providerBytes),primaryAuthority:{runtimeAuthoritySha256:"a".repeat(64),typeAuthoritySha256:primaryDigest()},
        executable:{logicalPath:"modules/AchievementModule.swf",documentBundleId:qnames[0],modulePartQName:qnames[5],
            sourceSwf:{path:"game-client/swfs/assets/modules/AchievementModule.swf",bytes:4304,sha256:"c".repeat(64)},sources},
        exports:[{qname:qnames[0]},{qname:qnames[5]}]};mutate({request,closure:state.closure});
    const requestPath=path.join(state.root,`${name}-request.json`);fs.writeFileSync(requestPath,`${canonical(request)}\n`);
    const output=path.join(state.root,name),result=spawnSync(process.execPath,[executable,"transpile",state.root,output,"--source-census",authority.census,
        "--target-capabilities",authority.target,"--profile-lock",authority.lock,"--source-closure",closurePath,"--secondary-authority",requestPath,
        "--compiler-provider",providerPath],{cwd:repository,encoding:"utf8",timeout:30_000,windowsHide:true});
    return {result,output,request};
}

test("v2 request emits the exact linker plus held multi-file and import-free primary-host candidates",async t=>{
    const state=fixture(t),authority=profile(state),{result,output,request}=invoke(state,authority,"browser-output");
    assert.equal(result.status,0,result.stderr);
    const manifest=JSON.parse(fs.readFileSync(path.join(output,"manifest.json"))),packageRoot=path.join(output,manifest.secondaryBrowserLinkerPackageRoot);
    assert.deepEqual(fs.readdirSync(packageRoot).sort(),["AchievementModule.authority-receipt.json","AchievementModule.secondary-linker.mjs",
        "AchievementModule.secondary-type-authority.json","AchievementModule.source-closure.json"]);
    const source=fs.readFileSync(path.join(packageRoot,"AchievementModule.secondary-linker.mjs"),"utf8");
    assert.match(source,/^export function linkAS3SecondaryAuthority\(primary\)/);
    assert.doesNotMatch(source,/(?:^\s*import\s|\brequire\s*\(|\bmodule\.|\bexports\.)/m);
    const evidence=JSON.parse(fs.readFileSync(path.join(packageRoot,"AchievementModule.secondary-type-authority.json")));
    assert.deepEqual(evidence.evaluationOrder,qnames);assert.deepEqual(evidence.initializerOrder,qnames);assert.deepEqual(evidence.externalBootstrapQNames,["mx.core.UIComponent"]);
    const receipt=JSON.parse(fs.readFileSync(path.join(packageRoot,"AchievementModule.authority-receipt.json")));
    assert.equal(receipt.schema,"ap-original-achievement-secondary-linker-receipt@3");assert.deepEqual(receipt.primaryAuthority,request.primaryAuthority);
    const evidenceBytes=fs.readFileSync(path.join(packageRoot,"AchievementModule.secondary-type-authority.json"));
    assert.deepEqual(receipt.secondaryTypeAuthority,{path:"AchievementModule.secondary-type-authority.json",bytes:evidenceBytes.length,sha256:sha256(evidenceBytes)});
    assert.equal(manifest.primarySecondaryHostPackageRoot,undefined);
    const hostRoot=path.join(output,manifest.primarySecondaryHostCandidatePackageRoot);
    assert.equal(manifest.primarySecondaryHostCandidateStatus,"held");
    assert.deepEqual(manifest.primarySecondaryHostCandidateHolds,["AP_ACHIEVEMENT_PRIMARY_HOST_BROWSER_ESM_CLOSURE_UNQUALIFIED"]);
    assert.deepEqual(fs.readdirSync(hostRoot).sort(),["AchievementModule.primary-host-candidate-receipt.json","AchievementModule.primary-host.mjs"]);
    const hostReceiptBytes=fs.readFileSync(path.join(hostRoot,"AchievementModule.primary-host-candidate-receipt.json"));
    const hostReceipt=JSON.parse(hostReceiptBytes);
    assert.equal(hostReceipt.schema,"ap-original-achievement-primary-host-candidate-receipt@1");
    assert.equal(hostReceipt.status,"held");
    assert.deepEqual(hostReceipt.holds.map(item=>item.code),["AP_ACHIEVEMENT_PRIMARY_HOST_BROWSER_ESM_CLOSURE_UNQUALIFIED"]);
    assert.equal(hostReceipt.exportName,"createAchievementPrimarySecondaryLinkage");
    assert.deepEqual(hostReceipt.primaryAuthority,request.primaryAuthority);
    assert.deepEqual(hostReceipt.dependencies.map(row=>row.role),["primary-runtime","bootstrap-definition",
        ...hostReceipt.runtimeModules.map(()=>"runtime-module"),
        ...hostReceipt.dependencies.slice(2+hostReceipt.runtimeModules.length).map(()=>"transitive-module")]);
    const dependencyPaths=new Set(hostReceipt.dependencies.map(row=>row.path));
    for(const secondaryPath of relativePaths.map(value=>`achievement-primary-runtime/application/${value.replace(/\.as$/,".mjs")}`))
        assert.equal(dependencyPaths.has(secondaryPath),false,"primary runtime must not duplicate a secondary application module");
    for(const dependency of hostReceipt.dependencies) {
        assert.equal(dependency.format,"browser-esm@1");assert.match(dependency.specifier,/^\.\.\/achievement-primary-runtime\/.*\.mjs$/);
        dependency.imports.forEach(item=>{assert.match(item.specifier,/^\.\.?\//);assert.ok(dependencyPaths.has(item.path));});
        const bytes=fs.readFileSync(path.join(output,"__as3_runtime",dependency.path));
        assert.equal(bytes.length,dependency.bytes);assert.equal(sha256(bytes),dependency.sha256);
        assert.doesNotMatch(bytes.toString("utf8"),/(?:\brequire\s*\(|\bmodule\.exports\b|\bexports\.)/);
    }
    assert.equal(sha256(hostReceiptBytes),manifest.primarySecondaryHostCandidateReceipt.sha256);
    const hostSource=fs.readFileSync(path.join(hostRoot,"AchievementModule.primary-host.mjs"),"utf8");
    assert.match(hostSource,/export function createAchievementPrimarySecondaryLinkage\(\)/);
    assert.doesNotMatch(hostSource,/AchievementModule\.(?:secondary-linker|secondary-type-authority|source-closure|authority-receipt)/);
    assert.equal(manifest.primaryHostBundleCandidateStatus,"held");
    assert.deepEqual(manifest.primaryHostBundleCandidateHolds,["AP_ACHIEVEMENT_PRIMARY_HOST_BROWSER_EXECUTION_UNVERIFIED"]);
    const bundleRoot=path.join(output,manifest.primaryHostBundleCandidatePackageRoot);
    assert.deepEqual(fs.readdirSync(bundleRoot).sort(),["AchievementModule.primary-host-bundle-candidate-receipt.json",
        "AchievementModule.primary-host-bundle.mjs"]);
    const bundleReceiptBytes=fs.readFileSync(path.join(bundleRoot,"AchievementModule.primary-host-bundle-candidate-receipt.json"));
    const bundleReceipt=JSON.parse(bundleReceiptBytes);
    assert.equal(bundleReceipt.schema,"ap-original-achievement-primary-host-bundle-candidate-receipt@1");
    assert.equal(bundleReceipt.status,"held");
    assert.deepEqual(bundleReceipt.holds.map(item=>item.code),["AP_ACHIEVEMENT_PRIMARY_HOST_BROWSER_EXECUTION_UNVERIFIED"]);
    assert.deepEqual(bundleReceipt.dependencies,[]);
    assert.equal(bundleReceipt.exportName,"createAchievementPrimarySecondaryLinkage");
    assert.deepEqual(bundleReceipt.sourceHostCandidate,hostReceipt.output);
    assert.deepEqual(bundleReceipt.sourceHostCandidateReceipt,manifest.primarySecondaryHostCandidateReceipt);
    assert.deepEqual(bundleReceipt.primaryAuthority,request.primaryAuthority);
    assert.deepEqual(bundleReceipt.primaryRuntime,hostReceipt.primaryRuntime);
    assert.deepEqual(bundleReceipt.embeddedInputClosure.map(item=>item.path),bundleReceipt.embeddedFactoryClosure.map(item=>item.path));
    assert.ok(bundleReceipt.embeddedFactoryCycles.some(component=>component.length===6),"actual primary runtime SCC must be inventoried");
    const embeddedPaths=new Set(bundleReceipt.embeddedInputClosure.map(item=>item.path));
    assert.ok(embeddedPaths.has("achievement-primary-host/AchievementModule.primary-host.mjs"));
    for(const secondaryPath of relativePaths.map(value=>`achievement-primary-runtime/application/${value.replace(/\.as$/,".mjs")}`))
        assert.equal(embeddedPaths.has(secondaryPath),false,"bundle must not embed a secondary application module");
    const bundleSource=fs.readFileSync(path.join(bundleRoot,"AchievementModule.primary-host-bundle.mjs"),"utf8");
    assertImportFreeFactory(bundleSource);
    assert.doesNotMatch(bundleSource,/`/,"AP javascript lexer forbids template-literal tokens");
    assert.equal((bundleSource.match(/^export /gm)||[]).length,1);
    assert.equal(bundleReceipt.output.bytes,Buffer.byteLength(bundleSource));assert.equal(bundleReceipt.output.sha256,sha256(bundleSource));
    assert.equal(sha256(bundleReceiptBytes),manifest.primaryHostBundleCandidateReceipt.sha256);
    const hostNamespace=await import(pathToFileURL(path.join(bundleRoot,"AchievementModule.primary-host-bundle.mjs")).href+`?${crypto.randomUUID()}`);
    assert.deepEqual(Object.keys(hostNamespace),["createAchievementPrimarySecondaryLinkage"]);
    const primary=hostNamespace.createAchievementPrimarySecondaryLinkage();
    assert.throws(()=>hostNamespace.createAchievementPrimarySecondaryLinkage(),/already consumed/);
    const expectedPlan={schema:"as3-secondary-type-authority-plan@1",sourceClosureSha256:receipt.sourceClosure.sha256,
        provider:receipt.provider,primaryAuthority:request.primaryAuthority,secondaryTypeAuthoritySha256:receipt.secondaryTypeAuthoritySha256,qnames};
    assert.throws(()=>primary.resolveDefinition("mx.core.Missing"),/outside the authenticated literal resolver/);
    const UIComponent=primary.resolveDefinition("mx.core.UIComponent");
    assert.equal(typeof UIComponent,"function");assert.throws(()=>primary.resolveDefinition.call({},"mx.core.UIComponent"),/outside the authenticated literal resolver/);
    assert.throws(()=>primary.resolveRuntimeModule.call({},evidence.externalRuntimeImports[0]),/outside the authenticated literal resolver/);
    const primaryRuntimeModule=primary.resolveRuntimeModule(evidence.externalRuntimeImports[0]);
    assert.equal(Object.isFrozen(primaryRuntimeModule),true);assert.throws(()=>{primaryRuntimeModule.syntheticMutation=true;},TypeError);
    const typeRuntime=primary.resolveRuntimeModule("@test/as3-runtime/AS3Type"),uiType=typeRuntime.as3ClassType("mx.core.UIComponent",UIComponent);
    assert.deepEqual([...typeRuntime.as3ReferenceValues(new Set([null]),uiType)],[null]);
    assert.deepEqual([...typeRuntime.as3ReferenceValues(new Map([["value",null]]).values(),uiType)],[null]);
    const loaded=await import(pathToFileURL(path.join(packageRoot,"AchievementModule.secondary-linker.mjs")).href+`?${crypto.randomUUID()}`),linked=loaded.linkAS3SecondaryAuthority(primary);
    assert.deepEqual(linked.definitions.map(row=>row.qname),qnames);assert.deepEqual(expectedPlan,{schema:"as3-secondary-type-authority-plan@1",
        sourceClosureSha256:receipt.sourceClosure.sha256,provider:receipt.provider,primaryAuthority:request.primaryAuthority,
        secondaryTypeAuthoritySha256:receipt.secondaryTypeAuthoritySha256,qnames});
    let lateReservationAborts=0,lateTransactionAborts=0;
    const lateRuntime=new Proxy(Object.create(null),{get(_target,key){if(key==="as3InitializeClass")return ctor=>ctor;return ()=>undefined;}});
    const latePrimary={...primary,resolveDefinition(){return UIComponent;},resolveRuntimeModule(){return lateRuntime;},beginSecondaryAuthority(plan){return {
        schema:"as3-secondary-type-authority-transaction@1",primaryAuthoritySha256:plan.primaryAuthority.typeAuthoritySha256,
        secondaryTypeAuthoritySha256:plan.secondaryTypeAuthoritySha256,qnames:plan.qnames,active:true,
        preflight(){return {schema:"as3-secondary-type-authority-reservation@1",primaryAuthoritySha256:plan.primaryAuthority.typeAuthoritySha256,
            secondaryTypeAuthoritySha256:plan.secondaryTypeAuthoritySha256,qnames:plan.qnames,active:true,commit(){throw new Error("commit must not run");},
            abort(){lateReservationAborts++;}};},abort(){lateTransactionAborts++;}};}};
    const originalFreeze=Object.freeze;Object.freeze=value=>{
        if(value?.schema==="ap-original-achievement-linked-authority@1")throw new Error("synthetic post-preflight failure");
        return originalFreeze(value);
    };
    try {assert.throws(()=>loaded.linkAS3SecondaryAuthority(latePrimary),/synthetic post-preflight failure/);}
    finally {Object.freeze=originalFreeze;}
    assert.equal(lateReservationAborts,1);assert.equal(lateTransactionAborts,0);
    assert.throws(()=>primary.beginSecondaryAuthority(expectedPlan),/only once/);
    assert.throws(()=>linked.typeReservation.commit.call({...linked.typeReservation}),/active owned identity/);
    const lease=linked.typeReservation.commit();assert.equal(linked.typeReservation.active,false);
    lease.seal();
    assert.throws(()=>lease.seal.call({...lease}),/cannot seal in this state/);
    linked.definitions.forEach(row=>row.initialize());
    const command=new linked.definitions[1].definition(),proxy=command.makeProxy();
    assert.ok(proxy instanceof linked.definitions[4].definition,"forward application imports resolve through live definition cells after evaluation");
    let rolledBack=0,definitionsSeen=0;
    const failingRuntime=new Proxy(Object.create(null),{get(_target,key){if(key==="as3DefineClassInitialization")return ()=>{
        definitionsSeen++;if(definitionsSeen===3)throw new Error("synthetic definition failure");};return ()=>undefined;}});
    const failingPrimary={...primary,resolveDefinition(){return class UIComponent{};},resolveRuntimeModule(){return failingRuntime;},
        beginSecondaryAuthority(plan){return {schema:"as3-secondary-type-authority-transaction@1",primaryAuthoritySha256:plan.primaryAuthority.typeAuthoritySha256,
            secondaryTypeAuthoritySha256:plan.secondaryTypeAuthoritySha256,qnames:plan.qnames,active:true,
            preflight(){throw new Error("preflight must not run");},abort(){rolledBack++;}};}};
    assert.throws(()=>loaded.linkAS3SecondaryAuthority(failingPrimary),/synthetic definition failure/);assert.equal(rolledBack,1);
});

test("v2 browser emission fails closed on source identity drift and non-v2 closure",t=>{
    {const state=fixture(t),authority=profile(state),{result}=invoke(state,authority,"source-drift",({request})=>{request.executable.sources[2].sha256="f".repeat(64);});
        assert.equal(result.status,6,result.stderr);assert.match(result.stderr,/executable source identity is invalid|executable sources differ/);}
    {const state=fixture(t),authority=profile(state);state.closure.schema="as3-authenticated-source-closure@1";state.closure.roots.forEach(root=>delete root.includes);
        const {result}=invoke(state,authority,"v1-closure");assert.equal(result.status,6,result.stderr);assert.match(result.stderr,/exact authenticated v2 source closure/);}
    {const state=fixture(t),authority=profile(state),{result}=invoke(state,authority,"export-order",({request})=>request.exports.reverse());
        assert.equal(result.status,6,result.stderr);assert.match(result.stderr,/must be AchievementModule then/);}
    {const state=fixture(t),authority=profile(state),{result}=invoke(state,authority,"primary-type-drift",({request})=>{
        request.primaryAuthority.typeAuthoritySha256="f".repeat(64);});
        assert.equal(result.status,6,result.stderr);assert.match(result.stderr,/primary type authority differs from the emitted sealed registry/);}
});
