"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const test = require("node:test");
const { buildSync } = require("esbuild");

test("bounds admission retains the complete authenticated Flash bridge overload", t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bounds-mapping-"));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const bundle = path.join(dir, "ledger.cjs");
    buildSync({ entryPoints: [path.resolve(__dirname, "../../src/hardened/ledger.ts")],
        outfile: bundle, bundle: true, platform: "node", format: "cjs", logLevel: "silent" });
    const { selectCapabilityCandidates } = require(bundle);
    const sourceSignature = "public function getBounds(param1:flash.display.DisplayObject) : flash.geom.Rectangle";
    const targetSignature = "{ (targetCoordinateSpace: DisplayObject | null): Rectangle; (out?: LayaRectangle): LayaRectangle; }";
    const original = {
        sourceQName: "flash.display.DisplayObject", sourceRoles: ["instance-member"],
        sourceMember: { access: "call", name: "getBounds", minArgs: 1, maxArgs: 1, signature: sourceSignature },
        targetCapabilityId: "api.flash.display", targetExport: "DisplayObject", targetKind: "class",
        targetModule: "src/layaAir/flash/display/DisplayObject.ts", targetSignature: "typeof DisplayObject",
        targetMember: { name: "getBounds", kind: "method", scope: "instance", signature: targetSignature },
    };
    function select(mapping) {
        // Match both documents to the candidate, so negative cases exercise
        // compatibility checking in addition to ordinary hash/identity checks.
        const source = { as3SourceCapabilities: {
            apis: [{ qname: mapping.sourceQName, classification: "layaair-flash-api-bridge",
                roles: ["instance-member"], preserve: { apiName: true, signature: true } }],
            memberUses: [{ qname: mapping.sourceQName, member: "getBounds", access: "call",
                classification: "layaair-flash-api-bridge", argumentCount: 1, context: "instance-member", preserveNameAndSignature: true,
                signatures: [{ signature: mapping.sourceMember.signature, minArgs: 1, maxArgs: 1 }] }],
        } };
        const target = { schema: "laya-authored-content-capabilities@1", capabilities: [{
            id: mapping.targetCapabilityId, status: "typescript-obligation", obligations: [{
                module: mapping.targetModule, export: mapping.targetExport, kind: "class",
                signature: mapping.targetSignature, members: [mapping.targetMember],
            }],
        }] };
        return selectCapabilityCandidates(JSON.stringify(source), JSON.stringify(target),
            JSON.stringify({ schema: "as3-source-to-laya-capability-map@1", mappings: [mapping] }));
    }
    assert.deepEqual(select(original).mappings, [original], JSON.stringify(select(original).held));
    for (const change of [
        m => m.targetMember.signature = "(targetCoordinateSpace: DisplayObject) => Rectangle",
        m => m.targetMember.signature = targetSignature.replace(": Rectangle;", ": LayaRectangle;"),
        m => m.targetMember.signature = targetSignature.replace("out?: LayaRectangle", "out?: DisplayObject"),
        m => m.targetModule = "src/layaAir/display/Sprite.ts",
        m => m.sourceQName = "flash.display.Sprite",
        m => m.sourceMember.signature = sourceSignature.replace("flash.display.DisplayObject", "Object"),
    ]) {
        const mapping = structuredClone(original); change(mapping);
        const result = select(mapping);
        assert.equal(result.mappings.length, 0);
        assert.equal(result.held.length, 1);
    }
});
