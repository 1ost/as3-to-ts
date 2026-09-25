"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const OUTPUT = fs.mkdtempSync(path.join(os.tmpdir(), "as3-bytearray-runtime-"));
const CONFIG = path.join(OUTPUT, "tsconfig.json");
fs.writeFileSync(CONFIG, JSON.stringify({
    compilerOptions: {
        target: "ES2022", module: "CommonJS", moduleResolution: "Node", strict: true,
        skipLibCheck: true, rootDir: path.join(ROOT, "src"), outDir: OUTPUT,
    },
    files: [path.join(ROOT, "src/hardened-runtime/AS3ByteArray.ts")],
}), "utf8");
childProcess.execFileSync(process.execPath,
    [path.join(ROOT, "node_modules/typescript-4-9/bin/tsc"), "-p", CONFIG], { cwd: ROOT, stdio: "inherit" });
const { AS3ByteArray, AS3Endian, AS3EOFError, configureAS3SystemCodePageEncoder } =
    require(path.join(OUTPUT, "hardened-runtime/AS3ByteArray.js"));

test.after(() => fs.rmSync(OUTPUT, { recursive: true, force: true }));

test("ByteArray rejects foreign Reflect receivers without poisoning closures or setters",()=>{
    const a=new AS3ByteArray();const b=new AS3ByteArray();a.writeByte(1);b.writeByte(2);const write=a.writeByte;
    for(const foreign of [b,{},new Proxy({}, {})]) assert.throws(()=>Reflect.get(a,"writeByte",foreign),/receiver is not this byte array/);
    let traps=0;const hostile=new Proxy({},{get(){traps+=1;throw new Error("foreign get");},set(){traps+=1;throw new Error("foreign set");}});
    assert.throws(()=>Reflect.get(a,"writeByte",hostile),/receiver is not this byte array/);
    assert.equal(traps,0);assert.equal(a.writeByte,write);a.writeByte(3);assert.equal(a.length,2);assert.equal(b.length,1);
    for(const [name,value] of [["position",0],["length",0],["endian",AS3Endian.LITTLE_ENDIAN]]){
        for(const foreign of [b,{},hostile]) assert.throws(()=>Reflect.set(a,name,value,foreign),/receiver is not this byte array/);
    }
    assert.equal(traps,0);assert.equal(a.length,2);assert.equal(b.length,1);
});

test("ByteArray preserves Flash endian, integer, floating point, and Boolean semantics", () => {
    const bytes = new AS3ByteArray();
    assert.equal(bytes.endian, AS3Endian.BIG_ENDIAN);
    assert.equal(bytes.objectEncoding, 3);
    bytes.objectEncoding = 0;
    assert.equal(bytes.objectEncoding, 0);
    bytes.objectEncoding = 3;
    assert.throws(() => { bytes.objectEncoding = 1; }, error => error.name === "ArgumentError"
        && error.errorID === 2008 && /objectEncoding/.test(error.message));
    assert.equal(bytes.objectEncoding, 3);
    bytes.writeInt(-2);
    bytes.writeUnsignedInt(0xfedcba98);
    bytes.writeShort(-3);
    bytes.writeByte(-4);
    bytes.writeBoolean(true);
    bytes.writeFloat(1.25);
    bytes.writeDouble(-3.5);
    assert.equal(bytes.length, 24);
    assert.equal(bytes.position, 24);
    bytes.position = 0;
    assert.equal(bytes.readInt(), -2);
    assert.equal(bytes.readUnsignedInt(), 0xfedcba98);
    assert.equal(bytes.readShort(), -3);
    assert.equal(bytes.readByte(), -4);
    assert.equal(bytes.readBoolean(), true);
    assert.equal(bytes.readFloat(), 1.25);
    assert.equal(bytes.readDouble(), -3.5);
    assert.equal(bytes.bytesAvailable, 0);
    assert.throws(() => bytes.readUnsignedByte(), error => error instanceof AS3EOFError
        && error.name === "EOFError" && error.errorID === 2030
        && error.message === "End of file was encountered.");
});

test("little endian and UTF operations preserve byte order and UTF-8 length", () => {
    const bytes = new AS3ByteArray();
    bytes.endian = AS3Endian.LITTLE_ENDIAN;
    bytes.writeUnsignedInt(0x01020304);
    bytes.writeUTF("hé");
    bytes.writeUTFBytes("世界");
    assert.deepEqual([...new Uint8Array(bytes.toArrayBuffer()).slice(0, 4)], [4, 3, 2, 1]);
    bytes.position = 0;
    assert.equal(bytes.readUnsignedInt(), 0x01020304);
    assert.equal(bytes.readUTF(), "hé");
    assert.equal(bytes.readUTFBytes(bytes.bytesAvailable), "世界");
    assert.throws(() => { bytes.endian = "middleEndian"; }, /must be Endian/);
});

test("length, position, gaps, and byte copies are deterministic", () => {
    const source = new AS3ByteArray();
    source.writeUTFBytes("abcdef");
    source.position = 1;
    const target = new AS3ByteArray();
    target.length = 2;
    target.position = 9;
    target.writeByte(7);
    assert.equal(target.length, 10);
    assert.deepEqual([...new Uint8Array(target.toArrayBuffer()).slice(2, 9)], [0, 0, 0, 0, 0, 0, 0]);
    source.readBytes(target, 2, 3);
    assert.equal(source.position, 4);
    assert.equal(target.position, 10, "readBytes does not mutate destination position");
    target.position = 2;
    assert.equal(target.readUTFBytes(3), "bcd");

    const copy = new AS3ByteArray();
    copy.writeBytes(source, 0, 0);
    assert.deepEqual([...new Uint8Array(copy.toArrayBuffer())], [...new TextEncoder().encode("abcdef")]);
    copy.position = 2;
    copy.writeBytes(copy, 0, 3);
    copy.position = 0;
    assert.equal(copy.readUTFBytes(copy.length), "ababcf");

    const clamped = new AS3ByteArray();
    clamped.writeBytes(source, 5, 99);
    assert.deepEqual([...new Uint8Array(clamped.toArrayBuffer())], [102]);
    clamped.writeBytes(source, 99, 1);
    assert.deepEqual([...new Uint8Array(clamped.toArrayBuffer())], [102]);

    copy.length = 2;
    copy.length = 5;
    assert.deepEqual([...new Uint8Array(copy.toArrayBuffer())], [97, 98, 0, 0, 0]);
    copy.clear();
    assert.equal(copy.length, 0);
    assert.equal(copy.position, 0);
});

test("indexed ByteArray access preserves cipher-style unsigned byte mutation without moving position", () => {
    const bytes = AS3ByteArray.fromArrayBuffer(new Uint8Array([1, 2, 255]));
    bytes.position = 2;
    assert.equal(bytes[0], 1);
    bytes[1] = 258;
    bytes[5] = -1;
    assert.equal(bytes.position, 2);
    assert.equal(bytes.length, 6);
    assert.deepEqual([...new Uint8Array(bytes.toArrayBuffer())], [1, 2, 255, 0, 0, 255]);
    assert.equal(0 in bytes, true);
    assert.equal(6 in bytes, false);
    assert.throws(() => bytes[6], /index exceeds length/);
    assert.throws(() => { bytes[0xffffffff] = 1; }, RangeError);
    assert.equal(bytes.length, 6, "rejected uint-max write cannot mutate length");
});

test("writeMultiByte keeps explicit UTF-8 and host-authenticated default code pages distinct", () => {
    const utf8 = new AS3ByteArray();
    utf8.writeMultiByte("hé", "utf-8");
    assert.deepEqual([...new Uint8Array(utf8.toArrayBuffer())], [...new TextEncoder().encode("hé")]);

    const missing = new AS3ByteArray();
    assert.throws(() => missing.writeMultiByte("mail", ""), /requires an installed native encoder/);
    configureAS3SystemCodePageEncoder(value => new Uint8Array([...value].map(character => character.charCodeAt(0))));
    const system = new AS3ByteArray();
    system.writeMultiByte("mail", "");
    assert.deepEqual([...new Uint8Array(system.toArrayBuffer())], [109, 97, 105, 108]);
    assert.throws(() => system.writeMultiByte("x", "shift-jis"), /charset is not admitted/);
});

test("host ArrayBuffer seams copy bytes without exposing mutable storage", () => {
    const raw = new Uint8Array([1, 2, 3]);
    const bytes = AS3ByteArray.fromArrayBuffer(raw);
    raw[0] = 9;
    assert.deepEqual([...new Uint8Array(bytes.toArrayBuffer())], [1, 2, 3]);
    const exported = new Uint8Array(bytes.toArrayBuffer());
    exported[1] = 8;
    assert.deepEqual([...new Uint8Array(bytes.toArrayBuffer())], [1, 2, 3]);
    assert.equal("readObject" in bytes, true);
    assert.equal("writeObject" in bytes, true);
    assert.equal("uncompress" in bytes, true);
    const before=bytes.toArrayBuffer();
    assert.throws(()=>bytes.writeObject({value:1}),/authenticated shared AMF3 target/);
    assert.deepEqual(bytes.toArrayBuffer(),before,"missing provider cannot partially mutate bytes");
});

test("ByteArray rejects hostile allocation ranges before allocating or mutating content", () => {
    const bytes = AS3ByteArray.fromArrayBuffer(new Uint8Array([1, 2, 3]));
    assert.throws(() => { bytes.length = -1; }, /resource limit/);
    assert.equal(bytes.length, 3);
    bytes.position = -1;
    assert.throws(() => bytes.writeByte(4), /write range is invalid/);
    assert.deepEqual([...new Uint8Array(bytes.toArrayBuffer())], [1, 2, 3]);
    assert.throws(() => { bytes[256 * 1024 * 1024] = 1; }, /resource limit/);
    assert.equal(Object.prototype.hasOwnProperty.call(bytes, String(256 * 1024 * 1024)), false);
});

test("ByteArray nominal identity accepts allocations without consulting forged prototypes or proxy hooks",()=>{
    const {isAS3ByteArray}=require(path.join(OUTPUT,"hardened-runtime/AS3ByteArray.js"));
    const value=new AS3ByteArray();let hooks=0;
    const hostile=new Proxy({}, {get(){hooks++;throw new Error('unexpected read');},getPrototypeOf(){hooks++;throw new Error('unexpected prototype');}});
    assert.equal(isAS3ByteArray(value),true);
    for(const fake of [null,undefined,7,'bytes',{},Object.create(AS3ByteArray.prototype),new Proxy(value,{}),hostile])
        assert.equal(isAS3ByteArray(fake),false);
    assert.equal(hooks,0);
});
