const assert = require('node:assert/strict');
const test = require('node:test');
const {spawnSync} = require('node:child_process');
const {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join, resolve} = require('node:path');
const ROOT=resolve(__dirname,'../..');
const sdk=process.env.HARDENED_FIXTURE_AIR_SDK, laya=process.env.HARDENED_FIXTURE_LAYA;

test('native property profiles preserve super access and reject mismatched overrides', {skip:!sdk||!laya}, t => {
    const dir=realpathSync(mkdtempSync(join(tmpdir(),'as3-native-property-')));
    t.after(()=>rmSync(dir,{recursive:true,force:true}));
    function qualify(name, text) {
        const source=join(dir,name), profile=join(dir,name+'-profile'), output=join(dir,name+'-output');mkdirSync(source);
        writeFileSync(join(source,'Probe.as'),text);
        const generated=spawnSync('python3',[join(ROOT,'tools/create-fixture-profile.py'),'--source',source,'--entry','Probe',
            '--laya',laya,'--air-sdk',sdk,'--output',profile],{encoding:'utf8',timeout:60000});
        assert.equal(generated.status,0,generated.stderr);
        const result=spawnSync(process.execPath,[join(ROOT,'bin/as3-frontend'),'qualify',source,output,'--source-census',join(profile,'census.json'),
            '--profile-lock',join(profile,'profile-lock.json'),'--target-capabilities',join(laya,'docTool/architecture/authored-content-capabilities.json')],{encoding:'utf8',timeout:30000});
        assert.equal(result.status,0,result.stderr);
        return JSON.parse(readFileSync(join(output,'manifest.json'),'utf8')).files[0];
    }
    const source='package { import flash.display.Sprite; public class Probe extends Sprite { public var count:int; public function Probe(){super();} override public function get visible():Boolean {return super.visible;} override public function set visible(value:Boolean):void {++count; super.visible=value; mouseEnabled=super.visible;} } }';
    assert.equal(qualify('valid',source).status,'admitted');
    assert.equal(qualify('bad-type',source.replace('get visible():Boolean','get visible():Number')).code,'HARDENED_OVERRIDE_SIGNATURE');
    assert.equal(qualify('missing-native',source.replace('mouseEnabled=super.visible','missingNativeProperty=super.visible')).code,'HARDENED_IDENTIFIER_SCOPE');
});
