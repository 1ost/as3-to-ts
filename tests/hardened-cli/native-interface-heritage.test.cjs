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
const FFDEC = process.env.HARDENED_FIXTURE_FFDEC;

test("authenticated native interface tokens admit local extends and implements clauses",
    { skip: !(AIR && LAYA && FFDEC) }, t => {
        const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "native-interface-heritage-")));
        t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
        const source = path.join(temporary, "source");
        const profile = path.join(temporary, "profile");
        fs.mkdirSync(path.join(source, "fixture"), { recursive: true });
        fs.writeFileSync(path.join(source, "fixture/NativeChild.as"), `package fixture {
 import flash.events.IEventDispatcher;
 public interface NativeChild extends IEventDispatcher { function child():void; }
}\n`);
        fs.writeFileSync(path.join(source, "fixture/NativeInterfaceProbe.as"), `package fixture {
 import flash.events.Event;
 import flash.events.IEventDispatcher;
 public final class NativeInterfaceProbe implements IEventDispatcher {
  public function addEventListener(type:String, listener:Function, useCapture:Boolean=false,
   priority:int=0, useWeakReference:Boolean=false):void {}
  public function removeEventListener(type:String, listener:Function, useCapture:Boolean=false):void {}
  public function dispatchEvent(event:Event):Boolean { return true; }
  public function hasEventListener(type:String):Boolean { return false; }
  public function willTrigger(type:String):Boolean { return false; }
 }
}\n`);
        fs.writeFileSync(path.join(source, "fixture/NativeInterfaceCalls.as"), `package fixture {
 import flash.events.Event;
 import flash.events.IEventDispatcher;
 public final class NativeInterfaceCalls {
  public function run(value:IEventDispatcher, event:Event, listener:Function):Boolean {
   value.addEventListener("ready", listener, false, 1, false);
   value.removeEventListener("ready", listener, false);
   return value.dispatchEvent(event) || value.hasEventListener("ready") || value.willTrigger("ready");
  }
 }
}\n`);
        const run = (command, args, timeout = 120000) => {
            const result = childProcess.spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout });
            assert.equal(result.status, 0, result.stdout + result.stderr);
            return result;
        };
        run("python3", ["-B", "tools/create-fixture-profile.py", "--source", source,
            "--entry", "fixture.NativeInterfaceProbe", "--air-sdk", AIR, "--laya", LAYA,
            "--ffdec-jar", FFDEC, "--output", profile]);
        const output = path.join(temporary, "output");
        run(process.execPath, ["bin/as3-frontend", "transpile", source, output,
            "--source-census", path.join(profile, "census.json"), "--target-capabilities",
            path.join(LAYA, "docTool/architecture/authored-content-capabilities.json"),
            "--profile-lock", path.join(profile, "profile-lock.json")]);
        const manifest = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
        assert.deepEqual(manifest.files.map(row => [row.sourcePath, row.typescriptPath]), [
            ["fixture/NativeChild.as", "__as3_runtime/application/fixture/NativeChild.ts"],
            ["fixture/NativeInterfaceCalls.as", "__as3_runtime/application/fixture/NativeInterfaceCalls.ts"],
            ["fixture/NativeInterfaceProbe.as", "__as3_runtime/application/fixture/NativeInterfaceProbe.ts"],
        ]);
        const generated = path.join(output, "__as3_runtime/application/fixture");
        const calls = fs.readFileSync(path.join(generated, "NativeInterfaceCalls.ts"), "utf8");
        const child = fs.readFileSync(path.join(generated, "NativeChild.ts"), "utf8");
        const probe = fs.readFileSync(path.join(generated, "NativeInterfaceProbe.ts"), "utf8");
        assert.match(calls, /value!\.addEventListener\("ready", listener!, false, __as3Int\(1\), false\);/);
        assert.match(calls, /value!\.removeEventListener\("ready", listener!, false\);/);
        assert.match(calls, /value!\.dispatchEvent\(event!\)/);
        assert.match(calls, /value!\.hasEventListener\("ready"\)/);
        assert.match(calls, /value!\.willTrigger\("ready"\)/);
        assert.match(child, /import \{ IEventDispatcher \} from "laya\/flash\/events\/IEventDispatcher";/);
        assert.match(child, /export interface NativeChild extends IEventDispatcher/);
        assert.match(probe, /import \{ IEventDispatcher \} from "laya\/flash\/events\/IEventDispatcher";/);
        assert.match(probe, /export class NativeInterfaceProbe implements IEventDispatcher/);
    });
