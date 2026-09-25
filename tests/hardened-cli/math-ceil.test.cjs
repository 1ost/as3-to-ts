"use strict";

const assert=require("node:assert/strict");
const childProcess=require("node:child_process");
const crypto=require("node:crypto");
const fs=require("node:fs");
const Module=require("node:module");
const os=require("node:os");
const path=require("node:path");
const test=require("node:test");

const ROOT=path.resolve(__dirname,"../..");
const AIR=process.env.HARDENED_FIXTURE_AIR_SDK;
const LAYA=process.env.HARDENED_FIXTURE_LAYA;
const FFDEC=process.env.HARDENED_FIXTURE_FFDEC;
const LAYA_EVIDENCE_REVISION="d9d243925f17780eef0af9923fd958a268e9e875";
const sha256=value=>crypto.createHash("sha256").update(value).digest("hex");

function run(command,args,timeout=180000) {
    const result=childProcess.spawnSync(command,args,{cwd:ROOT,encoding:"utf8",timeout});
    assert.equal(result.status,0,result.stdout+result.stderr);
    return result;
}

function writeSource(directory,name,body) {
    fs.writeFileSync(path.join(directory,`${name}.as`),`package {public class ${name} {${body}}}\n`);
}

test("unary primitive Math.ceil is bound to retained AIR and Chromium bit evidence",
    {skip:!(AIR&&LAYA&&FFDEC)},t=>{
    const laya=fs.realpathSync(LAYA),fixture=path.join(laya,"tests/nativeFlashOracle/math-ceil-bits");
    const ancestor=childProcess.spawnSync("git",["merge-base","--is-ancestor",LAYA_EVIDENCE_REVISION,"HEAD"],
        {cwd:laya,encoding:"utf8"});
    assert.equal(ancestor.status,0,ancestor.stderr||"Math.ceil evidence revision is not retained");
    const evidence={
        "MathCeilBitsProbe.as":"37b88a08577ad8718ddf8c57a5c7ad176498e62b9e0aa9d89bc98b3b4edc6d59",
        "scenario.json":"fae64cba3a3cdf5f7ea51e716e23ba3b0939de4321bbd962c79ce47adf86daa8",
        "sdk-Math.as.txt":"e69deda3d6ddd2d6d3cf29aa3e98f6cf6c93cad0abf3a9b6f612c911e65b07fd",
        "native-air.json":"375778364772fbe61edc43dc746ec484ea6f36f27192486c344112b7c2de2be2",
        "browser-pin.json":"2bdcdebca03e073497a0e6e987d9091e54e1568a9b51004d02be50ff63cdb73a",
        "run-browser.mjs":"728e03aa69fa780246a7727acb36f59659ce6279c9e02ed55e119b064aaf572c",
        "browser-air.json":"0c0895594fc969fdda0dee0141b4442163a6720ff4ab3617b318c7170256867a",
    };
    for(const [name,expected] of Object.entries(evidence)) {
        assert.equal(sha256(childProcess.execFileSync("git",["show",`${LAYA_EVIDENCE_REVISION}:tests/nativeFlashOracle/math-ceil-bits/${name}`],{cwd:laya})),expected,`Git object ${name}`);
        assert.equal(sha256(fs.readFileSync(path.join(fixture,name))),expected,name);
    }
    const retained=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json"))),
        relation=JSON.parse(fs.readFileSync(path.join(fixture,"browser-air.json"))),
        scenario=JSON.parse(fs.readFileSync(path.join(fixture,"scenario.json")));
    assert.equal(retained.status,"passed");
    assert.equal(retained.capture.runtime.version,"MAC 51,3,3,2");
    assert.equal(retained.sdkDeclaration.signature,"public static native function ceil(param1:Number) : Number;");
    assert.equal(relation.status,"passed");
    assert.equal(relation.relation.ceilOutputBits,"equal");
    assert.equal(relation.relation.argumentEvaluationCount,"equal");
    assert.equal(relation.observations.length,scenario.steps.length);

    const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"math-ceil-cli-")));
    t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
    const source=path.join(temporary,"source"),profile=path.join(temporary,"profile");fs.mkdirSync(source);
    const probeBytes=fs.readFileSync(path.join(fixture,"MathCeilBitsProbe.as"));
    fs.writeFileSync(path.join(source,"MathCeilBitsProbe.as"),probeBytes);
    writeSource(source,"NumericCeil",[
        "public function numberValue(value:Number):Number {return Math.ceil(value);}",
        "public function intValue(value:int):Number {return Math.ceil(value);}",
        "public function uintValue(value:uint):Number {return Math.ceil(value);}",
    ].join(""));
    run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","MathCeilBitsProbe",
        "--air-sdk",AIR,"--laya",laya,"--ffdec-jar",FFDEC,"--output",profile,
        "--intrinsic-type","flash.utils.ByteArray"]);
    const compile=(operation,name)=>run(process.execPath,["bin/as3-frontend",operation,source,path.join(temporary,name),
        "--source-census",path.join(profile,"census.json"),"--target-capabilities",
        path.join(laya,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",
        path.join(profile,"profile-lock.json")]);
    const snapshots=[];
    for(const name of ["first","second"]) {
        compile("transpile",name);
        const output=path.join(temporary,name),manifest=JSON.parse(fs.readFileSync(path.join(output,"manifest.json"))),
            probeRow=manifest.files.find(row=>row.sourcePath==="MathCeilBitsProbe.as"),
            numericRow=manifest.files.find(row=>row.sourcePath==="NumericCeil.as");
        assert.equal(probeRow.sourceSha256,sha256(probeBytes));
        assert.ok(probeRow.typescriptPath&&numericRow.typescriptPath,JSON.stringify(manifest.files));
        const probeCode=fs.readFileSync(path.join(output,probeRow.typescriptPath),"utf8"),
            numericCode=fs.readFileSync(path.join(output,numericRow.typescriptPath),"utf8");
        assert.match(probeCode,/Math\.ceil\(this\.counted\(input\)\)/);
        assert.match(probeCode,/Math\.ceil\(\(remainder \+ incoming\) \/ maxStacking\)/);
        assert.doesNotMatch(probeCode,/__as3MathCeil/);
        assert.equal((numericCode.match(/Math\.ceil\(/g)||[]).length,3);
        snapshots.push([manifest.files,probeCode,numericCode]);

        const packageRoot=path.join(output,"__as3_runtime"),packageInfo=JSON.parse(fs.readFileSync(path.join(packageRoot,"package.json"))),
            files=[path.join(output,probeRow.typescriptPath),path.join(output,numericRow.typescriptPath)],
            tsconfig=path.join(output,"strict-tsconfig.json");
        fs.writeFileSync(tsconfig,JSON.stringify({compilerOptions:{target:"ES2020",module:"CommonJS",moduleResolution:"node",
            strict:true,skipLibCheck:true,noEmit:true,types:[],lib:["ES2020","DOM"],baseUrl:ROOT,
            paths:{[packageInfo.name+"/*"]:["src/hardened-runtime/*"],"@laya/as3-runtime/*":["src/hardened-runtime/*"]}},files}));
        run(process.execPath,[path.join(ROOT,"node_modules/typescript-4-9/bin/tsc"),"-p",tsconfig,"--pretty","false"]);

        const typescript=require("typescript-4-9"),entryPath=path.join(output,manifest.applicationEntryPath),
            entryCode=fs.readFileSync(entryPath,"utf8"),javascriptEntry=entryPath.replace(/\.ts$/,".js");
        for(const [typescriptPath,code] of [[path.join(output,probeRow.typescriptPath),probeCode],
            [path.join(output,numericRow.typescriptPath),numericCode],[entryPath,entryCode]])
            fs.writeFileSync(typescriptPath.replace(/\.ts$/,".js"),typescript.transpileModule(code,{compilerOptions:{
                target:typescript.ScriptTarget.ES2020,module:typescript.ModuleKind.CommonJS}}).outputText);
        const application=Module.createRequire(javascriptEntry)(javascriptEntry),
            exported=exportName=>application.AS3_APPLICATION_MODULES.find(module=>module[exportName])[exportName],
            probe=new (exported("MathCeilBitsProbe"))(),numeric=new (exported("NumericCeil"))();
        for(const [index,step] of scenario.steps.entries()) {
            for(const call of step.calls) probe[call.method](...call.args);
            assert.deepEqual(probe.result,retained.capture.state.observations[index].result,step.id);
        }
        assert.equal(1/numeric.numberValue(-.25),-Infinity);
        assert.equal(numeric.intValue(-2),-2);
        assert.equal(numeric.uintValue(2),2);
    }
    assert.deepEqual(snapshots[0],snapshots[1]);

    const hostiles={
        NoArgs:["","return Math.ceil();"],
        ExtraArgs:["","return Math.ceil(1,2);"],
        StringInput:["","return Math.ceil(\"1\");"],
        ObjectInput:["","return Math.ceil({});"],
        BooleanInput:["","return Math.ceil(true);"],
        DynamicInput:["value:*","return Math.ceil(value);"],
        MethodValue:["","var operation:Function=Math.ceil;return operation;"],
        OtherMethod:["","return Math.floor(1);"],
        ParameterMath:["Math:Object","return Math.ceil(1);"],
        FieldMath:["","return Math.ceil(1);", "public var Math:Object={};"],
    };
    for(const [name,[parameters,body,prefix=""]] of Object.entries(hostiles))
        writeSource(source,name,`${prefix}public function run(${parameters}):* {${body}}`);
    fs.mkdirSync(path.join(source,"foreign"));
    fs.writeFileSync(path.join(source,"foreign/Math.as"),"package foreign {public class Math {public static function ceil(value:Number):Number {return value;}}}\n");
    fs.writeFileSync(path.join(source,"ImportedMath.as"),"package {import foreign.Math; public class ImportedMath {public function run():* {return Math.ceil(1);}}}\n");
    fs.writeFileSync(path.join(source,"ReplaceMath.as"),"package {public class ReplaceMath {public function run(operation:Function):* {Math.ceil=operation;return Math.ceil(1);}}}\n");
    fs.rmSync(profile,{recursive:true,force:true});
    run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","MathCeilBitsProbe",
        "--air-sdk",AIR,"--laya",laya,"--ffdec-jar",FFDEC,"--output",profile,
        "--intrinsic-type","flash.utils.ByteArray"]);
    compile("qualify","hostile");
    const rows=JSON.parse(fs.readFileSync(path.join(temporary,"hostile/manifest.json"))).files;
    for(const name of [...Object.keys(hostiles),"ImportedMath","ReplaceMath"]) {
        const row=rows.find(item=>item.sourcePath===`${name}.as`);
        assert.equal(row?.status,"held",JSON.stringify(row));
        assert.ok(row.code?.startsWith("HARDENED_"),JSON.stringify(row));
    }
    for(const name of ["NoArgs","ExtraArgs"])
        assert.equal(rows.find(row=>row.sourcePath===`${name}.as`).code,"HARDENED_MATH_ARITY");
    for(const name of ["StringInput","ObjectInput","BooleanInput","DynamicInput"])
        assert.equal(rows.find(row=>row.sourcePath===`${name}.as`).code,"HARDENED_MATH_ARGUMENT");
    assert.equal(rows.find(row=>row.sourcePath==="MethodValue.as").code,"HARDENED_MATH_MEMBER");
    for(const name of ["ParameterMath","FieldMath","ImportedMath"])
        assert.equal(rows.find(row=>row.sourcePath===`${name}.as`).code,"HARDENED_MATH_SHADOW");
});
