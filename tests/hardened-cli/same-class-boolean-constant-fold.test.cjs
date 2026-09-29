"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),test=require("node:test");
const {spawnSync}=require("node:child_process");
const ROOT=path.resolve(__dirname,"../.."),AIR=process.env.HARDENED_FIXTURE_AIR_SDK,
 LAYA=process.env.HARDENED_FIXTURE_LAYA&&fs.realpathSync.native(process.env.HARDENED_FIXTURE_LAYA);

test("only authenticated same-class private static literal Boolean constants fold unreachable branches",{skip:!AIR||!LAYA},t=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"same-class-boolean-fold-")));let completed=false;
 t.after(()=>{if(completed)fs.rmSync(root,{recursive:true,force:true});else t.diagnostic("Retained failure: "+root);});
 const source=path.join(root,"source"),profile=path.join(root,"profile"),output=path.join(root,"output");fs.mkdirSync(source);
 const write=(name,body)=>fs.writeFileSync(path.join(source,name+".as"),`package {public class ${name} {${body}}}\n`);
 write("FoldBefore",`private static const OFF:Boolean=false;
  public function run():int {if(OFF){missing();}return 7;}`);
 write("FoldAfter",`public function run():int {if(OFF){missing();}return 8;}
  private static const OFF:Boolean=false;`);
 write("FoldTrueElse",`private static const ON:Boolean=true;
  public function run():int {if(ON){return 9;}else{missing();}}`);
 write("Enabled",`private static const ON:Boolean=true;
  public function run():int {if(ON){missing();}return 1;}`);
 write("Mutable",`private static var OFF:Boolean=false;
  public function run():int {if(OFF){missing();}return 1;}`);
 write("Public",`public static const OFF:Boolean=false;
  public function run():int {if(OFF){missing();}return 1;}`);
 write("Shadowed",`private static const OFF:Boolean=false;
  public function run(OFF:Boolean):int {if(OFF){missing();}return 1;}`);
 write("Hoisted",`private static const OFF:Boolean=false;
  public function run():int {if(OFF){var value:int=1;missing();}return value;}`);
 const run=(command,args,timeout=180000)=>{const result=spawnSync(command,args,{cwd:ROOT,encoding:"utf8",timeout});assert.equal(result.status,0,result.stdout+result.stderr);};
 run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","FoldBefore","--air-sdk",AIR,"--laya",LAYA,"--output",profile]);
 run(process.execPath,["bin/as3-frontend","qualify",source,output,"--source-census",path.join(profile,"census.json"),
  "--target-capabilities",path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 const rows=JSON.parse(fs.readFileSync(path.join(output,"manifest.json"),"utf8")).files;
 const admitted=["FoldBefore","FoldAfter","FoldTrueElse"],held=["Enabled","Mutable","Public","Shadowed","Hoisted"];
 for(const name of admitted){const row=rows.find(value=>value.sourcePath===name+".as");assert.equal(row.status,"admitted",JSON.stringify(row));}
 for(const name of held){
  const row=rows.find(value=>value.sourcePath===name+".as");assert.equal(row.status,"held",JSON.stringify(row));
  assert.equal(row.code,"HARDENED_IDENTIFIER_SCOPE",JSON.stringify(row));
 }
 for(const name of held)fs.rmSync(path.join(source,name+".as"));fs.rmSync(profile,{recursive:true});fs.rmSync(output,{recursive:true});
 run("python3",["-B","tools/create-fixture-profile.py","--source",source,"--entry","FoldBefore","--air-sdk",AIR,"--laya",LAYA,"--output",profile]);
 run(process.execPath,["bin/as3-frontend","transpile",source,output,"--source-census",path.join(profile,"census.json"),
  "--target-capabilities",path.join(LAYA,"docTool/architecture/authored-content-capabilities.json"),"--profile-lock",path.join(profile,"profile-lock.json")]);
 const emittedRows=JSON.parse(fs.readFileSync(path.join(output,"manifest.json"),"utf8")).files;
 for(const name of admitted){
  const row=emittedRows.find(value=>value.sourcePath===name+".as");assert.ok(row&&row.typescriptPath,JSON.stringify(row));
  const emitted=fs.readFileSync(path.join(output,row.typescriptPath),"utf8");assert.doesNotMatch(emitted,/missing/);
 }
 completed=true;
});
