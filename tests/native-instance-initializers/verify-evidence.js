const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const raw = fs.readFileSync(path.join(__dirname, 'oracle/receipt.json'));
assert.equal(hash(raw), '46be80b65ca3b6a997a3e44a5781c7bc020383d962bb596086b4b7f3cdc36c2d');
const receipt = JSON.parse(raw);
for (const entry of receipt.files)
    assert.equal(hash(fs.readFileSync(path.join(__dirname, entry.path))), entry.sha256, entry.path);
console.log('Retained original Flash and failed native comparisons authenticated; no fidelity admission');
const argumentRaw = fs.readFileSync(path.join(__dirname, 'arguments-original/receipt.json'));
assert.equal(hash(argumentRaw), 'c0b572a7af4f8f9725667a3a370155067d15dd1f62be93f0d6a428ff259b36c2');
for (const entry of JSON.parse(argumentRaw).files)
    assert.equal(hash(fs.readFileSync(path.join(__dirname, entry.path))), entry.sha256, entry.path);
console.log('Retained original Flash constructor argument/identity evidence authenticated');
for (const [directory, expected] of [
    ['review-original','e62e3094337b5bac91c0af6d28bb39e16f0d7951d7f7188e2ee8ebc005f0fa00'],
    ['replay-original','f2c9f6f8fa3a0effe8806dc2690dd5f5f27fc2bd9458e801a09f42adfd89290f'],
    ['class-alias-original','a64c82f29aaaa87a2a56e0bf607ee7df341aa2024d6deb6b8559a4b1f1869bda'],
]) {
    const bytes = fs.readFileSync(path.join(__dirname,directory,'receipt.json'));
    assert.equal(hash(bytes),expected);
    for(const entry of JSON.parse(bytes).files)
        assert.equal(hash(fs.readFileSync(path.join(__dirname,entry.path))),entry.sha256,entry.path);
}
console.log('Retained independent hygiene and active/completed/failed replay evidence authenticated');
console.log('Retained unresolved Class alias observations authenticated; these are not passing native observations');
