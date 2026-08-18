"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const repository = path.resolve(__dirname, "../..");
const sourceCensus = process.env.HARDENED_SOURCE_CAPABILITY_CENSUS
    || "C:/Users/admin/Desktop/GITHUB REPO/bleach-services/as3-to-layaair-porting-kit/generated/reports/swf-capability-census.json";
const targetCapabilities = process.env.HARDENED_TARGET_CAPABILITIES
    || "C:/Users/admin/Desktop/GITHUB REPO/LayaAir/docTool/architecture/authored-content-capabilities.json";

function canonicalJson(value) {
    if (value === null || typeof value === "boolean" || typeof value === "string" || typeof value === "number") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}

test("capability map regenerates byte-identically from both authorities", t => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "as3-capability-map-"));
    t.after(() => fs.rmSync(output, { recursive: true, force: true }));
    const mapping = path.join(output, "capability-map.json");
    const lock = path.join(output, "authority-lock.json");
    const result = spawnSync(process.execPath, [
        path.join(repository, "tools", "generate-capability-map.cjs"),
        sourceCensus,
        targetCapabilities,
        mapping,
        lock,
    ], { cwd: os.tmpdir(), encoding: "utf8", timeout: 20_000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    const canonical = value => value.replace(/\r\n?/g, "\n");
    assert.equal(canonical(fs.readFileSync(mapping, "utf8")),
        canonical(fs.readFileSync(path.join(repository, "config", "capability-map.json"), "utf8")));
    assert.equal(canonical(fs.readFileSync(lock, "utf8")),
        canonical(fs.readFileSync(path.join(repository, "config", "authority-lock.json"), "utf8")));
    const document = JSON.parse(fs.readFileSync(mapping, "utf8"));
    const typeMappings = document.mappings.filter(item => item.sourceMember === null);
    const memberMappings = document.mappings.filter(item => item.sourceMember !== null);
    assert.equal(typeMappings.length, 30);
    assert.equal(memberMappings.length, 138);
    assert.equal(memberMappings.filter(item => item.targetMember.kind === "constructor").length, 13);
    assert.equal(memberMappings.filter(item => ["getBounds", "getRect", "scrollRect"]
        .includes(item.sourceMember.name)).length, 0);
    assert.equal(memberMappings.filter(item => item.sourceQName === "flash.geom.Point").length, 6);
    assert.equal(memberMappings.filter(item => item.sourceQName === "flash.geom.Rectangle").length, 18);
    assert.equal(memberMappings.some(item => item.sourceQName === "flash.text.TextField"
        && item.sourceMember.name === "autoSize" && item.sourceMember.access === "write"), false);
    assert.equal(memberMappings.some(item => !["flash.geom.Point", "flash.geom.Rectangle", "flash.display.Bitmap",
        "flash.display.BitmapData", "flash.display.BitmapDataChannel"].includes(item.sourceQName)
        && item.sourceMember.access !== "call"), false);
    for (const qname of ["flash.display.Bitmap", "flash.display.BitmapData",
        "flash.display.BitmapDataChannel", "flash.display.PixelSnapping"]) {
        assert.equal(typeMappings.some(item => item.sourceQName === qname), true, qname);
        assert.equal(memberMappings.some(item => item.sourceQName === qname), qname !== "flash.display.PixelSnapping", qname);
    }
    assert.deepEqual(memberMappings.filter(item => item.sourceQName === "flash.display.Bitmap")
        .map(item => `${item.sourceMember.access}:${item.sourceMember.name}`).sort(),
    ["read:bitmapData", "read:smoothing", "write:bitmapData", "write:smoothing"]);
    assert.deepEqual(memberMappings.filter(item => item.sourceQName === "flash.display.BitmapDataChannel")
        .map(item => `${item.sourceMember.name}:${item.targetMember.signature}`).sort(), ["ALPHA:8", "RED:1"]);
    assert.equal(memberMappings.some(item => ["draw", "applyFilter"].includes(item.sourceMember.name)), false);
    assert.deepEqual(memberMappings.filter(item => item.sourceQName === "flash.text.TextField")
        .map(item => item.sourceMember.name).sort(), ["TextField", "addEventListener", "appendText", "getCharBoundaries",
        "getCharIndexAtPoint", "getLineLength", "getLineOffset", "getTextFormat", "removeEventListener", "replaceText",
        "setSelection", "setTextFormat"]);
    assert.equal(memberMappings.some(item => item.sourceQName === "flash.text.TextFormat"), false);
    assert.deepEqual(memberMappings.filter(item => item.sourceQName.startsWith("flash.filters."))
        .map(item => `${item.sourceQName}:${item.sourceMember.name}`).sort(), [
        "flash.filters.BlurFilter:BlurFilter", "flash.filters.DropShadowFilter:DropShadowFilter",
        "flash.filters.GlowFilter:GlowFilter"]);

    const baseline = spawnSync("git", ["show",
        "01f78fb5200240cae7f0e6abd01d494720adeb0e:config/capability-map.json"],
    { cwd: repository, encoding: "utf8", timeout: 10_000, windowsHide: true });
    assert.equal(baseline.status, 0, baseline.stderr);
    const baselineDocument = JSON.parse(baseline.stdout);
    const mappingKey = item => [item.sourceQName, item.sourceMember?.access || "", item.sourceMember?.name || "",
        item.sourceMember?.signature || ""].join("\u0000");
    const currentKeys = new Set(document.mappings.map(mappingKey));
    assert.equal(baselineDocument.mappings.length, 130);
    assert.equal(baselineDocument.mappings.every(item => currentKeys.has(mappingKey(item))), true,
        "the exact accepted 01f mapping key set must be preserved");
    assert.equal(document.mappings.length - baselineDocument.mappings.length, 38);
    for (const item of document.mappings) {
        assert.match(item.targetModule, /^src\/layaAir\/flash\//);
        assert.doesNotMatch(item.targetExport, /^_/);
        if (item.targetMember) assert.doesNotMatch(item.targetMember.name, /^_/);
    }
});

test("geometry generation fails closed on forged types, ambiguous targets, cross-runtime properties, and bounds lookalikes", t => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "as3-capability-map-adversarial-"));
    t.after(() => fs.rmSync(output, { recursive: true, force: true }));
    const alteredTarget = JSON.parse(fs.readFileSync(targetCapabilities, "utf8"));
    const geometry = alteredTarget.capabilities.find(item => item.id === "api.flash.geom");
    const point = geometry.obligations.find(item => item.export === "Point");
    point.members.find(item => item.name === "x").signature = "number | null";
    const rectangle = geometry.obligations.find(item => item.export === "Rectangle");
    rectangle.members.push({ ...rectangle.members.find(item => item.name === "clone") });
    rectangle.members.find(item => item.name === "width").signature = "string";
    rectangle.members.find(item => item.name === "intersection").signature = "(toIntersect: Rectangle) => Rectangle | null";
    const text = alteredTarget.capabilities.find(item => item.id === "api.flash.text");
    const textField = text.obligations.find(item => item.export === "TextField");
    textField.members.find(item => item.name === "autoSize").signature = "string";
    const display = alteredTarget.capabilities.find(item => item.id === "api.flash.display");
    const bitmap = display.obligations.find(item => item.export === "Bitmap");
    bitmap.members.find(item => item.name === "smoothing").signature = "boolean | null";
    bitmap.members.find(item => item.name === "bitmapData").readonly = true;
    const bitmapData = display.obligations.find(item => item.export === "BitmapData");
    bitmapData.members.find(item => item.name === "getPixel").signature = "(x: number, y: number) => number | null";
    bitmapData.members.push({ name: "draw", kind: "method", scope: "instance", signature: "(source: unknown) => void" });
    bitmapData.members.push({ name: "applyFilter", kind: "method", scope: "instance",
        signature: "(sourceBitmapData: BitmapData, sourceRect: Rectangle, destPoint: Point, filter: unknown) => void" });
    const channel = display.obligations.find(item => item.export === "BitmapDataChannel");
    channel.members.find(item => item.name === "RED").readonly = false;
    channel.members.find(item => item.name === "ALPHA").signature = "7";
    for (const capability of alteredTarget.capabilities) {
        for (const obligation of capability.obligations || []) {
            for (const member of obligation.members || []) {
                if (member.name === "getBounds") {
                    member.signature = "(targetCoordinateSpace: DisplayObject) => Rectangle";
                }
            }
        }
    }
    const target = path.join(output, "target.json");
    fs.writeFileSync(target, JSON.stringify(alteredTarget), "utf8");
    const mapping = path.join(output, "capability-map.json");
    const lock = path.join(output, "authority-lock.json");
    const result = spawnSync(process.execPath, [
        path.join(repository, "tools", "generate-capability-map.cjs"),
        sourceCensus, target, mapping, lock,
    ], { cwd: os.tmpdir(), encoding: "utf8", timeout: 20_000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    const document = JSON.parse(fs.readFileSync(mapping, "utf8"));
    assert.equal(document.mappings.some(item => item.sourceQName === "flash.geom.Point"
        && item.sourceMember?.name === "x"), false);
    assert.equal(document.mappings.some(item => item.sourceQName === "flash.geom.Rectangle"
        && item.sourceMember?.name === "clone"), false);
    assert.equal(document.mappings.some(item => item.sourceQName === "flash.geom.Rectangle"
        && item.sourceMember?.name === "width"), false);
    assert.equal(document.mappings.some(item => item.sourceQName === "flash.geom.Rectangle"
        && item.sourceMember?.name === "intersection"
        && item.targetMember?.signature.endsWith("Rectangle | null")), true);
    for (const member of ["smoothing", "getPixel", "RED", "ALPHA", "draw", "applyFilter"]) {
        assert.equal(document.mappings.some(item => item.sourceQName.startsWith("flash.display.Bitmap")
            && item.sourceMember?.name === member), false, member);
    }
    assert.equal(document.mappings.some(item => item.sourceQName === "flash.display.Bitmap"
        && item.sourceMember?.name === "bitmapData" && item.sourceMember.access === "read"), true);
    assert.equal(document.mappings.some(item => item.sourceQName === "flash.display.Bitmap"
        && item.sourceMember?.name === "bitmapData" && item.sourceMember.access === "write"), false);
    for (const member of ["autoSize", "filters", "graphics", "parent"]) {
        assert.equal(document.mappings.some(item => item.sourceQName !== "flash.geom.Point"
            && item.sourceQName !== "flash.geom.Rectangle" && item.sourceMember?.name === member
            && item.sourceMember?.access !== "call"), false, member);
    }
    assert.equal(document.mappings.some(item => ["getBounds", "getRect", "scrollRect"]
        .includes(item.sourceMember?.name)), false);

    const alteredSource = JSON.parse(fs.readFileSync(sourceCensus, "utf8"));
    alteredSource.as3SourceCapabilities.memberUses.find(item => item.qname === "flash.display.BitmapData"
        && item.member === "clone").classification = "forged-non-bridge";
    alteredSource.as3SourceCapabilities.memberUses.find(item => item.qname === "flash.display.BitmapData"
        && item.member === "getPixel").receiverType = "flash.display.Bitmap";
    alteredSource.as3SourceCapabilities.memberUses.find(item => item.qname === "flash.display.BitmapDataChannel"
        && item.member === "RED").signatures[0].static = false;
    const forgedSource = path.join(output, "source.json");
    fs.writeFileSync(forgedSource, JSON.stringify(alteredSource), "utf8");
    const forgedMapping = path.join(output, "source-capability-map.json");
    const forgedLock = path.join(output, "source-authority-lock.json");
    const forgedResult = spawnSync(process.execPath, [
        path.join(repository, "tools", "generate-capability-map.cjs"),
        forgedSource, targetCapabilities, forgedMapping, forgedLock,
    ], { cwd: os.tmpdir(), encoding: "utf8", timeout: 20_000, windowsHide: true });
    assert.notEqual(forgedResult.status, 0, "conflicting bitmap source evidence must abort generation");
});

test("bitmap generation rejects duplicate source and target authority identities", t => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "as3-capability-ambiguity-"));
    t.after(() => fs.rmSync(output, { recursive: true, force: true }));
    const baseSource = JSON.parse(fs.readFileSync(sourceCensus, "utf8"));
    const baseTarget = JSON.parse(fs.readFileSync(targetCapabilities, "utf8"));
    const run = (name, sourceValue, targetValue) => {
        const sourceFile = path.join(output, `${name}-source.json`);
        const targetFile = path.join(output, `${name}-target.json`);
        fs.writeFileSync(sourceFile, JSON.stringify(sourceValue), "utf8");
        fs.writeFileSync(targetFile, JSON.stringify(targetValue), "utf8");
        return spawnSync(process.execPath, [path.join(repository, "tools", "generate-capability-map.cjs"),
            sourceFile, targetFile, path.join(output, `${name}-map.json`), path.join(output, `${name}-lock.json`)],
        { cwd: os.tmpdir(), encoding: "utf8", timeout: 20_000, windowsHide: true });
    };
    const duplicateApi = structuredClone(baseSource);
    duplicateApi.as3SourceCapabilities.apis.push(structuredClone(duplicateApi.as3SourceCapabilities.apis
        .find(item => item.qname === "flash.display.BitmapData")));
    assert.notEqual(run("duplicate-api", duplicateApi, baseTarget).status, 0);

    const duplicateUse = structuredClone(baseSource);
    duplicateUse.as3SourceCapabilities.memberUses.push(structuredClone(duplicateUse.as3SourceCapabilities.memberUses
        .find(item => item.qname === "flash.display.BitmapData" && item.member === "clone")));
    assert.notEqual(run("duplicate-use", duplicateUse, baseTarget).status, 0);

    const duplicateSignature = structuredClone(baseSource);
    const cloneUse = duplicateSignature.as3SourceCapabilities.memberUses
        .find(item => item.qname === "flash.display.BitmapData" && item.member === "clone");
    cloneUse.signatures.push(structuredClone(cloneUse.signatures[0]));
    assert.notEqual(run("duplicate-signature", duplicateSignature, baseTarget).status, 0);

    const conflictingArgumentSignature = structuredClone(baseSource);
    const copyPixelsSix = conflictingArgumentSignature.as3SourceCapabilities.memberUses.find(item =>
        item.qname === "flash.display.BitmapData" && item.member === "copyPixels" && item.argumentCount === 6);
    copyPixelsSix.signatures[0].returnType = "uint";
    assert.notEqual(run("conflicting-argument-signature", conflictingArgumentSignature, baseTarget).status, 0);

    const duplicateObligation = structuredClone(baseTarget);
    const displayCapability = duplicateObligation.capabilities.find(item => item.id === "api.flash.display");
    const siblingObligation = structuredClone(displayCapability.obligations.find(item => item.export === "BitmapData"));
    siblingObligation.module = siblingObligation.module.replace("BitmapData.ts", "forged/BitmapData.ts");
    siblingObligation.kind = "forged-class";
    displayCapability.obligations.push(siblingObligation);
    assert.notEqual(run("duplicate-obligation", baseSource, duplicateObligation).status, 0);

    const crossCapabilityObligation = structuredClone(baseTarget);
    const crossCapabilityBitmapData = structuredClone(crossCapabilityObligation.capabilities
        .find(item => item.id === "api.flash.display").obligations.find(item => item.export === "BitmapData"));
    crossCapabilityObligation.capabilities.push({ id: "api.forged.bitmap-data", status: "typescript-obligation",
        obligations: [crossCapabilityBitmapData] });
    assert.notEqual(run("cross-capability-obligation", baseSource, crossCapabilityObligation).status, 0);

    const duplicateMember = structuredClone(baseTarget);
    const bitmapData = duplicateMember.capabilities.flatMap(item => item.obligations || [])
        .find(item => item.export === "BitmapData");
    const clone = structuredClone(bitmapData.members.find(item => item.name === "clone"));
    clone.kind = "get";
    clone.scope = "static";
    bitmapData.members.push(clone);
    assert.notEqual(run("duplicate-member", baseSource, duplicateMember).status, 0);

    const conflictingConstructor = structuredClone(baseTarget);
    const constructorBitmapData = conflictingConstructor.capabilities.flatMap(item => item.obligations || [])
        .find(item => item.export === "BitmapData");
    constructorBitmapData.constructors.push("new (width: number, height: number): BitmapData");
    assert.notEqual(run("conflicting-constructor", baseSource, conflictingConstructor).status, 0);

    const nullableTextCall = structuredClone(baseTarget);
    nullableTextCall.capabilities.flatMap(item => item.obligations || []).find(item => item.export === "TextField")
        .members.find(item => item.name === "getLineLength").signature = "(lineIndex: number | null) => number";
    assert.equal(run("nullable-text-call", baseSource, nullableTextCall).status, 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(output, "nullable-text-call-map.json"), "utf8")).mappings
        .some(item => item.sourceQName === "flash.text.TextField" && item.sourceMember?.name === "getLineLength"), false);

    const duplicateTextMember = structuredClone(baseTarget);
    const duplicateTextField = duplicateTextMember.capabilities.flatMap(item => item.obligations || [])
        .find(item => item.export === "TextField");
    duplicateTextField.members.push(structuredClone(duplicateTextField.members.find(item => item.name === "appendText")));
    assert.notEqual(run("duplicate-text-member", baseSource, duplicateTextMember).status, 0);

    const nullableFilterConstructor = structuredClone(baseTarget);
    nullableFilterConstructor.capabilities.flatMap(item => item.obligations || []).find(item => item.export === "BlurFilter")
        .constructors[0] = "new (blurX?: number | null, blurY?: number, quality?: number): BlurFilter";
    assert.equal(run("nullable-filter-constructor", baseSource, nullableFilterConstructor).status, 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(output, "nullable-filter-constructor-map.json"), "utf8")).mappings
        .some(item => item.sourceQName === "flash.filters.BlurFilter" && item.sourceMember !== null), false);
});

test("capability loader authenticates bitmap holds, numeric nullability, and constants", t => {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "as3-capability-ledger-bitmap-"));
    t.after(() => fs.rmSync(output, { recursive: true, force: true }));
    const bundle = path.join(output, "ledger.cjs");
    require("esbuild").buildSync({
        entryPoints: [path.join(repository, "src", "hardened", "ledger.ts")],
        outfile: bundle,
        bundle: true,
        platform: "node",
        format: "cjs",
        logLevel: "silent",
    });
    const { loadCapabilityAuthority } = require(bundle);
    const normalized = file => fs.readFileSync(file, "utf8").replace(/\r\n?/g, "\n");
    const sourceJson = normalized(sourceCensus);
    const targetJson = normalized(targetCapabilities);
    const source = JSON.parse(sourceJson);
    const target = JSON.parse(targetJson);
    const baseMapping = JSON.parse(normalized(path.join(repository, "config", "capability-map.json")));
    const nativeTimerAuthorityJson = normalized(path.join(repository, "config", "native-timer-authority.json"));
    const key = item => [item.sourceQName, item.sourceMember ? item.sourceMember.access : "",
        item.sourceMember ? item.sourceMember.name : "", item.sourceMember ? item.sourceMember.signature : ""].join("\u0000");
    const load = (mapping, sourceValue = source, targetValue = target) => {
        mapping.mappings.sort((left, right) => key(left).localeCompare(key(right)));
        const mappingJson = `${canonicalJson(mapping)}\n`;
        const forgedSourceJson = `${canonicalJson(sourceValue)}\n`;
        const forgedTargetJson = `${canonicalJson(targetValue)}\n`;
        return loadCapabilityAuthority({
        sourceCensusJson: forgedSourceJson,
        sourceCensusSha256: sha256(forgedSourceJson),
        targetCapabilitiesJson: forgedTargetJson,
        targetCapabilitiesSha256: sha256(forgedTargetJson),
        mappingJson,
        mappingSha256: sha256(mappingJson),
        nativeTimerAuthorityJson,
        nativeTimerAuthoritySha256: sha256(nativeTimerAuthorityJson),
    }, sha256);
    };
    assert.doesNotThrow(() => load(structuredClone(baseMapping)));

    const duplicateApiSource = structuredClone(source);
    duplicateApiSource.as3SourceCapabilities.apis.push(structuredClone(duplicateApiSource.as3SourceCapabilities.apis
        .find(item => item.qname === "flash.display.BitmapData")));
    assert.throws(() => load(structuredClone(baseMapping), duplicateApiSource),
        error => error?.code === "HARDENED_SOURCE_CAPABILITY");

    const duplicateUseSource = structuredClone(source);
    duplicateUseSource.as3SourceCapabilities.memberUses.push(structuredClone(duplicateUseSource.as3SourceCapabilities.memberUses
        .find(item => item.qname === "flash.display.BitmapData" && item.member === "clone")));
    assert.throws(() => load(structuredClone(baseMapping), duplicateUseSource),
        error => error?.code === "HARDENED_SOURCE_MEMBER_CAPABILITY");

    const duplicateSignatureSource = structuredClone(source);
    const duplicateCloneUse = duplicateSignatureSource.as3SourceCapabilities.memberUses
        .find(item => item.qname === "flash.display.BitmapData" && item.member === "clone");
    duplicateCloneUse.signatures.push(structuredClone(duplicateCloneUse.signatures[0]));
    assert.throws(() => load(structuredClone(baseMapping), duplicateSignatureSource),
        error => error?.code === "HARDENED_SOURCE_MEMBER_CAPABILITY");

    const conflictingArgumentSource = structuredClone(source);
    conflictingArgumentSource.as3SourceCapabilities.memberUses.find(item => item.qname === "flash.display.BitmapData"
        && item.member === "copyPixels" && item.argumentCount === 6).signatures[0].returnType = "uint";
    assert.throws(() => load(structuredClone(baseMapping), conflictingArgumentSource),
        error => error?.code === "HARDENED_SOURCE_MEMBER_CAPABILITY");

    const duplicateCapabilityTarget = structuredClone(target);
    duplicateCapabilityTarget.capabilities.push(structuredClone(duplicateCapabilityTarget.capabilities
        .find(item => item.id === "api.flash.display")));
    assert.throws(() => load(structuredClone(baseMapping), source, duplicateCapabilityTarget),
        error => error?.code === "HARDENED_TARGET_CAPABILITY");

    const duplicateObligationTarget = structuredClone(target);
    const duplicateDisplay = duplicateObligationTarget.capabilities.find(item => item.id === "api.flash.display");
    const siblingBitmapDataObligation = structuredClone(duplicateDisplay.obligations
        .find(item => item.export === "BitmapData"));
    siblingBitmapDataObligation.module = siblingBitmapDataObligation.module.replace("BitmapData.ts", "forged/BitmapData.ts");
    siblingBitmapDataObligation.kind = "forged-class";
    duplicateDisplay.obligations.push(siblingBitmapDataObligation);
    assert.throws(() => load(structuredClone(baseMapping), source, duplicateObligationTarget),
        error => error?.code === "HARDENED_TARGET_EXPORT");

    const crossCapabilityObligationTarget = structuredClone(target);
    const crossCapabilityBitmapData = structuredClone(crossCapabilityObligationTarget.capabilities
        .find(item => item.id === "api.flash.display").obligations.find(item => item.export === "BitmapData"));
    crossCapabilityObligationTarget.capabilities.push({ id: "api.forged.bitmap-data", status: "typescript-obligation",
        obligations: [crossCapabilityBitmapData] });
    assert.throws(() => load(structuredClone(baseMapping), source, crossCapabilityObligationTarget),
        error => error?.code === "HARDENED_TARGET_EXPORT");

    const shrunkTypeRoles = structuredClone(baseMapping);
    const shrunkBitmapDataType = shrunkTypeRoles.mappings.find(item => item.sourceQName === "flash.display.BitmapData"
        && item.sourceMember === null);
    shrunkBitmapDataType.sourceRoles = shrunkBitmapDataType.sourceRoles.slice(1);
    assert.throws(() => load(shrunkTypeRoles), error => error?.code === "HARDENED_SOURCE_CAPABILITY");

    const extraTypeRole = structuredClone(baseMapping);
    extraTypeRole.mappings.find(item => item.sourceQName === "flash.display.BitmapData"
        && item.sourceMember === null).sourceRoles.push("zz-forged-role");
    assert.throws(() => load(extraTypeRole), error => error?.code === "HARDENED_SOURCE_CAPABILITY");

    const duplicateMemberTarget = structuredClone(target);
    const duplicateBitmapData = duplicateMemberTarget.capabilities.flatMap(item => item.obligations || [])
        .find(item => item.export === "BitmapData");
    duplicateBitmapData.members.push({ ...structuredClone(duplicateBitmapData.members
        .find(item => item.name === "clone")), kind: "get", scope: "static" });
    assert.throws(() => load(structuredClone(baseMapping), source, duplicateMemberTarget),
        error => error?.code === "HARDENED_TARGET_MEMBER");

    const duplicateConstructorTarget = structuredClone(target);
    const constructorBitmapData = duplicateConstructorTarget.capabilities.flatMap(item => item.obligations || [])
        .find(item => item.export === "BitmapData");
    constructorBitmapData.constructors.push("new (width: number, height: number): BitmapData");
    assert.throws(() => load(structuredClone(baseMapping), source, duplicateConstructorTarget),
        error => error?.code === "HARDENED_TARGET_MEMBER");

    const unmappedBitmapConstructorTarget = structuredClone(target);
    const unmappedBitmap = unmappedBitmapConstructorTarget.capabilities.flatMap(item => item.obligations || [])
        .find(item => item.export === "Bitmap");
    unmappedBitmap.constructors.push("new (bitmapData?: BitmapData): Bitmap");
    assert.throws(() => load(structuredClone(baseMapping), source, unmappedBitmapConstructorTarget),
        error => error?.code === "HARDENED_TARGET_MEMBER");

    const forgedClassification = structuredClone(source);
    forgedClassification.as3SourceCapabilities.memberUses.find(item => item.qname === "flash.display.BitmapData"
        && item.member === "clone").classification = "forged-non-bridge";
    assert.throws(() => load(structuredClone(baseMapping), forgedClassification),
        error => error?.code === "HARDENED_SOURCE_MEMBER_CAPABILITY");

    const forgedRole = structuredClone(baseMapping);
    forgedRole.mappings.find(item => item.sourceQName === "flash.display.BitmapData"
        && item.sourceMember?.name === "clone").sourceRoles = ["import"];
    assert.throws(() => load(forgedRole), error => error?.code === "HARDENED_SOURCE_MEMBER_CAPABILITY");

    const forgedKind = structuredClone(baseMapping);
    const forgedKindTarget = structuredClone(target);
    forgedKind.mappings.find(item => item.sourceQName === "flash.display.BitmapData"
        && item.sourceMember?.name === "clone").targetMember.kind = "get";
    forgedKindTarget.capabilities.flatMap(item => item.obligations || []).find(item => item.export === "BitmapData")
        .members.find(item => item.name === "clone").kind = "get";
    assert.throws(() => load(forgedKind, source, forgedKindTarget),
        error => error?.code === "HARDENED_CAPABILITY_MEMBER_BEHAVIOR");

    const readonlyWriteTarget = structuredClone(target);
    readonlyWriteTarget.capabilities.flatMap(item => item.obligations || []).find(item => item.export === "Bitmap")
        .members.find(item => item.name === "bitmapData").readonly = true;
    assert.throws(() => load(structuredClone(baseMapping), source, readonlyWriteTarget),
        error => error?.code === "HARDENED_TARGET_MEMBER");

    const forgedConstructor = structuredClone(baseMapping);
    const bitmapTypeMapping = forgedConstructor.mappings.find(item => item.sourceQName === "flash.display.Bitmap"
        && item.sourceMember === null);
    const bitmapCtorUse = source.as3SourceCapabilities.memberUses.find(item => item.qname === "flash.display.Bitmap"
        && item.member === "Bitmap" && item.context === "constructor");
    const bitmapCtorSignature = bitmapCtorUse.signatures[0];
    const bitmapCtorTarget = target.capabilities.flatMap(item => item.obligations || [])
        .find(item => item.export === "Bitmap").constructors[0];
    forgedConstructor.mappings.push({ ...bitmapTypeMapping, sourceRoles: ["constructor"], sourceMember: {
        name: "Bitmap", access: "call", minArgs: bitmapCtorSignature.minArgs,
        maxArgs: bitmapCtorSignature.maxArgs, signature: bitmapCtorSignature.signature,
    }, targetMember: { name: "Bitmap", kind: "constructor", scope: "static", signature: bitmapCtorTarget } });
    assert.throws(() => load(forgedConstructor),
        error => error?.code === "HARDENED_CAPABILITY_MEMBER_BEHAVIOR");

    const nullableNumber = structuredClone(baseMapping);
    const nullableTarget = structuredClone(target);
    const pixelMap = nullableNumber.mappings.find(item => item.sourceQName === "flash.display.BitmapData"
        && item.sourceMember?.name === "getPixel");
    pixelMap.targetMember.signature = "(x: number, y: number) => number | null";
    const pixelObligation = nullableTarget.capabilities.flatMap(item => item.obligations || [])
        .find(item => item.export === "BitmapData");
    pixelObligation.members.find(item => item.name === "getPixel").signature = pixelMap.targetMember.signature;
    assert.throws(() => load(nullableNumber, source, nullableTarget),
        error => error?.code === "HARDENED_CAPABILITY_MEMBER_SIGNATURE");

    const nullableText = structuredClone(baseMapping);
    const nullableTextTarget = structuredClone(target);
    nullableText.mappings.find(item => item.sourceQName === "flash.text.TextField"
        && item.sourceMember?.name === "getLineLength").targetMember.signature = "(lineIndex: number | null) => number";
    nullableTextTarget.capabilities.flatMap(item => item.obligations || []).find(item => item.export === "TextField")
        .members.find(item => item.name === "getLineLength").signature = "(lineIndex: number | null) => number";
    assert.throws(() => load(nullableText, source, nullableTextTarget),
        error => error?.code === "HARDENED_CAPABILITY_MEMBER_SIGNATURE");

    const forgedTextMetadata = structuredClone(source);
    forgedTextMetadata.as3SourceCapabilities.memberUses.find(item => item.qname === "flash.text.TextField"
        && item.member === "getLineLength").signatures[0].declaredBy = "flash.text.TextFormat";
    assert.throws(() => load(structuredClone(baseMapping), forgedTextMetadata),
        error => error?.code === "HARDENED_SOURCE_MEMBER_CAPABILITY");

    for (const qname of ["flash.text.TextFormat", "flash.filters.ColorMatrixFilter"]) {
        const forgedHeldConstructor = structuredClone(baseMapping);
        const type = forgedHeldConstructor.mappings.find(item => item.sourceQName === qname && item.sourceMember === null);
        const use = source.as3SourceCapabilities.memberUses.find(item => item.qname === qname && item.context === "constructor");
        const signature = use.signatures[0];
        const constructor = target.capabilities.flatMap(item => item.obligations || [])
            .find(item => item.export === type.targetExport).constructors[0];
        forgedHeldConstructor.mappings.push({ ...type, sourceRoles: ["constructor"], sourceMember: {
            name: type.targetExport, access: "call", minArgs: signature.minArgs, maxArgs: signature.maxArgs,
            signature: signature.signature,
        }, targetMember: { name: type.targetExport, kind: "constructor", scope: "static", signature: constructor } });
        assert.throws(() => load(forgedHeldConstructor),
            error => error?.code === "HARDENED_CAPABILITY_MEMBER_BEHAVIOR", qname);
    }

    const unreadonlyConstant = structuredClone(target);
    unreadonlyConstant.capabilities.flatMap(item => item.obligations || [])
        .find(item => item.export === "BitmapDataChannel").members.find(item => item.name === "RED").readonly = false;
    assert.throws(() => load(structuredClone(baseMapping), source, unreadonlyConstant),
        error => error?.code === "HARDENED_TARGET_MEMBER");

    const mutatedConstant = structuredClone(baseMapping);
    const mutatedConstantSource = structuredClone(source);
    const redMapping = mutatedConstant.mappings.find(item => item.sourceQName === "flash.display.BitmapDataChannel"
        && item.sourceMember?.name === "RED");
    redMapping.sourceMember.signature = redMapping.sourceMember.signature.replace("= 1;", "= 2;");
    mutatedConstantSource.as3SourceCapabilities.memberUses.find(item => item.qname === "flash.display.BitmapDataChannel"
        && item.member === "RED").signatures[0].signature = redMapping.sourceMember.signature;
    assert.throws(() => load(mutatedConstant, mutatedConstantSource, target),
        error => error?.code === "HARDENED_CAPABILITY_MEMBER_SIGNATURE");

    const forgedPixel = structuredClone(baseMapping);
    const pixelType = forgedPixel.mappings.find(item => item.sourceQName === "flash.display.PixelSnapping"
        && item.sourceMember === null);
    const pixelUse = source.as3SourceCapabilities.memberUses.find(item => item.qname === "flash.display.PixelSnapping"
        && item.member === "AUTO");
    const pixelTarget = target.capabilities.flatMap(item => item.obligations || [])
        .find(item => item.export === "PixelSnapping").members.find(item => item.name === "AUTO");
    forgedPixel.mappings.push({ ...pixelType, sourceRoles: [pixelUse.context], sourceMember: {
        name: "AUTO", access: "read", minArgs: 0, maxArgs: 0, signature: pixelUse.signatures[0].signature,
    }, targetMember: { name: pixelTarget.name, kind: pixelTarget.kind, scope: pixelTarget.scope,
        signature: pixelTarget.signature } });
    assert.throws(() => load(forgedPixel), error => error?.code === "HARDENED_CAPABILITY_MEMBER_BEHAVIOR");

    const forgedDraw = structuredClone(baseMapping);
    const drawSource = source.as3SourceCapabilities.memberUses.find(item => item.qname === "flash.display.BitmapData"
        && item.member === "draw" && item.argumentCount === 1);
    const bitmapType = forgedDraw.mappings.find(item => item.sourceQName === "flash.display.BitmapData"
        && item.sourceMember === null);
    const drawTarget = structuredClone(target);
    const drawObligation = drawTarget.capabilities.flatMap(item => item.obligations || [])
        .find(item => item.export === "BitmapData");
    const drawMember = { name: "draw", kind: "method", scope: "instance", signature: "(source: unknown) => void" };
    drawObligation.members.push(drawMember);
    forgedDraw.mappings.push({ ...bitmapType, sourceRoles: [drawSource.context], sourceMember: {
        name: "draw", access: "call", minArgs: drawSource.signatures[0].minArgs,
        maxArgs: drawSource.signatures[0].maxArgs, signature: drawSource.signatures[0].signature,
    }, targetMember: drawMember });
    assert.throws(() => load(forgedDraw, source, drawTarget),
        error => error?.code === "HARDENED_CAPABILITY_MEMBER_BEHAVIOR");
});
