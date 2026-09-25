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
// A source interface may share its export with a nominal runtime const. Keep
// the capability's real const kind; prove its type declaration on that same
// symbol rather than inventing a second interface obligation or a class value.
function mergedInterface(row) {
    if (request.allowMergedInterface !== true || row.kind !== "const") return false;
    const declarations = expected.declarations || [];
    const interfaces = declarations.filter(ts.isInterfaceDeclaration);
    const values = declarations.filter(ts.isVariableDeclaration);
    return interfaces.length === 1 && values.length === 1
        && declarations.every(declaration => path.resolve(declaration.getSourceFile().fileName) === row.file)
        && (values[0].parent.flags & ts.NodeFlags.Const) !== 0;
}
const matches = candidates.map((row, index) => ({ row, index, symbol: symbol(row.file, row.export) }))
    .filter(row => row.symbol === expected && expected.declarations?.some(declaration =>
        path.resolve(declaration.getSourceFile().fileName) === row.row.file
        && (row.row.kind === "class" ? ts.isClassDeclaration(declaration)
            : row.row.kind === "interface" ? ts.isInterfaceDeclaration(declaration)
            : row.row.kind === "function" ? ts.isFunctionDeclaration(declaration) : mergedInterface(row.row))));
if (matches.length !== 1) throw new Error("No unique defining obligation for facade export");
if (matches[0].row.kind === "function") {
    const declarations = expected.declarations.filter(ts.isFunctionDeclaration);
    const signatures = checker.getTypeOfSymbolAtLocation(expected, declarations[0]).getCallSignatures();
    if (declarations.length !== 1 || signatures.length !== 1)
        throw new Error("Function target must have one unambiguous declaration and signature");
    const signature = checker.signatureToString(signatures[0], declarations[0],
        ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.WriteArrowStyleSignature);
    if (signature !== matches[0].row.signature) throw new Error("Function obligation signature differs from source");
}
if (request.validateConstructors) {
    const row=matches[0].row, declaration=expected.declarations.find(ts.isClassDeclaration);
    if (row.kind!=="class" || !declaration) throw Error("Class constructor proof requires a class");
    const signatures=checker.getTypeOfSymbolAtLocation(expected,declaration).getConstructSignatures()
        .map(signature=>"new " + checker.signatureToString(signature,declaration,ts.TypeFormatFlags.NoTruncation));
    if (JSON.stringify(signatures)!==JSON.stringify(row.constructors))
        throw Error("Constructor obligation differs from source: " + JSON.stringify(signatures));
}
process.stdout.write(JSON.stringify({ index: matches[0].index, inputs }) + "\n");
