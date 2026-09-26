"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { buildSync } = require("esbuild");

test("scrollRect admission requires the exact inherited Flash DisplayObject bridge", t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scroll-rect-mapping-"));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const bundle = path.join(dir, "ledger.cjs");
    buildSync({ entryPoints: [path.resolve(__dirname, "../../src/hardened/ledger.ts")],
        outfile: bundle, bundle: true, platform: "node", format: "cjs", logLevel: "silent" });
    const { selectCapabilityCandidates } = require(bundle);

    function mapping(access) {
        const read = access === "read";
        return {
            sourceQName: "flash.display.DisplayObject", sourceRoles: ["instance-member"],
            sourceMember: { access, name: "scrollRect", minArgs: read ? 0 : 1, maxArgs: read ? 0 : 1,
                signature: read ? "public function get scrollRect() : flash.geom.Rectangle"
                    : "public function set scrollRect(param1:flash.geom.Rectangle) : void" },
            targetCapabilityId: "api.flash.display", targetExport: "DisplayObject", targetKind: "class",
            targetModule: "src/layaAir/flash/display/DisplayObject.ts", targetSignature: "typeof DisplayObject",
            targetMember: { name: "scrollRect", kind: "get+set", scope: "instance", signature: "Rectangle" },
        };
    }
    function select(candidate, alterSource = () => {}, alterTarget = () => {}) {
        const source = { as3SourceCapabilities: {
            apis: [{ qname: candidate.sourceQName, classification: "layaair-flash-api-bridge",
                roles: candidate.sourceRoles, preserve: { apiName: true, signature: true } }],
            memberUses: [{ qname: candidate.sourceQName, member: "scrollRect", access: candidate.sourceMember.access,
                classification: "layaair-flash-api-bridge", argumentCount: null,
                context: "instance-member", receiverType: candidate.sourceQName, preserveNameAndSignature: true,
                signatures: [{ signature: candidate.sourceMember.signature, minArgs: candidate.sourceMember.minArgs,
                    maxArgs: candidate.sourceMember.maxArgs, declaredBy: candidate.sourceQName,
                    kind: candidate.sourceMember.access === "read" ? "get" : "set", static: false,
                    returnType: candidate.sourceMember.access === "read" ? "flash.geom.Rectangle" : "void" }] }],
        } };
        alterSource(source);
        const target = { schema: "laya-authored-content-capabilities@1", capabilities: [{
            id: candidate.targetCapabilityId, status: "typescript-obligation", obligations: [{
                module: candidate.targetModule, export: candidate.targetExport, kind: candidate.targetKind,
                signature: candidate.targetSignature, constructors: ["new (): DisplayObject"],
                members: [candidate.targetMember],
            }],
        }] };
        alterTarget(target);
        return selectCapabilityCandidates(JSON.stringify(source), JSON.stringify(target),
            JSON.stringify({ schema: "as3-source-to-laya-capability-map@1", mappings: [candidate] }));
    }

    for (const access of ["read", "write"]) {
        const candidate = mapping(access);
        assert.deepEqual(select(candidate).mappings, [candidate]);
    }
    for (const change of [
        value => value.sourceQName = "flash.display.Sprite",
        value => value.sourceRoles = ["static-member"],
        value => value.sourceMember.signature = value.sourceMember.signature.replace("flash.geom.Rectangle", "Object"),
        value => value.targetCapabilityId = "api.flash.geom",
        value => value.targetModule = "src/layaAir/laya/display/Sprite.ts",
        value => value.targetExport = "Sprite",
        value => value.targetMember.kind = "property",
        value => value.targetMember.signature = "LayaRectangle",
    ]) {
        const candidate = mapping("read"); change(candidate);
        const result = select(candidate);
        assert.equal(result.mappings.length, 0);
        assert.equal(result.held.length, 1);
    }
    for (const alterSource of [
        source => source.as3SourceCapabilities.apis.push(structuredClone(source.as3SourceCapabilities.apis[0])),
        source => source.as3SourceCapabilities.memberUses.push(structuredClone(source.as3SourceCapabilities.memberUses[0])),
        source => source.as3SourceCapabilities.memberUses[0].argumentCount = 0,
        source => source.as3SourceCapabilities.memberUses[0].receiverType = "flash.display.Sprite",
        source => source.as3SourceCapabilities.memberUses[0].signatures[0].declaredBy = "flash.display.Sprite",
        source => source.as3SourceCapabilities.memberUses[0].signatures[0].kind = "set",
        source => source.as3SourceCapabilities.memberUses[0].signatures[0].static = true,
        source => source.as3SourceCapabilities.memberUses[0].signatures[0].minArgs = 99,
        source => source.as3SourceCapabilities.memberUses[0].signatures[0].maxArgs = 99,
        source => source.as3SourceCapabilities.memberUses[0].signatures[0].returnType = "Object",
    ]) {
        const result = select(mapping("read"), alterSource);
        assert.equal(result.mappings.length, 0);
        assert.equal(result.held.length, 1);
    }
    const duplicateTarget = select(mapping("read"), () => {}, target => {
        const members = target.capabilities[0].obligations[0].members;
        members.push(structuredClone(members[0]));
    });
    assert.equal(duplicateTarget.mappings.length, 0);
    assert.equal(duplicateTarget.held.length, 1);
});
