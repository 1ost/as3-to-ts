'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const esbuild = require('esbuild');

const testBundleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'as3-parser-hardening-'));
esbuild.buildSync({
    absWorkingDir: path.join(__dirname, '..', '..'),
    entryPoints: {
        parse: 'src/parse/index.ts',
        parser: 'src/parse/parser.ts',
        scanner: 'src/parse/scanner.ts',
        'source-file': 'src/parse/source-file.ts',
        nodeKind: 'src/syntax/nodeKind.ts',
    },
    outdir: testBundleRoot,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    logLevel: 'silent',
});

const parse = require(path.join(testBundleRoot, 'parse.js')).default;
const NodeKind = require(path.join(testBundleRoot, 'nodeKind.js')).default;
const AS3Parser = require(path.join(testBundleRoot, 'parser.js')).default;
const parserApi = require(path.join(testBundleRoot, 'parser.js'));
const AS3Scanner = require(path.join(testBundleRoot, 'scanner.js')).default;
const SourceFile = require(path.join(testBundleRoot, 'source-file.js')).default;

process.on('exit', () => fs.rmSync(testBundleRoot, {recursive: true, force: true}));

function all(node, kind, result = []) {
    if (node.kind === kind) result.push(node);
    node.children.forEach(child => {
        assert.ok(child, 'AST child arrays must not contain null placeholders');
        all(child, kind, result);
    });
    return result;
}

function childText(node, kind) {
    const child = node.children.find(candidate => candidate.kind === kind);
    return child && child.text;
}

function assertMonotoneSpans(node, source, label, parent = null) {
    assert.ok(Number.isInteger(node.start), `${label}: start must be an integer`);
    assert.ok(Number.isInteger(node.end), `${label}: end must be an integer`);
    assert.ok(node.start >= 0, `${label}: start ${node.start} precedes source`);
    assert.ok(node.start <= node.end, `${label}: inverted span ${node.start}..${node.end}`);
    assert.ok(node.end <= source.length,
        `${label}: end ${node.end} exceeds source length ${source.length}`);
    if (parent) {
        assert.ok(node.start >= parent.start && node.end <= parent.end,
            `${label}: child span ${node.start}..${node.end} escapes parent ${parent.start}..${parent.end}`);
    }
    node.children.forEach((child, index) =>
        assertMonotoneSpans(child, source, `${label}/${NodeKind[node.kind]}[${index}]`, node));
}

function watchdog(source) {
    const worker = path.join(__dirname, 'watchdog-worker.js');
    const result = childProcess.spawnSync(process.execPath,
        [worker, testBundleRoot, Buffer.from(source).toString('base64')],
        {encoding: 'utf8', timeout: 1500});
    assert.strictEqual(result.error && result.error.code, undefined,
        `parser exceeded watchdog or failed to launch: ${result.error && result.error.message}`);
    assert.strictEqual(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
}

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'hardening.as'), 'utf8');
const ast = parse('C:\\fixture\\hardening.as', fixture);
assertMonotoneSpans(ast, fixture, 'hardening fixture');
assert.strictEqual(ast.start, 0);
assert.strictEqual(ast.end, fixture.length, 'compilation-unit span covers the full source');
assert.deepStrictEqual(ast.trivia.map(token => token.text), [
    '/* between declarations */',
    '// ASI must terminate break here',
    '/* inline before semicolon */',
]);
ast.trivia.forEach(token => {
    assert.strictEqual(fixture.slice(token.index, token.end), token.text,
        'trivia token retains its exact source span');
});

const varList = all(ast, NodeKind.VAR_LIST)[0];
const declarations = varList.children.filter(child => child.kind === NodeKind.NAME_TYPE_INIT);
assert.strictEqual(declarations.length, 2, 'one AST declaration is retained for every var-list entry');
assert.deepStrictEqual(declarations.map(node => childText(node, NodeKind.NAME)), ['first', 'second']);
assert.deepStrictEqual(declarations.map(node => childText(node, NodeKind.TYPE)), ['int', 'uint']);

const functions = all(ast, NodeKind.FUNCTION);
assert.strictEqual(functions.length, 1, 'omitted member access modifier is valid ActionScript');
const parameterTypes = all(functions[0], NodeKind.PARAMETER)
    .map(parameter => childText(parameter.findChild(NodeKind.NAME_TYPE_INIT), NodeKind.TYPE));
assert.deepStrictEqual(parameterTypes, ['flash.display.Sprite']);
assert.ok(all(functions[0], NodeKind.TYPE).some(type => type.text === 'flash.events.Event'),
    'fully-qualified return type is preserved');
assert.ok(all(functions[0], NodeKind.IDENTIFIER).some(identifier => identifier.text === 'int'),
    'int expression identity is preserved in the parser AST');
assert.strictEqual(all(ast, NodeKind.BREAK).length, 1);
assert.strictEqual(all(ast, NodeKind.CONTINUE).length, 1);
assert.strictEqual(all(ast, NodeKind.THROW).length, 1, 'throw is not represented as return');

const negationSource = 'package p { class C { function f(a:Boolean,b:Boolean):void { var x:Boolean = !a && b; } } }';
const negationAst = parse('negation-precedence.as', negationSource);
assertMonotoneSpans(negationAst, negationSource, 'negation precedence');
const conjunction = all(negationAst, NodeKind.AND)[0];
assert.strictEqual(conjunction.children[0].kind, NodeKind.NOT,
    'unary negation binds before logical conjunction');
assert.strictEqual(conjunction.children[0].children[0].text, 'a');
assert.strictEqual(conjunction.children[2].text, 'b');

const updateSource = 'package p { class C { function f(flag:Boolean):void { var i:Number = 0; var j:Number = flag ? i : 1; ++i; i++; --i; i--; } } }';
const updateAst = parse('updates.as', updateSource);
assertMonotoneSpans(updateAst, updateSource, 'updates');
[
    [NodeKind.PRE_INC, '++i'],
    [NodeKind.POST_INC, 'i++'],
    [NodeKind.PRE_DEC, '--i'],
    [NodeKind.POST_DEC, 'i--'],
].forEach(([kind, spelling]) => {
    const node = all(updateAst, kind)[0];
    assert.strictEqual(updateSource.slice(node.start, node.end), spelling,
        `${spelling} retains its exact source span`);
});
const conditionalNode = all(updateAst, NodeKind.CONDITIONAL)[0];
assert.strictEqual(conditionalNode.children.length, 3, 'conditional retains all three ordered expressions');

const emptySource = 'package p { class C {} interface I {} }';
const emptyAst = parse('empty-bodies.as', emptySource);
assertMonotoneSpans(emptyAst, emptySource, 'empty bodies');
assert.strictEqual(emptyAst.children.length, 1, 'no redundant post-package CONTENT node is synthesized');
const emptyPackageContent = emptyAst.children[0].findChild(NodeKind.CONTENT);
const emptyClassContent = all(emptyAst, NodeKind.CLASS)[0].findChild(NodeKind.CONTENT);
const emptyInterfaceContent = all(emptyAst, NodeKind.INTERFACE)[0].findChild(NodeKind.CONTENT);
assert.strictEqual(emptyClassContent.start, emptyClassContent.end, 'empty class content has an exact zero-width span');
assert.strictEqual(emptyInterfaceContent.start, emptyInterfaceContent.end,
    'empty interface content has an exact zero-width span');
assert.ok(emptyPackageContent.end > emptyPackageContent.start,
    'non-empty package content ends at its closing boundary');

const emptyPackageSource = 'package p {}';
const emptyPackageAst = parse('empty-package.as', emptyPackageSource);
assertMonotoneSpans(emptyPackageAst, emptyPackageSource, 'empty package');
const zeroPackageContent = emptyPackageAst.children[0].findChild(NodeKind.CONTENT);
assert.strictEqual(zeroPackageContent.start, zeroPackageContent.end,
    'empty package content has an exact zero-width span');

for (const literal of ['1e21','1e+21','1E-7','1.25e2','.5E+3','1.e2']) {
    const numeric = new AS3Scanner();
    numeric.setContent(literal + ';', 'exponent.as');
    const token = numeric.nextToken();
    assert.strictEqual(token.text, literal);
    assert.strictEqual(token.isNumeric, true);
    assert.strictEqual(token.end, literal.length);
    assert.strictEqual(numeric.nextToken().text, ';');
    const source = `package { public class Numeric { public var value:Number = ${literal}; } }`;
    assertMonotoneSpans(parse('Numeric.as', source), source, literal);
}
for (const literal of ['1e','1e+','1E-','1.e;']) {
    const numeric = new AS3Scanner();
    numeric.setContent(literal, 'bad-exponent.as');
    assert.throws(() => numeric.nextToken(), error => error.code === 'AS3_PARSE_NUMBER_EXPONENT');
}

const scanner = new AS3Scanner();
scanner.setContent('Vector.<uint> tail', 'checkpoint.as');
assert.strictEqual(scanner.nextToken().text, 'Vector');
const scannerCheckpoint = scanner.getCheckPoint();
const expectedNext = scanner.nextToken().text;
scanner.missedSemi = true;
scanner.lastLineScanned = 99;
scanner.queuedToken = scanner.createToken('rogue', {skip: false});
scanner.rewind(scannerCheckpoint);
assert.deepStrictEqual(scanner.getCheckPoint(), scannerCheckpoint, 'scanner checkpoint restores every mutable field');
assert.strictEqual(scanner.nextToken().text, expectedNext);

const speculative = new AS3Parser();
speculative.sourceFile = new SourceFile('alpha /* trivia */ beta', 'checkpoint.as');
speculative.scn = new AS3Scanner();
speculative.scn.setContent(speculative.sourceFile.content, speculative.sourceFile.path);
parserApi.nextToken(speculative);
const originalToken = speculative.tok;
const originalScanner = speculative.scn.getCheckPoint();
const parsed = parserApi.tryParse(speculative, () => {
    parserApi.nextToken(speculative);
    speculative.isInFor = true;
    throw parserApi.parseError(speculative, 'AS3_PARSE_UNEXPECTED_TOKEN',
        'speculative syntax', 'checkpoint test');
});
assert.strictEqual(parsed, null);
assert.strictEqual(speculative.tok, originalToken);
assert.deepStrictEqual(speculative.scn.getCheckPoint(), originalScanner);
assert.strictEqual(speculative.isInFor, false);
assert.deepStrictEqual(speculative.trivia, [], 'failed speculation does not leak trivia');

const malformed = [
    'package missing',
    'package p { class C { function f():void {',
    'package p { [Meta class C {} }',
    'package p { class C { function f():void { call(1 2); } } }',
    'package p { class C { function f():void { var a:Array = [1, 2; } } }',
];
malformed.forEach(source => {
    const result = watchdog(source);
    assert.strictEqual(result.ok, false, source);
    assert.strictEqual(result.name, 'AS3ParseError');
    assert.ok(/^AS3_PARSE_/.test(result.code), result.code);
    assert.strictEqual(result.path, 'C:/watchdog/Malformed.as');
    assert.ok(result.line >= 1 && result.column >= 1);
    assert.strictEqual(/[\r\n]/.test(result.message), false, 'diagnostic is one logical line');
});

assert.strictEqual(watchdog('package p { class C { function f():void { throw\nvalue; } } }').code,
    'AS3_PARSE_THROW_LINE_BREAK');
assert.strictEqual(watchdog('package p { /* never closed').code,
    'AS3_PARSE_UNTERMINATED_COMMENT');
assert.strictEqual(watchdog('package p { class C { var s:String = "never closed; } }').code,
    'AS3_PARSE_UNTERMINATED_STRING');

const trailing = watchdog('package p { class C {} } )');
assert.strictEqual(trailing.ok, false, 'non-trivia trailing input is never silently consumed');
assert.ok(/^AS3_PARSE_/.test(trailing.code));

const corpusFiles = [];
function collectActionScript(directory) {
    fs.readdirSync(directory).forEach(name => {
        const entry = path.join(directory, name);
        if (fs.statSync(entry).isDirectory()) collectActionScript(entry);
        else if (/\.as$/.test(name)) corpusFiles.push(entry);
    });
}
collectActionScript(path.join(__dirname, '..', 'simple'));
collectActionScript(path.join(__dirname, '..', 'compound'));
const corpusFailures = corpusFiles.map(file => ({file, result: watchdog(fs.readFileSync(file, 'utf8'))}))
    .filter(entry => !entry.result.ok);
assert.deepStrictEqual(corpusFailures, [], 'checked-in AS3 corpus remains parseable without watchdog expiry');
corpusFiles.forEach(file => {
    const source = fs.readFileSync(file, 'utf8');
    assertMonotoneSpans(parse(file, source), source, file);
});

console.log(`parser hardening gates passed (${corpusFiles.length} corpus files)`);
