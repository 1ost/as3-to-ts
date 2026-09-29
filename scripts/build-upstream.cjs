const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript-4-9');
const roots = ['emit', 'parse', 'syntax', 'reports', 'custom-visitors'];
const files = fs.readdirSync('src').filter(name => name.endsWith('.ts') && name !== 'command.ts').map(name => path.join('src', name));
function collect(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) files.push(file);
  }
}
roots.forEach(root => collect(path.join('src', root)));
for (const file of files) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
  });
  const errors = (output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw new Error(ts.formatDiagnostics(errors, {
    getCanonicalFileName: name => name, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n',
  }));
  const target = path.join('lib', path.relative('src', file)).replace(/\.ts$/, '.js');
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, output.outputText);
}
