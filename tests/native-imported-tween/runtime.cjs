const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const ClassList = require('../../lib/emit/classlist').default;
const engine = path.resolve(process.env.LAYA_ENGINE_REPOSITORY || '../LayaAir-op2');
const ts = require(path.join(engine, 'node_modules/typescript'));
const {build} = require(path.join(engine, 'node_modules/esbuild'));
const {chromium} = require(require.resolve('playwright', {paths:[path.resolve('../op2-html5/game-client-laya'), engine]}));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const evidence = path.join(engine, 'src/extensions/greensock/runtime-tests');
for (const file of JSON.parse(fs.readFileSync(path.join(evidence, 'evidence-manifest.json'), 'utf8'))) {
    assert.ok(!file.path.includes('..') && !path.isAbsolute(file.path));
    assert.equal(hash(fs.readFileSync(path.join(evidence, file.path))), file.sha256, file.path);
}
const capture = name => JSON.parse(fs.readFileSync(path.join(evidence, 'original-capture', name, 'flash.json'), 'utf8')).rows;
assert.deepEqual(capture('capture-b'), capture('capture-c'));
const expected = capture('capture-b').filter(row => ['query-newest-first', 'snapshot-kill-all'].includes(row.id));
assert.equal(expected.length, 2);
const source = fs.readFileSync(path.join(__dirname, 'QueryMigration.as'), 'utf8');
const cache = path.resolve('.cache/native-imported-tween');fs.mkdirSync(cache, {recursive:true});
const out = fs.mkdtempSync(path.join(cache, 'run-'));
async function main() {
    const browser = await chromium.launch({headless:true});
    const results = [];
    try {
        for (const target of ['ES5', 'ES2015']) {
            const dir = path.join(out, target);fs.mkdirSync(dir);
            const runtime = path.relative(dir, path.join(engine, 'src/extensions/greensock/FlashTweenRuntime')).replaceAll('\\', '/');
            const options = {lineSeparator:'\n', useNamespaces:false, customVisitors:[], definitionsByNamespace:{},
                importModules:{'migration.FlashTweenRuntime':runtime}, nativeTweenModule:runtime,
                decoratorModules:Object.fromEntries(['bound', 'classBound'].map(name =>
                    [name, path.relative(dir, path.resolve('utils', name)).replaceAll('\\', '/')]))};
            ClassList.classList = [];ClassList.isScanning = true;
            emit(parse('QueryMigration.as', source), source, options);ClassList.optimize();ClassList.isScanning = false;
            const generated = emit(parse('QueryMigration.as', source), source, options);
            const file = path.join(dir, 'QueryMigration.ts');fs.writeFileSync(file, generated);
            // Dependencies target ES2020; downlevel only the generated consumer.
            const program = ts.createProgram([file], {target:ts.ScriptTarget.ES2020, module:ts.ModuleKind.CommonJS, experimentalDecorators:true,
                moduleResolution:ts.ModuleResolutionKind.NodeJs, lib:['lib.es2020.d.ts', 'lib.dom.d.ts'], noEmit:true});
            const diagnostics = ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
            assert.deepEqual(diagnostics, []);
            const compiled = ts.transpileModule(generated, {compilerOptions:{target:ts.ScriptTarget[target], module:ts.ModuleKind.ESNext, experimentalDecorators:true}}).outputText;
            fs.writeFileSync(path.join(dir, 'QueryMigration.js'), compiled);
            const entry = path.join(dir, 'entry.ts');
            fs.writeFileSync(entry, `import {QueryMigration} from './QueryMigration.js';
import {FlashTweenRuntime} from ${JSON.stringify(runtime)};
export function run() {
 const runtime = new FlashTweenRuntime(() => 0);
 try {
  const rows = QueryMigration.run();
  const target = {x:0};let calls = 0;
  const first = runtime.to(target, 1, {x:1});
  const selected = QueryMigration.query(() => {calls++;return target;});
  const other = QueryMigration.query(() => ({}));
  selected[0].kill();
  return {rows, checks:{calls, identity:selected[0] === first, other:other.length, remaining:runtime.getTweensOf(target).length}};
 } finally {runtime.dispose();}
}`);
            for (const [platform, format, name] of [['node', 'cjs', 'node.cjs'], ['browser', 'iife', 'browser.js']]) {
                await build({entryPoints:[entry], outfile:path.join(dir, name), bundle:true, platform, format, globalName:'TweenQuery', target:'es2020', logLevel:'warning'});
            }
            const node = require(path.join(dir, 'node.cjs')).run();
            const page = await browser.newPage();const errors = [];
            page.on('pageerror', error => errors.push(String(error)));
            await page.addScriptTag({path:path.join(dir, 'browser.js')});
            const chromiumResult = await page.evaluate(() => window.TweenQuery.run());await page.close();
            assert.deepEqual(errors, []);assert.deepEqual(node, chromiumResult);assert.deepEqual(node.rows, expected);
            assert.deepEqual(node.checks, {calls:1, identity:true, other:0, remaining:0});
            results.push({target, diagnostics, node, chromium:chromiumResult, generatedSha256:hash(generated), compiledSha256:hash(compiled)});
        }
    } finally {await browser.close();}
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({scope:'Imported call routing; wildcard handles; two retained Flash projections, not complete WindowLayer or typed-local qualification', sourceSha256:hash(source), expected, results}, null, 2));
    console.log(JSON.stringify({status:'pass', targets:results.length, originalRows:expected.length, runtimeChecks:4, out}));
}
main().catch(error => {console.error(error);process.exitCode = 1;});
