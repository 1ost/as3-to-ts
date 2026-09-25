"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),path=require("node:path"),
    os=require("node:os"),cp=require("node:child_process");
const root=path.resolve(__dirname,"../..");

test("file-local runtime scope validates source identity before authority seals",t=>{
    const output=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"file-local-scope-")));
    t.after(()=>fs.rmSync(output,{recursive:true,force:true}));
    const config=path.join(output,"tsconfig.json");
    fs.writeFileSync(config,JSON.stringify({compilerOptions:{target:"ES2022",module:"CommonJS",strict:true,skipLibCheck:true,
        rootDir:path.join(root,"src/hardened-runtime"),outDir:path.join(output,"runtime")},
        files:[path.join(root,"src/hardened-runtime/internal/AS3TypeRegistry.ts")]}));
    cp.execFileSync(process.execPath,[path.join(root,"node_modules/typescript-4-9/bin/tsc"),"-p",config],{stdio:"inherit"});
    const script=`
        const assert=require('node:assert/strict'),crypto=require('node:crypto');
        const registry=require(${JSON.stringify(path.join(output,"runtime/internal/AS3TypeRegistry.js"))});
        const {fileLocalClassIdentity}=require(${JSON.stringify(path.join(output,"runtime/internal/AS3FileLocalIdentity.js"))});
        const scope={module:'application',sourcePath:'first/Owner.as',ownerQualifiedName:'first.Owner',name:'Item'};
        const identity=fileLocalClassIdentity(scope);
        const row={kind:'class',qname:identity.key,base:null,interfaces:[],sourceSha256:'a'.repeat(64),fields:[],
            objectTraits:{dynamic:false,members:[]},fileLocalScope:scope};
        const mode=process.argv[1];
        if(mode==='wrong-key')row.qname='FilePrivate(other)::Item';
        if(mode==='public-key')row.qname='first.Item';
        if(mode==='missing-scope')delete row.fileLocalScope;
        if(mode==='extra-scope')scope.extra=true;
        if(mode==='bad-owner')scope.ownerQualifiedName='node:fs';
        if(mode==='path-traversal')scope.sourcePath='../Owner.as';
        if(mode==='absolute-path')scope.sourcePath='/first/Owner.as';
        if(mode==='foreign-module')scope.module='other';
        if(mode==='renamed-class')scope.name='Other';
        const metadata={schema:'as3-runtime-type-authority@1',qnames:[row.qname],entries:[row]};
        class Item{}
        const entry={...row,constructor:Item,predicate:()=>false,constructionTarget:()=>null,constructionProof:()=>false};
        if(mode==='native-constructor'){entry.constructionTarget=null;entry.constructionProof=null;}
        const document={schema:metadata.schema,sha256:crypto.createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),
            qnames:metadata.qnames,entries:[entry]};
        if(mode==='stale-digest')scope.ownerQualifiedName='second.Owner';
        if(mode==='valid'){
            registry.installAS3TypeAuthority(document);
            assert.equal(registry.authorityStatus().sealed,true);
            assert.equal(registry.lookupStringClassName(Item),'FilePrivateNS:Owner::Item');
        }else{
            assert.throws(()=>registry.installAS3TypeAuthority(document),TypeError);
            assert.equal(registry.authorityStatus().sealed,false);
        }
    `;
    for(const mode of ['valid','wrong-key','public-key','missing-scope','extra-scope','bad-owner','path-traversal',
        'absolute-path','foreign-module','renamed-class','native-constructor','stale-digest'])
        assert.doesNotThrow(()=>cp.execFileSync(process.execPath,['-e',script,mode],{stdio:'pipe'}),mode);
});
