"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { buildSync } = require("esbuild");

test("Sprite drag admission requires exact AIR and authored Laya contracts", t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sprite-drag-mapping-"));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const bundle = path.join(dir, "ledger.cjs");
    buildSync({ entryPoints: [path.resolve(__dirname, "../../src/hardened/ledger.ts")],
        outfile: bundle, bundle: true, platform: "node", format: "cjs", logLevel: "silent" });
    const { selectCapabilityCandidates } = require(bundle);
    const targetStart = "{ (lockCenter?: boolean, bounds?: FlashRectangle | null): void; "
        + "(area?: LayaRectangle, hasInertia?: boolean, elasticDistance?: number, elasticBackTime?: number, "
        + "data?: any, ratio?: number): void; }";
    function mapping(name) {
        const start = name === "startDrag";
        return {
            sourceQName: "flash.display.Sprite", sourceRoles: ["instance-member"],
            sourceMember: { access: "call", name, minArgs: 0, maxArgs: start ? 2 : 0,
                signature: start
                    ? "public function startDrag(param1:Boolean = false, param2:flash.geom.Rectangle = null) : void"
                    : "public function stopDrag() : void" },
            targetCapabilityId: "api.flash.display", targetExport: "Sprite", targetKind: "class",
            targetModule: "src/layaAir/flash/display/Sprite.ts", targetSignature: "typeof Sprite",
            targetMember: { name, kind: "method", scope: "instance", signature: start ? targetStart : "() => void" },
        };
    }
    function select(candidate, alterSource = () => {}, alterTarget = () => {}) {
        const member = candidate.sourceMember;
        const source = { as3SourceCapabilities: {
            apis: [{ qname: candidate.sourceQName, classification: "layaair-flash-api-bridge",
                roles: ["import", "instance-member"], preserve: { apiName: true, signature: true } }],
            memberUses: [{ qname: candidate.sourceQName, member: member.name, access: "call",
                classification: "layaair-flash-api-bridge", argumentCount: 0, context: "instance-member",
                receiverType: candidate.sourceQName, preserveNameAndSignature: true,
                signatures: [{ signature: member.signature, minArgs: 0, maxArgs: member.maxArgs,
                    declaredBy: candidate.sourceQName, kind: "method", static: false, returnType: "void" }] }],
        } };
        alterSource(source);
        const target = { schema: "laya-authored-content-capabilities@1", capabilities: [{
            id: candidate.targetCapabilityId, status: "typescript-obligation", obligations: [{
                module: candidate.targetModule, export: candidate.targetExport, kind: candidate.targetKind,
                signature: candidate.targetSignature, constructors: ["new (): Sprite"],
                members: [candidate.targetMember],
            }],
        }] };
        alterTarget(target);
        return selectCapabilityCandidates(JSON.stringify(source), JSON.stringify(target),
            JSON.stringify({ schema: "as3-source-to-laya-capability-map@1", mappings: [candidate] }));
    }

    for (const name of ["startDrag", "stopDrag"]) {
        const candidate = mapping(name);
        assert.deepEqual(select(candidate).mappings, [candidate]);
    }
    for (const alterSource of [
        source => source.as3SourceCapabilities.apis.push(structuredClone(source.as3SourceCapabilities.apis[0])),
        source => source.as3SourceCapabilities.memberUses.push(structuredClone(source.as3SourceCapabilities.memberUses[0])),
        source => source.as3SourceCapabilities.memberUses[0].argumentCount = 1,
        source => source.as3SourceCapabilities.memberUses[0].receiverType = "flash.display.DisplayObject",
        source => source.as3SourceCapabilities.memberUses[0].signatures[0].declaredBy = "flash.display.DisplayObject",
        source => source.as3SourceCapabilities.memberUses[0].signatures[0].kind = "property",
        source => source.as3SourceCapabilities.memberUses[0].signatures[0].static = true,
        source => source.as3SourceCapabilities.memberUses[0].signatures[0].maxArgs = 6,
        source => source.as3SourceCapabilities.memberUses[0].signatures[0].returnType = "Boolean",
    ]) {
        const result = select(mapping("startDrag"), alterSource);
        assert.equal(result.mappings.length, 0);
        assert.equal(result.held.length, 1);
    }
    for (const alterTarget of [
        target => target.capabilities[0].obligations[0].module = "src/layaAir/laya/display/Sprite.ts",
        target => target.capabilities[0].obligations[0].signature = "typeof LayaSprite",
        target => target.capabilities[0].obligations[0].members[0].kind = "property",
        target => target.capabilities[0].obligations[0].members[0].scope = "static",
        target => target.capabilities[0].obligations[0].members[0].signature = targetStart.replace("FlashRectangle", "Rectangle"),
        target => target.capabilities[0].obligations[0].members.push(
            structuredClone(target.capabilities[0].obligations[0].members[0])),
    ]) {
        const result = select(mapping("startDrag"), () => {}, alterTarget);
        assert.equal(result.mappings.length, 0);
        assert.equal(result.held.length, 1);
    }
});
