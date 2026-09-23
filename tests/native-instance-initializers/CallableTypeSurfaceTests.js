const assert = require('assert'), fs = require('fs'), path = require('path'), os = require('os');
const ts = require('typescript'), parse = require('../../lib/parse'), emit = require('../../lib/emit');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'callable-types-'));
const input = path.join(__dirname, 'oracle/instanceorder');
const sourceClasses = Object.fromEntries(fs.readdirSync(input).map(file => ['instanceorder.' + path.basename(file, '.as'), fs.readFileSync(path.join(input,file),'utf8')]));
const classes = Object.fromEntries(Object.keys(sourceClasses).map(key => [key, 'lazy']));
require('./common-runtime').writeDeclaration(directory);
fs.appendFileSync(path.join(directory,'AS3MethodBinding.d.ts'),'\nexport declare function as3CoerceNumber(value:any):number;\nexport declare function as3CoerceInt(value:any):number;\nexport declare function as3CoerceUint(value:any):number;\n');
for (const name of ['nativeClass', 'bound', 'classBound', 'callableClass'])
    fs.copyFileSync(path.join(__dirname, '../../utils', name + '.ts'), path.join(directory, name + '.ts'));
for (const [qname, source] of Object.entries(sourceClasses)) {
    const name = qname.split('.').pop();
    fs.writeFileSync(path.join(directory, name + '.ts'), emit(parse(name+'.as',source), source,
        {customVisitors:[], definitionsByNamespace:{},nativeClassInitialization:{classes},nativeCallableMethodBindingModule:"./AS3MethodBinding",nativeCallableCoercionModule:"./AS3MethodBinding",nativeCallableClasses:sourceClasses}));
}
fs.writeFileSync(path.join(directory, 'Consumer.ts'), `import {Explicit} from './Explicit';
import {Base} from './Base'; import {readNativeClass} from './nativeClass';
const Constructor = readNativeClass(Explicit);
const instance: Explicit = new Constructor();
const parent: Base = instance;
const first: number = instance.first;
const method: string = parent.inspect();
`);
for (const target of [ts.ScriptTarget.ES5, ts.ScriptTarget.ES2015]) {
    const program = ts.createProgram(fs.readdirSync(directory).map(file => path.join(directory,file)),
        {target,module:ts.ModuleKind.CommonJS,strict:true,strictNullChecks:false,lib:['lib.es2015.d.ts'],experimentalDecorators:true,noEmit:true});
    const errors = ts.getPreEmitDiagnostics(program).map(d => (d.file ? d.file.fileName + ':' : '') + ts.flattenDiagnosticMessageText(d.messageText,'\n'));
    assert.deepEqual(errors, []);
}
console.log('Closed source callable constructors: strict TypeScript '+ts.version+' value/instance/inheritance surfaces pass both targets');
