"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../.."),laya=process.env.HARDENED_FIXTURE_LAYA;
const sha=value=>crypto.createHash("sha256").update(value).digest("hex");
const output=fs.mkdtempSync(path.join(os.tmpdir(),"as3-uri-runtime-"));
fs.writeFileSync(path.join(output,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",strict:true,outDir:output},files:[path.join(root,"src/hardened-runtime/AS3URI.ts")]}));
cp.execFileSync(process.execPath,[path.join(root,"node_modules/typescript-4-9/bin/tsc"),"-p",path.join(output,"tsconfig.json")],{cwd:root,stdio:"inherit"});
const {as3EncodeURIComponent}=require(path.join(output,"AS3URI.js"));
test.after(()=>fs.rmSync(output,{recursive:true,force:true}));

const values={
 "unescaped":"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()",
 "reserved":";/?:@&=+$,#",
 "percent-space-control-nul":"% \t\r\n\u0000\u0001\u001f\u007f",
 "bmp-unicode":"é中€",
 "astral-unicode":"A😀𝄞Z",
 "lone-high-surrogate":"A\ud800Z",
 "lone-low-surrogate":"A\udc00Z",
};

test("URI helper matches retained AIR bytes and normalizes Chromium surrogate failures",{skip:!laya},()=>{
 const fixture=path.join(fs.realpathSync(laya),"tests/nativeFlashOracle/encode-uri-component");
 const retained=cp.spawnSync("git",["-C",laya,"merge-base","--is-ancestor","1563e72a6f3849554c3ccb3eacd615fd3083f435","HEAD"]);
 assert.equal(retained.status,0,"URI evidence revision is not retained by the selected Laya commit");
 const hashes={"native-air.json":"6e6fb03ff5373b9d57f2b4ce9f2b877619b48c12b93c789191780baa0fa470b2","browser-air.json":"427ae9b7408c6da2026090df4e3321af78719d49ea77e2e2d8046d8853f85adf","browser-pin.json":"42c5d4efebeb0eba8e4f98c9efd8b8529435033b35432b56188d14c0f61879b2"};
 for(const [name,digest] of Object.entries(hashes)) assert.equal(sha(fs.readFileSync(path.join(fixture,name))),digest);
 const native=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json"))),browser=JSON.parse(fs.readFileSync(path.join(fixture,"browser-air.json")));
 assert.equal(native.status,"passed");assert.equal(browser.status,"mismatch");assert.equal(browser.relation.encodedReturns,"equal");
 const rows=Object.fromEntries(native.capture.state.observations.map(row=>[row.id,row.result]));
 for(const [id,value] of Object.entries(values)) {
  if(rows[id].kind==="return") assert.equal(as3EncodeURIComponent(value),rows[id].value,id);
  else assert.throws(()=>as3EncodeURIComponent(value),error=>error instanceof URIError&&error.name===rows[id].name
   &&error.errorID===rows[id].errorID&&error.message===rows[id].message&&error.toString()===rows[id].stringValue,id);
 }
 assert.equal(browser.relation.exactThrownDiagnostics,"different");
});

test("URI helper has a closed one-String runtime boundary",()=>{
 assert.equal(as3EncodeURIComponent(";/ 😀"),"%3B%2F%20%F0%9F%98%80");
 for(const value of [undefined,null,1,{},["a"]]) assert.throws(()=>as3EncodeURIComponent(value),/one proven String/);
 for(const value of ["\ud800","\ud800A","\udc00","A\udc00"]) assert.throws(()=>as3EncodeURIComponent(value),error=>error.name==="URIError"&&error.errorID===1052);
});
