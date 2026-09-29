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

function typecheckGenerated(output, manifest, directory) {
    const check = path.join(directory, "generated-typecheck");
    fs.mkdirSync(check);
    const modules = new Map();
    for (const row of manifest.files) {
        const typescript = fs.readFileSync(path.join(output, row.typescriptPath), "utf8");
        for (const match of typescript.matchAll(/^import \{([^}]+)\} from "([^".][^"]*)";/gm)) {
            const names = modules.get(match[2]) || new Set();
            for (const item of match[1].split(",")) names.add(item.trim().split(/\s+as\s+/)[0]);
            modules.set(match[2], names);
        }
    }
    const declarations = [];
    for (const [moduleName, names] of modules) {
        declarations.push(`declare module ${JSON.stringify(moduleName)} {`);
        for (const name of names) declarations.push(name === "as3InitializeClass"
            ? "export function as3InitializeClass<T>(value:T, self:boolean):T;"
            : `export const ${name}:any;`);
        declarations.push("}");
    }
    const stubs = path.join(check, "runtime-stubs.d.ts");
    fs.writeFileSync(stubs, declarations.join("\n") + "\n", "utf8");
    const config = path.join(check, "tsconfig.json");
    fs.writeFileSync(config, JSON.stringify({ compilerOptions:{ target:"ES2022", module:"Node16",
        moduleResolution:"Node16", strict:true, strictPropertyInitialization:false,
        skipLibCheck:true, allowJs:true, noEmit:true },
        files:[stubs, ...manifest.files.map(row => path.join(output, row.typescriptPath)),
            path.join(output, manifest.applicationEntryPath)] }), "utf8");
    run(process.execPath, [path.join(ROOT, "node_modules/typescript/bin/tsc"), "-p", config]);
}

test("terminal exhaustive switch proves non-void return paths without admitting fallthrough", { skip:!AIR || !LAYA }, t => {
    const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "exhaustive-switch-return-")));
    t.after(() => fs.rmSync(temporary, { recursive:true, force:true }));
    const source = path.join(temporary, "source");
    const profile = path.join(temporary, "profile");
    const qualified = path.join(temporary, "qualified");
    const output = path.join(temporary, "output");
    fs.mkdirSync(source);

    fs.writeFileSync(path.join(source, "SeakingEquipSlot.as"), `package { public class SeakingEquipSlot {} }`, "utf8");
    fs.writeFileSync(path.join(source, "SeaKingUnlockEquipment.as"), `package { public class SeaKingUnlockEquipment {
        public var slotAo:SeakingEquipSlot;
        public var slotYen:SeakingEquipSlot;
        public var slotNeck:SeakingEquipSlot;
        public var slotDai:SeakingEquipSlot;
        public var slotAoChoang:SeakingEquipSlot;
        public var slotHoThu:SeakingEquipSlot;
        public var slotXich:SeakingEquipSlot;
        public var slotHat:SeakingEquipSlot;
    } }`, "utf8");
    fs.writeFileSync(path.join(source, "ExhaustiveSwitchReturnProbe.as"), `package { public class ExhaustiveSwitchReturnProbe {
        public function exercise(arg1:SeaKingUnlockEquipment, arg2:int):SeakingEquipSlot {
            return this.automationSeaKingsEquippedSlot(arg1,arg2);
        }

        private function automationSeaKingsEquippedSlot(arg1:SeaKingUnlockEquipment, arg2:int) : SeakingEquipSlot
        {
            switch(arg2)
            {
                case 1:
                    return arg1.slotAo;
                case 2:
                    return arg1.slotYen;
                case 3:
                    return arg1.slotNeck;
                case 4:
                    return arg1.slotDai;
                case 5:
                    return arg1.slotAoChoang;
                case 6:
                    return arg1.slotHoThu;
                case 7:
                    return arg1.slotXich;
                case 8:
                    return arg1.slotHat;
                default:
                    return null;
            }
        }

        public function nested(value:int, flag:Boolean):int {
            switch(value) {
                case 0:
                    if(flag) { return 10; }
                    else { return 11; }
                default:
                    throw new Error("outside nested case");
            }
        }

        public function lambda(value:int):int {
            var callback:Function = function(input:int):int {
                switch(input) {
                    case 0: return 20;
                    default: return 21;
                }
            };
            return callback(value);
        }

        public function grouped(value:int):int {
            switch(value) {
                case 0:
                case 1:
                    return 30;
                case 2:
                case 3:
                    throw new Error("grouped throw");
                default:
                    return 31;
            }
        }
    } }
`, "utf8");

    const hostile = {
        "MissingDefault.as": `package { public class MissingDefault { public function run(value:int):int {
            switch(value) { case 0: return 1; case 1: throw new Error("one"); }
        } } }`,
        "EmptyTerminal.as": `package { public class EmptyTerminal { public function run(value:int):int {
            switch(value) { case 0: return 1; default: }
        } } }`,
        "StatementFallthrough.as": `package { public class StatementFallthrough { public function run(value:int):int {
            switch(value) { case 0: value = value + 1; case 1: return 1; default: return 2; }
        } } }`,
        "BreakClause.as": `package { public class BreakClause { public function run(value:int):int {
            switch(value) { case 0: break; default: return 2; }
        } } }`,
        "IncompleteIfClause.as": `package { public class IncompleteIfClause { public function run(value:int,flag:Boolean):int {
            switch(value) { case 0: if(flag) { return 1; } default: return 2; }
        } } }`,
        "LambdaDoesNotReturnOuter.as": `package { public class LambdaDoesNotReturnOuter { public function run():int {
            var callback:Function = function(value:int):int {
                switch(value) { case 0: return 1; default: return 2; }
            };
        } } }`,
    };
    for (const [name, text] of Object.entries(hostile)) fs.writeFileSync(path.join(source, name), text, "utf8");

    const profileArgs = ["-B", "tools/create-fixture-profile.py", "--source", source,
        "--entry", "ExhaustiveSwitchReturnProbe", "--air-sdk", AIR, "--laya", LAYA, "--output", profile];
    run("python3", profileArgs);
    const authorityArgs = ["--source-census", path.join(profile, "census.json"),
        "--target-capabilities", path.join(LAYA, "docTool/architecture/authored-content-capabilities.json"),
        "--profile-lock", path.join(profile, "profile-lock.json")];
    run(process.execPath, ["bin/as3-frontend", "qualify", source, qualified, ...authorityArgs]);
    const rows = JSON.parse(fs.readFileSync(path.join(qualified, "manifest.json"), "utf8")).files;
    assert.equal(rows.find(row => row.sourcePath === "ExhaustiveSwitchReturnProbe.as")?.status, "admitted");
    for (const name of Object.keys(hostile)) {
        const row = rows.find(candidate => candidate.sourcePath === name);
        assert.equal(row?.code, "HARDENED_RETURN_PATH", `${name}: ${JSON.stringify(row)}`);
    }

    for (const name of Object.keys(hostile)) fs.rmSync(path.join(source, name));
    fs.rmSync(profile, { recursive:true });
    run("python3", profileArgs);
    run(process.execPath, ["bin/as3-frontend", "transpile", source, output, ...authorityArgs]);
    const manifest = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
    const row = manifest.files.find(candidate => candidate.sourcePath === "ExhaustiveSwitchReturnProbe.as");
    assert.equal(typeof row?.typescriptPath, "string", JSON.stringify(row));
    const typescript = fs.readFileSync(path.join(output, row.typescriptPath), "utf8");
    assert.match(typescript, /automationSeaKingsEquippedSlot/);
    for (const [index, field] of ["slotAo", "slotYen", "slotNeck", "slotDai", "slotAoChoang", "slotHoThu", "slotXich", "slotHat"].entries())
        assert.match(typescript, new RegExp(`case ${index + 1}:\\s+return arg1!?\\.${field};`));
    assert.match(typescript, /default:\s+return null;/);
    assert.match(typescript, /if \(flag\) \{\s+return __as3Int\(10\);/);
    assert.match(typescript, /outside nested case/);
    typecheckGenerated(output, manifest, temporary);

    const modules = Object.assign({}, ...require(path.join(output,
        "__as3_runtime/ApplicationEntry.generated.js")).AS3_APPLICATION_MODULES);
    const Probe = modules.ExhaustiveSwitchReturnProbe;
    const Equipment = modules.SeaKingUnlockEquipment;
    const Slot = modules.SeakingEquipSlot;
    const instance = new Probe();
    const equipment = new Equipment();
    const fields = ["slotAo", "slotYen", "slotNeck", "slotDai", "slotAoChoang", "slotHoThu", "slotXich", "slotHat"];
    fields.forEach((field, index) => {
        equipment[field] = new Slot();
        assert.equal(instance.exercise(equipment, index + 1), equipment[field]);
    });
    assert.equal(instance.exercise(equipment, 0), null);
    assert.equal(instance.nested(0, true), 10);
    assert.equal(instance.nested(0, false), 11);
    assert.throws(() => instance.nested(1, true), /outside nested case/);
    assert.equal(instance.lambda(0), 20);
    assert.equal(instance.lambda(1), 21);
    assert.equal(instance.grouped(0), 30);
    assert.equal(instance.grouped(1), 30);
    assert.throws(() => instance.grouped(2), /grouped throw/);
    assert.throws(() => instance.grouped(3), /grouped throw/);
    assert.equal(instance.grouped(4), 31);
});
