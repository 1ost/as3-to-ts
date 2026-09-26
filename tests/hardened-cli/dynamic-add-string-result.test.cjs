"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const AIR = process.env.HARDENED_FIXTURE_AIR_SDK;
const LAYA = process.env.HARDENED_FIXTURE_LAYA;

function run(command, args, timeout = 180_000) {
    const result = childProcess.spawnSync(command, args, { cwd:ROOT, encoding:"utf8", timeout });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return result;
}

function typecheckGenerated(typescript, directory) {
    const check = path.join(directory, "generated-typecheck");
    fs.mkdirSync(check);
    const runtimeSource = path.join(ROOT, "src/hardened-runtime/AS3Coerce.ts");
    const runtimeImport = path.relative(check, runtimeSource).replaceAll(path.sep, "/").replace(/\.ts$/, "");
    const source = typescript.replace('"@laya/as3-runtime/AS3Coerce"', JSON.stringify(runtimeImport));
    fs.writeFileSync(path.join(check, "generated.ts"), source, "utf8");
    const declarations = [];
    for (const match of source.matchAll(/^import \{([^}]+)\} from "(@laya\/as3-runtime\/[^"]+)";/gm)) {
        const names = match[1].split(",").map(item => item.trim().split(/\s+as\s+/)[0]);
        declarations.push(`declare module ${JSON.stringify(match[2])} {`);
        for (const name of names) declarations.push(name === "as3InitializeClass"
            ? "export function as3InitializeClass<T>(value:T, self:boolean):T;"
            : `export const ${name}:any;`);
        declarations.push("}");
    }
    fs.writeFileSync(path.join(check, "runtime-stubs.d.ts"), declarations.join("\n") + "\n", "utf8");
    const config = path.join(check, "tsconfig.json");
    fs.writeFileSync(config, JSON.stringify({ compilerOptions:{ target:"ES2022", module:"Node16",
        moduleResolution:"Node16", strict:true, skipLibCheck:true, noEmit:true },
        files:[path.join(check, "runtime-stubs.d.ts"), path.join(check, "generated.ts")] }), "utf8");
    run(process.execPath, [path.join(ROOT, "node_modules/typescript/bin/tsc"), "-p", config]);
}

test("as3Add String-result overloads remain narrow and preserve native conversion order", t => {
    const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "as3-add-string-result-")));
    t.after(() => fs.rmSync(temporary, { recursive:true, force:true }));
    const probe = path.join(temporary, "probe.ts");
    const runtimeSource = path.join(ROOT, "src/hardened-runtime/AS3Coerce.ts");
    const runtimeImport = path.relative(temporary, runtimeSource).replaceAll(path.sep, "/").replace(/\.ts$/, "");
    fs.writeFileSync(probe, `import { as3Add as __as3Add } from ${JSON.stringify(runtimeImport)};
export function exact(parserOwner:unknown, error:{message:unknown}):Error {
    return new Error(__as3Add(__as3Add(__as3Add("Failed to resolve static class '", parserOwner), "': "), error.message));
}
export function positive(left:string, right:string, value:unknown):[string,string] {
    return [__as3Add(left,value),__as3Add(value,right)];
}
export function negative(nullable:string|null, left:unknown, right:unknown):void {
    // @ts-expect-error nullable String does not prove a String addition result.
    const nullableResult:string=__as3Add(nullable,right);
    // @ts-expect-error no String operand does not prove a String addition result.
    const dynamicResult:string=__as3Add(left,right);
    void nullableResult;void dynamicResult;
}
`, "utf8");
    const output = path.join(temporary, "compiled");
    const config = path.join(temporary, "tsconfig.json");
    fs.writeFileSync(config, JSON.stringify({
        compilerOptions: {
            target:"ES2022", module:"Node16", moduleResolution:"Node16", strict:true,
            skipLibCheck:true, rootDir:path.parse(ROOT).root, outDir:output,
        },
        files:[probe],
    }), "utf8");
    run(process.execPath, [path.join(ROOT, "node_modules/typescript/bin/tsc"), "-p", config]);

    const runtimeJavaScript = path.join(output, path.relative(path.parse(ROOT).root, runtimeSource).replace(/\.ts$/, ".js"));
    const registryJavaScript = path.join(path.dirname(runtimeJavaScript), "internal/AS3TypeRegistry.js");
    const registry = require(registryJavaScript);
    class DynamicAddProbe {}
    const entry = { kind:"class", qname:"DynamicAddProbe", base:null, interfaces:[], sourceSha256:"a".repeat(64),
        fields:[], objectTraits:{dynamic:false,members:[]} };
    const metadata = { schema:"as3-runtime-type-authority@1", qnames:[entry.qname], entries:[entry] };
    registry.installAS3TypeAuthority({ schema:metadata.schema,
        sha256:crypto.createHash("sha256").update(JSON.stringify(metadata)).digest("hex"), qnames:metadata.qnames,
        entries:[{ ...entry, constructor:DynamicAddProbe, predicate:value => value instanceof DynamicAddProbe,
            constructionTarget:null, constructionProof:null }] });
    const { as3Add } = require(runtimeJavaScript);
    const events = [];
    const right = {
        valueOf() { events.push("right-valueOf"); return 7; },
        toString() { events.push("right-toString"); return "text"; },
    };
    assert.equal(as3Add((events.push("left-eval"), "prefix:"), (events.push("right-eval"), right)), "prefix:text");
    assert.deepEqual(events, ["left-eval", "right-eval", "right-toString"]);
    events.length = 0;
    const left = {
        valueOf() { events.push("left-valueOf"); return 7; },
        toString() { events.push("left-toString"); return "text"; },
    };
    assert.equal(as3Add((events.push("left-eval"), left), (events.push("right-eval"), ":suffix")), "7:suffix");
    assert.deepEqual(events, ["left-eval", "right-eval", "left-valueOf"]);
    const failure = new Error("conversion failed");
    events.length = 0;
    const throwing = { toString() { events.push("right-toString"); throw failure; } };
    assert.throws(() => as3Add((events.push("left-eval"), "prefix:"),
        (events.push("right-eval"), throwing)), error => error === failure);
    assert.deepEqual(events, ["left-eval", "right-eval", "right-toString"]);
});

test("authenticated dynamic addition proves only non-null String Error arguments", { skip:!AIR || !LAYA }, t => {
    const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "dynamic-add-error-")));
    t.after(() => fs.rmSync(temporary, { recursive:true, force:true }));
    const source = path.join(temporary, "source");
    const profile = path.join(temporary, "profile");
    const qualified = path.join(temporary, "qualified");
    const output = path.join(temporary, "output");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "DynamicAddStringResult.as"), String.raw`package { public class DynamicAddStringResult {
        public function exact(parserOwner:Object):Error {
            try { throw new Error("boom"); }
            catch(e:Error) { return new Error("Failed to resolve static class \'" + parserOwner + "\': " + e.message); }
            return new Error("unreachable");
        }
        public function left(value:Object):Error { return new Error("left:" + value); }
        public function right(value:Object):Error { return new Error(value + ":right"); }
    } }
`);
    fs.writeFileSync(path.join(source, "NullableStringResult.as"),
        'package { public class NullableStringResult { public function run(value:String, other:Object):Error { return new Error(value + other); } } }\n');
    fs.writeFileSync(path.join(source, "NoStringResult.as"),
        'package { public class NoStringResult { public function run(left:Object, right:Object):Error { return new Error(left + right); } } }\n');

    const profileArgs = ["-B", "tools/create-fixture-profile.py", "--source", source,
        "--entry", "DynamicAddStringResult", "--air-sdk", AIR, "--laya", LAYA, "--output", profile];
    run("python3", profileArgs);
    const authorityArgs = ["--source-census", path.join(profile, "census.json"),
        "--target-capabilities", path.join(LAYA, "docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock", path.join(profile, "profile-lock.json")];
    run(process.execPath, ["bin/as3-frontend", "qualify", source, qualified, ...authorityArgs]);
    const rows = JSON.parse(fs.readFileSync(path.join(qualified, "manifest.json"), "utf8")).files;
    assert.equal(rows.find(row => row.sourcePath === "DynamicAddStringResult.as")?.status, "admitted");
    for (const name of ["NullableStringResult.as", "NoStringResult.as"]) {
        const row = rows.find(candidate => candidate.sourcePath === name);
        assert.equal(row?.code, "HARDENED_ERROR_CONSTRUCTOR", JSON.stringify(row));
    }

    fs.rmSync(path.join(source, "NullableStringResult.as"));
    fs.rmSync(path.join(source, "NoStringResult.as"));
    fs.rmSync(profile, { recursive:true });
    run("python3", profileArgs);
    run(process.execPath, ["bin/as3-frontend", "transpile", source, output, ...authorityArgs]);
    const manifest = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
    const row = manifest.files.find(candidate => candidate.sourcePath === "DynamicAddStringResult.as");
    assert.equal(typeof row?.typescriptPath, "string", JSON.stringify(row));
    const typescript = fs.readFileSync(path.join(output, row.typescriptPath), "utf8");
    assert.match(typescript, /__as3Add\(__as3Add\("Failed to resolve static class '", parserOwner\) \+ "': ", e\.message\)/);
    assert.match(typescript, /__as3Add\("left:", value\)/);
    assert.match(typescript, /__as3Add\(value, ":right"\)/);
    typecheckGenerated(typescript, temporary);

    const { AS3_APPLICATION_MODULES } = require(path.join(output, "__as3_runtime/ApplicationEntry.generated.js"));
    const instance = new AS3_APPLICATION_MODULES[0].DynamicAddStringResult();
    assert.equal(instance.exact("ConfigOwner").message, "Failed to resolve static class 'ConfigOwner': boom");
    assert.equal(instance.left(7).message, "left:7");
    assert.equal(instance.right(7).message, "7:right");
});
