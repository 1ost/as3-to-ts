"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { buildSync } = require("esbuild");
const [sourcePath, targetPath, candidatesPath, outputPath] = process.argv.slice(2);
if (!sourcePath || !targetPath || !candidatesPath || !outputPath || process.argv.length !== 6)
    throw new Error("usage: select-native-api-profile.cjs <source-census> <target-capabilities> <candidates> <selection-output>");
const inputs = [sourcePath, targetPath, candidatesPath].map(file => {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024 * 1024)
        throw new Error("Profile inputs must be bounded regular files");
    const bytes = fs.readFileSync(file), text = bytes.toString("utf8");
    if (!Buffer.from(text).equals(bytes)) throw new Error("Profile inputs must be valid UTF-8");
    return { text, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
});
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "as3-native-selection-"));
try {
    const bundle = path.join(temporary, "ledger.cjs");
    buildSync({ entryPoints: [path.resolve(__dirname, "../src/hardened/ledger.ts")], outfile: bundle,
        bundle: true, platform: "node", format: "cjs", target: "node24", logLevel: "silent" });
    const { selectCapabilityCandidates } = require(bundle);
    const selection = selectCapabilityCandidates(...inputs.map(input => input.text));
    fs.writeFileSync(outputPath, JSON.stringify({ schema: "as3-native-api-selection@1",
        sourceCensusSha256: inputs[0].sha256, targetCapabilitiesSha256: inputs[1].sha256,
        candidatesSha256: inputs[2].sha256, ...selection }, null, 2) + "\n", { flag: "wx" });
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
