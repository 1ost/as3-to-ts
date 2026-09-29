'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'as3-equality-'));
fs.writeFileSync(path.join(output, 'tsconfig.json'), JSON.stringify({compilerOptions: {
    target:'ES2022', module:'CommonJS', strict:true, skipLibCheck:true,
    rootDir:path.join(root,'src'), outDir:output,
}, files:[path.join(root,'src/hardened-runtime/AS3Coerce.ts')]}));
cp.execFileSync(process.execPath, [path.join(root,'node_modules/typescript-4-9/bin/tsc'), '-p', path.join(output,'tsconfig.json')], {stdio:'inherit'});
const {as3Equals, as3String} = require(path.join(output,'hardened-runtime/AS3Coerce.js'));
const registry = require(path.join(output,'hardened-runtime/internal/AS3TypeRegistry.js'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
class LooseEqualityProbe {}
const row = {kind:'class',qname:'LooseEqualityProbe',base:null,interfaces:[],sourceSha256:'a'.repeat(64),fields:[],objectTraits:{dynamic:false,members:[]}};
const metadata = {schema:'as3-runtime-type-authority@1',qnames:[row.qname],entries:[row]};
registry.installAS3TypeAuthority({schema:metadata.schema,sha256:sha(JSON.stringify(metadata)),qnames:metadata.qnames,entries:[{
    ...row,constructor:LooseEqualityProbe,predicate:value=>value instanceof LooseEqualityProbe,
    constructionTarget:null,constructionProof:null,
}]});
test.after(() => fs.rmSync(output,{recursive:true,force:true}));
const laya = process.env.HARDENED_FIXTURE_LAYA;
test('abstract equality matches retained AIR values, reference identity, conversion order and errors', {skip:!laya}, () => {
    const dir = path.join(laya,'tests/nativeFlashOracle/loose-equality');
    const golden = JSON.parse(fs.readFileSync(path.join(dir,'native-air.json'),'utf8'));
    assert.equal(sha(fs.readFileSync(path.join(dir,'LooseEqualityProbe.as'))),golden.sourceSha256);
    assert.equal(sha(fs.readFileSync(path.join(dir,'scenario.json'))),golden.scenarioSha256);
    const scenario = JSON.parse(fs.readFileSync(path.join(dir,'scenario.json'),'utf8'));
    const owner = new LooseEqualityProbe();
    for (const {id,...expected} of golden.capture.state.observations) {
        const {method,args} = scenario.steps.find(value=>value.id===id).calls[0];
        const events = [], actual = {equal:false,different:false,reverse:false,order:'',failure:''};
        const record = (name,value) => function(){events.push(name);return value;};
        let left, right = 7;
        if (method === 'literals') [left,right] = args;
        else if (method === 'reference') {left=args[0]==='self'?owner:args[0]==='null'?null:{};right=owner;}
        else if (method === 'special') {
            const mode = args[0];
            const pairs = {
                __proto__:null,
                'undefined-null':[undefined,null], 'undefined-zero':[undefined,0], nan:[NaN,NaN],
                'other-object':[{},{}], 'same-class':[LooseEqualityProbe,LooseEqualityProbe],
                'class-string':[LooseEqualityProbe,'[class LooseEqualityProbe]'],
                'function-string':[function(){},'function Function() {}'],
                'array-number':[[7],7], 'empty-array':[[],0], 'array-null':[[],null],
                'object-pair':[{valueOf:record('left',7)},{valueOf:record('right',7)}],
                'object-null':[{valueOf:record('valueOf',0)},null],
            };
            if (pairs[mode]) [left,right] = pairs[mode];
            else if (mode === 'same-object' || mode === 'same-function') {left=mode==='same-object'?{}:function(){};right=left;}
            else {
                left={valueOf:record('valueOf',7),toString:record('toString','wrong')};
                if (mode==='string-hint') {left.toString=record('toString','text');right='text';}
                if (mode==='fallback') {left.valueOf=record('valueOf',{});left.toString=record('toString','7');}
                if (mode==='null-return') {left.valueOf=record('valueOf',null);left.toString=record('toString','7');}
                if (mode==='undefined-return') {left.valueOf=record('valueOf',undefined);left.toString=record('toString','7');}
                if (mode==='noncallable') left.valueOf=7;
                if (mode==='failure') {left.valueOf=record('valueOf',{});left.toString=record('toString',{});}
                if (mode==='throw') left.valueOf=function(){events.push('valueOf');throw new Error('conversion failed');};
            }
        }
        try {
            if (method==='evaluation') {
                const a=()=>{events.push('left-eval');return {valueOf:record('convert',7)};};
                const b=()=>{events.push('right-eval');return 7;};
                actual.equal=as3Equals(a(),b());actual.different=!as3Equals(a(),b());
            } else {
                actual.equal=as3Equals(left,right);actual.different=!as3Equals(left,right);actual.reverse=as3Equals(right,left);
            }
        } catch(error) {actual.failure=as3String(error);}
        actual.order=events.join(',');
        assert.deepEqual(actual,expected,id);
    }
});
test('equality rejects host-only primitives without probing object conversion', () => {
    const object={valueOf(){assert.fail('host primitive must fail before native conversion');}};
    for (const value of [1n,Symbol()]) {
        for (const pair of [[value,object],[object,value],[value,value]])
            assert.throws(()=>as3Equals(...pair),{name:'AS3ObjectDispatchUnavailable'});
    }
});
