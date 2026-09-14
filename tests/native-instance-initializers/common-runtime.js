const assert = require('assert'), fs = require('fs'), path = require('path'), child = require('child_process'), os = require('os');
const engine = path.resolve(__dirname, '../../../LayaAir-op2');
const commit = 'd3db69240e22575d48828ae95b1243bc6e593ed1';
const esbuild = require(path.join(engine, 'node_modules/esbuild'));
const modernTS = require(path.join(engine, 'node_modules/typescript'));
const crypto = require('crypto');
const sourceFile = 'src/layaAir/flash/utils/AS3MethodBinding.ts';
const sources = new Map();
function original(file) {
    const relative = path.relative(engine, file).replace(/\\/g, '/');
    assert(!relative.startsWith('../'), relative);
    if (!sources.has(relative)) sources.set(relative,
        child.execFileSync('git', ['show', commit + ':' + relative], {cwd: engine, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024}));
    return sources.get(relative);
}
let code;
function entry() {
    return ['AS3MethodBinding', 'AS3Property', 'FlashTypeMetadata', 'AS3Type', 'AS3Coercion'].map(name =>
        'export * from "./src/layaAir/flash/utils/' + name + '";').join('\n');
}
function wrap(code) {
    return '(function(){var module = {exports:{}};\n' + code
        + '\nObject.keys(module.exports).forEach(function(name){exports[name] = module.exports[name];});})();';
}
exports.moduleName = './AS3MethodBinding';
exports.commit = commit;
exports.source = function() {
    if (!code) {
        const snapshot = fs.mkdtempSync(path.resolve(__dirname, '../../../engine-'));
        const archive = child.execFileSync('git', ['archive', '--format=tar', commit, 'src/layaAir/flash/utils'],
            {cwd: engine, maxBuffer: 32 * 1024 * 1024});
        child.execFileSync('tar', ['-xf', '-', '-C', snapshot], {input: archive});
        const result = esbuild.buildSync({stdin: {contents: entry(), resolveDir: snapshot, loader: 'ts'},
            bundle: true, write: false, format: 'cjs', platform: 'node', target: 'es2015'});
        code = wrap(result.outputFiles[0].text);
    }
    return code;
};
/** Explicit integration probe only; default regression authority stays committed. */
exports.workingSource = function() {
    const result = esbuild.buildSync({stdin: {contents: entry(), resolveDir: engine, loader: 'ts'},
        bundle: true, write: false, format: 'cjs', platform: 'node', target: 'es2015', metafile: true});
    const files = Object.keys(result.metafile.inputs).filter(file => file !== '<stdin>').map(file => {
        const absolute = path.resolve(file);
        return {path: path.relative(engine, absolute).replace(/\\/g,'/'),
            sha256: crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex')};
    });
    return {source: wrap(result.outputFiles[0].text), files};
};
exports.writeDeclaration = function(directory) {
    const input = path.join(directory, 'AS3MethodBinding.ts');
    fs.writeFileSync(input, original(path.join(engine, sourceFile)));
    const program = modernTS.createProgram([input], {target: modernTS.ScriptTarget.ES2015,
        module: modernTS.ModuleKind.CommonJS, declaration: true, emitDeclarationOnly: true});
    assert.deepStrictEqual(modernTS.getPreEmitDiagnostics(program).map(d => modernTS.flattenDiagnosticMessageText(d.messageText, '\n')), []);
    assert.equal(program.emit().emitSkipped, false);
    fs.unlinkSync(input);
    const declaration = path.join(directory, 'AS3MethodBinding.d.ts');
    fs.writeFileSync(declaration, fs.readFileSync(declaration,'utf8').replace(/\bunknown\b/g,'any').replace(/\breadonly\s+/g,''));
};
