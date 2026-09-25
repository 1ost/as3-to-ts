"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = fs.mkdtempSync(path.join(os.tmpdir(), "as3-vector-runtime-"));
const CONFIG = path.join(OUTPUT, "tsconfig.json");
fs.writeFileSync(CONFIG, JSON.stringify({ compilerOptions: {
    target: "ES2022", module: "CommonJS", moduleResolution: "Node", strict: true,
    skipLibCheck: true, rootDir: path.join(ROOT, "src"), outDir: OUTPUT,
}, files: [path.join(ROOT, "src/hardened-runtime/AS3Vector.ts")] }), "utf8");
childProcess.execFileSync(process.execPath,
    [path.join(ROOT, "node_modules/typescript-4-9/bin/tsc"), "-p", CONFIG], { cwd: ROOT, stdio: "inherit" });
const runtime = require(path.join(OUTPUT, "hardened-runtime/AS3Vector.js"));
const { AS3Vector, AS3VectorPolicies, as3VectorNested, as3VectorReference, as3VectorType } = runtime;
const typeRuntime = require(path.join(OUTPUT, "hardened-runtime/AS3Type.js"));
const internal = require(path.join(OUTPUT, "hardened-runtime/internal/AS3TypeRegistry.js"));
const methodRuntime = require(path.join(OUTPUT, "hardened-runtime/AS3MethodClosure.js"));
const { AS3Types, as3As, as3InterfaceType, as3Is } = typeRuntime;
const { as3BindMethod, isAS3MethodClosure } = methodRuntime;

const itemBrands = new WeakSet(); class Item { constructor(value=1) { this.value=value; itemBrands.add(this); } }
const baseBrands = new WeakSet(); class BaseItem { constructor(value=1) { this.value=value; baseBrands.add(this); } }
const derivedBrands = new WeakSet(); class DerivedItem extends BaseItem { constructor(value=1) { super(value); derivedBrands.add(this); } }
const otherBrands = new WeakSet(); class OtherItem { constructor(value=1) { this.value=value; otherBrands.add(this); } }
const eventBrands = new WeakSet(); class Event { constructor() { eventBrands.add(this); } }
const spriteBrands = new WeakSet(); class Sprite { constructor() { spriteBrands.add(this); } }
const textBrands = new WeakSet(); class TextField { constructor() { textBrands.add(this); } }
class Hostile { static [Symbol.hasInstance]() { return true; } }
const entries = [
    { kind:"interface", qname:"test.IVectorBase", bases:[] },
    { kind:"interface", qname:"test.IVectorDerived", bases:["test.IVectorBase"] },
    { kind:"class", qname:"Item", base:null, interfaces:["test.IVectorDerived"], sourceSha256:"a".repeat(64), fields:[], constructor:Item, predicate:value=>itemBrands.has(value), constructionTarget:null, constructionProof:null },
    { kind:"class", qname:"test.BaseItem", base:null, interfaces:[], sourceSha256:"1".repeat(64), fields:[], constructor:BaseItem, predicate:value=>baseBrands.has(value), constructionTarget:null, constructionProof:null },
    { kind:"class", qname:"test.DerivedItem", base:"test.BaseItem", interfaces:[], sourceSha256:"2".repeat(64), fields:[], constructor:DerivedItem, predicate:value=>derivedBrands.has(value), constructionTarget:null, constructionProof:null },
    { kind:"class", qname:"test.OtherItem", base:null, interfaces:[], sourceSha256:"3".repeat(64), fields:[], constructor:OtherItem, predicate:value=>otherBrands.has(value), constructionTarget:null, constructionProof:null },
    { kind:"class", qname:"flash.events.Event", base:null, interfaces:[], sourceSha256:"b".repeat(64), fields:[], constructor:Event, predicate:value=>eventBrands.has(value), constructionTarget:null, constructionProof:null },
    { kind:"class", qname:"flash.display.Sprite", base:null, interfaces:[], sourceSha256:"c".repeat(64), fields:[], constructor:Sprite, predicate:value=>spriteBrands.has(value), constructionTarget:null, constructionProof:null },
    { kind:"class", qname:"flash.text.TextField", base:null, interfaces:[], sourceSha256:"d".repeat(64), fields:[], constructor:TextField, predicate:value=>textBrands.has(value), constructionTarget:null, constructionProof:null },
    { kind:"class", qname:"test.Hostile", base:null, interfaces:[], sourceSha256:"e".repeat(64), fields:[], constructor:Hostile, predicate:()=>false, constructionTarget:null, constructionProof:null },
];
const qnames = entries.map(entry=>entry.qname);
const metadata = {schema:"as3-runtime-type-authority@1",qnames,entries:entries.map(entry=>entry.kind==="interface"
    ?{kind:entry.kind,qname:entry.qname,bases:entry.bases}
    :{kind:entry.kind,qname:entry.qname,base:entry.base,interfaces:entry.interfaces,sourceSha256:entry.sourceSha256,fields:entry.fields})};
internal.installAS3TypeAuthority({schema:metadata.schema,
    sha256:crypto.createHash("sha256").update(JSON.stringify(metadata)).digest("hex"),qnames,entries});

test.after(() => fs.rmSync(OUTPUT, { recursive: true, force: true }));

test("typed defaults, coercion, bounds, fixed mutation, iteration and stable closures", () => {
    const vector = new AS3Vector(AS3VectorPolicies.int, 3);
    assert.deepEqual([...vector], [0,0,0]); vector[0]=4.9; vector[1]=-1;
    assert.deepEqual([...vector], [4,-1,0]); assert.equal(vector.push, vector.push);
    assert.equal(isAS3MethodClosure(vector.push),true);
    assert.throws(()=>vector[3], RangeError); vector[vector.length]=5.9;
    assert.deepEqual([...vector],[4,-1,0,5]); assert.throws(()=>{vector[vector.length+1]=1;}, RangeError);
    const empty=new AS3Vector(AS3VectorPolicies.int); empty[empty.length]=7.8; assert.deepEqual([...empty],[7]);
    const fixed = new AS3Vector(AS3VectorPolicies.uint,2,true); fixed[0]=-1;
    assert.throws(()=>{fixed[fixed.length]=1;},/fixed Vector/); assert.deepEqual([...fixed],[0xffffffff,0]);
    assert.throws(()=>fixed.push(1),/fixed Vector/); assert.deepEqual([...fixed],[0xffffffff,0]);
    fixed.fixed=false; assert.equal(fixed.push(2),3);
    const bounded=AS3Vector.from(AS3VectorPolicies.int,[1]);
    assert.throws(()=>bounded._assertResize(0x01000000),/length must be an integer/);
    assert.deepEqual([...bounded],[1]);
});

test("Vector rejects foreign Reflect receivers without poisoning closures or setters",()=>{
    const a=AS3Vector.from(AS3VectorPolicies.int,[1]);const b=AS3Vector.from(AS3VectorPolicies.int,[2]);
    const push=a.push;
    for(const foreign of [b,{},new Proxy({}, {})]) assert.throws(()=>Reflect.get(a,"push",foreign),/receiver is not this vector/);
    let traps=0;const hostile=new Proxy({},{get(){traps+=1;throw new Error("foreign get");},set(){traps+=1;throw new Error("foreign set");}});
    assert.throws(()=>Reflect.get(a,"push",hostile),/receiver is not this vector/);
    assert.equal(traps,0);assert.equal(a.push,push);assert.equal(a.push(3),2);assert.deepEqual([...a],[1,3]);assert.deepEqual([...b],[2]);
    for(const [name,value] of [["fixed",true],["length",0]]){
        for(const foreign of [b,{},hostile]) assert.throws(()=>Reflect.set(a,name,value,foreign),/receiver is not this vector/);
    }
    assert.equal(traps,0);assert.equal(a.fixed,false);assert.equal(a.length,2);assert.deepEqual([...b],[2]);
});

test("rejected resizes preflight before coercion and coercion failure is atomic", () => {
    let conversions=0;
    const hostile={valueOf(){conversions+=1;throw new Error("hostile coercion");}};
    for(const operation of [
        vector=>vector.push(hostile),
        vector=>vector.unshift(hostile),
        vector=>vector.splice(0,0,hostile),
        vector=>{vector[vector.length]=hostile;},
    ]){
        const fixed=AS3Vector.from(AS3VectorPolicies.int,[1],true);
        assert.throws(()=>operation(fixed),/fixed Vector/);
        assert.deepEqual([...fixed],[1]);
    }
    assert.equal(conversions,0);

    const capped=AS3Vector.from(AS3VectorPolicies.int,[]);
    assert.throws(()=>capped._assertResize(0x01000000),/length must be an integer/);
    assert.equal(conversions,0); assert.deepEqual([...capped],[]);

    for(const operation of [
        vector=>vector.push(2,hostile),
        vector=>vector.unshift(2,hostile),
        vector=>vector.splice(0,0,2,hostile),
    ]){
        const vector=AS3Vector.from(AS3VectorPolicies.int,[1]);
        assert.throws(()=>operation(vector),/hostile coercion/);
        assert.deepEqual([...vector],[1]);
    }
    assert.equal(conversions,3);
});

test("conversion, mutation, callbacks and specialization preserve exact element policy", () => {
    const vector=AS3Vector.from(AS3VectorPolicies.int,[1.9,2.1,3.8]);
    assert.deepEqual([...vector.splice(1,1,7.7,8.8)],[2]); assert.deepEqual([...vector],[1,7,8,3]);
    assert.deepEqual([...vector.concat(AS3Vector.from(AS3VectorPolicies.int,[9.4]))],[1,7,8,3,9]);
    assert.throws(()=>vector.concat(AS3Vector.from(AS3VectorPolicies.uint,[9])),/same element type or an authenticated reference subtype/);
    const seen=[]; vector.forEach((value,index,owner)=>seen.push([value,index,owner===vector]));
    assert.deepEqual(seen,[[1,0,true],[7,1,true],[8,2,true],[3,3,true]]);
    assert.equal(as3Is(vector,as3VectorType(AS3VectorPolicies.int)),true);
    assert.equal(as3Is(vector,as3VectorType(AS3VectorPolicies.uint)),false);
});

test("Array conversion densifies sparse indices and bounds hostile access atomically", () => {
    const sparse=new Array(5); sparse[1]=3.9; sparse[3]=undefined;
    assert.deepEqual([...AS3Vector.from(AS3VectorPolicies.int,sparse)],[0,3,0,0,0]);
    assert.deepEqual([...AS3Vector.from(AS3VectorPolicies.uint,sparse)],[0,3,0,0,0]);
    assert.deepEqual([...AS3Vector.from(AS3VectorPolicies.boolean,sparse)],[false,true,false,false,false]);
    const strings=new Array(4); strings[1]="x"; strings[3]=null;
    assert.deepEqual([...AS3Vector.from(AS3VectorPolicies.string,strings)],[null,"x",null,null]);
    assert.deepEqual([...AS3Vector.from(AS3VectorPolicies.object,strings)],[null,"x",null,null]);

    let reads=0; const getterArray=[1,2,3];
    Object.defineProperty(getterArray,1,{configurable:true,get(){reads+=1;throw new Error("hostile index");}});
    assert.throws(()=>AS3Vector.from(AS3VectorPolicies.int,getterArray),/hostile index/);
    assert.equal(reads,1); assert.equal(getterArray.length,3);

    let lengthReads=0; let indexReads=0;
    const oversized=new Proxy([], {get(target,property,receiver){
        if(property==="length"){lengthReads+=1;return 0x01000000;}
        if(typeof property==="string"&&/^[0-9]+$/.test(property))indexReads+=1;
        return Reflect.get(target,property,receiver);
    }});
    assert.throws(()=>AS3Vector.from(AS3VectorPolicies.int,oversized),/length must be an integer/);
    assert.equal(lengthReads,1); assert.equal(indexReads,0);

    lengthReads=0; indexReads=0;
    const bounded=new Proxy(new Array(3),{get(target,property,receiver){
        if(property==="length")lengthReads+=1;
        if(typeof property==="string"&&/^[0-9]+$/.test(property))indexReads+=1;
        return Reflect.get(target,property,receiver);
    }});
    assert.deepEqual([...AS3Vector.from(AS3VectorPolicies.int,bounded)],[0,0,0]);
    assert.equal(lengthReads,1); assert.equal(indexReads,3);
});

test("concat accepts only authenticated reference subtypes and implementing classes", () => {
    const basePolicy=as3VectorReference("test.BaseItem",BaseItem);
    const derivedPolicy=as3VectorReference("test.DerivedItem",DerivedItem);
    const otherPolicy=as3VectorReference("test.OtherItem",OtherItem);
    const interfacePolicy=as3VectorReference("test.IVectorBase",as3InterfaceType("test.IVectorBase"));
    const itemPolicy=as3VectorReference("Item",Item);
    const base=AS3Vector.from(basePolicy,[new BaseItem(1)]);
    const derived=AS3Vector.from(derivedPolicy,[new DerivedItem(2)]);
    assert.deepEqual([...base.concat(derived)].map(value=>value.value),[1,2]);
    assert.equal(interfacePolicy.coerce(AS3Vector.from(itemPolicy,[new Item()])[0]) instanceof Item,true);
    assert.equal(base.concat(derived)[1] instanceof DerivedItem,true);
    assert.equal(AS3Vector.from(interfacePolicy,[]).concat(AS3Vector.from(itemPolicy,[new Item()]))[0] instanceof Item,true);
    assert.throws(()=>derived.concat(base),/authenticated reference subtype/);
    assert.throws(()=>base.concat(AS3Vector.from(otherPolicy,[new OtherItem()])),/authenticated reference subtype/);
    assert.throws(()=>AS3Vector.from(AS3VectorPolicies.int,[1]).concat(
        AS3Vector.from(AS3VectorPolicies.uint,[1])),/authenticated reference subtype/);
    assert.throws(()=>AS3Vector.from(as3VectorNested(AS3VectorPolicies.int),[]).concat(
        AS3Vector.from(as3VectorNested(AS3VectorPolicies.uint),[])),/authenticated reference subtype/);
    const objects=AS3Vector.from(AS3VectorPolicies.object,["head"]);
    assert.deepEqual([...objects.concat(AS3Vector.from(AS3VectorPolicies.int,[2]))],["head",2]);
    assert.deepEqual([...objects.concat(AS3Vector.from(itemPolicy,[null,new Item(3)]))],
        ["head",null,new Item(3)]);
    const nestedInts=AS3Vector.from(as3VectorNested(AS3VectorPolicies.int),[
        AS3Vector.from(AS3VectorPolicies.int,[4])]);
    assert.equal(objects.concat(nestedInts)[1],nestedInts[0]);
    assert.throws(()=>AS3Vector.from(AS3VectorPolicies.int,[1]).concat(objects),/authenticated reference subtype/);
});

test("numeric sort admits exact Array.NUMERIC behavior and rejects other flags", () => {
    const vector=AS3Vector.from(AS3VectorPolicies.number,[10,3,NaN,3,-2,Infinity]);
    assert.equal(vector.sort(16),vector);
    assert.deepEqual([...vector].slice(0,5),[-2,3,3,10,Infinity]);
    assert.equal(Number.isNaN(vector[5]),true);
    assert.deepEqual([...AS3Vector.from(AS3VectorPolicies.int,[10,3,-2]).sort(16)],[-2,3,10]);
    for(const flag of [0,1,2,4,8,17,-1,"16",{},[]]) assert.throws(()=>vector.sort(flag),/exact Array.NUMERIC/);
});

test("branded method closures reject non-null callback receivers without spoofable inspection", () => {
    const receiver={visit(value){return value>0;}};
    const closure=as3BindMethod(receiver,receiver.visit); const alias=closure;
    assert.equal(isAS3MethodClosure(closure),true);
    const vector=AS3Vector.from(AS3VectorPolicies.int,[1,2]);
    for(const name of ["every","filter","forEach","map","some"]){
        assert.throws(()=>vector[name](alias,{}),/method closure requires a null thisObject/,name);
    }
    const nativeClosure=vector.some; assert.equal(nativeClosure,vector.some);
    assert.equal(isAS3MethodClosure(nativeClosure),true);
    for(const name of ["every","filter","forEach","map","some"]){
        assert.throws(()=>vector[name](nativeClosure,{}),/method closure requires a null thisObject/,name);
    }
    assert.doesNotThrow(()=>vector.forEach(closure,null));
    assert.equal(isAS3MethodClosure(function(){}),false);
    const fake=function(){}; fake.__as3MethodClosure=true; assert.equal(isAS3MethodClosure(fake),false);
    let traps=0; const hostile=new Proxy(function(){},{get(){traps+=1;throw new Error("get");},
        getPrototypeOf(){traps+=1;throw new Error("prototype");}});
    assert.equal(isAS3MethodClosure(hostile),false); assert.equal(traps,0);
});

test("Number/Object/Array/Class/Function and nested policy semantics are distinct", () => {
    const numbers=new AS3Vector(AS3VectorPolicies.number,2); assert.equal(Number.isNaN(numbers[0]),true);
    assert.deepEqual([...AS3Vector.from(AS3VectorPolicies.object,[undefined,null,0,false])],[null,null,0,false]);
    function ordinary(){}
    assert.equal(AS3Vector.from(AS3VectorPolicies.class,[Item])[0],Item);
    assert.equal(AS3Vector.from(AS3VectorPolicies.function,[ordinary])[0],ordinary);
    assert.throws(()=>AS3Vector.from(AS3VectorPolicies.class,[ordinary]),/Class/);
    assert.throws(()=>AS3Vector.from(AS3VectorPolicies.function,[Item]),/Function/);
    const nestedPolicy=as3VectorNested(AS3VectorPolicies.int); const nested=new AS3Vector(nestedPolicy,1);
    const ints=AS3Vector.from(AS3VectorPolicies.int,[1]); nested[0]=ints;
    assert.throws(()=>{nested[0]=AS3Vector.from(AS3VectorPolicies.uint,[1]);},/incompatible/);
});

test("class and inherited interface reference policies accept only authority-branded instances", () => {
    const item=new Item();
    for(const name of ["Item","test.IVectorBase","test.IVectorDerived"]){
        const value=name==="Item"?Item:as3InterfaceType(name);
        const policy=as3VectorReference(name,value); assert.equal(AS3Vector.from(policy,[item])[0],item);
        assert.throws(()=>AS3Vector.from(policy,[{}]),/incompatible/);
    }
    const classToken=typeRuntime.as3ClassType("Item",Item);
    assert.equal(AS3Vector.from(as3VectorReference("Item",classToken),[item])[0],item);
    assert.equal(AS3VectorPolicies.class.coerce(as3InterfaceType("test.IVectorBase")),as3InterfaceType("test.IVectorBase"));
});

test("mapped Flash class vectors use class-specific bridge brands without prototype fallback", () => {
    for(const [name,ctor] of [["flash.events.Event",Event],["flash.display.Sprite",Sprite],["flash.text.TextField",TextField]]){
        const value=new ctor(); const policy=as3VectorReference(name,ctor);
        assert.equal(AS3Vector.from(policy,[value])[0],value);
        assert.throws(()=>AS3Vector.from(policy,[Object.create(ctor.prototype)]),/incompatible/);
        assert.throws(()=>AS3Vector.from(policy,[new Proxy(value,{})]),/incompatible/);
    }
    const hostile=as3VectorReference("test.Hostile",Hostile); assert.throws(()=>hostile.coerce({}),/incompatible/);
});

test("policies, sources, state, indices and prototype are bounded and unforgeable", () => {
    let iteratorReads=0; const infinite={get [Symbol.iterator](){iteratorReads+=1;return function*(){while(true)yield 1;};}};
    assert.throws(()=>AS3Vector.from(AS3VectorPolicies.int,infinite),/Array or authenticated AS3 Vector/);
    assert.equal(iteratorReads,0);
    const oversized=[]; oversized.length=0x01000000;
    assert.throws(()=>AS3Vector.from(AS3VectorPolicies.int,oversized),/length must be an integer/);
    const fakePolicy=Object.freeze({name:"int",defaultValue:()=>0,coerce:value=>value});
    assert.throws(()=>new AS3Vector(fakePolicy),/authenticated element policy/);
    const vector=AS3Vector.from(AS3VectorPolicies.int,[1,2]); const token=as3VectorType(AS3VectorPolicies.int);
    for(const property of ["_policy","_values","_fixed","_closures"]){
        assert.equal(vector[property],undefined); assert.throws(()=>{vector[property]={};},/not writable/);
        assert.throws(()=>Object.defineProperty(vector,property,{value:{}}),/cannot be defined/);
        assert.throws(()=>delete vector[property],/cannot be deleted/);
    }
    assert.throws(()=>Object.setPrototypeOf(vector,{}),/prototype is sealed/);
    assert.equal(Object.isFrozen(AS3Vector),true); assert.equal(Object.isFrozen(AS3Vector.prototype),true);
    assert.throws(()=>Object.defineProperty(AS3Vector.prototype,"push",{value(){throw new Error("override");}}),TypeError);
    assert.throws(()=>Object.defineProperty(AS3Vector,"from",{value(){throw new Error("override");}}),TypeError);
    let hostileOverrideCalls=0;
    class EvilVector extends AS3Vector { push(){hostileOverrideCalls+=1;return 0;} }
    assert.throws(()=>new EvilVector(AS3VectorPolicies.int),/final and cannot be subclassed/);
    assert.equal(hostileOverrideCalls,0);
    assert.throws(()=>{vector.extra=1;},TypeError); assert.equal("extra" in vector,false);
    assert.throws(()=>Object.defineProperty(vector,"extra",{value:1}),TypeError);
    assert.throws(()=>delete vector.extra,TypeError);
    vector.fixed=true; assert.equal(vector.fixed,true); vector.fixed=false; vector.length=3;
    assert.deepEqual([...vector],[1,2,0]);
    assert.deepEqual([...vector],[1,2,0]); assert.equal(as3Is(vector,token),true); assert.equal(as3As([],token),null);
});
