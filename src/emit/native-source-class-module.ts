import * as ts from 'typescript';
import parse = require('../parse');
import {emit, EmitterOptions} from './emitter';
import {NativeGeneratedDeclarationPlan, nativeGeneratedDeclarationInputs} from './native-generated-declarations';

export interface NativeSourceClassModuleInput {
    plan: NativeGeneratedDeclarationPlan;
    emitterOptions: Partial<EmitterOptions>;
    /** Exact code-owned imports, resolved by the consumer's build, never by basename. */
    externalModules: ReadonlyArray<string>;
    loadingSessionModule: string;
    target: 'ES5' | 'ES2015';
}
export interface NativeSourceClassModuleArtifact {
    /** Native ESM JavaScript. All function bodies are compiled at build time. */
    readonly moduleSource: string;
    readonly declarationSource: string;
    /** Complete emitted TypeScript, retained for consumer type checking. */
    readonly generatedSources: ReadonlyArray<{readonly module: string; readonly source: string}>;
    readonly dependencies: ReadonlyArray<{readonly module: string; readonly imports: ReadonlyArray<string>}>;
    readonly sourceHashes: {[qname: string]: string};
}
function fail(reason: string): never {throw new Error('AS3_SOURCE_CLASS_MODULE_UNSUPPORTED: ' + reason);}
function specifier(value: string): string {
    if (typeof value !== 'string' || !value.trim() || /[\x00\r\n]/.test(value)) fail('module specifier');
    return value;
}

/** Emit a complete cohort from its genuine source plan; arbitrary generated text is not input authority. */
export function emitNativeSourceClassModule(input: NativeSourceClassModuleInput): NativeSourceClassModuleArtifact {
    const plan = input.plan, planned = nativeGeneratedDeclarationInputs(plan, plan && plan.scope);
    if (!planned.inheritScriptClasses || !planned.scriptDomainProvider || !planned.scriptGlobalProviderModule
        || !(plan.bindings.length + plan.interfaces.length) || plan.bindings.some(b => !b.scriptGlobalExport)
        || Object.keys(planned.sources).length !== plan.bindings.length + plan.interfaces.length
        || Object.keys(planned.sources).some(q => planned.sources[q].referenceOnly))
        fail('complete inherited script Class cohort required');
    if (input.target !== 'ES5' && input.target !== 'ES2015') fail('target');
    const options = input.emitterOptions;
    if (!options || options.customVisitors && options.customVisitors.length) fail('custom visitors cannot replace planned source');
    if (!options.nativeClassHelperModules || !options.nativeReferenceCoercion) fail('native Class and reference providers required');
    if (options.nativeReferenceCoercion.plan !== plan) fail('reference provider must use this plan');
    if (options.nativeGeneratedDeclarations && options.nativeGeneratedDeclarations.plan !== plan) fail('declaration plan mismatch');
    if (!Array.isArray(input.externalModules) || new Set(input.externalModules).size !== input.externalModules.length)
        fail('unique explicit external modules required');
    const external = input.externalModules.map(specifier);
    const session = specifier(input.loadingSessionModule), helper = specifier(options.nativeClassHelperModules.nativeClass);
    if (external.indexOf(session) < 0 || external.indexOf(helper) < 0) fail('session and native Class helpers must be explicit external modules');
    const domain = planned.scriptDomainProvider, declarations = './__native_declarations';
    const classModules = plan.bindings.map((b, i) => './__native_class_' + i);
    const interfaceModules = plan.interfaces.map((b, i) => './__native_interface_' + i);
    const local = [domain.module, declarations].concat(classModules, interfaceModules);
    if (new Set(local).size !== local.length || external.some(m => local.indexOf(m) >= 0)) fail('local/external module collision');
    const imports = {...options.importModules};
    plan.bindings.forEach((b, i) => {imports[b.qname] = classModules[i];});
    plan.interfaces.forEach((b, i) => {imports[b.qname] = interfaceModules[i];});
    const generated = [{module: declarations, source: plan.moduleSource}];
    plan.bindings.forEach((binding, i) => {
        const source = planned.sources[binding.qname].source;
        const opts = {...options, customVisitors: [], importModules: imports,
            nativeGeneratedDeclarations: {plan, module: declarations},
            nativeReferenceCoercion: {...options.nativeReferenceCoercion, plan, module: declarations}} as EmitterOptions;
        generated.push({module: classModules[i], source: emit(parse(binding.qname + '.as', source), source, opts)});
    });
    // Interfaces retain their complete authored type declarations. Runtime
    // identity comes from the selected nominal header, never a JS constructor.
    plan.interfaces.forEach((binding, i) => {
        const source = planned.sources[binding.qname].source;
        const opts = {...options, customVisitors: [], importModules: imports} as EmitterOptions;
        Object.keys(opts).filter(key => key.indexOf('native') === 0).forEach(key => delete (opts as any)[key]);
        opts.nativeVectorTypes = {plan, module: declarations};
        generated.push({module: interfaceModules[i], source: emit(parse(binding.qname + '.as', source), source, opts)});
    });
    const dependencies: {module: string; imports: ReadonlyArray<string>}[] = [];
    const bodies = generated.map(item => {
        // Check erased type imports as well as executable CommonJS dependencies.
        const sourceTree = ts.createSourceFile(item.module + '.ts', item.source, ts.ScriptTarget.Latest, true);
        sourceTree.statements.forEach(statement => {
            if (statement.kind === ts.SyntaxKind.ImportDeclaration || statement.kind === ts.SyntaxKind.ExportDeclaration) {
                const module = (statement as ts.ImportDeclaration | ts.ExportDeclaration).moduleSpecifier;
                if (module && (module.kind !== ts.SyntaxKind.StringLiteral
                    || local.indexOf((module as ts.StringLiteral).text) < 0 && external.indexOf((module as ts.StringLiteral).text) < 0))
                    fail('unbound TypeScript dependency: ' + item.module + ' -> ' + module.getText(sourceTree));
            }
        });
        const compiled = ts.transpileModule(item.source, {compilerOptions: {
            target: input.target === 'ES5' ? ts.ScriptTarget.ES5 : ts.ScriptTarget.ES2015,
            module: ts.ModuleKind.CommonJS, experimentalDecorators: true}, reportDiagnostics: true});
        if (compiled.diagnostics && compiled.diagnostics.length) fail('generated TypeScript syntax: ' + item.module);
        const tree = ts.createSourceFile(item.module + '.js', compiled.outputText, ts.ScriptTarget.Latest, true);
        const required: string[] = [];
        const walk = (node: ts.Node): void => {
            if (node.kind === ts.SyntaxKind.CallExpression) {
                const call = node as ts.CallExpression;
                if (call.expression.kind === ts.SyntaxKind.Identifier) {
                    const name = (call.expression as ts.Identifier).text;
                    if (name === 'eval' || name === 'Function') fail('runtime code compilation');
                    if (name === 'require') {
                        if (call.arguments.length !== 1 || call.arguments[0].kind !== ts.SyntaxKind.StringLiteral) fail('dynamic dependency');
                        const dep = (call.arguments[0] as ts.StringLiteral).text;
                        if (local.indexOf(dep) < 0 && external.indexOf(dep) < 0) fail('unbound dependency: ' + item.module + ' -> ' + dep);
                        if (required.indexOf(dep) < 0) required.push(dep);
                    }
                }
            }
            if (node.kind === ts.SyntaxKind.NewExpression && (node as ts.NewExpression).expression.getText(tree) === 'Function') fail('runtime code compilation');
            ts.forEachChild(node, walk);
        };
        walk(tree);
        dependencies.push(Object.freeze({module: item.module, imports: Object.freeze(required)}));
        return '[' + JSON.stringify(item.module) + ', function(exports, require) {\n' + compiled.outputText + '\n}]';
    });
    const used = new Set<string>([session, helper]);
    dependencies.forEach(d => d.imports.forEach(m => {if (external.indexOf(m) >= 0) used.add(m);}));
    const providers = external.filter(m => used.has(m));
    const providerName = (m: string): string => '__provider' + providers.indexOf(m);
    const lines = providers.map((m, i) => 'import * as __provider' + i + ' from ' + JSON.stringify(m) + ';');
    lines.push('const __external = new Map([' + providers.map(m => '[' + JSON.stringify(m) + ',' + providerName(m) + ']').join(',') + ']);',
        'const __bodies = new Map([\n' + bodies.join(',\n') + '\n]);',
        'export function bindNativeSourceClasses(domain) {',
        '  const cache = new Map([[' + JSON.stringify(domain.module) + ', {' + JSON.stringify(domain.exportName) + ': domain}]]);',
        '  let failed = false, failure;',
        '  function load(name) {',
        '    if (failed) throw failure;',
        '    if (__external.has(name)) return __external.get(name);',
        '    if (cache.has(name)) return cache.get(name);',
        '    if (!__bodies.has(name)) throw new Error("Unbound native cohort module: " + name);',
        '    const exports = Object.create(null); cache.set(name, exports);',
        '    try { __bodies.get(name)(exports, load); }',
        '    catch (error) { failed = true; failure = error; cache.clear(); throw error; }',
        '    return exports;',
        '  }',
        '  const headers = load(' + JSON.stringify(declarations) + ');',
        '  return [',
        plan.bindings.map((b, i) => '    {name:' + JSON.stringify(b.qname) + ',declaration:headers[' + JSON.stringify(b.tokenExport)
            + '],resolve:()=>' + providerName(helper) + '.readNativeClass(load(' + JSON.stringify(classModules[i]) + ')['
            + JSON.stringify(b.qname.split('.').pop()) + '],"value")}')
            .concat(plan.interfaces.map(b => '    {name:'+JSON.stringify(b.qname)+',declaration:headers['+JSON.stringify(b.tokenExport)
                +'],resolve:()=>headers['+JSON.stringify(b.tokenExport)+']}')).join(',\n'),
        '  ];', '}',
        'export const nativeSourceClassModule = ' + providerName(session) + '.createNativeSourceClassModule(async () => bindNativeSourceClasses);');
    return Object.freeze({moduleSource: lines.join('\n') + '\n',
        declarationSource: 'import {NativeSourceClassFactory, NativeSourceClassModule} from ' + JSON.stringify(session) + ';\n'
            + 'export declare const bindNativeSourceClasses: NativeSourceClassFactory;\nexport declare const nativeSourceClassModule: NativeSourceClassModule;\n',
        generatedSources: Object.freeze(generated.map(item => Object.freeze(item))),
        dependencies: Object.freeze(dependencies), sourceHashes: plan.sourceHashes});
}
