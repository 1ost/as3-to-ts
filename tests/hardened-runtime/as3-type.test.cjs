"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = fs.mkdtempSync(path.join(os.tmpdir(), "as3-type-runtime-"));
const CONFIG = path.join(OUTPUT, "tsconfig.json");
fs.writeFileSync(CONFIG, JSON.stringify({
    compilerOptions: { target: "ES2022", module: "CommonJS", moduleResolution: "Node", strict: true,
        skipLibCheck: true, rootDir: path.join(ROOT, "src"), outDir: OUTPUT },
    files: [path.join(ROOT, "src/hardened-runtime/AS3Type.ts"),
        path.join(ROOT, "src/hardened-runtime/AS3MethodClosure.ts")],
}), "utf8");
childProcess.execFileSync(process.execPath,
    [path.join(ROOT, "node_modules/typescript-4-9/bin/tsc"), "-p", CONFIG], { cwd: ROOT, stdio: "inherit" });
const runtime = require(path.join(OUTPUT, "hardened-runtime/AS3Type.js"));
const internal = require(path.join(OUTPUT, "hardened-runtime/internal/AS3TypeRegistry.js"));
const { as3BindMethod } = require(path.join(OUTPUT, "hardened-runtime/AS3MethodClosure.js"));
const { AS3Types, as3As, as3Cast, as3ClassType, as3InterfaceType, as3Is } = runtime;

const baseBrands = new WeakSet();
class Base { constructor() { baseBrands.add(this); } }
const childBrands = new WeakSet();
class Child extends Base { constructor() { super(); childBrands.add(this); } }
const eventBrands = new WeakSet();
class Event { constructor() { eventBrands.add(this); } }
const spriteBrands = new WeakSet();
class Sprite { constructor() { spriteBrands.add(this); } }
const textBrands = new WeakSet();
class TextField { constructor() { textBrands.add(this); } }

function authority(entries) {
    const qnames = entries.map(entry => entry.qname);
    const metadata = { schema: "as3-runtime-type-authority@1", qnames,
        entries: entries.map(entry => entry.kind === "interface"
            ? { kind: entry.kind, qname: entry.qname, bases: entry.bases }
            : { kind: entry.kind, qname: entry.qname, base: entry.base, interfaces: entry.interfaces,
                sourceSha256: entry.sourceSha256, fields:entry.fields, ...(entry.objectTraits ? {objectTraits:entry.objectTraits} : {}) }) };
    return { schema: metadata.schema, sha256: crypto.createHash("sha256").update(JSON.stringify(metadata)).digest("hex"),
        qnames, entries };
}

test.after(() => fs.rmSync(OUTPUT, { recursive: true, force: true }));

test("public facade exposes no registrar and lookup fails before the sealed authority", () => {
    assert.equal(runtime.as3RegisterClass, undefined);
    assert.equal(runtime.as3DefineInterface, undefined);
    assert.equal(runtime.as3AdmitClass, undefined);
    assert.equal(runtime.createTypeToken, undefined);
    assert.throws(() => as3ClassType("test.Base", Base), /authority is not sealed/);
    assert.throws(() => as3InterfaceType("test.IRunnable"), /authority is not sealed/);
});

test("one hash-pinned, ordered authority installs every identity exactly once", () => {
    internal.installAS3TypeAuthority(authority([
        { kind: "interface", qname: "test.IEventSource", bases: [] },
        { kind: "interface", qname: "test.IRunnable", bases: ["test.IEventSource"] },
        { kind: "class", qname: "test.Base", base: null, interfaces: ["test.IRunnable"], sourceSha256: "a".repeat(64),
            fields:[], objectTraits:{dynamic:false,members:[
                {name:"secret",kind:"field",type:"String",visibility:"private",namespaceName:null},
                {name:"shared",kind:"field",type:"int",visibility:"public",namespaceName:null}]}, constructor: Base, predicate: value => baseBrands.has(value), constructionTarget:null, constructionProof:null },
        { kind: "class", qname: "test.Child", base: "test.Base", interfaces: [], sourceSha256: "b".repeat(64),
            fields:[], objectTraits:{dynamic:false,members:[
                {name:"secret",kind:"field",type:"int",visibility:"private",namespaceName:null}]}, constructor: Child, predicate: value => childBrands.has(value), constructionTarget:null, constructionProof:null },
        { kind: "class", qname: "flash.events.Event", base: null, interfaces: [], sourceSha256: "c".repeat(64),
            fields:[], constructor: Event, predicate: value => eventBrands.has(value), constructionTarget:null, constructionProof:null },
        { kind: "class", qname: "flash.display.Sprite", base: null, interfaces: [], sourceSha256: "d".repeat(64),
            fields:[], constructor: Sprite, predicate: value => spriteBrands.has(value), constructionTarget:null, constructionProof:null },
        { kind: "class", qname: "flash.text.TextField", base: null, interfaces: [], sourceSha256: "e".repeat(64),
            fields:[], constructor: TextField, predicate: value => textBrands.has(value), constructionTarget:null, constructionProof:null },
    ]));
    assert.match(internal.authorityStatus().sha256, /^[0-9a-f]{64}$/);
    assert.throws(() => internal.installAS3TypeAuthority(authority([])), /already installing or sealed/);
});

test("primitive, class, interface, mapped bridge, and hostile proxy semantics are nominal", () => {
    assert.equal(as3Is(1, AS3Types.int), true);
    assert.equal(as3Is(0xffffffff, AS3Types.int), false);
    assert.equal(as3Is(0xffffffff, AS3Types.uint), true);
    assert.equal(as3Is(1.5, AS3Types.Number), true);
    assert.equal(as3As(1, AS3Types.int),1);
    assert.equal(as3As(0x80000000, AS3Types.int),null);
    assert.equal(as3As(0xffffffff, AS3Types.uint),0xffffffff);
    assert.equal(as3As(-1, AS3Types.uint),null);
    assert.equal(as3As(Number.NaN, AS3Types.Number),Number.NaN);
    assert.equal(as3As("1", AS3Types.Number),null);
    assert.equal(as3As(false, AS3Types.Boolean),false);
    assert.equal(as3As(0, AS3Types.Boolean),null);
    assert.equal(as3Is(1, AS3Types.int),true); assert.equal(as3Is(1.5, AS3Types.int),false);
    assert.equal(as3Is(0xffffffff, AS3Types.uint),true); assert.equal(as3Is(-1, AS3Types.uint),false);
    assert.equal(as3Is(Number.NaN, AS3Types.Number),true); assert.equal(as3Is("1", AS3Types.Number),false);
    assert.equal(as3Is(true, AS3Types.Boolean),true); assert.equal(as3Is(1, AS3Types.Boolean),false);
    assert.equal(as3Is(null, AS3Types.Object), false);
    const child = new Child();
    assert.equal(as3As(child, as3ClassType("test.Base", Base)), child);
    assert.equal(as3Is(child, as3InterfaceType("test.IRunnable")), true);
    assert.equal(as3Is(child, as3InterfaceType("test.IEventSource")), true);
    assert.equal(as3As({}, as3ClassType("test.Base", Base)), null);
    let traps = 0;
    const hostile = new Proxy({}, { getPrototypeOf() { traps += 1; return hostile; } });
    assert.equal(as3Is(hostile, as3ClassType("test.Base", Base)), false);
    assert.equal(traps, 0);
    assert.equal(as3Is(new Event(), as3ClassType("flash.events.Event", Event)), true);
    assert.equal(as3Is(new Sprite(), as3ClassType("flash.display.Sprite", Sprite)), true);
    assert.equal(as3Is(new TextField(), as3ClassType("flash.text.TextField", TextField)), true);
    assert.equal(as3Is(new Proxy(new Event(), {}), as3ClassType("flash.events.Event", Event)), false);
});

test("Class and Function are disjoint and forged tokens fail closed", () => {
    function ordinary() {}
    assert.equal(as3Is(Base, AS3Types.Class), true);
    assert.equal(as3Is(Base, AS3Types.Function), false);
    assert.equal(as3Is(ordinary, AS3Types.Class), false);
    assert.equal(as3Is(ordinary, AS3Types.Function), true);
    assert.equal(as3Is(as3InterfaceType("test.IRunnable"), AS3Types.Class), true);
    assert.throws(() => as3Is({}, Object.freeze({ name: "forged" })), /authenticated token/);
});

test("reference casts preserve identity, normalize nullish values and reject without hooks", () => {
    const value = new Child();
    const type = as3ClassType("test.Base", Base);
    assert.equal(as3Cast(value, type), value);
    assert.equal(as3Cast(value, as3InterfaceType("test.IEventSource")), value);
    assert.equal(as3Cast(undefined, type), null);
    assert.equal(as3Cast(null, type), null);
    let conversions = 0;
    const fake = { valueOf() { conversions++; return value; }, toString() { conversions++; return "Base"; } };
    for (const input of [fake, {}, 1, "Base", Object.create(Base.prototype)])
        assert.throws(() => as3Cast(input, type), error => error instanceof TypeError && error.errorID === 1034);
    assert.equal(conversions, 0);
    assert.throws(() => as3Cast(null, {name:"test.Base"}), /authenticated token/);
    assert.throws(() => as3Cast(1, AS3Types.int), /wrong token kind/);
});

test("standalone method closure cache is shared and idempotent across base and derived constructors", () => {
    class MethodBase {
        constructor() { this.onTick = as3BindMethod(this, this.onTick); this.baseCallback = this.onTick; }
        onTick() { return "base"; }
    }
    class MethodChild extends MethodBase {
        constructor() { super(); this.onTick = as3BindMethod(this, this.onTick); this.childCallback = this.onTick; }
        onTick() { return "child"; }
    }
    const value = new MethodChild();
    assert.equal(value.baseCallback, value.childCallback);
    assert.equal(value.onTick, value.baseCallback);
    assert.equal(value.onTick(), "child");
    assert.notEqual(new MethodChild().onTick, value.onTick);
});

test("malformed, duplicate, cyclic, drifted and preempting authority documents fail closed in fresh realms", () => {
    const script = `
      const crypto=require('node:crypto'); const i=require(${JSON.stringify(path.join(OUTPUT, "hardened-runtime/internal/AS3TypeRegistry.js"))});
      class A{} class B{}; const rows=JSON.parse(process.argv[1]);
      const entries=rows.map((r,n)=>r.kind==='interface'?{kind:r.kind,qname:r.qname,bases:r.bases}:{kind:r.kind,qname:r.qname,base:r.base,interfaces:r.interfaces,sourceSha256:'a'.repeat(64),fields:[],constructor:n?B:A,predicate:()=>false,constructionTarget:null,constructionProof:null});
      const qnames=entries.map(e=>e.qname); const metadata={schema:'as3-runtime-type-authority@1',qnames,entries:entries.map(e=>e.kind==='interface'?{kind:e.kind,qname:e.qname,bases:e.bases}:{kind:e.kind,qname:e.qname,base:e.base,interfaces:e.interfaces,sourceSha256:e.sourceSha256})};
      const document={schema:metadata.schema,sha256:crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),qnames,entries};
      try{i.installAS3TypeAuthority(document);process.exitCode=2}catch(e){process.exitCode=0}`;
    const cases = [
        [{ kind: "interface", qname: "I", bases: ["I"] }],
        [{ kind: "interface", qname: "I", bases: [] }, { kind: "interface", qname: "I", bases: [] }],
        [{ kind: "class", qname: "C", base: "Missing", interfaces: [] }],
    ];
    for (const rows of cases) {
        const result = childProcess.spawnSync(process.execPath, ["-e", script, JSON.stringify(rows)], { encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
    }
});


test("Object trait authority preserves declaring class and namespace without trusting JS properties", () => {
    const value = new Child();
    value.constructor = Base;
    value.forged = "not a source trait";
    const info = internal.lookupObjectClass(value);
    assert.equal(info.qname, "test.Child");
    assert.equal(info.constructor, Child);
    assert.deepEqual(info.chain.map(item => item.qname), ["test.Child", "test.Base"]);
    assert.deepEqual(info.chain.map(item => item.traits.members.filter(m => m.name === "secret").map(m => [m.type,m.visibility])),
        [[["int","private"]], [["String","private"]]]);
    assert.equal(info.chain.some(item => item.traits.members.some(m => m.name === "forged")), false);
    assert.equal(Object.isFrozen(info.chain[0].traits.members[0]), true);
    assert.equal(internal.lookupObjectClass(Object.create(Child.prototype)), null);
    assert.equal(internal.lookupObjectClass({constructor:Child}), null);
    assert.equal(internal.lookupObjectClass(new Event()).chain[0].traits, null,
        "Mapped classes without trait authority must remain explicitly unresolved");
});


test("namespace metadata cannot drift, widen after installation, or install invalid visibility", () => {
    const script = `
      const assert=require('node:assert/strict'),crypto=require('node:crypto');
      const i=require(${JSON.stringify(path.join(OUTPUT,"hardened-runtime/internal/AS3TypeRegistry.js"))});
      const brands=new WeakSet();class A {constructor(){brands.add(this)}}
      const traits={dynamic:false,members:[{name:'secret',kind:'field',type:'String',visibility:'private',namespaceName:null}]};
      const row={kind:'class',qname:'A',base:null,interfaces:[],sourceSha256:'a'.repeat(64),fields:[],objectTraits:traits};
      const metadata={schema:'as3-runtime-type-authority@1',qnames:['A'],entries:[row]};
      const mode=process.argv[1];if(mode==='invalid')traits.members[0].visibility='friend';
      const digest=crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex');
      if(mode==='drift')traits.members[0].visibility='public';
      const document={schema:metadata.schema,sha256:digest,qnames:metadata.qnames,entries:[{...row,constructor:A,predicate:v=>brands.has(v),constructionTarget:null,constructionProof:null}]};
      if(mode==='copy'){
        i.installAS3TypeAuthority(document);traits.members[0].visibility='public';
        assert.equal(i.lookupObjectClass(new A()).chain[0].traits.members[0].visibility,'private');
      }else{
        assert.throws(()=>i.installAS3TypeAuthority(document),mode==='drift'?/canonical SHA-256/:/Invalid AS3 Object member/);
        assert.equal(i.authorityStatus().sealed,false);
        assert.throws(()=>i.installAS3TypeAuthority(document),/already installing/);
      }`;
    for (const mode of ["drift","invalid","copy"]) {
        const result=childProcess.spawnSync(process.execPath,["-e",script,mode],{encoding:"utf8"});
        assert.equal(result.status,0,result.stderr);
    }
});

test("dynamic Class construction uses sealed identities and retains native non-constructor errors",()=>{
    const base=runtime.as3ConstructClass(Base,[]),child=runtime.as3ConstructClass(Child,[]);
    assert.equal(as3Is(base,as3ClassType("test.Base",Base)),true);
    assert.equal(as3Is(child,as3ClassType("test.Base",Base)),true);
    assert.notEqual(base,runtime.as3ConstructClass(Base,[]));
    for(const value of [null,undefined]) assert.throws(()=>runtime.as3ConstructClass(value,[]),{
        name:"TypeError",errorID:1007,message:"Error #1007: Instantiation attempted on a non-constructor."});
    assert.throws(()=>runtime.as3ConstructClass(class Forged {},[]),runtime.AS3ClassConstructionUnavailable);
    assert.throws(()=>runtime.as3ConstructClass(Object,[]),runtime.AS3ClassConstructionUnavailable);
    assert.throws(()=>runtime.as3ConstructClass(as3InterfaceType("test.IRunnable"),[]),{
        name:"VerifyError",errorID:1001,message:"Error #1001: The method test::IRunnable() is not implemented."});
});
test("constructor arity preserves qualified labels and actual argument counts",()=>{
    assert.throws(()=>runtime.as3RejectConstructorArity("test.Required",1,1,0),{
        name:"ArgumentError",errorID:1063,message:"Error #1063: Argument count mismatch on test::Required(). Expected 1, got 0."});
    assert.throws(()=>runtime.as3RejectConstructorArity("Required",1,1,2),{
        name:"ArgumentError",errorID:1063,message:"Error #1063: Argument count mismatch on Required(). Expected 1, got 2."});
});
