"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../.."),laya=process.env.HARDENED_FIXTURE_LAYA;
const layaRevision="ef6b67611ee494ab8711d22444f5a9a3ff6aa91e",sha=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");

test("String range/search helpers reproduce the retained AIR 51.3.3.2 oracle",{skip:!laya},t=>{
 const layaRoot=fs.realpathSync(laya),fixture=path.join(layaRoot,"tests/nativeFlashOracle/string-range-search");
 const retainedRevision=cp.spawnSync("git",["merge-base","--is-ancestor",layaRevision,"HEAD"],{cwd:layaRoot,encoding:"utf8"});assert.equal(retainedRevision.status,0,retainedRevision.stderr||"String oracle revision is not retained by the selected Laya commit");
 const hashes={"StringRangeSearchProbe.as":"cd8f0aee13fdf02b5c7c84670ef028676eac0393662ecb466ce3766ca07cfe42","scenario.json":"90045875a4e4b337fea079e6fb30bd99e9981bb007def4a7a85ad8816c46dc7f","sdk-authority.json":"2907bd62934615cd6d0b1687ef1d90e7bbd11129c72ea8e43f94a832e40a2175","native-air.json":"5c5d55fd2561b752076271685bedf2fcea25376dff531b955798627e304dfc96","browser-air.json":"8dbc8259f231cc1a1cb05e4b0033ace71f89a63f47e336022b6e3327567915f3"};
 for(const [name,expected] of Object.entries(hashes))assert.equal(sha(fs.readFileSync(path.join(fixture,name))),expected,name);
 const retained=JSON.parse(fs.readFileSync(path.join(fixture,"native-air.json"))),expected=new Map(retained.capture.state.observations.map(row=>[row.id,row.result]));
 assert.equal(retained.sdkVersion,"51.3.3.2");assert.equal(retained.captureRuns.identical,true);assert.equal(expected.size,20);

 const output=fs.mkdtempSync(path.join(os.tmpdir(),"as3-string-range-search-runtime-"));t.after(()=>fs.rmSync(output,{recursive:true,force:true}));
 const config=path.join(output,"tsconfig.json");fs.writeFileSync(config,JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",strict:true,rootDir:path.join(root,"src"),outDir:output},files:[path.join(root,"src/hardened-runtime/AS3Coerce.ts"),path.join(root,"src/hardened-runtime/AS3Object.ts")]}));
 cp.execFileSync(process.execPath,[path.join(root,"node_modules/typescript-4-9/bin/tsc"),"-p",config],{cwd:root,stdio:"inherit"});
 const runtime=require(path.join(output,"hardened-runtime/AS3Coerce.js")),text="ababa",dateText="20260907100506";
 const metadata={schema:"as3-runtime-type-authority@1",qnames:[],entries:[]};require(path.join(output,"hardened-runtime/internal/AS3TypeRegistry.js")).installAS3TypeAuthority({schema:metadata.schema,sha256:sha(JSON.stringify(metadata)),qnames:metadata.qnames,entries:metadata.entries});
 const last=(value,args=[])=>runtime.as3StringLastIndexOf(value,args),substring=(value,args=[])=>runtime.as3StringSubstring(value,args),slice=(value,args=[])=>runtime.as3StringSlice(value,args);
 const compare=(id,result)=>assert.deepEqual(result,expected.get(id),id);
 const configText="client_items_12",marker=last(configText,["_items_"]);
 compare("ap-exact-shapes",[marker,substring(configText,[0,marker]),slice(dateText,[0,4]),slice(dateText,[4,6]),slice(dateText,[6,8]),slice(dateText,[8,10]),slice(dateText,[10,12]),slice(dateText,[12,14])]);
 compare("omitted-arguments",[last(text),last(text,["a"]),substring(text),substring(text,[2]),slice(text),slice(text,[2])]);
 compare("explicit-undefined-null",[last(text,[undefined]),last(text,["a",undefined]),last(text,[null]),substring(text,[undefined]),substring(text,[1,undefined]),substring(text,[null]),slice(text,[undefined]),slice(text,[1,undefined]),slice(text,[null])]);
 compare("fractional-indices",[last(text,["a",3.9]),last(text,["a",-.9]),substring(text,[1.9,4.9]),substring(text,[-1.9,3.9]),slice(text,[1.9,4.9]),slice(text,[-1.9,4.9])]);
 compare("nonfinite-indices",[last(text,["a",NaN]),last(text,["a",Infinity]),last(text,["a",-Infinity]),substring(text,[NaN,Infinity]),substring(text,[-Infinity,3]),substring(text,[1,NaN]),slice(text,[NaN,Infinity]),slice(text,[-Infinity,3]),slice(text,[1,NaN])]);
 const negativeZero=-0;compare("signed-zero",[1/negativeZero===-Infinity,last(text,["a",negativeZero]),substring(text,[negativeZero,2]),slice(text,[negativeZero,2]),slice(text,[-negativeZero,2])]);
 compare("wide-indices",[last(text,["a",2147483647]),last(text,["a",2147483648]),last(text,["a",4294967296]),last(text,["a",-2147483649]),substring(text,[2147483648]),substring(text,[-2147483649,2]),slice(text,[2147483648]),slice(text,[-2147483649,2])]);
 compare("swapped-and-negative-bounds",[substring(text,[4,1]),substring(text,[4,-1]),substring(text,[9,2]),slice(text,[4,1]),slice(text,[4,-1]),slice(text,[-4,-1]),slice(text,[-1,-4])]);
 const unicode="A\uD83D\uDE00\u00E9\u4E2DZ";compare("utf16-boundaries",[unicode.length,substring(unicode,[1,2])==="\uD83D",substring(unicode,[2,3])==="\uDE00",slice(unicode,[1,3]),slice(unicode,[-2]),substring(unicode,[3,5]),slice(unicode,[3,5])]);
 compare("last-index-positions",[last(text,["a"]),last(text,["a",2147483647]),last(text,["a",4]),last(text,["a",3]),last(text,["a",0]),last(text,["a",-1]),last(text,["a",NaN]),last(text,["a",Infinity]),last(text,["a",-Infinity])]);
 compare("empty-and-missing-search",[last(text,["x"]),last(text,["",0]),last(text,["",2]),last(text,[""]),last("",[""]),substring(""),slice("")]);

 const events=[],receiver=value=>(events.push("receiver"),value),expression=(label,value)=>(events.push(label+"-expression"),value),object=(label,value,fail=false,method=label==="search"?"toString":"valueOf")=>({[method](){events.push(label+"-conversion");if(fail)throw new Error(label+"-conversion");return value;}}),failure=error=>[error.name,error.errorID??0,error.message];
 let search=object("search","a"),position=object("position",3);
 compare("last-index-coercion-order",[last(receiver(text),[expression("search",search),expression("position",position)]),events.join("|")]);events.length=0;
 let start=object("start",1),end=object("end",4);compare("substring-coercion-order",[substring(receiver(text),[expression("start",start),expression("end",end)]),events.join("|")]);events.length=0;
 start=object("start",1);end=object("end",4);compare("slice-coercion-order",[slice(receiver(text),[expression("start",start),expression("end",end)]),events.join("|")]);events.length=0;
 let info=[];try{last(receiver(text),[expression("search",object("search","a",true)),expression("position",object("position",3))]);}catch(error){info=failure(error);}compare("search-conversion-throw",[info,events.join("|")]);events.length=0;info=[];
 try{last(receiver(text),[expression("search",object("search","a")),expression("position",object("position",3,true))]);}catch(error){info=failure(error);}compare("position-conversion-throw",[info,events.join("|")]);events.length=0;info=[];
 try{slice(receiver(text),[expression("start",object("start",1,true)),expression("end",object("end",4))]);}catch(error){info=failure(error);}compare("slice-conversion-throw",[info,events.join("|")]);
 for(const [id,operation,args] of [["last-index-null-receiver",last,["a",3]],["substring-null-receiver",substring,[1,3]],["slice-null-receiver",slice,[1,3]]]){events.length=0;info=[];try{operation(receiver(null),args.map((value,index)=>expression(operation===last?(index?"position":"search"):(index?"end":"start"),value)));}catch(error){info=failure(error);}compare(id,[info,events.join("|")]);}

 assert.throws(()=>last({},["a"]),/original String/);assert.throws(()=>substring("a",[0,1,2]),/at most two arguments/);assert.throws(()=>slice(undefined,[]),error=>error.errorID===1010);
});
