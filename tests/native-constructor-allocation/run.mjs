import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..');
const require = createRequire(import.meta.url), ts = require('typescript');
const engine = path.resolve(process.env.LAYA_ENGINE_REPOSITORY || path.join(root, '../LayaAir-op2'));
const modern = require(path.join(engine, 'node_modules/typescript'));
const { build } = require(path.join(engine, 'node_modules/esbuild'));
const { chromium } = require(require.resolve('playwright', {paths:[process.env.LAYA_BROWSER_TOOLS || path.join(root, '../op2-html5/game-client-laya'), engine]}));
const { createLayaSourceAliasPlugin } = await import(pathToFileURL(path.join(engine, 'tests/nativeCanonicalSpriteClass/laya-source-alias.mjs')));
const expected = require(path.join(engine, 'tests/nativeFlashOracle/generated-sprite-ancestry/verify.cjs'));
const runtime = path.join(root, 'utils/callableClass.ts'), probe = path.join(here, 'probe.ts');
const parent = path.join(root, '.cache/native-constructor-allocation'); mkdirSync(parent, {recursive:true});
const out = mkdtempSync(path.join(parent, 'run-'));
const options = {target:modern.ScriptTarget.ES2022, lib:['lib.es2022.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts'],
    module:modern.ModuleKind.ES2022, moduleResolution:modern.ModuleResolutionKind.NodeJs,
    noEmit:true, skipLibCheck:true, experimentalDecorators:true,
    strict:true, strictNullChecks:false, useDefineForClassFields:false, baseUrl:engine,
    typeRoots:[path.join(engine, 'node_modules/@types')], types:['node'],
    paths:{'@laya/engine/*':['src/layaAir/*'], '@laya/flash/*':['src/layaAir/flash/*'],
        '@allocation/init':['tests/nativeCanonicalSpriteClass/init-imports.ts']}};
const program = modern.createProgram([probe, ...['glsl.d.ts','spine.d.ts'].map(name => path.join(engine,'src/layaAir/tslibs',name))], options);
const diagnostics = modern.getPreEmitDiagnostics(program).map(d => ({file:d.file && d.file.fileName, code:d.code, text:modern.flattenDiagnosticMessageText(d.messageText,'\n')}));
writeFileSync(path.join(out, 'types.json'), JSON.stringify(diagnostics, null, 2)); assert.deepEqual(diagnostics, []);
const transpile = (file, target) => {
    const result = ts.transpileModule(readFileSync(file, 'utf8'), {compilerOptions:{target, module:ts.ModuleKind.CommonJS}, reportDiagnostics:true});
    assert.deepEqual(result.diagnostics, []); return result.outputText;
};
const browser = await chromium.launch({headless:true, args:['--enable-unsafe-swiftshader']});
const results = [];
try {
    for (const target of [ts.ScriptTarget.ES5, ts.ScriptTarget.ES2015]) {
        const exports = {}; new Function('exports', transpile(runtime, target))(exports);
        const runtimeGuards = require('./guards.cjs')(exports.callableClassIntrinsics);
        const result = await build({absWorkingDir:engine, entryPoints:[probe], write:false, bundle:true, metafile:true,
            platform:'browser', format:'iife', target:'chrome120', tsconfigRaw:{compilerOptions:{useDefineForClassFields:false}},
            loader:{'.glsl':'text','.vs':'text','.fs':'text','.wgsl':'text'}, plugins:[{
                name:'compiler-protocol-target', setup(builder) {
                    builder.onResolve({filter:/^@allocation\/init$/}, () => ({path:path.join(engine,'tests/nativeCanonicalSpriteClass/init-imports.ts')}));
                    builder.onLoad({filter:/\.ts$/}, args => {
                        if (![probe, runtime].includes(path.resolve(args.path))) return;
                        return {contents:transpile(args.path, target), loader:'js', resolveDir:path.dirname(args.path)};
                    });
                }
            }, createLayaSourceAliasPlugin(engine)]});
        const bundle = result.outputFiles[0].text; writeFileSync(path.join(out, `bundle-${target}.js`), bundle);
        const server = createServer((req, res) => {
            res.setHeader('Content-Type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html');
            res.end(req.url === '/fixture.js' ? bundle : '<html><link rel="icon" href="data:,"><body><script src="/fixture.js"></script></body></html>');
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const page = await browser.newPage(), errors = [];
        try {
            page.on('pageerror', error => errors.push(String(error)));
            await page.goto(`http://127.0.0.1:${server.address().port}`);
            await page.waitForFunction(() => window.allocationResult, null, {timeout:30000});
            const actual = await page.evaluate(() => window.allocationResult);
            results.push({target, actual, errors, runtimeGuards, inputs:Object.keys(result.metafile.inputs).map(input => ({
                file:input, sha256:createHash('sha256').update(readFileSync(path.resolve(engine,input))).digest('hex')}))});
            writeFileSync(path.join(out, 'report.json'), JSON.stringify({results, browser:browser.version(), diagnostics}, null, 2));
            assert.equal(actual.error, undefined); assert.deepEqual(errors, []); assert.deepEqual(actual.rows, expected);
            assert.equal(actual.checks.length, 11); assert.equal(runtimeGuards, 18);
        } finally { await page.close(); await new Promise(resolve => server.close(resolve)); }
    }
} finally { await browser.close(); }
console.log(JSON.stringify({out, airRows:expected.length, browserGuards:11, runtimeGuards:18, targets:['ES5','ES2015'], typeErrors:0}));
