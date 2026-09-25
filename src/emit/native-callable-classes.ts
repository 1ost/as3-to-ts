import {generatedMethodCompletes} from './native-generated-completions';
import {NativeLexicalMembers} from './native-lexical-members';
import {lowerNativeSourceOperations} from './native-source-operations';
import {validateNativeTypeOf} from './native-typeof';
import {NativeClassMetadataOptions, validateNativeClassMetadata} from './native-class-metadata';
import Node, {unwrapEncapsulatedExpression} from '../syntax/node';
import K from '../syntax/nodeKind';
import parse = require('../parse');
import {nativeSourceTypeIdentity} from './native-source-type';
import {NativeDeclarationDomain, nativeDeclarationDomainFor} from './native-declaration-plan';
import {NativeGeneratedEmission} from './native-generated-emission';

export interface NativeCallableClassOptions { [qname: string]: string; }
interface SourceClass {
    qname: string; name: string; base: string; fields: {name: string; value: string}[];
    parameters: {name: string; type: string; optional: boolean; defaultLiteral?: string; reference?: {identity:string; exported:string}}[]; usesArguments: boolean; rest?: string;
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
    constructor(source: string, options: NativeCallableClassOptions, lazy: {[qname: string]: string}, private methodBindingModule?: string, private coercionModule?: string, private metadata?: NativeClassMetadataOptions, private sourceHelpers?: Set<string>, private stringModule?: string, private lexical?: NativeLexicalMembers, private localAdditionModule?: string, private generated?: NativeGeneratedEmission, private localReferenceModule?: string, private classValueModule?:string, private sourceErrorModule?:string, private displayReference=false, private dateReference=false, private byteArrayReference=false, private movieClipReference=false, private textFormatReference=false, private interactiveReference=false) {
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
            const isClassAlias = (node:Node, name:string):boolean => {
                const local = this.capturedType(node,name);
                return local === undefined ? classAliases.has(name) : local === 'Class';
            };
            const callScan = (node: Node): void => {
                const receiver = node.children[0] && unwrapEncapsulatedExpression(node.children[0]);
                if (node.kind === K.DOT && receiver && isClassAlias(node,receiver.text)
                    && ['call', 'apply', 'bind', 'prototype'].indexOf(node.children[1].text) >= 0)
                    this.fail('direct callable-constructor invocation/prototype manipulation');
                if (node.kind === K.CALL && node.children[0] && isClassAlias(node,node.children[0].text)
                    && !Object.keys(options).some(key => key.split('.').pop() === node.children[0].text)
                    && !(generated&&classValueModule&&node.parent&&node.parent.kind===K.NEW&&this.isCapturedClass(node,node.children[0].text)))
                    this.fail('dynamic Class invocation requires exact constructor authority');
                node.children.forEach(callScan);
            };
            if (!metadata) callScan(cls);
            if (cls.findChild(K.IMPLEMENTS_LIST) && !generated) this.fail('interface construction identity requires separate authority');
            let base: string = null;
            const ext = cls.findChild(K.EXTENDS);
            if (ext) {
                if (ext.text.indexOf('.') >= 0) this.fail('qualified base syntax');
                const candidates: string[] = [];
                const local = (namespace ? namespace + '.' : '') + ext.text;
                if (Object.prototype.hasOwnProperty.call(options, local)) candidates.push(local);
                pkg.findChild(K.CONTENT).findChildren(K.IMPORT).forEach(imp => {
                    const candidate = imp.text.endsWith('.*') ? imp.text.slice(0, -1) + ext.text : imp.text;
                    if (candidate.split('.').pop() === ext.text && (Object.prototype.hasOwnProperty.call(options, candidate)
                        || generated && generated.options.plan.nativeBindings.some(binding=>binding.qname===candidate&&!!binding.nativeBaseExport))
                        && candidates.indexOf(candidate) < 0) candidates.push(candidate);
                });
                if (!candidates.length && ext.text === 'Error' && generated && generated.options.plan.nativeBindings.some(binding=>binding.qname==='Error'&&!!binding.nativeBaseExport)) candidates.push('Error');
                if (candidates.length !== 1) this.fail('mixed/unknown/ambiguous base chain: ' + qname + ' extends ' + ext.text);
                base = candidates[0];
            }
            const fields: {name: string; value: string}[] = [];
            const instanceMembers: {name: string; method: boolean}[] = [];
            cls.findChild(K.CONTENT).children.forEach(member => {
                const mods = member.findChild(K.MOD_LIST);
                const isStatic = mods && mods.children.some(mod => mod.text === 'static');
                const lexicalMember = classLexical && classLexical.proves(member)
                    || generated && (!mods || !mods.children.some(mod=>mod.text==='public'));
                if (!isStatic && !lexicalMember && [K.FUNCTION, K.GET, K.SET].indexOf(member.kind) >= 0) {
                    const memberName = member.findChild(K.NAME).text;
                    if (memberName !== name) instanceMembers.push({name: memberName, method: member.kind === K.FUNCTION});
                }
                if (member.kind !== K.VAR_LIST && member.kind !== K.CONST_LIST) return;
                if (member.kind === K.CONST_LIST && !isStatic && !generated) this.fail('instance const descriptors need separate authority');
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
            if(generated && generated.options.plan.nativeBindings.some(binding=>binding.qname===base&&!!binding.nativeBaseExport)) {
                let calls=0;
                const scan=(node:Node):void=>{if(node.kind===K.CALL&&node.children[0]&&node.children[0].text==='super')calls++;node.children.forEach(scan);};
                if(constructor)scan(constructor.findChild(K.BLOCK));
                if(calls!==1)this.fail('native base requires one explicit source base call');
            }
            const parameters: {name: string; type: string; optional: boolean; defaultLiteral?: string; reference?: {identity:string; exported:string}}[] = [];
            let usesArguments = false, rest: string;
            if (constructor) {
                constructor.findChild(K.PARAMETER_LIST).children.forEach((parameter,index,list) => {
                    const spread=parameter.findChild(K.REST);
                    if(spread){
                        if(!generated||!generated.lexical.typedLocals||index!==list.length-1||rest)this.fail('rest constructor argument authority');
                        rest=spread.text;return;
                    }
                    const value = parameter.findChild(K.NAME_TYPE_INIT), type = value.findChild(K.TYPE);
                    if(value.findChild(K.VECTOR))this.fail('vector constructor parameter coercion requires authority');
                    const sourceReference=generated&&type&&generated.options.plan.references.find(ref=>ref.owner===qname&&ref.start===type.start&&ref.end===type.end);
                    const sourceDeclaration=sourceReference&&(sourceReference.kind==='declaration'
                        ?generated.options.plan.bindings.find(binding=>binding.qname===sourceReference.identity)
                        :sourceReference.kind==='interface'&&generated.options.plan.interfaces.find(binding=>binding.qname===sourceReference.identity));
                    const reference=sourceDeclaration?{identity:sourceDeclaration.qname,exported:sourceDeclaration.tokenExport}:undefined;
                    const sourceType = reference ? reference.identity : nativeSourceTypeIdentity(type, qname, imports);
                    const selfReference = !!metadata && sourceType === qname;
                    if (!selfReference && !reference && !(generated&&['Function','Array'].indexOf(sourceType)>=0) && ['Number', 'int', 'uint', 'Boolean', 'Object', '*', 'String'].indexOf(sourceType) < 0)
                        this.fail('constructor parameter coercion needs common provider authority: ' + (type && type.text || '*') + ' (' + sourceType + ')');
                    if (sourceType === 'String' && (typeof stringModule !== 'string' || !stringModule.trim()
                        || /[\r\n\u0000]/.test(stringModule)))
                        this.fail('String constructor parameters require the common AS3String provider module');
                    if (['Number', 'int', 'uint'].indexOf(sourceType) >= 0
                        && (typeof coercionModule !== 'string' || !coercionModule.trim()
                            || /[\r\n\u0000]/.test(coercionModule)))
                        this.fail('numeric constructor parameters require the common AS3Coercion module');
                    const init = value.findChild(K.INIT);
                    if(generated&&['Function','Array'].indexOf(sourceType)>=0&&init&&!(init.children[0].kind===K.IDENTIFIER&&init.children[0].text==='null'))
                        this.fail(sourceType+' constructor default requires literal null');
                    if(reference&&init&&!(init.children[0].kind===K.IDENTIFIER&&init.children[0].text==='null'))
                        this.fail('source reference constructor default requires literal null');
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
                    parameters.push({name:value.findChild(K.NAME).text, type:sourceType, optional:!!init, defaultLiteral, reference});
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
                if(rest&&usesArguments)this.fail('combined rest/arguments constructor scope requires qualification');
            }
            const value = {qname, name, base, fields, parameters, usesArguments, rest, instanceMembers}; this.classes.set(qname, value); roots.set(qname, cls); this.sourceRoots.set(qname, cls);
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

    /** Find the source slot, stopping at each function or catch shadow. */
    private isCapturedClass(node: Node, name: string): boolean {
        return this.capturedType(node,name)==='Class';
    }
    /** Undefined means absent; an untyped local still shadows aliases elsewhere. */
    private capturedType(node: Node, name: string): string | undefined {
        for(let scope=node.parent;scope;scope=scope.parent){
            if(scope.kind===K.CATCH&&scope.findChild(K.NAME).text===name)return scope.findChild(K.TYPE)?scope.findChild(K.TYPE).text:'*';
            if(scope.kind!==K.FUNCTION&&scope.kind!==K.LAMBDA)continue;
            const declarations:Node[]=[];
            scope.findChild(K.PARAMETER_LIST).children.forEach(p=>{const d=p.findChild(K.NAME_TYPE_INIT);if(d)declarations.push(d);});
            const collect=(value:Node):void=>{
                if(value.kind===K.FUNCTION||value.kind===K.LAMBDA)return;
                if([K.VAR_LIST,K.CONST_LIST,K.VAR,K.CONST].indexOf(value.kind)>=0)declarations.push(...value.findChildren(K.NAME_TYPE_INIT));
                value.children.forEach(collect);
            };collect(scope.findChild(K.BLOCK));
            const binding=declarations.find(d=>d.findChild(K.NAME).text===name);
            if(binding)return binding.findChild(K.TYPE)?binding.findChild(K.TYPE).text:'*';
        }
        return undefined;
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
        const argumentCountError = this.generated && this.sourceErrorModule ? unique('argumentCountError') : '';
        const arityFailure = argumentCountError ? argumentCountError + '()' : intrinsic + '.arityError()';
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
                if(this.generated) {
                    const ref=type&&this.generated.options.plan.references.find(r=>r.owner===owner.qname&&r.start===type.start&&r.end===type.end);
                    if(!ref||ref.kind!=='intrinsic'||['*','int','uint','Number','Boolean','String','Object'].indexOf(ref.identity)<0
                        ||declaration.findChild(K.INIT))this.fail('generated super signature requires fixed qualified scalar parameters');
                    minimum++;return;
                }
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
            return '((...' + args + ': any[]): any => {'
                + (this.generated?'':parameters.slice(0, supplied).map((_,index) => args + '[' + index + '] = !!' + args + '[' + index + '];').join(''))
                + 'return ' + intrinsic + '.apply(' + capture + ', this, ' + args + ');})';
        };
        const provider = unique('provider'), declaration = unique('declaration'), generation = unique('generation');
        const localCoercion = unique('localCoercion'), localString = unique('localString'), localAddition = unique('localAddition');
        const generatedProperty = unique('generatedProperty'), localReference = unique('localReference'), classValue=unique('classValue');
        const typedLocals = this.generated ? this.generated.lexical.typedLocals : this.lexical && this.lexical.typedLocals;
        const planned = this.declarationDomain && this.declarationDomain.bindings.find(binding => binding.qname === this.own.qname);
        if (this.declarationDomain && !planned) this.fail('current source declaration is absent from its compiler domain');
        const domainImport = planned || this.generated ? unique('declarationDomain') : '';
        const nativeBase=this.generated&&this.generated.nativeBase;
        const nativeBaseClass=nativeBase&&domainImport+'.'+nativeBase.referenceExport;
        const directNativeBase=nativeBase&&this.own.base===nativeBase.qname;
        const referenceToken = planned || this.generated ? (qname:string):string => {
            const binding=this.declarationDomain&&this.declarationDomain.bindings.find(value=>value.qname===qname)
                ||this.generated&&[...this.generated.options.plan.interfaces,...this.generated.options.plan.bindings].find(value=>value.qname===qname);
            const native=this.generated&&this.generated.options.plan.nativeBindings.find(value=>value.qname===qname);
            if(!binding&&!native)this.fail('foreign local declaration is absent from its compiler domain');
            return domainImport+'.'+(binding?binding.tokenExport:native.referenceExport);
        } : undefined;
        const text = (node: any): string => node.getText(file);
        const params = (member: any, signature: boolean): string => member.parameters.filter((p:any)=>signature||!this.generated||!p.dotDotDotToken).map((p: any) => {
            if (!signature) return this.generated?text(p.name)+': '+(p.type?text(p.type):'any'):text(p);
            return (p.dotDotDotToken ? '...' : '') + text(p.name) + (p.questionToken || p.initializer ? '?' : '')
                + ': ' + (p.type ? text(p.type) : 'any');
        }).join(', ');
        const type = (node: any): string => node.type ? text(node.type) : 'any';
        const instanceTypes: string[] = [], staticTypes: string[] = [], definitions: string[] = [], initializers: string[] = [];
        const staticMethods: string[] = [];
        let ctor: any, constructorReturns = 0;
        const body = (member: any, constructor: boolean, returnType?: string): string => {
            if (!member.body) this.fail('bodyless member');
            const returnPrefix = '<any>'+(returnType==='"Class"'?classValue+'.as3CoerceClass(':generatedProperty+'.coerceAS3PropertyValue(');
            const returnSuffix = returnType==='"Class"'?')':','+returnType+')';
            const edits: {start: number; end: number; value: string}[] = [];
            let superCount = 0;
            const deferred=new Map<any,{label:string;value:string;pending:string}>();
            const resetCatches=new Set<string>();
            const deferredReturn=(node:any):{label:string;value:string;pending:string}|undefined=>{
                let outer:any,child=node;
                for(let scope=node.parent;scope&&scope!==member.body;child=scope,scope=scope.parent){
                    if(scope.kind!==S.TryStatement||!scope.finallyBlock||child===scope.finallyBlock)continue;
                    const blockText=text(scope.finallyBlock);
                    if(this.generated.lexical.finallyMarkers.some(m=>blockText.indexOf('{/*'+m.name+'*/')===0))outer=scope;
                }
                if(!outer)return undefined;
                let entry=deferred.get(outer);
                if(!entry){
                    const id=deferred.size;entry={label:unique('returnRegion'+id),value:unique('returnValue'+id),pending:unique('returnPending'+id)};deferred.set(outer,entry);
                    edits.push({start:outer.getStart(file),end:outer.getStart(file),value:'{let '+entry.value+':any;let '+entry.pending+'=false;'+entry.label+':'});
                    edits.push({start:outer.end,end:outer.end,value:';if('+entry.pending+')return '+returnPrefix+entry.value+returnSuffix+';}'});
                }
                // A finalizer may throw and an enclosing catch may resume normally.
                // Such a catch cancels this pending return. Catches inside the
                // finalizer itself do not enclose the return and must not clear it.
                child=node;
                for(let scope=node.parent;scope&&scope!==member.body;child=scope,scope=scope.parent){
                    if(scope.kind===S.TryStatement&&scope.catchClause&&child===scope.tryBlock){
                        const block=scope.catchClause.block,key=entry.pending+':'+block.pos;
                        if(!resetCatches.has(key)){
                            resetCatches.add(key);
                            edits.push({start:block.getStart(file)+1,end:block.getStart(file)+1,value:entry.pending+'=false;'});
                        }
                    }
                    if(scope===outer)break;
                }
                return entry;
            };
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
                if (node.kind === S.ReturnStatement && returnType && !nestedFunction) {
                    if (!node.expression) this.fail('generated typed bare return');
                    const delayed=deferredReturn(node);
                    if(delayed){
                        edits.push({start:node.getStart(file),end:node.expression.getStart(file),value:'{'+delayed.value+'='});
                        edits.push({start:node.expression.end,end:node.end,value:';'+delayed.pending+'=true;break '+delayed.label+';}'});
                        ts.forEachChild(node,(child:any)=>walk(child,insideSuperArguments,nestedFunction));return;
                    }
                    // Insert around the original return expression. Walk its children
                    // normally, retaining nested compiler-helper return ownership.
                    edits.push({start:node.expression.getStart(file),end:node.expression.getStart(file),value:returnPrefix});
                    edits.push({start:node.expression.end,end:node.expression.end,value:returnSuffix});
                }
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
                            + (directNativeBase ? intrinsic+'.callNativeBase(this,'+identity+','+baseName+','+superArguments+'); }'
                                : intrinsic + '.expectBase(this, ' + identity + ', ' + baseName + '); '
                                    + intrinsic + '.apply(' + baseName + ', this, ' + superArguments + '); }')});
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
            if (typedLocals) result = typedLocals.lower(result, constructor ? this.own.name : member.name.text,
                !!member.modifiers && member.modifiers.some((mod: any) => mod.kind === S.StaticKeyword), this.generated ? localReference : provider, localCoercion, localString, localAddition, intrinsic + '.array', unique, referenceToken,
                member.kind===S.GetAccessor?K.GET:member.kind===S.SetAccessor?K.SET:K.FUNCTION,this.classValueModule?classValue:undefined,
                this.generated?(identity,value)=>{
                    const vector=this.generated.options.plan.vectors.find(v=>v.identity===identity);
                    if(!vector)this.fail('unplanned Vector local identity');
                    return generatedProperty+'.coerceAS3PropertyValue('+value+',{name:'+JSON.stringify(vector.name)+',vector:'+domainImport+'.'+vector.specExport+'})';
                }:undefined,this.generated?generatedProperty:undefined);
            return result;
        };
        const accessorTypes = new Set<string>();
        cls.members.forEach((member: any) => {
            const isStatic = member.modifiers && member.modifiers.some((mod: any) => mod.kind === S.StaticKeyword);
            const destination = isStatic ? name : name + '.prototype';
            if (member.kind === S.Constructor) { ctor = member; return; }
            if (!member.name || member.name.kind !== S.Identifier) this.fail('computed member identity');
            const key = member.name.text, lexicalMember = this.lexical && this.lexical.trait(key, !!isStatic)
                || this.generated && this.generated.lexical.trait(key,!!isStatic);
            const encoded = lexicalMember ? lexicalMember.key : JSON.stringify(key);
            if (key === 'constructor') this.fail('reserved constructor member');
            if (isStatic && ['prototype', 'call', 'apply', 'bind'].indexOf(key) >= 0)
                this.fail('reserved static callable constructor identity');
            if (member.kind === S.PropertyDeclaration) {
                if (lexicalMember) {
                    if (lexicalMember.kind === 'constant') return; // Installed before authored effects by the lexical registrar.
                    if (!isStatic && member.initializer && !(this.generated&&this.generated.lexical.earlyInstanceValue(lexicalMember as any)!==undefined)) initializers.push(this.generated
                        ? this.generated.lexical.provider + '.as3SetLexicalMember(this,' + lexicalMember.access + ',' + text(member.initializer) + ');'
                        : 'this[' + lexicalMember.key + '] = ' + text(member.initializer) + ';');
                    return;
                }
                const constant = this.generated && this.generated.projection[isStatic?'staticTraits':'instanceTraits'].find(t => t.name === key && t.kind === 'constant');
                (isStatic ? staticTypes : instanceTypes).push((constant ? 'readonly ' : '') + key + ': ' + type(member) + ';');
                if (constant && !isStatic) return; // Literal storage is installed before all source effects.
                if (constant) {
                    if (!member.initializer) this.fail('generated static constant literal missing');
                    const deferred=this.generated.deferredConstants[key];
                    const constantType=constant.type==='Array'?'{name:"Array",reference:'+intrinsic+'.array}'
                        : typeof constant.type==='string'?JSON.stringify(constant.type)
                        : '{name:'+JSON.stringify(constant.type.name)+',reference:'+domainImport+'.'+constant.type.referenceExport+'}';
                    const uintOr=this.generated.uintOrInitializers.constants[key];
                    definitions.push(deferred ? 'const '+deferred+'='+provider+'.declareAS3GeneratedStaticConstant('+destination+','+encoded+','+constantType+');'
                        : provider + '.defineAS3GeneratedStaticConstant(' + destination + ',' + encoded + ','
                            + constantType + ',' + (uintOr===undefined?text(member.initializer):uintOr) + ');');
                }
                if (isStatic && !this.generated) definitions.push(intrinsic + '.defineProperty(' + destination + ', ' + encoded
                    + ', {value: ' + (member.initializer ? text(member.initializer) : 'void 0') + ', writable:true, enumerable:true, configurable:false});');
                else if (!isStatic && member.initializer) initializers.push('this[' + encoded + '] = ' + text(member.initializer) + ';');
                return;
            }
            const receiver = isStatic ? constructorType : name;
            let signature = '', returnType: string;
            if (this.generated && [S.MethodDeclaration,S.GetAccessor,S.SetAccessor].indexOf(member.kind)>=0) {
                const sourceKind=member.kind===S.GetAccessor?K.GET:member.kind===S.SetAccessor?K.SET:K.FUNCTION;
                const sourceMethod = this.generated.lexical.ownClass.findChild(K.CONTENT).children.find(node => {
                    const mods=node.findChild(K.MOD_LIST),sourceStatic=!!mods&&mods.children.some(mod=>mod.text==='static');
                    return node.kind === sourceKind && node.findChild(K.NAME).text === key && sourceStatic === !!isStatic;
                });
                const parameters = sourceMethod.findChild(K.PARAMETER_LIST).children;
                const fixed=parameters.filter(p=>!p.findChild(K.REST)),spread=parameters.find(p=>!!p.findChild(K.REST));
                if(sourceKind!==K.FUNCTION&&(spread||fixed.length!==(sourceKind===K.GET?0:1)||fixed.some(p=>!!p.findChild(K.NAME_TYPE_INIT).findChild(K.INIT))))
                    this.fail('generated accessor requires exact fixed signature');
                if(spread&&parameters[parameters.length-1]!==spread)this.fail('rest method must be last');
                if(spread&&!typedLocals)this.fail('rest method requires typed local storage');
                const minimum=fixed.filter(p=>!p.findChild(K.NAME_TYPE_INIT).findChild(K.INIT)).length;
                signature = 'if(arguments.length < ' + minimum + (spread?'':' || arguments.length > '+fixed.length) + ')throw ' + arityFailure + ';\n'
                    + fixed.map((p,index) => {
                        const value=p.findChild(K.NAME_TYPE_INIT),name=value.findChild(K.NAME).text,type=value.findChild(K.VECTOR)||value.findChild(K.TYPE),init=value.findChild(K.INIT);
                        if(type&&type.kind===K.VECTOR&&init)this.fail('optional Vector parameter requires qualification');
                        if(!init&&index>=minimum)this.fail('required parameter after optional');
                        let fallback='';
                        if(init){
                            const raw=this.sourceTexts.get(this.own.qname).slice(init.start,init.end).trim(),identity=type&&type.text||'*';
                            const numeric=/^[+-]?(?:0[xX][0-9a-fA-F]+|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)$/.test(raw)&&isFinite(Number(raw));
                            if(['int','uint'].indexOf(identity)>=0&&(!numeric||/^[+-]?0[0-9]/.test(raw)||Math.floor(Number(raw))!==Number(raw)
                                ||Number(raw)<(identity==='int'?-2147483648:0)||Number(raw)>(identity==='int'?2147483647:4294967295)))
                                this.fail('generated optional integer default requires in-range literal');
                            if(!(identity==='*'&&(raw==='null'||raw==='undefined'||raw==='true'||raw==='false'||numeric||/^("(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*')$/.test(raw))
                                ||identity==='Boolean'&&/^(true|false)$/.test(raw)
                                ||['Number','int','uint'].indexOf(identity)>=0&&numeric
                                ||identity==='String'&&(raw==='null'||/^("(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*')$/.test(raw))
                                ||raw==='null'&&['Number','int','uint','Boolean','*'].indexOf(identity)<0))
                                this.fail('generated optional parameter requires qualified literal default');
                            fallback='arguments.length <= '+index+' ? '+text(member.parameters[index].initializer)+' : ';
                        }
                        if(type&&type.text==='Class'){if(!this.classValueModule)this.fail('Class parameter requires common class provider');return name+'='+fallback+'<any>'+classValue+'.as3CoerceClass('+name+');';}
                        return name+'='+fallback+'<any>'+generatedProperty+'.coerceAS3PropertyValue('+name+','+this.generated.lexical.typeExpression(type,this.own.qname,domainImport,intrinsic+'.array')+');';
                    }).join('\n')+(spread?'\nvar '+spread.findChild(K.REST).text+': any = '+intrinsic+'.apply('+intrinsic+'.arraySlice,arguments,['+fixed.length+']);\n':'');
                const returns=sourceMethod.findChild(K.VECTOR)||sourceMethod.findChild(K.TYPE);
                if(returns && returns.text !== 'void' && returns.text !== '*') {
                    const reference=this.generated.options.plan.references.find(ref=>ref.owner===this.own.qname&&ref.start===returns.start&&ref.end===returns.end);
                    if(reference&&reference.kind==='native'&&reference.identity!=='flash.utils.Dictionary'&&reference.identity!=='flash.net.SharedObject'
                        &&!(this.byteArrayReference&&reference.identity==='flash.utils.ByteArray')
                        &&!(this.movieClipReference&&reference.identity==='flash.display.MovieClip')
                        &&!(this.textFormatReference&&reference.identity==='flash.text.TextFormat')
                        &&!(this.interactiveReference&&reference.identity==='flash.display.InteractiveObject')
                        &&!this.generated.options.plan.nativeBindings.some(binding=>binding.qname===reference.identity&&binding.nativeInterface)
                        &&!(reference.identity==='flash.media.ID3Info'&&this.generated.options.plan.nativeBindings.some(binding=>binding.qname===reference.identity))
                        &&!(this.dateReference&&reference.identity==='Date')&&!(this.displayReference&&reference.identity==='flash.display.DisplayObject')&&!(reference.identity==='flash.events.Event'
                        &&this.generated.options.plan.nativeBindings.some(binding=>binding.qname===reference.identity&&!!binding.nativeBaseExport)))
                        this.fail('generated native return type requires separate qualification');
                    const sourceBody=sourceMethod.findChild(K.BLOCK);
                    const inspect=(node:Node,inFinally=false):void=>{
                        if(node.kind===K.FUNCTION||node.kind===K.LAMBDA)return;
                        inFinally=inFinally||node.kind===K.FINALLY;
                        if(inFinally&&(node.kind===K.BREAK||node.kind===K.CONTINUE))
                            this.fail('generated typed finalizer jumps require separate qualification');
                        if(node.kind===K.RETURN && !node.children.length)
                            this.fail('generated typed bare return');
                        node.children.forEach(child=>inspect(child,inFinally));
                    };
                    inspect(sourceBody);
                    if(!generatedMethodCompletes(sourceBody))
                        this.fail('generated typed fallthrough completion requires separate qualification');
                    if(returns.text==='Class') {
                        if(!this.classValueModule)this.fail('Class return requires common class provider');
                        returnType='"Class"';
                    } else returnType=this.generated.lexical.typeExpression(returns,this.own.qname,domainImport,intrinsic+'.array');
                }
            }
            const functionValue = 'function(this: ' + receiver + (member.parameters.length ? ', ' : '') + params(member, false)
                + ')' + (member.type ? ': ' + text(member.type) : '') + ' {'
                + (this.lexical ? provider + '.as3CheckArgumentCount(arguments.length,' + member.parameters.length + ',' + member.parameters.length + ');' : '')
                + signature + body(member, false, returnType) + '}';
            if (member.kind === S.MethodDeclaration) {
                if (!lexicalMember) (isStatic ? staticTypes : instanceTypes).push(key + '(' + params(member, true) + '): ' + type(member) + ';');
                definitions.push(intrinsic + '.defineProperty(' + destination + ', ' + encoded
                    + ', {value: ' + functionValue + ', writable:true, configurable:true, enumerable:false});');
                if (isStatic && !lexicalMember) staticMethods.push(key);
            } else if (member.kind === S.GetAccessor || member.kind === S.SetAccessor) {
                const identity = (isStatic ? 'static.' : '') + key;
                if (!lexicalMember && !accessorTypes.has(identity)) {
                    (isStatic ? staticTypes : instanceTypes).push(key + ': ' + (member.kind === S.GetAccessor ? type(member) : type(member.parameters[0])) + ';');
                    accessorTypes.add(identity);
                }
                definitions.push(intrinsic + '.defineProperty(' + destination + ', ' + encoded
                    + ', ' + intrinsic + '.assign({}, ' + intrinsic + '.getOwnPropertyDescriptor(' + destination + ', ' + encoded + '), {'
                    + (member.kind === S.GetAccessor ? 'get' : 'set') + ': ' + functionValue + ', configurable:true, enumerable:false}));');
            } else this.fail('unrecognized complete class member');
        });
        if (!ctor && this.own.base) {
            const parent=this.classes.get(this.own.base),root=this.sourceRoots.get(this.own.base);
            if(!this.generated||!parent||parent.base||!root||root.findChild(K.CONTENT).children.some(member=>
                member.kind===K.FUNCTION&&member.findChild(K.NAME).text===parent.name))
                this.fail('synthesized derived constructor requires source root with implicit constructor');
        }
        const chainFields: {name: string; value: string}[] = [];
        for (let current = this.own; current; current = this.classes.get(current.base)) chainFields.push(...current.fields);
        const memberNames = new Set<string>(), instanceMethods: string[] = [];
        for (let current = this.own; current; current = this.classes.get(current.base)) {
            current.instanceMembers.forEach(member => {
                if(this.generated && !this.generated.projection.instanceTraits.some(t=>t.name===member.name&&t.kind==='method'))return;
                if (!memberNames.has(member.name)) {
                    memberNames.add(member.name);
                    if (member.method) instanceMethods.push(member.name);
                }
            });
        }
        const bindInstance = instanceMethods.filter(key=>!nativeBase||(nativeBase.qname==='Error'?['getStackTrace']:nativeBase.qname==='flash.events.EventDispatcher'?['addEventListener','removeEventListener','dispatchEvent','hasEventListener','willTrigger','toString']:['clone','toString','formatToString','stopImmediatePropagation','preventDefault','isDefaultPrevented','stopPropagation']).indexOf(key)<0)
            .map(key => bindName + '(this, ' + JSON.stringify(key) + ');').join('\n');
        const defaults = (this.metadata || this.generated ? generation + '.enterInstance(this);\n' : '')
            + (nativeBase ? intrinsic+'.prepareNativeBase(this,'+nativeBaseClass+');\n' : '')
            + (this.generated ? this.generated.lexical.provider+'.initializeAS3LexicalInstance('+this.generated.lexical.scope+',this);\n' : '')
            + (this.lexical ? this.lexical.provider + '.initializeAS3LexicalInstance(' + this.lexical.scope + ',this);\n' : '')
            + (this.generated ? [] : chainFields).map(field => intrinsic + '.defineProperty(this, ' + JSON.stringify(field.name)
            + ', {value:' + field.value + ', writable:true, enumerable:true, configurable:false});').join('\n');
        const ancestry = cls.heritageClauses && cls.heritageClauses.find((clause:any)=>clause.token===S.ExtendsKeyword);
        const base = ancestry ? 'const ' + baseName + ' = ' + intrinsic + '.constructorIdentity(' + (directNativeBase ? nativeBaseClass : text(ancestry.types[0].expression)) + ');\n' : '';
        const sourceBaseName = this.own.base && (directNativeBase ? nativeBaseClass : this.classes.get(this.own.base).name);
        const constructorBody = ctor ? body(ctor, true) : this.own.base
            ? intrinsic+'.expectBase(this,'+identity+','+baseName+');'+intrinsic+'.apply('+baseName+',this,[]);' : '';
        const tail = ctor && ctor.body.statements[ctor.body.statements.length - 1];
        const completion = !constructorReturns && tail && tail.kind === S.ThrowStatement ? '' : succeeded + ' = true;';
        const completedBody = constructorReturns ? constructorCompletion + ': {\n' + constructorBody + '\n}' : constructorBody;
        const required = this.own.parameters.filter(parameter => !parameter.optional).length;
        const arity = 'if (arguments.length < ' + required
            + (this.own.usesArguments || this.own.rest ? '' : ' || arguments.length > ' + this.own.parameters.length)
            + ') {throw ' + arityFailure + ';}\n';
        const coercions = this.own.parameters.map((parameter, index) => {
            const value = parameter.name;
            const conversion = parameter.reference
                ? '<any>'+generatedProperty+'.coerceAS3PropertyValue('+value+',{name:'+JSON.stringify(parameter.reference.identity.replace(/\.([^.]*)$/,'::$1'))+',reference:'+domainImport+'.'+parameter.reference.exported+'})'
                : this.generated && parameter.type==='Array' ? '<any>'+generatedProperty+'.coerceAS3PropertyValue('+value+',{name:"Array",reference:'+intrinsic+'.array})'
                : this.generated && parameter.type==='Function' ? '<any>'+generatedProperty+'.coerceAS3PropertyValue('+value+',"Function")'
                : parameter.type === 'Number' ? numberCoercion + '(' + value + ')'
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
        const constructorParameters = '(this: ' + name
            + (ctor && this.own.parameters.length ? ', ' + (this.generated?params(ctor,false):params(ctor,true)) : '') + ')';
        const replacement = (this.lexical ? this.lexical.traits.map(t=>'const ' + t.key + '=' + intrinsic + '.symbol();').join('\n')+'\n' : '')
            + (this.generated ? this.generated.lexical.own.filter(t=>t.kind==='method'||t.kind==='accessor').map(t=>'const '+t.key+'='+intrinsic+'.symbol();').join('\n')+'\n' : '') + base + superMethods.join('\n') + '\nconst ' + name + ': ' + constructorType + ' = function ' + name + constructorParameters + ' {\n'
            + (nativeBase ? 'return '+intrinsic+'.invokeNativeConstructor(this,'+identity+',arguments,function'+constructorParameters+' {\n' : '')
            + 'const ' + fresh + ' = ' + intrinsic + '.enter(this, ' + identity + ');\nlet ' + succeeded + ' = false;\ntry {\n'
            + arity + coercions
            + (this.own.rest ? '\nvar '+this.own.rest+': any = '+intrinsic+'.apply('+intrinsic+'.arraySlice,arguments,['+this.own.parameters.length+']);\n' : '')
            + (this.own.usesArguments ? '\nlet ' + sourceArguments + ': any[] = '
                + intrinsic + '.apply(' + intrinsic + '.arraySlice, arguments, []);\n' : '') + '\nif (' + fresh + ') {\n' + defaults + '\n' + bindInstance + '\n}\n'
            + (this.metadata ? lowerNativeSourceOperations(initializers.join('\n'), provider, compilerHelpers, unique, this.lexical) : initializers.join('\n')) + '\n' + completedBody + '\n' + completion + '\n} finally { '
            + intrinsic + '.leave(this, ' + identity + ', ' + succeeded + '); }\n'
            + (nativeBase ? '});\n' : '') + '} as any;\n'
            + 'const ' + identity + ' = ' + intrinsic + '.constructorIdentity(' + name + ');\n'
            + (this.own.base ? intrinsic + '.setPrototypeOf(' + name + ', ' + baseName + ');\n'
                + name + '.prototype = ' + intrinsic + '.create(' + baseName + '.prototype);\n' : '')
            + intrinsic + '.defineProperty(' + name + '.prototype, "constructor", {value:' + name + ', writable:false, configurable:true});\n'
            + (nativeBase ? intrinsic+'.registerNativeBase('+nativeBaseClass+','+domainImport+'.'+nativeBase.nativeBaseExport+');\n' : '')
            + intrinsic + '.register(' + identity + ', ' + (this.own.base ? baseName : 'null') + ');\n'
            + definitions.join('\n') + '\n'
            + staticMethods.map(key => bindName + '(' + name + ', ' + JSON.stringify(key) + ');').join('\n')
            + (this.metadata ? '\n' + intrinsic + '.defineProperty(' + name + ', "prototype", {writable:false});\n'
                + provider + '.registerFlashTypeMetadata(' + identity + ', ' + JSON.stringify(this.metadata.classes[this.own.qname].metadata) + ');\n'
                + provider + '.registerAS3Class(' + identity + ', []);\n'
                + 'const ' + generation + ' = ' + declaration + '.publishGeneration(' + identity + ');\n'
                + provider + '.registerAS3PropertyTraits(' + identity + ', ' + this.emitPropertyTraits(this.metadata.classes[this.own.qname].instanceTraits, declaration, intrinsic)
                    + ', ' + this.emitPropertyTraits(this.metadata.classes[this.own.qname].staticTraits, declaration, intrinsic) + ');\n'
                + (this.lexical ? this.lexicalPublication(identity, intrinsic) : '')
                + provider + '.registerAS3Constructor(' + identity + ', {minimum:' + required + ', maximum:'
                    + (this.own.usesArguments ? 'Infinity' : this.own.parameters.length) + ', coerceArguments: (values:any) => values});\n' : '')
            + (this.generated ? '\n' + intrinsic + '.defineProperty(' + name + ', "prototype", {writable:false});\n'
                + 'const ' + generation + ' = ' + provider + '.registerAS3GeneratedClass(' + identity + ','
                + this.generated.projection.emitDefinition(domainImport,intrinsic + '.array',baseName) + ');\n'
                + this.generated.lexical.publication(identity,baseName,domainImport,intrinsic) + '\n'
                + Object.keys(this.generated.uintOrInitializers.variables).map(key=>generatedProperty+'.as3SetProperty('+name+','+JSON.stringify(key)+','+this.generated.uintOrInitializers.variables[key]+');\n').join('')
                + (this.classValueModule ? classValue+'.registerAS3Constructor('+identity+', {minimum:'+required+',maximum:'+(this.own.usesArguments||this.own.rest?'Infinity':this.own.parameters.length)+',coerceArguments:(values:any)=>values});\n' : '')
                : '');
        const surface = 'export interface ' + name + (sourceBaseName ? ' extends ' + sourceBaseName : '')
            + ' {\n' + instanceTypes.join('\n') + '\n}\ninterface ' + constructorType
            + ' extends ' + functionType + ' {new(' + (ctor ? params(ctor, true) : '') + '): ' + name + '; prototype: ' + name + ';\n'
            + staticTypes.join('\n') + '\n}';
        const replacements = [{start: cls.getStart(file), end: cls.end, value: replacement},
            {start: alias.getStart(file), end: alias.end, value: surface}];
        if (this.generated && this.generated.projection.binding.scriptGlobalExport) {
            // The defining global must exist throughout Class creation, including
            // registration and callbacks. Publish the Class only after the whole
            // lazy factory succeeds; the selected common provider owns failed
            // unit lifetime (retained for explicit single-Class script units).
            const body = cls.parent;
            if (body.kind !== S.Block || body.parent.kind !== S.ArrowFunction
                || !body.statements.length || body.statements[body.statements.length - 1].kind !== S.ReturnStatement)
                this.fail('lazy script factory body required for publication');
            replacements.push({start: body.getStart(file) + 1, end: body.getStart(file) + 1,
                value: '\nreturn ' + domainImport + '.' + this.generated.projection.binding.scriptGlobalExport
                    + '((' + this.generated.lexical.scriptGlobal + ':object)=>{\n'});
            replacements.push({start: body.end - 1, end: body.end - 1, value: '\n});\n'});
        }
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
        if (this.declarationDomain || this.generated) {
            const output=ts.createSourceFile('DomainImports.ts',source,ts.ScriptTarget.Latest,true);
            if(output.parseDiagnostics.length)this.fail('domain import intermediate syntax');
            const used=new Set<string>(),imports:any[]=[];
            const collect=(node:any):void=>{
                if(node.kind===S.ImportDeclaration){imports.push(node);return;}
                if(node.kind===S.Identifier)used.add(node.text);
                ts.forEachChild(node,collect);
            };
            collect(output);
            const sourceNames=new Set((this.declarationDomain?this.declarationDomain.bindings:this.generated.options.plan.bindings).map(binding=>binding.qname.split('.').pop()));
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
            + (this.generated ? 'import * as ' + provider + ' from ' + JSON.stringify(this.generated.registrar) + ';\n'
                + 'import * as '+this.generated.lexical.provider+' from '+JSON.stringify(this.generated.lexicalModule)+';\n'
                + 'import * as '+generatedProperty+' from '+JSON.stringify(this.generated.propertyModule)+';\n'
                + 'import * as ' + domainImport + ' from ' + JSON.stringify(this.generated.options.module) + ';\n' : '')
            + (typedLocals ? 'import * as ' + localCoercion + ' from ' + JSON.stringify(this.coercionModule) + ';\n'
                + 'import * as ' + localString + ' from ' + JSON.stringify(this.stringModule) + ';\n'
                + 'import * as ' + localAddition + ' from ' + JSON.stringify(this.localAdditionModule) + ';\n'
                + (this.generated ? 'import * as ' + localReference + ' from ' + JSON.stringify(this.localReferenceModule) + ';\n' : '') : '')
            + (this.metadata ? 'import * as ' + provider + ' from ' + JSON.stringify(this.metadata.module) + ';\n'
            + (planned ? 'import * as ' + domainImport + ' from ' + JSON.stringify(this.declarationDomain.module) + ';\n'
                + 'const ' + declaration + ' = {type:' + domainImport + '.' + planned.tokenExport
                + ' as ' + provider + '.AS3DeclarationType<' + name + '>,publishGeneration:' + domainImport + '.' + planned.publishExport + '};\n'
                : 'const ' + declaration + ' = ' + provider + '.declareAS3ReferenceType<' + name + '>(' + JSON.stringify(this.metadata.classes[this.own.qname].metadata.name) + ');\n') : '')
            + 'import {callableClassIntrinsics as ' + intrinsic + ', NativeCallableFunction as ' + functionType + '} from '
            + JSON.stringify(this.generated ? this.generated.helpers.callableClass : helperPath.replace(/bound$/, 'callableClass')) + ';\n'
            + (argumentCountError ? 'import {createAS3ArgumentCountError as '+argumentCountError+'} from '+JSON.stringify(this.sourceErrorModule)+';\n' : '')
            + (this.classValueModule?'import * as '+classValue+' from '+JSON.stringify(this.classValueModule)+';\n':'')
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
