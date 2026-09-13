#!/usr/bin/env node
"use strict";
// Resolve a facade by symbol identity, never by a coincidentally matching name.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript-4-9");

const request = JSON.parse(fs.readFileSync(0, "utf8"));
const root = fs.realpathSync(request.root);
const inputs = {};
function source(module) {
    if (typeof module !== "string" || !module.startsWith("src/layaAir/flash/")
        || module.split("/").includes("..")) throw new Error("Invalid bridge module");
    const file = fs.realpathSync(path.resolve(root, module));
    if (!file.startsWith(root + path.sep)) throw new Error("Bridge module escapes source root");
    return file;
}
function fingerprint(file) {
    const bytes = fs.readFileSync(file), text = bytes.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error("Bridge source is not UTF-8");
    inputs[file] = crypto.createHash("sha256").update(bytes).digest("hex");
    return crypto.createHash("sha256").update(text.replace(/\r\n?/g, "\n")).digest("hex");
}
const facade = source(request.facade.module);
if (fingerprint(facade) !== request.facade.sha256) throw new Error("Predicate facade hash mismatch");
const candidates = request.candidates.map(row => ({ ...row, file: source(row.module) }));
for (const row of candidates) {
    if (fingerprint(row.file) !== row.sha256) throw new Error("Constructor obligation hash mismatch");
}
const program = ts.createProgram([facade, ...candidates.map(row => row.file)], {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs, types: [], noLib: true,
    noEmit: true, skipLibCheck: true,
});
const checker = program.getTypeChecker();
for (const file of program.getSourceFiles()) {
    const actual = fs.realpathSync(file.fileName);
    if (!actual.startsWith(root + path.sep)) throw new Error("Export resolution escapes source root");
    fingerprint(actual);
    if (file.parseDiagnostics.length) throw new Error("Invalid bridge source syntax");
    // Type errors in unused engine APIs do not supply identity. Ambiguous or
    // duplicate exports must never let the checker select an arbitrary class.
    if (program.getSemanticDiagnostics(file).some(row => [2300, 2308, 2323, 2451, 2484].includes(row.code)))
        throw new Error("Ambiguous bridge declaration or export");
}
function symbol(file, exported) {
    const module = checker.getSymbolAtLocation(program.getSourceFile(file));
    let result = module && checker.getExportsOfModule(module).find(row => row.name === exported);
    if (result && result.flags & ts.SymbolFlags.Alias) result = checker.getAliasedSymbol(result);
    return result;
}
const expected = symbol(facade, request.facade.export);
if (!expected) throw new Error("Missing facade export");
const matches = candidates.map((row, index) => ({ row, index, symbol: symbol(row.file, row.export) }))
    .filter(row => row.symbol === expected && expected.declarations?.some(declaration =>
        path.resolve(declaration.getSourceFile().fileName) === row.row.file
        && (row.row.kind === "class" ? ts.isClassDeclaration(declaration) : ts.isInterfaceDeclaration(declaration))));
if (matches.length !== 1) throw new Error("No unique defining obligation for facade export");
process.stdout.write(JSON.stringify({ index: matches[0].index, inputs }) + "\n");
