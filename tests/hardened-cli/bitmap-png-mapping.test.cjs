'use strict';
const assert = require('node:assert/strict'), test = require('node:test'), fs = require('node:fs'),
    path = require('node:path'), os = require('node:os');

test('BitmapData.encode admission requires exact source and target member contracts', t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bitmap-png-mapping-'));
    t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
    const bundle = path.join(dir, 'ledger.cjs');
    require('esbuild').buildSync({entryPoints: [path.resolve(__dirname, '../../src/hardened/ledger.ts')],
        outfile: bundle, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent'});
    const {selectCapabilityCandidates} = require(bundle);
    const mapping = () => ({sourceQName: 'flash.display.BitmapData', sourceRoles: ['instance-member'],
        sourceMember: {name: 'encode', access: 'call', minArgs: 2, maxArgs: 3,
            signature: 'public function encode(rect:flash.geom.Rectangle, compressor:Object, bytes:flash.utils.ByteArray = null) : flash.utils.ByteArray'},
        targetCapabilityId: 'api.flash.display', targetModule: 'src/layaAir/flash/display/BitmapData.ts',
        targetExport: 'BitmapData', targetKind: 'class', targetSignature: 'typeof BitmapData',
        targetMember: {name: 'encode', kind: 'method', scope: 'instance',
            signature: '(rect: Rectangle, compressor: object, byteArray?: ByteArray | null) => ByteArray'}});
    function select(candidate, alterSource = () => {}, alterTarget = () => {}) {
        const source = {as3SourceCapabilities: {
            apis: [{qname: candidate.sourceQName, classification: 'layaair-flash-api-bridge',
                roles: candidate.sourceRoles, preserve: {apiName: true, signature: true}}],
            memberUses: [{qname: candidate.sourceQName, member: candidate.sourceMember.name,
                access: candidate.sourceMember.access, classification: 'layaair-flash-api-bridge', argumentCount: 2,
                context: 'instance-member', receiverType: candidate.sourceQName, preserveNameAndSignature: true,
                signatures: [{signature: candidate.sourceMember.signature, minArgs: candidate.sourceMember.minArgs,
                    maxArgs: candidate.sourceMember.maxArgs, declaredBy: candidate.sourceQName,
                    kind: 'method', static: false, returnType: 'flash.utils.ByteArray'}]}]}};
        const target = {schema: 'laya-authored-content-capabilities@1', capabilities: [{
            id: candidate.targetCapabilityId, status: 'typescript-obligation', obligations: [{
                module: candidate.targetModule, export: candidate.targetExport, kind: candidate.targetKind,
                signature: candidate.targetSignature, constructors: [], members: [candidate.targetMember]}]}]};
        alterSource(source); alterTarget(target);
        return selectCapabilityCandidates(JSON.stringify(source), JSON.stringify(target),
            JSON.stringify({schema: 'as3-source-to-laya-capability-map@1', mappings: [candidate]}));
    }
    assert.deepEqual(select(mapping()).mappings, [mapping()]);
    for (const change of [
        value => value.targetCapabilityId = 'api.flash.geom',
        value => value.targetModule = 'src/layaAir/laya/resource/Texture.ts',
        value => value.targetExport = 'Texture',
        value => value.sourceRoles = ['static-member'],
        value => value.sourceMember.minArgs = 1,
        value => value.sourceMember.maxArgs = 4,
        value => value.sourceMember.signature = value.sourceMember.signature.replace('compressor:Object', 'compressor:String'),
        value => value.targetMember.signature = value.targetMember.signature.replace('compressor: object', 'compressor: string'),
        value => value.targetMember.scope = 'static',
        value => value.targetMember.kind = 'property',
        value => value.targetMember.name = 'serialize',
    ]) {
        const candidate = mapping(); change(candidate);
        const result = select(candidate);
        assert.equal(result.mappings.length, 0, JSON.stringify(candidate));
        assert.equal(result.held.length, 1);
    }
    for (const alterSource of [
        source => source.as3SourceCapabilities.memberUses[0].signatures[0].static = true,
        source => source.as3SourceCapabilities.memberUses[0].signatures[0].returnType = 'Object',
        source => source.as3SourceCapabilities.memberUses[0].signatures.push(structuredClone(source.as3SourceCapabilities.memberUses[0].signatures[0])),
    ]) assert.equal(select(mapping(), alterSource).mappings.length, 0);
    assert.equal(select(mapping(), () => {}, target => {
        const members = target.capabilities[0].obligations[0].members; members.push(structuredClone(members[0]));
    }).mappings.length, 0);
});
