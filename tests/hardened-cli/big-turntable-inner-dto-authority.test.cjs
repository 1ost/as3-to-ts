"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repository = path.resolve(__dirname, "../..");
const sourceRepository = process.env.HARDENED_SOURCE_REPO
    || "C:/Users/admin/Desktop/GITHUB REPO/bleach-services";
const authorityPath = path.join(repository, "config/big-turntable-inner-dto-authority.json");
const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");
const normalizedBytes = file => Buffer.from(fs.readFileSync(file, "utf8")
    .replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"), "utf8");
const canonicalAuthorityBytes = normalizedBytes(authorityPath);
const authority = JSON.parse(canonicalAuthorityBytes.toString("utf8"));
const exactKeys = (value, keys) => assert.deepEqual(Object.keys(value).sort(), keys.slice().sort());

function sourcePath(portable) {
    return path.join(sourceRepository, ...portable.split("/"));
}

function validatePayload(raw) {
    const root = JSON.parse(raw);
    assert.ok(Array.isArray(root));
    assert.equal(root.length, authority.shape.rootLength);
    const entry = root[0];
    exactKeys(entry, authority.shape.entryKeys);
    assert.ok(Number.isInteger(entry.index) && entry.index >= -0x80000000 && entry.index <= 0x7fffffff);
    assert.ok(Number.isInteger(entry.getType) && entry.getType >= -0x80000000 && entry.getType <= 0x7fffffff);
    assert.equal(typeof entry.des, "string");
    assert.ok(Array.isArray(entry.costChip));
    assert.equal(entry.costChip.length, authority.shape.costChipLength);
    exactKeys(entry.costChip[0], authority.shape.costChipKeys);
    for (const value of [entry.costChip[0].index, entry.costChip[0].value]) {
        assert.ok(Number.isInteger(value) && value >= -0x80000000 && value <= 0x7fffffff);
    }
    assert.ok(Array.isArray(entry.award));
    assert.equal(entry.award.length, authority.shape.awardLength);
    assert.ok(Number.isInteger(entry.award[0]) && entry.award[0] >= -0x80000000 && entry.award[0] <= 0x7fffffff);
    assert.ok(Array.isArray(entry.flag));
    assert.equal(entry.flag.length, authority.shape.flagLength);
    entry.flag.forEach(value => assert.ok(Number.isInteger(value)
        && value >= -0x80000000 && value <= 0x7fffffff));
}

test("the DTO authority is one canonical closed document", () => {
    assert.equal(canonicalAuthorityBytes.at(-1), 0x0a);
    assert.equal(canonicalAuthorityBytes.toString("utf8"), JSON.stringify(authority) + "\n");
    assert.equal(sha256(canonicalAuthorityBytes), "ecaaaca59ba9e94795be12e90659c52042f573443cb500eccd03826c70db2bc4");
    exactKeys(authority, ["consumers", "producer", "runtimeSchema", "schema", "shape", "variants"]);
    assert.equal(authority.schema, "bleach-big-turn-table-inner-dto-authority@1");
    assert.equal(authority.runtimeSchema, "bleach-big-turn-table-inner-config@1");
    assert.equal(authority.consumers.length, 2);
    assert.equal(authority.variants.length, 8);
    assert.equal(new Set(authority.variants.map(item => item.path)).size, 8);
});

test("the one producer and both consumers are byte-authenticated and nonescaping", () => {
    for (const record of authority.consumers.concat([authority.producer])) {
        exactKeys(record, record === authority.producer
            ? ["constructorExpressions", "qname", "sourceContentSha256", "sourcePath"]
            : ["qname", "sourceContentSha256", "sourcePath"]);
        assert.equal(sha256(normalizedBytes(sourcePath(record.sourcePath))), record.sourceContentSha256);
    }
    const producer = normalizedBytes(sourcePath(authority.producer.sourcePath)).toString("utf8");
    authority.producer.constructorExpressions.forEach(expression =>
        assert.equal(producer.split(expression).length - 1, 1));
    assert.equal(producer.match(/new TBigTurnTable(?:Gold|Lucky)LotteryInner\s*\(/g)?.length, 2);
    const runtime = fs.readFileSync(path.join(repository,
        "src/hardened-runtime/AS3BigTurnTableInnerDto.ts"), "utf8");
    assert.match(runtime,
        /export function as3DecodeBigTurnTableInnerConfig\(raw: string\): BigTurnTableInnerConfig/);
    assert.match(runtime, /const validatedEntries = new WeakMap<object, BigTurnTableInnerEntry>\(\)/);
    assert.match(runtime,
        /const cached = validatedEntries\.get\(input as object\);[\s\S]*cached === undefined/);
    assert.doesNotMatch(runtime, /export function as3BigTurnTableInnerEntry\(\s*input: unknown/);
    for (const consumerRecord of authority.consumers) {
        const consumer = normalizedBytes(sourcePath(consumerRecord.sourcePath)).toString("utf8");
        const constructor = consumer.match(
            /function TBigTurnTable(?:Gold|Lucky)LotteryInner\(param1:Object\)\s*\{([\s\S]*?)\n\s*\}/);
        assert.ok(constructor);
        assert.doesNotMatch(constructor[1], /return\s+param1|this\.[A-Za-z0-9_]+\s*=\s*param1\s*[;\r\n]/);
    }
});

test("all thirty-two tracked Gold and Lucky locale payloads prove the shared sealed row schema", () => {
    for (const variant of authority.variants) {
        exactKeys(variant, ["contentSha256", "goldPayloadsSha256", "luckyPayloadsSha256", "path"]);
        const bytes = normalizedBytes(sourcePath(variant.path));
        assert.equal(sha256(bytes), variant.contentSha256);
        for (const [tag, hashes] of [["actGoldInnerBtn", variant.goldPayloadsSha256],
            ["actLuckyInnerBtn", variant.luckyPayloadsSha256]]) {
            const payloads = [...bytes.toString("utf8").matchAll(new RegExp(`<${tag}>(.*?)</${tag}>`, "g"))]
                .map(match => match[1]);
            assert.equal(payloads.length, 2);
            assert.deepEqual(payloads.map(sha256), hashes);
            payloads.forEach(validatePayload);
        }
    }
});
