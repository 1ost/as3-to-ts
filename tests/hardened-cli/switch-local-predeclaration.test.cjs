"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
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
    fs.writeFileSync(path.join(check, "generated.ts"), typescript, "utf8");
    const declarations = [];
    for (const match of typescript.matchAll(/^import \{([^}]+)\} from "([^"]+)";/gm)) {
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

test("switch clauses share function-scoped local predeclarations without crossing lambdas", { skip:!AIR || !LAYA }, t => {
    const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "switch-local-predeclaration-")));
    t.after(() => fs.rmSync(temporary, { recursive:true, force:true }));
    const source = path.join(temporary, "source");
    const profile = path.join(temporary, "profile");
    const qualified = path.join(temporary, "qualified");
    const output = path.join(temporary, "output");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "SwitchLocalProbe.as"), `package { public class SwitchLocalProbe {
        public function direct(value:int):int {
            switch(value) {
                case 0: var selected:int = 7; break;
                default: selected = 9;
            }
            return selected;
        }
        public function nested(value:int, flag:Boolean):int {
            switch(value) {
                case 0:
                    if(flag) { var nestedLocal:int = 3; }
                    else { nestedLocal = 4; }
                    break;
                default: nestedLocal = 5;
            }
            return nestedLocal;
        }
        public function lambdaLocal(value:int):int {
            var callback:Function = function(input:int):int {
                switch(input) {
                    case 0: var lambdaValue:int = 11; break;
                    default: lambdaValue = 12;
                }
                return lambdaValue;
            };
            return callback(value);
        }
    } }
`, "utf8");
    fs.writeFileSync(path.join(source, "DuplicateSwitchLocal.as"), `package { public class DuplicateSwitchLocal {
        public function run(value:int):int {
            switch(value) {
                case 0: var repeated:int = 1; break;
                default: var repeated:int = 2;
            }
            return repeated;
        }
    } }
`, "utf8");
    fs.writeFileSync(path.join(source, "ParameterSwitchLocal.as"), `package { public class ParameterSwitchLocal {
        public function run(value:int):int {
            switch(value) { case 0: var value:int = 1; break; }
            return value;
        }
    } }
`, "utf8");
    fs.writeFileSync(path.join(source, "LambdaSwitchLeak.as"), `package { public class LambdaSwitchLeak {
        public function run():int {
            var callback:Function = function():void {
                switch(0) { case 0: var hidden:int = 1; break; }
            };
            return hidden;
        }
    } }
`, "utf8");

    const profileArgs = ["-B", "tools/create-fixture-profile.py", "--source", source,
        "--entry", "SwitchLocalProbe", "--air-sdk", AIR, "--laya", LAYA, "--output", profile];
    run("python3", profileArgs);
    const authorityArgs = ["--source-census", path.join(profile, "census.json"),
        "--target-capabilities", path.join(LAYA, "docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock", path.join(profile, "profile-lock.json")];
    run(process.execPath, ["bin/as3-frontend", "qualify", source, qualified, ...authorityArgs]);
    const rows = JSON.parse(fs.readFileSync(path.join(qualified, "manifest.json"), "utf8")).files;
    assert.equal(rows.find(row => row.sourcePath === "SwitchLocalProbe.as")?.status, "admitted");
    assert.equal(rows.find(row => row.sourcePath === "DuplicateSwitchLocal.as")?.code, "HARDENED_LOCAL_DUPLICATE");
    assert.equal(rows.find(row => row.sourcePath === "ParameterSwitchLocal.as")?.code, "HARDENED_LOCAL_PARAMETER_COLLISION");
    assert.equal(rows.find(row => row.sourcePath === "LambdaSwitchLeak.as")?.code, "HARDENED_IDENTIFIER_SCOPE");

    for (const name of ["DuplicateSwitchLocal.as", "ParameterSwitchLocal.as", "LambdaSwitchLeak.as"])
        fs.rmSync(path.join(source, name));
    fs.rmSync(profile, { recursive:true });
    run("python3", profileArgs);
    run(process.execPath, ["bin/as3-frontend", "transpile", source, output, ...authorityArgs]);
    const manifest = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
    const row = manifest.files.find(candidate => candidate.sourcePath === "SwitchLocalProbe.as");
    assert.equal(typeof row?.typescriptPath, "string", JSON.stringify(row));
    const typescript = fs.readFileSync(path.join(output, row.typescriptPath), "utf8");
    assert.match(typescript, /switch \(value\)/);
    assert.match(typescript, /var selected: number = __as3Int\(7\);/);
    assert.match(typescript, /if \(flag\) \{\s+var nestedLocal: number = __as3Int\(3\);/);
    assert.match(typescript, /var lambdaValue: number = __as3Int\(11\);/);
    typecheckGenerated(typescript, temporary);

    const { AS3_APPLICATION_MODULES } = require(path.join(output, "__as3_runtime/ApplicationEntry.generated.js"));
    const instance = new AS3_APPLICATION_MODULES[0].SwitchLocalProbe();
    assert.equal(instance.direct(0), 7);
    assert.equal(instance.direct(2), 9);
    assert.equal(instance.nested(0, true), 3);
    assert.equal(instance.nested(0, false), 4);
    assert.equal(instance.nested(2, true), 5);
    assert.equal(instance.lambdaLocal(0), 11);
    assert.equal(instance.lambdaLocal(2), 12);
});
