import {NativeLexicalMembers} from './native-lexical-members';
import {lowerNativeSourceOperations} from './native-source-operations';
import {validateNativeTypeOf} from './native-typeof';
import {NativeClassMetadataOptions, validateNativeClassMetadata} from './native-class-metadata';
import Node, {unwrapEncapsulatedExpression} from '../syntax/node';
import K from '../syntax/nodeKind';
import parse = require('../parse');
import {nativeSourceTypeIdentity} from './native-source-type';
import {NativeDeclarationDomain, nativeDeclarationDomainFor} from './native-declaration-plan';

export interface NativeCallableClassOptions { [qname: string]: string; }
interface SourceClass {
    qname: string; name: string; base: string; fields: {name: string; value: string}[];
    parameters: {name: string; type: string; optional: boolean; defaultLiteral?: string}[]; usesArguments: boolean;
    instanceMembers: {name: string; method: boolean}[];
}

/** Explicit closed-source prototype. No provider allocation or constructor-body dispatcher. */
export class NativeCallableClasses {
    private classes = new Map<string, SourceClass>();
    private own: SourceClass;
    private sourceRoots = new Map<string, Node>();
    private sourceTexts = new Map<string, string>();
    private ts: any;
    private declarationDomain: NativeDeclarationDomain;
    private fail(message: string): never { throw new Error('AS3_CALLABLE_CLASS_UNSUPPORTED: ' + message); }
    constructor(source: string, options: NativeCallableClassOptions, lazy: {[qname: string]: string}, private methodBindingModule?: string, private coercionModule?: string, private metadata?: NativeClassMetadataOptions, private sourceHelpers?: Set<string>, private stringModule?: string, private lexical?: NativeLexicalMembers, private localAdditionModule?: string) {
        if (!options) return;
        this.declarationDomain = nativeDeclarationDomainFor(metadata,options,lexical);
        if (typeof methodBindingModule !== 'string' || !methodBindingModule.trim()
            || /[\r\n\u0000]/.test(methodBindingModule))
            this.fail('callable source methods require the common AS3MethodBinding module');
        if (typeof options !== 'object' || Array.isArray(options)
            || Object.getPrototypeOf(options) !== Object.prototype && Object.getPrototypeOf(options) !== null)
            this.fail('invalid exact source class map');
        const roots = new Map<string, Node>();
        Object.keys(options).forEach(qname => {
            if (typeof options[qname] !== 'string' || !lazy || lazy[qname] !== 'lazy') this.fail('source identity must be lazy: ' + qname);
            this.sourceTexts.set(qname, options[qname]);
            const root = parse(qname + '.as', options[qname]), declarations: Node[] = [];
            const walk = (node: Node): void => {
                if (!node) return;
                node.children = node.children.filter(child => !!child);
                if (node.kind === K.CLASS) declarations.push(node);
                node.children.forEach(child => { if (child) child.parent = node; walk(child); });
            };
            walk(root);
            if (declarations.length !== 1) this.fail('exactly one source class is required: ' + qname);
            // A source map shares declaration inputs, not a lexical capability.
            // The current emitter plan can only prove its own exact source/qname.
            let classLexical: NativeLexicalMembers;
            if (metadata) {
                try {
                    if (lexical) classLexical = lexical.qname === qname && lexical.source === options[qname]
                        ? lexical
                        : new NativeLexicalMembers(options[qname], root, lexical.module, metadata, !!lexical.typedLocals);
                    validateNativeClassMetadata(qname, options[qname], metadata, classLexical);
                } catch (error) {
                    if (error instanceof Error) error.message += ' [source-map declaration: ' + qname + ']';
                    throw error;
                }
            }

            const cls = declarations[0], name = cls.findChild(K.NAME).text;
            if (metadata) validateNativeTypeOf(cls, options[qname], Object.keys(lazy));
            let pkg = cls.parent; while (pkg && pkg.kind !== K.PACKAGE) pkg = pkg.parent;
            const namespace = pkg && pkg.findChild(K.NAME).text || '';
            const imports = pkg.findChild(K.CONTENT).findChildren(K.IMPORT).map(node => node.text);
            if ((namespace ? namespace + '.' : '') + name !== qname) this.fail('mismatched source identity: ' + qname);
            const classAliases = new Set<string>(Object.keys(options).map(key => key.split('.').pop()));
            const aliasScan = (node: Node): void => {
                if (node.kind === K.NAME_TYPE_INIT && node.findChild(K.TYPE) && node.findChild(K.TYPE).text === 'Class')
                    classAliases.add(node.findChild(K.NAME).text);
                node.children.forEach(aliasScan);
            };
            aliasScan(cls);
            const callScan = (node: Node): void => {
                const receiver = node.children[0] && unwrapEncapsulatedExpression(node.children[0]);
                if (node.kind === K.DOT && receiver && classAliases.has(receiver.text)
                    && ['call', 'apply', 'bind', 'prototype'].indexOf(node.children[1].text) >= 0)
                    this.fail('direct callable-constructor invocation/prototype manipulation');
                if (node.kind === K.CALL && node.children[0] && classAliases.has(node.children[0].text)
                    && !Object.keys(options).some(key => key.split('.').pop() === node.children[0].text))
                    this.fail('dynamic Class invocation requires exact constructor authority');
                node.children.forEach(callScan);
            };
            if (!metadata) callScan(cls);
            if (cls.findChild(K.IMPLEMENTS_LIST)) this.fail('interface construction identity requires separate authority');
            let base = null;
            const ext = cls.findChild(K.EXTENDS);
            if (ext) {
                if (ext.text.indexOf('.') >= 0) this.fail('qualified base syntax');
                const candidates: string[] = [];
                const local = (namespace ? namespace + '.' : '') + ext.text;
                if (Object.prototype.hasOwnProperty.call(options, local)) candidates.push(local);
                pkg.findChild(K.CONTENT).findChildren(K.IMPORT).forEach(imp => {
                    const candidate = imp.text.endsWith('.*') ? imp.text.slice(0, -1) + ext.text : imp.text;
                    if (candidate.split('.').pop() === ext.text && Object.prototype.hasOwnProperty.call(options, candidate)
                        && candidates.indexOf(candidate) < 0) candidates.push(candidate);
                });
                if (candidates.length !== 1) this.fail('mixed/unknown/ambiguous base chain: ' + qname + ' extends ' + ext.text);
                base = candidates[0];
            }
            const fields: {name: string; value: string}[] = [];
            const instanceMembers: {name: string; method: boolean}[] = [];
            cls.findChild(K.CONTENT).children.forEach(member => {
                const mods = member.findChild(K.MOD_LIST);
                const isStatic = mods && mods.children.some(mod => mod.text === 'static');
                const lexicalMember = classLexical && classLexical.proves(member);
                if (!isStatic && !lexicalMember && [K.FUNCTION, K.GET, K.SET].indexOf(member.kind) >= 0) {
                    const memberName = member.findChild(K.NAME).text;
                    if (memberName !== name) instanceMembers.push({name: memberName, method: member.kind === K.FUNCTION});
                }
                if (member.kind !== K.VAR_LIST && member.kind !== K.CONST_LIST) return;
                if (member.kind === K.CONST_LIST && !isStatic) this.fail('instance const descriptors need separate authority');
                if (isStatic || lexicalMember) return;
                member.findChildren(K.NAME_TYPE_INIT).forEach(field => {
                    const fieldName = field.findChild(K.NAME).text, typeNode = field.findChild(K.TYPE);
                    instanceMembers.push({name: fieldName, method: false});
                    if (['constructor', '__proto__', 'prototype'].indexOf(fieldName) >= 0) this.fail('reserved construction identity field');
                    const type = nativeSourceTypeIdentity(typeNode, qname, imports);
                    fields.push({name: fieldName, value: type === 'int' || type === 'uint' ? '0' : type === 'Number' ? '(0/0)'
                        : type === 'Boolean' ? 'false' : !type || type === '*' ? 'void 0' : 'null'});
                });
            });
            const constructor = cls.findChild(K.CONTENT).children.find(member => member.kind === K.FUNCTION && member.findChild(K.NAME).text === name);
            const parameters: {name: string; type: string; optional: boolean; defaultLiteral?: string}[] = [];
            let usesArguments = false;
            if (constructor) {
                constructor.findChild(K.PARAMETER_LIST).children.forEach(parameter => {
                    if (parameter.findChild(K.REST)) this.fail('rest constructor argument authority');
                    const value = parameter.findChild(K.NAME_TYPE_INIT), type = value.findChild(K.TYPE);
                    const sourceType = nativeSourceTypeIdentity(type, qname, imports);
                    const selfReference = !!metadata && sourceType === qname;
                    if (!selfReference && ['Number', 'int', 'uint', 'Boolean', 'Object', '*', 'String'].indexOf(sourceType) < 0)
                        this.fail('constructor parameter coercion needs common provider authority: ' + (type && type.text || '*') + ' (' + sourceType + ')');
                    if (sourceType === 'String' && (typeof stringModule !== 'string' || !stringModule.trim()
                        || /[\r\n\u0000]/.test(stringModule)))
                        this.fail('String constructor parameters require the common AS3String provider module');
                    if (['Number', 'int', 'uint'].indexOf(sourceType) >= 0
                        && (typeof coercionModule !== 'string' || !coercionModule.trim()
                            || /[\r\n\u0000]/.test(coercionModule)))
                        this.fail('numeric constructor parameters require the common AS3Coercion module');
                    const init = value.findChild(K.INIT);
                    if (selfReference && (!init || init.children[0].kind !== K.IDENTIFIER || init.children[0].text !== 'null'))
                        this.fail('self-reference constructor parameter requires an optional null default');
                    if (init && sourceType === 'String') {
                        const expression = init.children[0];
                        if (!(expression.kind === K.IDENTIFIER && expression.text === 'null')
                            && !(expression.kind === K.LITERAL && /^(?:"[\s\S]*"|'[\s\S]*')$/.test(expression.text)))
                            this.fail('String constructor default requires source String or null literal authority');
                    }
                    let defaultLiteral: string;
                    if (init && ['Number', 'int', 'uint'].indexOf(sourceType) >= 0) {
                        const expression = init.children[0];
                        defaultLiteral = expression.kind === K.LITERAL ? expression.text
                            : (expression.kind === K.MINUS || expression.kind === K.PLUS)
                                && expression.children.length === 1 && expression.children[0].kind === K.LITERAL
                                ? (expression.kind === K.MINUS ? '-' : '+') + expression.children[0].text : '';
                        const numeric = /^[+-]?(?:0[xX][0-9a-fA-F]+|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)$/.test(defaultLiteral)
                            ? Number(defaultLiteral) : NaN;
                        if (/^[+-]?0[0-9]/.test(defaultLiteral) || !isFinite(numeric) || sourceType !== 'Number'
                            && (Math.floor(numeric) !== numeric || numeric < (sourceType === 'int' ? -2147483648 : 0)
                                || numeric > (sourceType === 'int' ? 2147483647 : 4294967295)))
                            this.fail('numeric constructor default requires finite source literal authority');
                    }
                    parameters.push({name:value.findChild(K.NAME).text, type:sourceType, optional:!!init, defaultLiteral});
                });
                const scanArguments = (node: Node): void => {
                    if (node.kind === K.FUNCTION || node.kind === K.LAMBDA) {
                        const nested = (child: Node): void => {
                            if (child.kind === K.IDENTIFIER && child.text === 'arguments')
                                this.fail('nested function arguments require separate lexical scope authority');
                            child.children.forEach(nested);
                        };
                        nested(node); return;
                    }
                    if (node.kind === K.IDENTIFIER && node.text === 'arguments') usesArguments = true;
                    node.children.forEach(scanArguments);
                };
                scanArguments(constructor.findChild(K.BLOCK));
            }
            const value = {qname, name, base, fields, parameters, usesArguments, instanceMembers}; this.classes.set(qname, value); roots.set(qname, cls); this.sourceRoots.set(qname, cls);
            if (options[qname] === source) {
                if (this.own) this.fail('ambiguous current source');
                this.own = value;
            }
        });
        if (!this.own) this.fail('current source bytes are absent from exact class map');
        this.classes.forEach(value => {
            const chain = new Set<string>(), slots = new Set<string>();
            for (let current = value; current; current = this.classes.get(current.base)) {
                if (chain.has(current.qname)) this.fail('cyclic source inheritance');
                chain.add(current.qname);
                current.fields.forEach(field => {
                    if (slots.has(field.name)) this.fail('colliding source slot identity: ' + field.name);
                    slots.add(field.name);
                });
            }
        });
        // This optional compiler pass uses the toolkit's installed TypeScript parser.
        this.ts = require('typescript');
    }

    public lower(source: string): string {
        if (!this.own) return source;
        const ts = this.ts, S = ts.SyntaxKind, name = this.own.name;
        const file = ts.createSourceFile('Callable.ts', source, ts.ScriptTarget.Latest, true);
        if (file.parseDiagnostics.length) this.fail('intermediate native syntax');
        let cls: any, alias: any;
        const visit = (node: any): void => {
            if (node.kind === S.ClassDeclaration && node.name.text === name) cls = node;
            if (node.kind === S.TypeAliasDeclaration && node.name.text === name) alias = node;
            ts.forEachChild(node, visit);
        };
        visit(file);
        const compilerHelpers = new Set<string>();
        if (this.sourceHelpers) this.sourceHelpers.forEach(helper => compilerHelpers.add(helper));
        file.statements.forEach((statement: any) => {
            if (statement.kind !== S.ImportDeclaration || !statement.importClause || !statement.importClause.namedBindings) return;
            if (!/(?:^|\/)(?:nativeClass|callableClass|bound|classBound|AS3MethodBinding)$/.test(statement.moduleSpecifier.text)) return;
            const bindings = statement.importClause.namedBindings;
            if (bindings.elements) bindings.elements.forEach((item: any) => compilerHelpers.add(item.name.text));
        });
        if (!cls || !alias) this.fail('expected complete native class and instance type');
        const unique = (label: string): string => { let result = '__as3_callable_' + label; while (source.indexOf(result) >= 0) result += '_'; return result; };
        const baseName = unique('base'), constructorType = unique('constructor'), bindName = unique('bind');
        const intrinsic = unique('intrinsics'), identity = unique('identity'), fresh = unique('fresh'), succeeded = unique('succeeded');
        const functionType = unique('functionType'), superArguments = unique('superArguments');
        const numberCoercion = unique('number'), intCoercion = unique('int'), uintCoercion = unique('uint');
        const stringCoercion = unique('string');
        const sourceArguments = unique('arguments');
        const constructorCompletion = unique('constructorCompletion');
        const superMethods: string[] = [];
        const superMethodNames = new Map<string, string>();
        const directSuper = (key: string, supplied: number): string => {
            let owner = this.classes.get(this.own.base), depth = 0, method: Node;
            for (; owner; owner = this.classes.get(owner.base), depth++) {
                const content = this.sourceRoots.get(owner.qname).findChild(K.CONTENT);
                const candidates = content.children.filter(member => member.findChild(K.NAME)
                    && member.findChild(K.NAME).text === key);
                if (candidates.length) {
                    if (candidates.length !== 1 || candidates[0].kind !== K.FUNCTION)
                        this.fail('super target must be an exact source instance method');
                    method = candidates[0]; break;
                }
                if (owner.fields.some(field => field.name === key))
                    this.fail('super target is a source field');
            }
            if (!method) this.fail('super method is absent from complete source ancestry');
            if (key === owner.name) this.fail('super constructor is not an instance method');
            const mods = method.findChild(K.MOD_LIST);
            if (!mods || mods.children.some(mod => mod.text === 'private' || mod.text === 'static')
                || !mods.children.some(mod => mod.text === 'public' || mod.text === 'protected'))
                this.fail('super method visibility requires separate authority');
            const parameters = method.findChild(K.PARAMETER_LIST).children;
            let minimum = 0;
            parameters.forEach(parameter => {
                if (parameter.findChild(K.REST)) this.fail('super rest method signature');
                const declaration = parameter.findChild(K.NAME_TYPE_INIT), type = declaration.findChild(K.TYPE);
                if (!type || type.text !== 'Boolean') this.fail('super parameter coercion requires separately proved signature');
                const init = declaration.findChild(K.INIT);
                if (!init) minimum++;
                else if (!/^\s*(true|false)\s*$/.test(this.sourceTexts.get(owner.qname).slice(init.start,init.end)))
                    this.fail('super optional Boolean literal');
            });
            if (supplied < minimum || supplied > parameters.length)
                this.fail('super call source arity differs from declared signature');
            let capture = superMethodNames.get(key);
            if (!capture) {
                capture = unique('superMethod' + superMethods.length);
                let prototype = baseName + '.prototype';
                for (let index = 0; index < depth; index++) prototype = intrinsic + '.getPrototypeOf(' + prototype + ')';
                superMethods.push('const ' + capture + ' = ' + intrinsic + '.getOwnPropertyDescriptor('
                    + prototype + ', ' + JSON.stringify(key) + ')!.value;');
                superMethodNames.set(key, capture);
            }
            const args = unique('superCallArguments');
            return '((...' + args + ': any[]) => {'
                + parameters.slice(0, supplied).map((_,index) => args + '[' + index + '] = !!' + args + '[' + index + '];').join('')
                + 'return ' + intrinsic + '.apply(' + capture + ', this, ' + args + ');})';
        };
        const provider = unique('provider'), declaration = unique('declaration'), generation = unique('generation');
        const localCoercion = unique('localCoercion'), localString = unique('localString'), localAddition = unique('localAddition');
        const planned = this.declarationDomain && this.declarationDomain.bindings.find(binding => binding.qname === this.own.qname);
        if (this.declarationDomain && !planned) this.fail('current source declaration is absent from its compiler domain');
        const domainImport = planned ? unique('declarationDomain') : '';
        const referenceToken = planned ? (qname:string):string => {
            const binding=this.declarationDomain.bindings.find(value=>value.qname===qname);
            if(!binding)this.fail('foreign local declaration is absent from its compiler domain');
            return domainImport+'.'+binding.tokenExport;
        } : undefined;
        const text = (node: any): string => node.getText(file);
        const params = (member: any, signature: boolean): string => member.parameters.map((p: any) => {
            if (!signature) return text(p);
            return (p.dotDotDotToken ? '...' : '') + text(p.name) + (p.questionToken || p.initializer ? '?' : '')
                + ': ' + (p.type ? text(p.type) : 'any');
        }).join(', ');
        const type = (node: any): string => node.type ? text(node.type) : 'any';
        const instanceTypes: string[] = [], staticTypes: string[] = [], definitions: string[] = [], initializers: string[] = [];
        const staticMethods: string[] = [];
        let ctor: any, constructorReturns = 0;
        const body = (member: any, constructor: boolean): string => {
            if (!member.body) this.fail('bodyless member');
            const edits: {start: number; end: number; value: string}[] = [];
            let superCount = 0;
            const isSourceArguments = (node: any): boolean => {
                if (!constructor || node.kind !== S.Identifier || node.text !== 'arguments') return false;
                if ((node.parent.kind === S.PropertyAccessExpression || node.parent.kind === S.PropertyAssignment)
                    && node.parent.name === node) return false;
                let scope = node.parent;
                while (scope !== member.body && scope.kind !== S.FunctionExpression
                    && scope.kind !== S.FunctionDeclaration && scope.kind !== S.ArrowFunction) scope = scope.parent;
                return scope === member.body;
            };
            const argumentExpression = (node: any): string => {
                let result = text(node);
                const references: any[] = [];
                const collect = (child: any): void => {
                    if (isSourceArguments(child)) references.push(child);
                    ts.forEachChild(child, collect);
                };
                collect(node);
                references.sort((a,b) => b.getStart(file) - a.getStart(file)).forEach(reference => {
                    const start = reference.getStart(file) - node.getStart(file);
                    result = result.slice(0, start) + sourceArguments + result.slice(start + reference.end - reference.getStart(file));
                });
                return result;
            };
            const walk = (node: any, insideSuperArguments: boolean = false, nestedFunction: boolean = false): void => {
                if (isSourceArguments(node) && (node.parent.kind === S.PropertyAccessExpression
                        && node.parent.name.text === 'callee' || node.parent.kind === S.ElementAccessExpression
                        && node.parent.argumentExpression.kind === S.StringLiteral && node.parent.argumentExpression.text === 'callee'))
                    this.fail('arguments.callee requires separate callable identity authority');
                if (isSourceArguments(node) && !insideSuperArguments)
                    edits.push({start:node.getStart(file), end:node.end, value:sourceArguments});
                if (node.kind === S.CallExpression && node.expression.kind === S.PropertyAccessExpression
                    && node.expression.expression.kind === S.SuperKeyword) {
                    if (constructor || nestedFunction || insideSuperArguments
                        || member.modifiers && member.modifiers.some((mod: any) => mod.kind === S.StaticKeyword))
                        this.fail('super direct method call requires an ordinary instance method body');
                    if (node.arguments.some((argument: any) => argument.kind === S.SpreadElement))
                        this.fail('spread super method arguments');
                    edits.push({start:node.expression.getStart(file),end:node.expression.end,
                        value:directSuper(node.expression.name.text,node.arguments.length)});
                    node.arguments.forEach((argument: any) => walk(argument,false,nestedFunction)); return;
                }
                if (node.kind === S.SuperKeyword) this.fail('super property access requires separate receiver authority');
                if (node.kind === S.ReturnStatement && constructor && !nestedFunction) {
                    if (node.expression) this.fail('constructor return value');
                    constructorReturns++;
                    // Exiting a labeled block preserves all source finally effects.
                    // Completion is recorded only after those effects succeed.
                    edits.push({start: node.getStart(file), end: node.end,
                        value: 'break ' + constructorCompletion + ';'});
                    return;
                }
                if (node.kind === S.CallExpression && node.expression.kind === S.SuperKeyword) {
                    if (!constructor || node.parent.kind !== S.ExpressionStatement || node.parent.parent !== member.body)
                        this.fail('non-straight-line super construction');
                    if (++superCount > 1) this.fail('repeated super construction');
                    edits.push({start: node.getStart(file), end: node.end,
                        value: '{const ' + superArguments + ': any[] = [' + node.arguments.map(argumentExpression).join(', ') + ']; '
                            + intrinsic + '.expectBase(this, ' + identity + ', ' + baseName + '); '
                            + intrinsic + '.apply(' + baseName + ', this, ' + superArguments + '); }'});
                    node.arguments.forEach((argument: any) => walk(argument, true, nestedFunction)); return;
                }
                const childFunction = nestedFunction || node.kind === S.FunctionExpression
                    || node.kind === S.FunctionDeclaration || node.kind === S.ArrowFunction
                    || node.kind === S.MethodDeclaration || node.kind === S.GetAccessor || node.kind === S.SetAccessor;
                ts.forEachChild(node, (child: any) => walk(child, insideSuperArguments, childFunction));
            };
            walk(member.body);
            if (constructor && this.own.base && superCount !== 1) this.fail('missing source-base constructor call');
            let result = source.slice(member.body.getStart(file) + 1, member.body.end - 1);
            const offset = member.body.getStart(file) + 1;
            edits.sort((a,b) => b.start - a.start).forEach(edit => {
                result = result.slice(0, edit.start - offset) + edit.value + result.slice(edit.end - offset);
            });
            result = this.metadata ? lowerNativeSourceOperations(result, provider, compilerHelpers, unique, this.lexical) : result;
            if (this.lexical && this.lexical.typedLocals) result = this.lexical.typedLocals.lower(result, constructor ? this.own.name : member.name.text,
                !!member.modifiers && member.modifiers.some((mod: any) => mod.kind === S.StaticKeyword), provider, localCoercion, localString, localAddition, intrinsic + '.array', unique, referenceToken);
            return result;
        };
        const accessorTypes = new Set<string>();
        cls.members.forEach((member: any) => {
            const isStatic = member.modifiers && member.modifiers.some((mod: any) => mod.kind === S.StaticKeyword);
            const destination = isStatic ? name : name + '.prototype';
            if (member.kind === S.Constructor) { ctor = member; return; }
            if (!member.name || member.name.kind !== S.Identifier) this.fail('computed member identity');
            const key = member.name.text, lexicalMember = this.lexical && this.lexical.trait(key, !!isStatic);
            const encoded = lexicalMember ? lexicalMember.key : JSON.stringify(key);
            if (key === 'constructor') this.fail('reserved constructor member');
            if (isStatic && ['prototype', 'call', 'apply', 'bind'].indexOf(key) >= 0)
                this.fail('reserved static callable constructor identity');
            if (member.kind === S.PropertyDeclaration) {
                if (lexicalMember) {
                    if (!isStatic && member.initializer) initializers.push('this[' + lexicalMember.key + '] = ' + text(member.initializer) + ';');
                    return;
                }
                (isStatic ? staticTypes : instanceTypes).push(key + ': ' + type(member) + ';');
                if (isStatic) definitions.push(intrinsic + '.defineProperty(' + destination + ', ' + encoded
                    + ', {value: ' + (member.initializer ? text(member.initializer) : 'void 0') + ', writable:true, enumerable:true, configurable:false});');
                else if (member.initializer) initializers.push('this[' + encoded + '] = ' + text(member.initializer) + ';');
                return;
            }
            const receiver = isStatic ? constructorType : name;
            const functionValue = 'function(this: ' + receiver + (member.parameters.length ? ', ' : '') + params(member, false)
                + ')' + (member.type ? ': ' + text(member.type) : '') + ' {'
                + (this.lexical ? provider + '.as3CheckArgumentCount(arguments.length,' + member.parameters.length + ',' + member.parameters.length + ');' : '')
                + body(member, false) + '}';
            if (member.kind === S.MethodDeclaration) {
                if (!lexicalMember) (isStatic ? staticTypes : instanceTypes).push(key + '(' + params(member, true) + '): ' + type(member) + ';');
                definitions.push(intrinsic + '.defineProperty(' + destination + ', ' + encoded
                    + ', {value: ' + functionValue + ', writable:true, configurable:true, enumerable:false});');
                if (isStatic && !lexicalMember) staticMethods.push(key);
            } else if (member.kind === S.GetAccessor || member.kind === S.SetAccessor) {
                const identity = (isStatic ? 'static.' : '') + key;
                if (!accessorTypes.has(identity)) {
                    (isStatic ? staticTypes : instanceTypes).push(key + ': ' + (member.kind === S.GetAccessor ? type(member) : type(member.parameters[0])) + ';');
                    accessorTypes.add(identity);
                }
                definitions.push(intrinsic + '.defineProperty(' + destination + ', ' + encoded
                    + ', ' + intrinsic + '.assign({}, ' + intrinsic + '.getOwnPropertyDescriptor(' + destination + ', ' + encoded + '), {'
                    + (member.kind === S.GetAccessor ? 'get' : 'set') + ': ' + functionValue + ', configurable:true, enumerable:false}));');
            } else this.fail('unrecognized complete class member');
        });
        if (!ctor && this.own.base) this.fail('synthesized derived constructor needs source arity authority');
        const chainFields: {name: string; value: string}[] = [];
        for (let current = this.own; current; current = this.classes.get(current.base)) chainFields.push(...current.fields);
        const memberNames = new Set<string>(), instanceMethods: string[] = [];
        for (let current = this.own; current; current = this.classes.get(current.base)) {
            current.instanceMembers.forEach(member => {
                if (!memberNames.has(member.name)) {
                    memberNames.add(member.name);
                    if (member.method) instanceMethods.push(member.name);
                }
            });
        }
        const bindInstance = instanceMethods.map(key => bindName + '(this, ' + JSON.stringify(key) + ');').join('\n');
        const defaults = (this.metadata ? generation + '.enterInstance(this);\n' : '')
            + (this.lexical ? this.lexical.provider + '.initializeAS3LexicalInstance(' + this.lexical.scope + ',this);\n' : '') + chainFields.map(field => intrinsic + '.defineProperty(this, ' + JSON.stringify(field.name)
            + ', {value:' + field.value + ', writable:true, enumerable:true, configurable:false});').join('\n');
        const ancestry = cls.heritageClauses && cls.heritageClauses[0];
        const base = ancestry ? 'const ' + baseName + ' = ' + text(ancestry.types[0].expression) + ';\n' : '';
        const sourceBaseName = this.own.base && this.classes.get(this.own.base).name;
        const constructorBody = ctor ? body(ctor, true) : '';
        const tail = ctor && ctor.body.statements[ctor.body.statements.length - 1];
        const completion = !constructorReturns && tail && tail.kind === S.ThrowStatement ? '' : succeeded + ' = true;';
        const completedBody = constructorReturns ? constructorCompletion + ': {\n' + constructorBody + '\n}' : constructorBody;
        const required = this.own.parameters.filter(parameter => !parameter.optional).length;
        const arity = 'if (arguments.length < ' + required
            + (this.own.usesArguments ? '' : ' || arguments.length > ' + this.own.parameters.length)
            + ') {throw ' + intrinsic + '.arityError();}\n';
        const coercions = this.own.parameters.map((parameter, index) => {
            const value = parameter.name;
            const conversion = parameter.type === 'Number' ? numberCoercion + '(' + value + ')'
                : parameter.type === 'int' ? intCoercion + '(' + value + ')' : parameter.type === 'uint' ? uintCoercion + '(' + value + ')'
                : parameter.type === 'String' ? stringCoercion + '(' + value + ')'
                : this.metadata && parameter.type === this.own.qname
                    ? provider + '.as3CoerceReference(' + value + ',' + declaration + '.type)'
                : parameter.type === 'Boolean' ? '!!' + value : parameter.type === 'Object' ? '(' + value + ' === void 0 ? null : ' + value + ')' : value;
            const defaultValue = parameter.defaultLiteral !== undefined
                ? (parameter.type === 'Number' ? numberCoercion : parameter.type === 'int' ? intCoercion : uintCoercion)
                    + '(' + parameter.defaultLiteral + ')'
                : parameter.optional && text(ctor.parameters[index].initializer);
            return value + ' = ' + (parameter.optional ? 'arguments.length <= ' + index + ' ? ' + defaultValue + ' : ' : '') + conversion + ';\n'
                + 'if (arguments.length > ' + index + ') arguments[' + index + '] = ' + value + ';';
        }).join('\n');
        const replacement = (this.lexical ? this.lexical.traits.map(t=>'const ' + t.key + '=' + intrinsic + '.symbol();').join('\n')+'\n' : '') + base + superMethods.join('\n') + '\nconst ' + name + ': ' + constructorType + ' = function ' + name + '(this: ' + name
            + (ctor && ctor.parameters.length ? ', ' + params(ctor, true) : '') + ') {\n'
            + 'const ' + fresh + ' = ' + intrinsic + '.enter(this, ' + identity + ');\nlet ' + succeeded + ' = false;\ntry {\n'
            + arity + coercions
            + (this.own.usesArguments ? '\nlet ' + sourceArguments + ': any[] = '
                + intrinsic + '.apply(' + intrinsic + '.arraySlice, arguments, []);\n' : '') + '\nif (' + fresh + ') {\n' + defaults + '\n' + bindInstance + '\n}\n'
            + (this.metadata ? lowerNativeSourceOperations(initializers.join('\n'), provider, compilerHelpers, unique, this.lexical) : initializers.join('\n')) + '\n' + completedBody + '\n' + completion + '\n} finally { '
            + intrinsic + '.leave(this, ' + identity + ', ' + succeeded + '); }\n} as any;\n'
            + 'const ' + identity + ' = ' + name + ';\n'
            + (this.own.base ? intrinsic + '.setPrototypeOf(' + name + ', ' + baseName + ');\n'
                + name + '.prototype = ' + intrinsic + '.create(' + baseName + '.prototype);\n' : '')
            + intrinsic + '.defineProperty(' + name + '.prototype, "constructor", {value:' + name + ', writable:false, configurable:true});\n'
            + intrinsic + '.register(' + identity + ', ' + (this.own.base ? baseName : 'null') + ');\n'
            + definitions.join('\n') + '\n'
            + staticMethods.map(key => bindName + '(' + name + ', ' + JSON.stringify(key) + ');').join('\n')
            + (this.metadata ? '\n' + intrinsic + '.defineProperty(' + name + ', "prototype", {writable:false});\n'
                + provider + '.registerFlashTypeMetadata(' + name + ', ' + JSON.stringify(this.metadata.classes[this.own.qname].metadata) + ');\n'
                + provider + '.registerAS3Class(' + name + ', []);\n'
                + 'const ' + generation + ' = ' + declaration + '.publishGeneration(' + name + ');\n'
                + provider + '.registerAS3PropertyTraits(' + name + ', ' + this.emitPropertyTraits(this.metadata.classes[this.own.qname].instanceTraits, declaration, intrinsic)
                    + ', ' + this.emitPropertyTraits(this.metadata.classes[this.own.qname].staticTraits, declaration, intrinsic) + ');\n'
                + (this.lexical ? this.lexicalPublication(name, intrinsic) : '')
                + provider + '.registerAS3Constructor(' + name + ', {minimum:' + required + ', maximum:'
                    + (this.own.usesArguments ? 'Infinity' : this.own.parameters.length) + ', coerceArguments: (values:any) => values});\n' : '');
        const surface = 'export interface ' + name + (sourceBaseName ? ' extends ' + sourceBaseName : '')
            + ' {\n' + instanceTypes.join('\n') + '\n}\ninterface ' + constructorType
            + ' extends ' + functionType + ' {new(' + (ctor ? params(ctor, true) : '') + '): ' + name + '; prototype: ' + name + ';\n'
            + staticTypes.join('\n') + '\n}';
        const replacements = [{start: cls.getStart(file), end: cls.end, value: replacement},
            {start: alias.getStart(file), end: alias.end, value: surface}];
        if (this.metadata) {
            const statements = cls.parent.statements;
            if (!statements) this.fail('lazy native factory body required for publication');
            const index = statements.indexOf(cls);
            const finalize = statements[index + 1];
            if (!finalize || finalize.kind !== S.ExpressionStatement || finalize.expression.kind !== S.BinaryExpression
                || finalize.expression.right.kind !== S.CallExpression) this.fail('lazy final identity publication marker');
            for (let i = index + 2; i < statements.length; i++) {
                const statement = statements[i];
                if (statement.kind === S.ReturnStatement) break;
                replacements.push({start: statement.getStart(file), end: statement.end,
                    value: lowerNativeSourceOperations(text(statement), provider, compilerHelpers, unique, this.lexical)});
            }
        }
        replacements.sort((a,b) => b.start - a.start).forEach(edit => source = source.slice(0,edit.start) + edit.value + source.slice(edit.end));
        // Local declaration annotations have become token references. AS3 imports
        // do not execute Class initialization; erase only now-unused named source
        // declaration imports, so two qualified namesakes cannot leave duplicate
        // TypeScript bindings. Any surviving value/type identifier keeps its import.
        if (this.declarationDomain) {
            const output=ts.createSourceFile('DomainImports.ts',source,ts.ScriptTarget.Latest,true);
            if(output.parseDiagnostics.length)this.fail('domain import intermediate syntax');
            const used=new Set<string>(),imports:any[]=[];
            const collect=(node:any):void=>{
                if(node.kind===S.ImportDeclaration){imports.push(node);return;}
                if(node.kind===S.Identifier)used.add(node.text);
                ts.forEachChild(node,collect);
            };
            collect(output);
            const sourceNames=new Set(this.declarationDomain.bindings.map(binding=>binding.qname.split('.').pop()));
            const erased=imports.filter(node=>node.importClause&&!node.importClause.name
                &&node.importClause.namedBindings&&node.importClause.namedBindings.kind===S.NamedImports
                &&node.importClause.namedBindings.elements.length===1
                &&sourceNames.has(node.importClause.namedBindings.elements[0].name.text)
                &&!node.importClause.namedBindings.elements[0].propertyName
                &&node.moduleSpecifier.text.split('/').pop()===node.importClause.namedBindings.elements[0].name.text
                &&!used.has(node.importClause.namedBindings.elements[0].name.text));
            erased.sort((a,b)=>b.getStart(output)-a.getStart(output)).forEach(node=>{
                source=source.slice(0,node.getStart(output))+source.slice(node.end);
            });
        }
        const boundImport = file.statements.find((node: any) => node.kind === S.ImportDeclaration && /(?:^|\/)bound$/.test(node.moduleSpecifier.text));
        const helperPath = boundImport ? boundImport.moduleSpecifier.text : './bound';
        return (this.lexical ? 'import * as ' + this.lexical.provider + ' from ' + JSON.stringify(this.lexical.module) + ';\n' : '')
            + (this.lexical && this.lexical.typedLocals ? 'import * as ' + localCoercion + ' from ' + JSON.stringify(this.coercionModule) + ';\n'
                + 'import * as ' + localString + ' from ' + JSON.stringify(this.stringModule) + ';\n'
                + 'import * as ' + localAddition + ' from ' + JSON.stringify(this.localAdditionModule) + ';\n' : '')
            + (this.metadata ? 'import * as ' + provider + ' from ' + JSON.stringify(this.metadata.module) + ';\n'
            + (planned ? 'import * as ' + domainImport + ' from ' + JSON.stringify(this.declarationDomain.module) + ';\n'
                + 'const ' + declaration + ' = {type:' + domainImport + '.' + planned.tokenExport
                + ' as ' + provider + '.AS3DeclarationType<' + name + '>,publishGeneration:' + domainImport + '.' + planned.publishExport + '};\n'
                : 'const ' + declaration + ' = ' + provider + '.declareAS3ReferenceType<' + name + '>(' + JSON.stringify(this.metadata.classes[this.own.qname].metadata.name) + ');\n') : '')
            + 'import {callableClassIntrinsics as ' + intrinsic + ', NativeCallableFunction as ' + functionType + '} from '
            + JSON.stringify(helperPath.replace(/bound$/, 'callableClass')) + ';\n'
            + 'import {bindAS3Method as ' + bindName + '} from '
            + JSON.stringify(this.methodBindingModule) + ';\n'
            + (this.own.parameters.some(parameter => ['Number', 'int', 'uint'].indexOf(parameter.type) >= 0)
                ? 'import {as3CoerceNumber as ' + numberCoercion + ', as3CoerceInt as ' + intCoercion
                    + ', as3CoerceUint as ' + uintCoercion + '} from ' + JSON.stringify(this.coercionModule) + ';\n' : '')
            + (this.own.parameters.some(parameter => parameter.type === 'String')
                ? 'import {as3CoerceString as ' + stringCoercion + '} from ' + JSON.stringify(this.stringModule) + ';\n' : '')
            + source;
    }

    private lexicalPublication(name: string, intrinsic: string): string {
        const lexical = this.lexical;
        const specs = lexical.traits.map(t => '{name:' + JSON.stringify(t.name) + ',visibility:' + JSON.stringify(t.visibility)
            + ',static:' + t.static + ',kind:' + JSON.stringify(t.kind)
            + (t.kind === 'method' ? ',key:' + t.key + ',parameterCount:' + t.parameterCount
                : ',type:' + (t.type === 'Array' ? '{name:"Array",reference:' + intrinsic + '.array}' : JSON.stringify(t.type || '*'))) + '}');
        return 'const ' + lexical.scope + '=' + lexical.provider + '.registerAS3LexicalMembers(' + name + ',null,[' + specs.join(',') + ']);\n'
            + lexical.traits.map(t=>'const ' + t.access + '=' + lexical.provider + '.resolveAS3LexicalMember(' + lexical.scope + ','
                + JSON.stringify(t.name) + ',' + JSON.stringify(t.visibility) + ',' + t.static + ');').join('\n') + '\n';
    }

    /** Bind authenticated reference storage without resolving authored names at runtime. */
    private emitPropertyTraits(traits: any[], declaration: string, intrinsic: string): string {
        const name = this.metadata.classes[this.own.qname].metadata.name;
        return '[' + traits.map(trait => {
            const reference = trait.type === name ? declaration + '.type'
                : trait.type === 'Array' ? intrinsic + '.array' : null;
            if (!reference) return JSON.stringify(trait);
            const fields = Object.keys(trait).filter(key => key !== 'type')
                .map(key => JSON.stringify(key) + ':' + JSON.stringify(trait[key]));
            fields.push('"type":{name:' + JSON.stringify(trait.type) + ',reference:' + reference + '}');
            return '{' + fields.join(',') + '}';
        }).join(',') + ']';
    }
}
