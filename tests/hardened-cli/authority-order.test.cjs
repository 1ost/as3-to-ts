"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const OLD_TYPE_SHA = "fe557887a0ea87d4549536c0a3afd708ac4877583dbf22a4ff77f4e5655869bf";
const OLD_MEMBER_SHA = "663beb2c386797966f1acf8b5248eae41e2b0a4e12b0887ef0990a46c1416b36";

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function canonical(value) {
    if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}
function member(kind,name,{modifiers=["public"],fieldType=null,returnType=null,parameters=[]}={}) {
    return { fieldType,kind,modifiers,name,namespaceName:null,parameters,readonly:false,returnType };
}
function fixtureCli(t, files, declarations, prerequisites, mutateMemberMap=null) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "as3-authority-order-"));
    t.after(() => fs.rmSync(root,{recursive:true,force:true}));
    for (const directory of ["bin","config","lib","source"]) fs.mkdirSync(path.join(root,directory),{recursive:true});
    fs.cpSync(path.join(ROOT,"src","hardened-runtime"),path.join(root,"src","hardened-runtime"),{recursive:true});
    for (const name of ["authority-lock.json","capability-map.json","native-timer-authority.json","runtime-type-authority-lock.json","runtime-type-predicates.json"]) {
        fs.copyFileSync(path.join(ROOT,"config",name),path.join(root,"config",name));
    }
    for (const name of ["parser-worker.js","declaration-worker.js"]) {
        fs.copyFileSync(path.join(ROOT,"lib",name),path.join(root,"lib",name));
    }
    fs.copyFileSync(path.join(ROOT,"bin","as3-frontend"),path.join(root,"bin","as3-frontend"));
    const typeMap=JSON.parse(fs.readFileSync(path.join(ROOT,"config","local-type-map.json"),"utf8"));
    const memberMap=JSON.parse(fs.readFileSync(path.join(ROOT,"config","local-member-map.json"),"utf8"));
    const rows=[]; const memberRows=[]; let ordinal=0;
    for(const [relative,source] of Object.entries(files)) {
        const typeName=path.basename(relative,".as");
        const matches=Object.keys(declarations).filter(qname=>qname.endsWith(`.${typeName}`));
        assert.equal(matches.length,1,`fixture declaration identity for ${relative}`);
        const qname=matches[0]; const declaration=declarations[qname];
        const nodeId=sha256(qname).slice(0,16); const sourceContentSha256=sha256(source);
        rows.push({componentId:`scc-${String(99000+ordinal).padStart(5,"0")}`,graphSourceSha256:sha256(`graph:${qname}`),
            importable:true,module:"application",nodeId,prerequisites:(prerequisites[qname]||[]).map(name=>sha256(name).slice(0,16)).sort(),qname,
            sourceContentSha256,sourcePath:`game-client/tapplication_main/src/${relative}`,targetPath:`game-client/layaair/src/application/${relative.slice(0,-3)}.ts`,
            topologicalLevel:ordinal,typeKind:declaration.kind});
        memberRows.push({declaration:declaration.value,holdCode:null,holdSha256:null,module:"application",nodeId,qname,
            sourceContentSha256,status:"complete",typeKind:declaration.kind});
        fs.mkdirSync(path.dirname(path.join(root,"source",relative)),{recursive:true});
        fs.writeFileSync(path.join(root,"source",relative),source,"utf8"); ordinal+=1;
    }
    const compareIdentity=(a,b)=>{const left=`${a.module}\0${a.qname}`;const right=`${b.module}\0${b.qname}`;return left<right?-1:left>right?1:0;};
    typeMap.entries.push(...rows); typeMap.entries.sort(compareIdentity);
    typeMap.entryCount=typeMap.entries.length; const typeBytes=`${canonical(typeMap)}\n`; const typeSha=sha256(typeBytes);
    memberMap.entries.push(...memberRows); memberMap.entries.sort(compareIdentity);
    if(mutateMemberMap!==null)mutateMemberMap(memberMap);
    memberMap.entryCount=memberMap.entries.length;
    memberMap.completeCount=memberMap.entries.filter(entry=>entry.status==="complete").length;
    memberMap.heldCount=memberMap.entries.filter(entry=>entry.status==="held").length;
    memberMap.localTypeMapSha256=typeSha;
    const memberBytes=`${canonical(memberMap)}\n`; const memberSha=sha256(memberBytes);
    fs.writeFileSync(path.join(root,"config","local-type-map.json"),typeBytes,"utf8");
    fs.writeFileSync(path.join(root,"config","local-member-map.json"),memberBytes,"utf8");
    let command=fs.readFileSync(path.join(ROOT,"lib","command.js"),"utf8");
    command=command.replace(OLD_TYPE_SHA,typeSha).replace(OLD_MEMBER_SHA,memberSha)
        .replace("var COMPILED_LOCAL_TYPE_COUNT = 2923;",`var COMPILED_LOCAL_TYPE_COUNT = ${typeMap.entryCount};`)
        .replace("var COMPILED_LOCAL_MEMBER_COMPLETE_COUNT = 2884;",`var COMPILED_LOCAL_MEMBER_COMPLETE_COUNT = ${memberMap.completeCount};`)
        .replace("var COMPILED_LOCAL_MEMBER_HELD_COUNT = 39;",`var COMPILED_LOCAL_MEMBER_HELD_COUNT = ${memberMap.heldCount};`);
    fs.writeFileSync(path.join(root,"lib","command.js"),command,"utf8");
    return root;
}
function classDeclaration(name,members=[],baseQNames=[],includeConstructor=true) {
    return {kind:"class",value:{baseQNames,interfaceQNames:[],members:[...(includeConstructor?[member("constructor",name)]:[]),...members],packageInitializer:null}};
}
function interfaceDeclaration(name,members=[]) {
    return {kind:"interface",value:{baseQNames:[],interfaceQNames:[],members,packageInitializer:null}};
}
function packageDeclaration(name,typeName) {
    const field=member("field",name,{fieldType:typeName}); field.readonly=true;
    return {kind:"package",value:{baseQNames:[],interfaceQNames:[],members:[field],
        packageInitializer:{argumentCount:0,kind:"new",targetQName:typeName}}};
}
function invoke(root) {
    const census=process.env.HARDENED_SOURCE_CAPABILITY_CENSUS;
    const capabilities=process.env.HARDENED_TARGET_CAPABILITIES;
    assert.ok(census&&capabilities,"exact capability authorities are required");
    return childProcess.spawnSync(process.execPath,[path.join(root,"bin","as3-frontend"),"transpile",path.join(root,"source"),path.join(root,"out"),
        "--source-census",census,"--target-capabilities",capabilities],{cwd:root,encoding:"utf8",timeout:30_000,windowsHide:true});
}
function qualify(root) {
    const census=process.env.HARDENED_SOURCE_CAPABILITY_CENSUS;
    const capabilities=process.env.HARDENED_TARGET_CAPABILITIES;
    assert.ok(census&&capabilities,"exact capability authorities are required");
    return childProcess.spawnSync(process.execPath,[path.join(root,"bin","as3-frontend"),"qualify",path.join(root,"source"),path.join(root,"qualification"),
        "--source-census",census,"--target-capabilities",capabilities],{cwd:root,encoding:"utf8",timeout:30_000,windowsHide:true});
}
function createLayaPackage(packageRoot) {
    const root=path.join(packageRoot,"node_modules","laya");
    fs.mkdirSync(root,{recursive:true});
    fs.writeFileSync(path.join(root,"package.json"),'{"name":"laya","version":"0.0.0","type":"commonjs"}',"utf8");
    const authority=JSON.parse(fs.readFileSync(path.join(packageRoot,"..","..","config","runtime-type-predicates.json"),"utf8"));
    const byName=new Map(authority.types.map(row=>[row.sourceQName,row]));
    for(const row of authority.types){
        const relative=row.targetModule.slice("src/layaAir/".length,-3);const baseName=row.heritageClosure[0];
        const baseRow=baseName===undefined?null:byName.get(baseName);
        const base=baseRow===null?"":`const {${baseRow.constructorExport}}=require(${JSON.stringify(`laya/${baseRow.targetModule.slice("src/layaAir/".length,-3)}`)});`;
        const heritage=baseRow===null?"":` extends ${baseRow.constructorExport}`;const baseCall=baseRow===null?"":"super(...args);";
        const target=path.join(root,`${relative}.js`);fs.mkdirSync(path.dirname(target),{recursive:true});
        const reentry=row.sourceQName==="flash.display.Sprite"?"const hook=globalThis.__as3MappedBaseHook;if(typeof hook==='function')hook();":"";
        fs.writeFileSync(target,`${base}const brand=new WeakSet();class ${row.constructorExport}${heritage}{constructor(...args){${baseCall}brand.add(this);${reentry}}}function ${row.predicateExport}(value){return typeof value==='object'&&value!==null&&brand.has(value)}module.exports={${row.constructorExport},${row.predicateExport}};\n`,"utf8");
    }
}

test("CLI rejects direct class-package-singleton CommonJS evaluation cycle before authority emission",t=>{
    const files={
        "cycle/Base.as":"package cycle { import cycle.SCore; public class Base { public function Base() {} public function core():Base { return SCore; } } }\n",
        "cycle/SCore.as":"package cycle { public const SCore:Base = new Base(); }\n",
    };
    const root=fixtureCli(t,files,{"cycle.Base":classDeclaration("Base",[member("method","core",{returnType:"cycle.Base"})]),
        "cycle.SCore":packageDeclaration("SCore","cycle.Base")},{"cycle.Base":["cycle.SCore"],"cycle.SCore":["cycle.Base"]});
    const result=invoke(root);
    assert.equal(result.status,4); assert.match(result.stderr,/HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE/);
    assert.equal(fs.existsSync(path.join(root,"out")),false);
});

test("CLI rejects transitive singleton construction that would perform preseal Vector type lookup",t=>{
    const files={
        "cycle/Base.as":"package cycle { public class Base { private var values:Vector.<Base>; public function Base() { this.values = new Vector.<Base>(); } } }\n",
        "cycle/SCore.as":"package cycle { public const SCore:Base = new Base(); }\n",
        "cycle/Helper.as":"package cycle { import cycle.SCore; public class Helper { public function Helper() {} public function core():Base { return SCore; } } }\n",
        "cycle/Root.as":"package cycle { import cycle.Helper; public class Root { private var helper:Helper; public function Root() { this.helper = new Helper(); } } }\n",
    };
    const root=fixtureCli(t,files,{"cycle.Base":classDeclaration("Base",[member("field","values",{modifiers:["private"],fieldType:"Vector.<cycle.Base>"})]),
        "cycle.SCore":packageDeclaration("SCore","cycle.Base"),"cycle.Helper":classDeclaration("Helper",[member("method","core",{returnType:"cycle.Base"})]),
        "cycle.Root":classDeclaration("Root",[member("field","helper",{modifiers:["private"],fieldType:"cycle.Helper"})])},
    {"cycle.SCore":["cycle.Base"],"cycle.Helper":["cycle.Base","cycle.SCore"],"cycle.Root":["cycle.Helper"]});
    const result=invoke(root);
    assert.equal(result.status,4); assert.match(result.stderr,/HARDENED_TYPE_AUTHORITY_DEFINITION_CLOSURE/);
    assert.equal(fs.existsSync(path.join(root,"out")),false);
});

test("CLI chooses a safe root for mutual class imports before evaluating derived heritage",t=>{
    const files={
        "cycle/Base.as":"package cycle { import cycle.Derived; public class Base { public function Base() {} public function make():Derived { return new Derived(); } } }\n",
        "cycle/Derived.as":"package cycle { import cycle.Base; public class Derived extends Base { public function Derived() { super(); } } }\n",
    };
    const root=fixtureCli(t,files,{"cycle.Base":classDeclaration("Base",[member("method","make",{returnType:"cycle.Derived"})]),
        "cycle.Derived":classDeclaration("Derived",[],["cycle.Base"])},{"cycle.Base":["cycle.Derived"],"cycle.Derived":["cycle.Base"]});
    const result=invoke(root);
    assert.equal(result.status,0,result.stderr);const packageRoot=path.join(root,"out","__as3_runtime");createLayaPackage(packageRoot);
    const entry=require(path.join(packageRoot,"ApplicationEntry.generated.js"));
    const modules=Object.assign({},...entry.AS3_APPLICATION_MODULES);const base=new modules.Base();
    assert.ok(base.make() instanceof modules.Derived);
});

test("CLI excludes erased interface edges and loads the safe class root before derived heritage",t=>{
    const files={
        "cycle/AContract.as":"package cycle { import cycle.Derived; public interface AContract { function create():Derived; } }\n",
        "cycle/Base.as":"package cycle { import cycle.Derived; public class Base { public function Base() {} public function make():Derived { return new Derived(); } } }\n",
        "cycle/Derived.as":"package cycle { import cycle.AContract; import cycle.Base; public class Derived extends Base implements AContract { public function Derived() { super(); } public function create():Derived { return new Derived(); } } }\n",
    };
    const root=fixtureCli(t,files,{"cycle.AContract":interfaceDeclaration("AContract",[member("method","create",{returnType:"cycle.Derived"})]),
        "cycle.Base":classDeclaration("Base",[member("method","make",{returnType:"cycle.Derived"})]),
        "cycle.Derived":{kind:"class",value:{baseQNames:["cycle.Base"],interfaceQNames:["cycle.AContract"],members:[member("constructor","Derived"),member("method","create",{returnType:"cycle.Derived"})],packageInitializer:null}}},
    {"cycle.AContract":["cycle.Derived"],"cycle.Base":["cycle.Derived"],"cycle.Derived":["cycle.AContract","cycle.Base"]});
    const result=invoke(root);
    assert.equal(result.status,0,result.stderr);const packageRoot=path.join(root,"out","__as3_runtime");createLayaPackage(packageRoot);
    const entry=require(path.join(packageRoot,"ApplicationEntry.generated.js"));
    const modules=Object.assign({},...entry.AS3_APPLICATION_MODULES);const base=new modules.Base();const derived=new modules.Derived();
    assert.ok(base.make() instanceof modules.Derived);assert.ok(derived.create() instanceof modules.Derived);
});

test("generated construction proves pre-base nominal traits, exact field defaults, and rejects forged allocation paths",t=>{
    const files={
        "cycle/IDerived.as":"package cycle { public interface IDerived { function marker():int; } }\n",
        "cycle/Observer.as":"package cycle { public class Observer { public var calls:int; public var value:Object; public function Observer() {} public function record(value:Object):void { this.calls++; this.value = value; } } }\n",
        "cycle/Unrelated.as":"package cycle { public class Unrelated { } }\n",
        "cycle/Base.as":"package cycle { public class Base { public var sawDerived:Boolean; public var sawInterface:Boolean; public var sawUnrelated:Boolean; public function Base() { this.sawDerived = this is Derived; this.sawInterface = this is IDerived; this.sawUnrelated = this is Unrelated; } } }\n",
        "cycle/Mid.as":"package cycle { public class Mid extends Base { } }\n",
        "cycle/Derived.as":"package cycle { public class Derived extends Mid implements IDerived { public function marker():int { return 1; } } }\n",
        "cycle/ForgedBase.as":"package cycle { public class ForgedBase { public function ForgedBase(observer:Observer) { observer.record(this); } } }\n",
        "cycle/ForgedDerived.as":"package cycle { public class ForgedDerived extends ForgedBase { public function ForgedDerived(observer:Observer) { super(observer); } } }\n",
        "cycle/ExplodingBase.as":"package cycle { public class ExplodingBase { public function ExplodingBase(observer:Observer) { observer.record(this); throw \"base-boom\"; } } }\n",
        "cycle/ExplodingDerived.as":"package cycle { public class ExplodingDerived extends ExplodingBase { public function ExplodingDerived(observer:Observer) { super(observer); } } }\n",
        "cycle/LocalSprite.as":"package cycle { import flash.display.Sprite; public class LocalSprite extends Sprite { } }\n",
        "cycle/LocalA.as":"package cycle { import flash.display.Sprite; public class LocalA extends Sprite { public var value:int; } }\n",
        "cycle/LocalB.as":"package cycle { import flash.display.Sprite; public class LocalB extends Sprite { public var value:int; } }\n",
        "cycle/Throwing.as":"package cycle { public class Throwing extends ForgedBase implements IDerived { public function Throwing(observer:Observer) { super(observer); throw \"boom\"; } public function marker():int { return 2; } } }\n",
        "cycle/Defaults.as":"package cycle { public class Defaults { public var i:int; public var u:uint; public var n:Number; public var b:Boolean; public var s:String; public var o:Object; public var a:Array; public var c:Class; public var f:Function; public var v:Vector.<int>; public var self:Defaults; public var iface:IDerived; public var count:int; public var explicitValue:int = increment(); public var explicitNull:Object = null; public function Defaults() {} private function increment():int { this.count++; return 7; } } }\n",
    };
    const parameter={name:"observer",type:"cycle.Observer",optional:false,rest:false};
    const declarations={
        "cycle.IDerived":interfaceDeclaration("IDerived",[member("method","marker",{returnType:"int"})]),
        "cycle.Observer":classDeclaration("Observer",[member("field","calls",{fieldType:"int"}),member("field","value",{fieldType:"Object"}),
            member("method","record",{returnType:"void",parameters:[{name:"value",type:"Object",optional:false,rest:false}]})]),
        "cycle.Unrelated":classDeclaration("Unrelated",[],[],false),
        "cycle.Base":{kind:"class",value:{baseQNames:[],interfaceQNames:[],members:[member("field","sawDerived",{fieldType:"Boolean"}),
            member("field","sawInterface",{fieldType:"Boolean"}),member("field","sawUnrelated",{fieldType:"Boolean"}),
            member("constructor","Base")],packageInitializer:null}},
        "cycle.Mid":classDeclaration("Mid",[],["cycle.Base"],false),
        "cycle.Derived":{kind:"class",value:{baseQNames:["cycle.Mid"],interfaceQNames:["cycle.IDerived"],
            members:[member("method","marker",{returnType:"int"})],packageInitializer:null}},
        "cycle.ForgedBase":{kind:"class",value:{baseQNames:[],interfaceQNames:[],members:[member("constructor","ForgedBase",{parameters:[parameter]})],packageInitializer:null}},
        "cycle.ForgedDerived":{kind:"class",value:{baseQNames:["cycle.ForgedBase"],interfaceQNames:[],members:[member("constructor","ForgedDerived",{parameters:[parameter]})],packageInitializer:null}},
        "cycle.ExplodingBase":{kind:"class",value:{baseQNames:[],interfaceQNames:[],members:[member("constructor","ExplodingBase",{parameters:[parameter]})],packageInitializer:null}},
        "cycle.ExplodingDerived":{kind:"class",value:{baseQNames:["cycle.ExplodingBase"],interfaceQNames:[],members:[member("constructor","ExplodingDerived",{parameters:[parameter]})],packageInitializer:null}},
        "cycle.LocalSprite":classDeclaration("LocalSprite",[],["flash.display.Sprite"],false),
        "cycle.LocalA":classDeclaration("LocalA",[member("field","value",{fieldType:"int"})],["flash.display.Sprite"],false),
        "cycle.LocalB":classDeclaration("LocalB",[member("field","value",{fieldType:"int"})],["flash.display.Sprite"],false),
        "cycle.Throwing":{kind:"class",value:{baseQNames:["cycle.ForgedBase"],interfaceQNames:["cycle.IDerived"],
            members:[member("constructor","Throwing",{parameters:[parameter]}),member("method","marker",{returnType:"int"})],packageInitializer:null}},
        "cycle.Defaults":classDeclaration("Defaults",[
            ...[["i","int"],["u","uint"],["n","Number"],["b","Boolean"],["s","String"],["o","Object"],["a","Array"],["c","Class"],["f","Function"],["v","Vector.<int>"],["self","cycle.Defaults"],["iface","cycle.IDerived"],["count","int"],["explicitValue","int"],["explicitNull","Object"]].map(([name,fieldType])=>member("field",name,{fieldType})),
            member("method","increment",{modifiers:["private"],returnType:"int"})]),
    };
    const prerequisites={"cycle.Base":["cycle.Derived","cycle.IDerived","cycle.Observer","cycle.Unrelated"],
        "cycle.Mid":["cycle.Base"],"cycle.Derived":["cycle.IDerived","cycle.Mid"],
        "cycle.ForgedBase":["cycle.Observer"],"cycle.ForgedDerived":["cycle.ForgedBase","cycle.Observer"],
        "cycle.ExplodingBase":["cycle.Observer"],"cycle.ExplodingDerived":["cycle.ExplodingBase","cycle.Observer"],
        "cycle.Throwing":["cycle.ForgedBase","cycle.IDerived","cycle.Observer"],"cycle.Defaults":["cycle.IDerived"]};
    const root=fixtureCli(t,files,declarations,prerequisites);const result=invoke(root);
    assert.equal(result.status,0,result.stderr);const packageRoot=path.join(root,"out","__as3_runtime");createLayaPackage(packageRoot);
    const entry=require(path.join(packageRoot,"ApplicationEntry.generated.js"));const api=require(path.join(packageRoot,"AS3Authority.generated.js"));
    const modules=Object.assign({},...entry.AS3_APPLICATION_MODULES);const derived=new modules.Derived();
    assert.equal(derived.sawDerived,true);assert.equal(derived.sawInterface,true);assert.equal(derived.sawUnrelated,false);
    const defaults=new modules.Defaults();assert.equal(defaults.i,0);assert.equal(defaults.u,0);assert.equal(Number.isNaN(defaults.n),true);
    assert.equal(defaults.b,false);for(const name of ["s","o","a","c","f","v","self","iface","explicitNull"])assert.equal(defaults[name],null,name);
    assert.equal(defaults.count,1);assert.equal(defaults.explicitValue,7);
    const observer=new modules.Observer();assert.throws(()=>Reflect.construct(modules.ForgedBase,[observer],modules.ForgedDerived),/handoff|proof/);
    assert.equal(observer.calls,0);assert.equal(observer.value,null);
    assert.throws(()=>Reflect.construct(modules.Mid,[],modules.Derived),/handoff|proof/);
    class Evil extends modules.Derived{} assert.throws(()=>new Evil(),/proof|authenticated/);
    assert.equal(api.as3Is(Object.create(modules.Derived.prototype),api.as3ClassType("cycle.Derived",modules.Derived)),false);
    let traps=0;const hostile=new Proxy({}, {get(){traps+=1;throw new Error("trap");},getPrototypeOf(){traps+=1;throw new Error("trap");}});
    assert.equal(api.as3Is(hostile,api.as3ClassType("cycle.Derived",modules.Derived)),false);assert.equal(traps,0);
    const leaking=new modules.Observer();assert.throws(()=>new modules.Throwing(leaking),/boom/);assert.equal(leaking.calls,1);
    assert.equal(api.as3Is(leaking.value,api.as3ClassType("cycle.Base",modules.Base)),false);
    assert.equal(api.as3Is(leaking.value,api.as3InterfaceType("cycle.IDerived")),false);
    const exploding=new modules.Observer();assert.throws(()=>new modules.ExplodingDerived(exploding),error=>error==="base-boom");
    assert.equal(exploding.calls,1);assert.equal(api.as3Is(exploding.value,api.as3ClassType("cycle.ExplodingBase",modules.ExplodingBase)),false);
    assert.doesNotThrow(()=>new modules.Derived(),"a failed derived handoff cannot poison the next construction");
    const originalIterator=Array.prototype[Symbol.iterator];let iteratorCalls=0;
    Array.prototype[Symbol.iterator]=function(){iteratorCalls+=1;throw new Error("array iterator reentry");};
    let iteratorError=null;try{new modules.ForgedDerived(new modules.Observer());}catch(error){iteratorError=error;
    }finally{Array.prototype[Symbol.iterator]=originalIterator;}
    assert.equal(iteratorError,null);assert.equal(iteratorCalls,0);
    const localSprite=new modules.LocalSprite();const {Sprite}=require(path.join(packageRoot,"node_modules/laya/flash/display/Sprite.js"));
    assert.equal(api.as3Is(localSprite,api.as3ClassType("cycle.LocalSprite",modules.LocalSprite)),true);
    assert.equal(api.as3Is(localSprite,api.as3ClassType("flash.display.Sprite",Sprite)),true);
    let nestedA=null,nestedB=null,afterThrow=null;
    globalThis.__as3MappedBaseHook=()=>{globalThis.__as3MappedBaseHook=undefined;
        nestedB=new modules.LocalB();nestedA=new modules.LocalA();
        globalThis.__as3MappedBaseHook=()=>{throw "nested-mapped";};
        assert.throws(()=>new modules.LocalB(),error=>error==="nested-mapped");
        globalThis.__as3MappedBaseHook=undefined;afterThrow=new modules.LocalB();};
    let outerA;try{outerA=new modules.LocalA();}finally{delete globalThis.__as3MappedBaseHook;}
    for(const [value,name] of [[outerA,"outer"],[nestedA,"same-type nested"],[nestedB,"cross-type nested"],[afterThrow,"post-throw nested"]]){
        assert.equal(value.value,0,name);const Constructor=name.includes("cross")||name.includes("post")?modules.LocalB:modules.LocalA;
        assert.equal(api.as3Is(value,api.as3ClassType(`cycle.${Constructor.name}`,Constructor)),true,name);
    }
});

test("generated constructors enforce authenticated AS3 arity before base, field, or user effects",t=>{
    const files={
        "cycle/Observer.as":"package cycle { public class Observer { public var calls:int; public function Observer() {} public function hit():void { this.calls++; } } }\n",
        "cycle/Root.as":"package cycle { public class Root { public function Root(observer:Observer,value:int) { observer.hit(); } } }\n",
        "cycle/Base.as":"package cycle { public class Base { public function Base(observer:Observer) { observer.hit(); } } }\n",
        "cycle/Mid.as":"package cycle { public class Mid extends Base { public function Mid(observer:Observer) { super(observer); } } }\n",
        "cycle/Derived.as":"package cycle { public class Derived extends Mid { public function Derived(observer:Observer,value:int,label:String = \"ok\") { super(observer); observer.hit(); } } }\n",
        "cycle/Implicit.as":"package cycle { public class Implicit { public var value:int = 7; } }\n",
        "cycle/Optional.as":"package cycle { public class Optional { public function Optional(observer:Observer,value:int = 7) { observer.hit(); } } }\n",
        "cycle/Resty.as":"package cycle { public class Resty { public function Resty(observer:Observer,...values) { observer.hit(); } } }\n",
    };
    const observer={name:"observer",type:"cycle.Observer",optional:false,rest:false};
    const value={name:"value",type:"int",optional:false,rest:false};
    const label={name:"label",type:"String",optional:true,rest:false};
    const rest={name:"values",type:"*",optional:false,rest:true};
    const ctor=(name,parameters)=>member("constructor",name,{parameters});
    const declarations={
        "cycle.Observer":classDeclaration("Observer",[member("field","calls",{fieldType:"int"}),member("method","hit",{returnType:"void"})]),
        "cycle.Root":{kind:"class",value:{baseQNames:[],interfaceQNames:[],members:[ctor("Root",[observer,value])],packageInitializer:null}},
        "cycle.Base":{kind:"class",value:{baseQNames:[],interfaceQNames:[],members:[ctor("Base",[observer])],packageInitializer:null}},
        "cycle.Mid":{kind:"class",value:{baseQNames:["cycle.Base"],interfaceQNames:[],members:[ctor("Mid",[observer])],packageInitializer:null}},
        "cycle.Derived":{kind:"class",value:{baseQNames:["cycle.Mid"],interfaceQNames:[],members:[ctor("Derived",[observer,value,label])],packageInitializer:null}},
        "cycle.Implicit":classDeclaration("Implicit",[member("field","value",{fieldType:"int"})],[],false),
        "cycle.Optional":{kind:"class",value:{baseQNames:[],interfaceQNames:[],members:[ctor("Optional",[observer,{name:"value",type:"int",optional:true,rest:false}])],packageInitializer:null}},
        "cycle.Resty":{kind:"class",value:{baseQNames:[],interfaceQNames:[],members:[ctor("Resty",[observer,rest])],packageInitializer:null}},
    };
    const prerequisites={"cycle.Root":["cycle.Observer"],"cycle.Base":["cycle.Observer"],
        "cycle.Mid":["cycle.Base","cycle.Observer"],"cycle.Derived":["cycle.Mid","cycle.Observer"],
        "cycle.Optional":["cycle.Observer"],"cycle.Resty":["cycle.Observer"]};
    const root=fixtureCli(t,files,declarations,prerequisites);const result=invoke(root);
    assert.equal(result.status,0,result.stderr);const packageRoot=path.join(root,"out","__as3_runtime");createLayaPackage(packageRoot);
    const entry=require(path.join(packageRoot,"ApplicationEntry.generated.js"));const modules=Object.assign({},...entry.AS3_APPLICATION_MODULES);
    const rejectWithoutCalls=(construct,observerValue)=>{const before=observerValue?.calls??0;assert.throws(construct,/requires .* arguments/);
        if(observerValue!==null)assert.equal(observerValue.calls,before);};
    for(const reflect of [false,true]){
        let tracker=new modules.Observer();rejectWithoutCalls(()=>reflect?Reflect.construct(modules.Root,[tracker]):new modules.Root(tracker),tracker);
        tracker=new modules.Observer();rejectWithoutCalls(()=>reflect?Reflect.construct(modules.Root,[tracker,1,2]):new modules.Root(tracker,1,2),tracker);
        tracker=new modules.Observer();rejectWithoutCalls(()=>reflect?Reflect.construct(modules.Mid,[]):new modules.Mid(),tracker);
        tracker=new modules.Observer();rejectWithoutCalls(()=>reflect?Reflect.construct(modules.Mid,[tracker,1]):new modules.Mid(tracker,1),tracker);
        tracker=new modules.Observer();rejectWithoutCalls(()=>reflect?Reflect.construct(modules.Derived,[tracker]):new modules.Derived(tracker),tracker);
        tracker=new modules.Observer();rejectWithoutCalls(()=>reflect?Reflect.construct(modules.Derived,[tracker,1,"ok",4]):new modules.Derived(tracker,1,"ok",4),tracker);
        tracker=new modules.Observer();rejectWithoutCalls(()=>reflect?Reflect.construct(modules.Optional,[]):new modules.Optional(),tracker);
        tracker=new modules.Observer();rejectWithoutCalls(()=>reflect?Reflect.construct(modules.Optional,[tracker,1,2]):new modules.Optional(tracker,1,2),tracker);
        rejectWithoutCalls(()=>reflect?Reflect.construct(modules.Implicit,[1]):new modules.Implicit(1),null);
        tracker=new modules.Observer();rejectWithoutCalls(()=>reflect?Reflect.construct(modules.Resty,[]):new modules.Resty(),tracker);
    }
    let tracker=new modules.Observer();new modules.Root(tracker,1);assert.equal(tracker.calls,1);
    tracker=new modules.Observer();new modules.Mid(tracker);assert.equal(tracker.calls,1);
    tracker=new modules.Observer();new modules.Derived(tracker,1);assert.equal(tracker.calls,2);
    tracker=new modules.Observer();Reflect.construct(modules.Derived,[tracker,1,"label"]);assert.equal(tracker.calls,2);
    tracker=new modules.Observer();new modules.Optional(tracker);new modules.Optional(tracker,1);assert.equal(tracker.calls,2);
    tracker=new modules.Observer();new modules.Resty(tracker);Reflect.construct(modules.Resty,[tracker,1,2,3]);assert.equal(tracker.calls,2);
    assert.equal(new modules.Implicit().value,7);
});

test("constructor arity rejection cannot be intercepted by legal TypeError bindings",t=>{
    const files={
        "cycle/Observer.as":"package cycle { public class Observer { public var calls:int; public function Observer() {} public function hit():void { this.calls++; } } }\n",
        "cycle/TypeError.as":"package cycle { public class TypeError { public function TypeError(observer:Observer) { observer.hit(); } } }\n",
        "cycle/ParameterShadow.as":"package cycle { public class ParameterShadow { public function ParameterShadow(TypeError:Observer) { TypeError.hit(); } } }\n",
        "cycle/ImportShadow.as":"package cycle { import cycle.TypeError; public class ImportShadow { public function ImportShadow(observer:Observer) { observer.hit(); } } }\n",
        "cycle/LocalShadow.as":"package cycle { public class LocalShadow { public function LocalShadow(observer:Observer) { var TypeError:int = 0; observer.hit(); } } }\n",
    };
    const observer={name:"observer",type:"cycle.Observer",optional:false,rest:false};
    const typeErrorParameter={name:"TypeError",type:"cycle.Observer",optional:false,rest:false};
    const ctor=(name,parameters)=>member("constructor",name,{parameters});
    const declarations={
        "cycle.Observer":classDeclaration("Observer",[member("field","calls",{fieldType:"int"}),member("method","hit",{returnType:"void"})]),
        "cycle.TypeError":{kind:"class",value:{baseQNames:[],interfaceQNames:[],members:[ctor("TypeError",[observer])],packageInitializer:null}},
        "cycle.ParameterShadow":{kind:"class",value:{baseQNames:[],interfaceQNames:[],members:[ctor("ParameterShadow",[typeErrorParameter])],packageInitializer:null}},
        "cycle.ImportShadow":{kind:"class",value:{baseQNames:[],interfaceQNames:[],members:[ctor("ImportShadow",[observer])],packageInitializer:null}},
        "cycle.LocalShadow":{kind:"class",value:{baseQNames:[],interfaceQNames:[],members:[ctor("LocalShadow",[observer])],packageInitializer:null}},
    };
    const prerequisites={"cycle.TypeError":["cycle.Observer"],"cycle.ParameterShadow":["cycle.Observer"],
        "cycle.ImportShadow":["cycle.Observer","cycle.TypeError"],"cycle.LocalShadow":["cycle.Observer"]};
    const root=fixtureCli(t,files,declarations,prerequisites);const result=invoke(root);assert.equal(result.status,0,result.stderr);
    const packageRoot=path.join(root,"out","__as3_runtime");createLayaPackage(packageRoot);
    const entry=require(path.join(packageRoot,"ApplicationEntry.generated.js"));const modules=Object.assign({},...entry.AS3_APPLICATION_MODULES);
    for(const name of ["TypeError","ParameterShadow","ImportShadow","LocalShadow"]){
        const Constructor=modules[name];
        for(const reflect of [false,true]){
            const tracker=new modules.Observer();
            assert.throws(()=>reflect?Reflect.construct(Constructor,[tracker,1]):new Constructor(tracker,1),
                error=>error instanceof globalThis.TypeError&&/requires exactly 1 arguments/.test(error.message),`${name}/${reflect}`);
            assert.equal(tracker.calls,0,`${name}/${reflect}`);
        }
    }
});

test("source bindings cannot enter the reserved authenticated emitter namespace",t=>{
    const cases=[
        ["parameter","cycle/Shadow.as","package cycle { public class Shadow { public function Shadow(__as3PrepareConstruction:int) {} } }\n",
            "cycle.Shadow",{kind:"class",value:{baseQNames:[],interfaceQNames:[],members:[member("constructor","Shadow",{parameters:[{name:"__as3PrepareConstruction",type:"int",optional:false,rest:false}]})],packageInitializer:null}}],
        ["hoisted local","cycle/Shadow.as","package cycle { public class Shadow { public function Shadow() { var __as3EnterConstruction:int = 0; } } }\n",
            "cycle.Shadow",classDeclaration("Shadow")],
        ["abort local","cycle/Shadow.as","package cycle { public class Shadow { public function Shadow() { var __as3AbortConstruction:int = 0; } } }\n",
            "cycle.Shadow",classDeclaration("Shadow")],
        ["catch","cycle/Shadow.as","package cycle { public class Shadow { public function Shadow() { try { throw \"x\"; } catch(__AS3OwnRecord:Error) {} } } }\n",
            "cycle.Shadow",classDeclaration("Shadow")],
        ["member","cycle/Shadow.as","package cycle { public class Shadow { public var __as3InitializeInstanceFields:int; public function Shadow() {} } }\n",
            "cycle.Shadow",classDeclaration("Shadow",[member("field","__as3InitializeInstanceFields",{fieldType:"int"})])],
        ["class","cycle/__as3BindMethod.as","package cycle { public class __as3BindMethod { public function __as3BindMethod() {} } }\n",
            "cycle.__as3BindMethod",classDeclaration("__as3BindMethod")],
        ["import","cycle/Shadow.as","package cycle { import cycle.__as3CompleteConstruction; public class Shadow { public function Shadow() {} } }\n",
            "cycle.Shadow",classDeclaration("Shadow")],
        ["weak brand","cycle/WeakSet.as","package cycle { public class WeakSet { public function WeakSet() {} } }\n",
            "cycle.WeakSet",classDeclaration("WeakSet")],
        ["weak target","cycle/WeakMap.as","package cycle { public class WeakMap { public function WeakMap() {} } }\n",
            "cycle.WeakMap",classDeclaration("WeakMap")],
        ["nominal export","cycle/isAS3ClassInstance.as","package cycle { public class isAS3ClassInstance { public function isAS3ClassInstance() {} } }\n",
            "cycle.isAS3ClassInstance",classDeclaration("isAS3ClassInstance")],
        ["nominal target export","cycle/as3ConstructionTarget.as","package cycle { public class as3ConstructionTarget { public function as3ConstructionTarget() {} } }\n",
            "cycle.as3ConstructionTarget",classDeclaration("as3ConstructionTarget")],
    ];
    for(const [label,relative,source,qname,declaration] of cases){
        const root=fixtureCli(t,{[relative]:source},{[qname]:declaration},{});const result=invoke(root);
        const authorityReject=label==="class";
        assert.equal(result.status,authorityReject?6:4,`${label}: ${result.stderr}`);
        assert.match(result.stderr,authorityReject?/local type entry .* invalid, unsafe/:/HARDENED_IDENTIFIER/,label);
        assert.equal(fs.existsSync(path.join(root,"out")),false,label);
    }
});

test("constructor arity proof rejects an arguments parameter shadow",t=>{
    const cases=[
        ["parameter","package cycle { public class Shadow { public function Shadow(arguments:int) {} } }\n",
            [{name:"arguments",type:"int",optional:false,rest:false}]],
        ["var local","package cycle { public class Shadow { public function Shadow() { var arguments:int = 0; } } }\n",[]],
        ["const local","package cycle { public class Shadow { public function Shadow() { const arguments:int = 0; } } }\n",[]],
        ["catch binding","package cycle { public class Shadow { public function Shadow() { try { throw \"x\"; } catch(arguments:Error) {} } } }\n",[]],
    ];
    for(const [label,source,parameters] of cases){
        const files={"cycle/Shadow.as":source};
        const declarations={"cycle.Shadow":{kind:"class",value:{baseQNames:[],interfaceQNames:[],
            members:[member("constructor","Shadow",{parameters})],packageInitializer:null}}};
        const root=fixtureCli(t,files,declarations,{});const result=invoke(root);
        assert.equal(result.status,4,`${label}: ${result.stderr}`);assert.match(result.stderr,/HARDENED_EMIT_CONSTRUCTOR_ARITY/);
        assert.equal(fs.existsSync(path.join(root,"out")),false,label);
    }
});

test("local field authority rejects inherited slot aliases and base-method collisions",t=>{
    const cases=[
        ["exact fields","package cycle { public class Base { protected var Slot:int; public function Base() {} } }\n",
            "package cycle { public class Derived extends Base { public var Slot:int; } }\n",
            member("field","Slot",{modifiers:["protected"],fieldType:"int"}),
            member("field","Slot",{modifiers:["public"],fieldType:"int"})],
        ["base method and derived field","package cycle { public class Base { public function Base() {} public function slot():void {} } }\n",
            "package cycle { public class Derived extends Base { public var slot:int; } }\n",
            member("method","slot",{returnType:"void"}),member("field","slot",{fieldType:"int"})],
    ];
    for(const [label,baseSource,derivedSource,baseMember,derivedMember] of cases){
        const files={"cycle/Base.as":baseSource,"cycle/Derived.as":derivedSource};
        const declarations={"cycle.Base":classDeclaration("Base",[baseMember]),
            "cycle.Derived":classDeclaration("Derived",[derivedMember],["cycle.Base"],false)};
        const root=fixtureCli(t,files,declarations,{"cycle.Derived":["cycle.Base"]});const result=invoke(root);
        assert.equal(result.status,4,`${label}: ${result.stderr}`);assert.match(result.stderr,/HARDENED_LOCAL_FIELD_ANCESTRY/);
        assert.equal(fs.existsSync(path.join(root,"out")),false,label);
    }
});

test("native timer import resolution rejects every inherited visible local member kind",t=>{
    const kinds=["field","getter","setter","method"];
    const timers=["clearInterval","clearTimeout","getTimer","setInterval","setTimeout"];
    for(const timerName of timers){
        for(const kind of kinds){
            const suffix=`${timerName}_${kind}`;const baseName=`Base_${suffix}`;const derivedName=`Derived_${suffix}`;
            let declaration;let sourceMember;
            if(kind==="field"){
                declaration=member("field",timerName,{fieldType:"Function"});
                sourceMember=`public var ${timerName}:Function;`;
            }else if(kind==="getter"){
                declaration=member("getter",timerName,{returnType:"Function"});
                sourceMember=`public function get ${timerName}():Function { return null; }`;
            }else if(kind==="setter"){
                declaration=member("setter",timerName,{returnType:"void",parameters:[{name:"value",type:"Function",optional:false,rest:false}]});
                sourceMember=`public function set ${timerName}(value:Function):void {}`;
            }else{
                declaration=timerName==="setTimeout"||timerName==="setInterval"
                    ? member("method",timerName,{returnType:"uint",parameters:[
                        {name:"closure",type:"Function",optional:false,rest:false},
                        {name:"delay",type:"Number",optional:false,rest:false}]})
                    : timerName==="getTimer"
                    ? member("method",timerName,{returnType:"int"})
                    : member("method",timerName,{returnType:"void",parameters:[
                        {name:"id",type:"uint",optional:false,rest:false}]});
                sourceMember=timerName==="setTimeout"||timerName==="setInterval"
                    ? `public function ${timerName}(closure:Function, delay:Number):uint { return 1; }`
                    : timerName==="getTimer"
                    ? `public function ${timerName}():int { return 1; }`
                    : `public function ${timerName}(id:uint):void {}`;
            }
            const call=timerName==="setTimeout"||timerName==="setInterval"
                ?`${timerName}(function():void {}, 0);`
                :timerName==="getTimer"?`${timerName}();`:`${timerName}(1);`;
            const baseQName=`cycle.${baseName}`;const derivedQName=`cycle.${derivedName}`;
            const files={
                [`cycle/${baseName}.as`]:`package cycle { public class ${baseName} { ${sourceMember} public function ${baseName}() {} } }\n`,
                [`cycle/${derivedName}.as`]:`package cycle { import flash.utils.${timerName}; public class ${derivedName} extends ${baseName} { public function arm():void { ${call} } } }\n`,
            };
            const declarations={
                [baseQName]:classDeclaration(baseName,[declaration]),
                [derivedQName]:classDeclaration(derivedName,[],[baseQName],false),
            };
            const root=fixtureCli(t,files,declarations,{[derivedQName]:[baseQName]});const result=invoke(root);
            assert.equal(result.status,4,`${timerName}/${kind}: ${result.stderr}`);
            assert.match(result.stderr,/HARDENED_NATIVE_TIMER_INHERITED_SHADOW/,`${timerName}/${kind}`);
            assert.equal(fs.existsSync(path.join(root,"out")),false,`${timerName}/${kind}`);
        }
    }
});

test("native timer inherited shadow resolution distinguishes inaccessible internal and private members",t=>{
    for(const timerName of ["clearInterval","clearTimeout","getTimer","setInterval","setTimeout"]){
        const call=timerName==="setTimeout"||timerName==="setInterval"
            ?`${timerName}(function():void {}, 0);`
            :timerName==="getTimer"?`${timerName}();`:`${timerName}(1);`;
        for(const visibility of ["internal","private"]){
            const baseName=`Base_${timerName}_${visibility}`;const derivedName=`Derived_${timerName}_${visibility}`;
            const baseQName=`basepkg.${baseName}`;const derivedQName=`otherpkg.${derivedName}`;
            const modifier=visibility==="private"?"private ":"";
            const files={
                [`basepkg/${baseName}.as`]:`package basepkg { public class ${baseName} { ${modifier}var ${timerName}:Function; public function ${baseName}() {} } }\n`,
                [`otherpkg/${derivedName}.as`]:`package otherpkg { import basepkg.${baseName}; import flash.utils.${timerName}; public class ${derivedName} extends ${baseName} { public function arm():void { ${call} } } }\n`,
            };
            const declarations={
                [baseQName]:classDeclaration(baseName,[member("field",timerName,{modifiers:visibility==="private"?["private"]:[],fieldType:"Function"})]),
                [derivedQName]:classDeclaration(derivedName,[],[baseQName],false),
            };
            const root=fixtureCli(t,files,declarations,{[derivedQName]:[baseQName]});const result=invoke(root);
            if(visibility==="internal"){
                assert.equal(result.status,4,`${timerName}/${visibility}: ${result.stderr}`);
                assert.match(result.stderr,/HARDENED_LOCAL_MEMBER_VISIBILITY/,`${timerName}/${visibility}`);
                assert.equal(fs.existsSync(path.join(root,"out")),false,`${timerName}/${visibility}`);
            }else{
                assert.equal(result.status,0,`${timerName}/${visibility}: ${result.stderr}`);
                const output=fs.readFileSync(path.join(root,"out","__as3_runtime","application","otherpkg",`${derivedName}.ts`),"utf8");
                assert.match(output,new RegExp(`import \\{ ${timerName} \\} from "@bleach/as3-runtime/AS3Timer";`));
                assert.match(output,new RegExp(`${timerName}\\(`));
            }
        }
    }
});

test("native timer inherited provenance fails closed on held and ambiguous local lineage",t=>{
    {
        const baseQName="cycle.HeldTimerBase";const derivedQName="cycle.HeldTimerDerived";
        const files={
            "cycle/HeldTimerBase.as":"package cycle { public class HeldTimerBase { public function HeldTimerBase() {} } }\n",
            "cycle/HeldTimerDerived.as":"package cycle { import flash.utils.setTimeout; public class HeldTimerDerived extends HeldTimerBase { public function arm():void { setTimeout(function():void {}, 0); } } }\n",
        };
        const declarations={
            [baseQName]:classDeclaration("HeldTimerBase"),
            [derivedQName]:classDeclaration("HeldTimerDerived",[],[baseQName],false),
        };
        const root=fixtureCli(t,files,declarations,{[derivedQName]:[baseQName]},memberMap=>{
            const entry=memberMap.entries.find(item=>item.qname===baseQName);
            entry.declaration=null;entry.holdCode="TEST_HELD_LINEAGE";entry.holdSha256=sha256(baseQName);entry.status="held";
        });
        const result=qualify(root);assert.equal(result.status,0,result.stderr);
        const report=JSON.parse(fs.readFileSync(path.join(root,"qualification","manifest.json"),"utf8"));
        const derived=report.files.find(item=>item.sourcePath==="cycle/HeldTimerDerived.as");
        assert.equal(derived.code,"HARDENED_LOCAL_MEMBER_HELD");
    }
    {
        const firstQName="cycle.TimerParentOne";const secondQName="cycle.TimerParentTwo";
        const baseQName="cycle.AmbiguousTimerBase";const derivedQName="cycle.AmbiguousTimerDerived";
        const files={
            "cycle/TimerParentOne.as":"package cycle { public class TimerParentOne { public function TimerParentOne() {} } }\n",
            "cycle/TimerParentTwo.as":"package cycle { public class TimerParentTwo { public function TimerParentTwo() {} } }\n",
            "cycle/AmbiguousTimerBase.as":"package cycle { public class AmbiguousTimerBase { public function AmbiguousTimerBase() {} } }\n",
            "cycle/AmbiguousTimerDerived.as":"package cycle { import flash.utils.clearTimeout; public class AmbiguousTimerDerived extends AmbiguousTimerBase { public function cancel():void { clearTimeout(1); } } }\n",
        };
        const declarations={
            [firstQName]:classDeclaration("TimerParentOne"),[secondQName]:classDeclaration("TimerParentTwo"),
            [baseQName]:classDeclaration("AmbiguousTimerBase"),
            [derivedQName]:classDeclaration("AmbiguousTimerDerived",[],[baseQName],false),
        };
        const root=fixtureCli(t,files,declarations,{[derivedQName]:[baseQName]},memberMap=>{
            const entry=memberMap.entries.find(item=>item.qname===baseQName);
            entry.declaration.baseQNames=[firstQName,secondQName];
        });
        const result=qualify(root);assert.equal(result.status,0,result.stderr);
        const report=JSON.parse(fs.readFileSync(path.join(root,"qualification","manifest.json"),"utf8"));
        const derived=report.files.find(item=>item.sourcePath==="cycle/AmbiguousTimerDerived.as");
        assert.equal(derived.code,"HARDENED_LOCAL_MEMBER_BASE");
    }
});

test("nested field method closures observe the canonical bound identity before initialization",t=>{
    const source="package cycle { public class ClosureFields { public var payload:Object = {callbacks:[handler],callback:handler}; public var hits:int; public function ClosureFields() {} public function handler():void { this.hits++; } } }\n";
    const files={"cycle/ClosureFields.as":source};
    const declarations={"cycle.ClosureFields":classDeclaration("ClosureFields",[
        member("field","payload",{fieldType:"Object"}),
        member("field","hits",{fieldType:"int"}),member("method","handler",{returnType:"void"})])};
    const root=fixtureCli(t,files,declarations,{});const result=invoke(root);assert.equal(result.status,0,result.stderr);
    const packageRoot=path.join(root,"out","__as3_runtime");createLayaPackage(packageRoot);
    const entry=require(path.join(packageRoot,"ApplicationEntry.generated.js"));const modules=Object.assign({},...entry.AS3_APPLICATION_MODULES);
    const value=new modules.ClosureFields();assert.equal(value.payload.callbacks[0],value.handler);assert.equal(value.payload.callback,value.handler);
    value.payload.callbacks[0]();value.payload.callback();assert.equal(value.hits,2);
});

test("direct method-closure field initializers remain held",t=>{
    const source="package cycle { public class DirectClosure { public var callback:Function = handler; public function DirectClosure() {} public function handler():void {} } }\n";
    const files={"cycle/DirectClosure.as":source};
    const declarations={"cycle.DirectClosure":classDeclaration("DirectClosure",[
        member("field","callback",{fieldType:"Function"}),member("method","handler",{returnType:"void"})])};
    const root=fixtureCli(t,files,declarations,{});const result=invoke(root);assert.equal(result.status,4);
    assert.match(result.stderr,/HARDENED_METHOD_CLOSURE_INITIALIZER/);assert.equal(fs.existsSync(path.join(root,"out")),false);
});
