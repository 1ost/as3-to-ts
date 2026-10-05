"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const native_source_unit_1 = require("./native-source-unit");
const native_generated_declarations_1 = require("./native-generated-declarations");
const native_generated_proxy_1 = require("./native-generated-proxy");
const native_generated_namespaces_1 = require("./native-generated-namespaces");
const native_generated_declarations_2 = require("./native-generated-declarations");
const native_reference_coercion_1 = require("./native-reference-coercion");
const native_generated_completions_1 = require("./native-generated-completions");
const native_lexical_members_1 = require("./native-lexical-members");
const native_source_operations_1 = require("./native-source-operations");
const native_typeof_1 = require("./native-typeof");
const native_class_metadata_1 = require("./native-class-metadata");
const node_1 = require("../syntax/node");
const nodeKind_1 = require("../syntax/nodeKind");
const parse = require("../parse");
const native_source_type_1 = require("./native-source-type");
const native_declaration_plan_1 = require("./native-declaration-plan");
// These native entry protocols have AIR-qualified zero-argument construction.
function implicitNativeBase(identity) {
    return ['flash.events.EventDispatcher', 'flash.display.Sprite'].indexOf(identity) >= 0;
}
/** Explicit closed-source prototype. No provider allocation or constructor-body dispatcher. */
class NativeCallableClasses {
    constructor(source, options, lazy, methodBindingModule, coercionModule, metadata, sourceHelpers, stringModule, lexical, localAdditionModule, generated, localReferenceModule, classValueModule, sourceErrorModule, displayReference = false, dateReference = false, byteArrayReference = false, movieClipReference = false, textFormatReference = false, interactiveReference = false, accessibilityReference = false, spriteValueReferences = false, spriteOwnerReferences = false, loaderReferences = false, xmlReferences = false, pointReference = false, textFieldReference = false, containerReference = false, simpleButtonReference = false, tabStopReference = false, contentElementReferences = false, rectangleReference = false, matrixReference = false, textLineReference = false, errorEventReference = false, fontMetricsReference = false, textJustifierReference = false, soundLoaderContextReference = false, bitmapDataReference = false, dataEventReference = false, bitmapFilterReference = false, timerReference = false, textBlockReference = false, contextMenuClipboardItemsReference = false, elementFormatReference = false) {
        this.methodBindingModule = methodBindingModule;
        this.coercionModule = coercionModule;
        this.metadata = metadata;
        this.sourceHelpers = sourceHelpers;
        this.stringModule = stringModule;
        this.lexical = lexical;
        this.localAdditionModule = localAdditionModule;
        this.generated = generated;
        this.localReferenceModule = localReferenceModule;
        this.classValueModule = classValueModule;
        this.sourceErrorModule = sourceErrorModule;
        this.displayReference = displayReference;
        this.dateReference = dateReference;
        this.byteArrayReference = byteArrayReference;
        this.movieClipReference = movieClipReference;
        this.textFormatReference = textFormatReference;
        this.interactiveReference = interactiveReference;
        this.accessibilityReference = accessibilityReference;
        this.spriteValueReferences = spriteValueReferences;
        this.spriteOwnerReferences = spriteOwnerReferences;
        this.loaderReferences = loaderReferences;
        this.xmlReferences = xmlReferences;
        this.pointReference = pointReference;
        this.textFieldReference = textFieldReference;
        this.containerReference = containerReference;
        this.simpleButtonReference = simpleButtonReference;
        this.tabStopReference = tabStopReference;
        this.contentElementReferences = contentElementReferences;
        this.rectangleReference = rectangleReference;
        this.matrixReference = matrixReference;
        this.textLineReference = textLineReference;
        this.errorEventReference = errorEventReference;
        this.fontMetricsReference = fontMetricsReference;
        this.textJustifierReference = textJustifierReference;
        this.soundLoaderContextReference = soundLoaderContextReference;
        this.bitmapDataReference = bitmapDataReference;
        this.dataEventReference = dataEventReference;
        this.bitmapFilterReference = bitmapFilterReference;
        this.timerReference = timerReference;
        this.textBlockReference = textBlockReference;
        this.contextMenuClipboardItemsReference = contextMenuClipboardItemsReference;
        this.elementFormatReference = elementFormatReference;
        this.classes = new Map();
        this.sourceRoots = new Map();
        this.sourceTexts = new Map();
        if (!options)
            return;
        this.declarationDomain = native_declaration_plan_1.nativeDeclarationDomainFor(metadata, options, lexical);
        if (typeof methodBindingModule !== 'string' || !methodBindingModule.trim()
            || /[\r\n\u0000]/.test(methodBindingModule))
            this.fail('callable source methods require the common AS3MethodBinding module');
        if (typeof options !== 'object' || Array.isArray(options)
            || Object.getPrototypeOf(options) !== Object.prototype && Object.getPrototypeOf(options) !== null)
            this.fail('invalid exact source class map');
        const classNameFor = (key) => {
            const helper = generated && generated.options.plan.privateBindings.find(binding => binding.identity === key);
            return helper ? helper.declaration.name : key.split('.').pop();
        };
        const sourceClassNames = Object.keys(options).map(classNameFor);
        const roots = new Map();
        // Index on the first typed constructor parameter; vector-only and
        // untyped constructors should not pay for a whole-plan reference scan.
        let referencesByOwner;
        const constructorReference = (owner, start, end) => {
            if (!referencesByOwner) {
                referencesByOwner = new Map();
                generated.options.plan.references.forEach(reference => {
                    let references = referencesByOwner.get(reference.owner);
                    if (!references)
                        referencesByOwner.set(reference.owner, references = []);
                    references.push(reference);
                });
            }
            return (referencesByOwner.get(owner) || []).find(ref => ref.start === start && ref.end === end);
        };
        Object.keys(options).forEach(qname => {
            if (typeof options[qname] !== 'string' || !lazy || lazy[qname] !== 'lazy')
                this.fail('source identity must be lazy: ' + qname);
            this.sourceTexts.set(qname, options[qname]);
            if (generated)
                native_generated_declarations_2.nativeGeneratedDeclarationSource(generated.options.plan, generated.options.plan.scope, qname, options[qname]);
            const selected = generated && native_generated_declarations_2.nativeGeneratedClassDeclaration(generated.options.plan, qname);
            const root = generated ? native_generated_declarations_2.nativeGeneratedDeclarationNode(generated.options.plan, qname) : parse(qname + '.as', options[qname]), declarations = [];
            const walk = (node) => {
                if (!node)
                    return;
                node.children = node.children.filter(child => !!child);
                if (node.kind === nodeKind_1.default.CLASS)
                    declarations.push(node);
                node.children.forEach(child => { if (child)
                    child.parent = node; walk(child); });
            };
            walk(root);
            if (declarations.length !== 1)
                this.fail('exactly one source class is required: ' + qname);
            // A source map shares declaration inputs, not a lexical capability.
            // The current emitter plan can only prove its own exact source/qname.
            let classLexical;
            if (metadata) {
                try {
                    if (lexical)
                        classLexical = lexical.qname === qname && lexical.source === options[qname]
                            ? lexical
                            : new native_lexical_members_1.NativeLexicalMembers(options[qname], root, lexical.module, metadata, !!lexical.typedLocals);
                    native_class_metadata_1.validateNativeClassMetadata(qname, options[qname], metadata, classLexical);
                }
                catch (error) {
                    if (error instanceof Error)
                        error.message += ' [source-map declaration: ' + qname + ']';
                    throw error;
                }
            }
            const cls = declarations[0], name = cls.findChild(nodeKind_1.default.NAME).text;
            if (metadata)
                native_typeof_1.validateNativeTypeOf(cls, options[qname], Object.keys(lazy));
            let pkg = cls.parent;
            while (pkg && pkg.kind !== nodeKind_1.default.PACKAGE)
                pkg = pkg.parent;
            const namespace = pkg && pkg.findChild(nodeKind_1.default.NAME).text || '';
            const importContent = pkg ? pkg.findChild(nodeKind_1.default.CONTENT) : cls.parent;
            const imports = importContent.findChildren(nodeKind_1.default.IMPORT).map(node => node.text);
            if (!selected && (namespace ? namespace + '.' : '') + name !== qname)
                this.fail('mismatched source identity: ' + qname);
            // Metadata-backed declarations use their authenticated member/type
            // validators. Alias discovery is only consumed by callScan below.
            if (!metadata) {
                const classAliases = new Set(sourceClassNames);
                const aliasScan = (node) => {
                    if (node.kind === nodeKind_1.default.NAME_TYPE_INIT && node.findChild(nodeKind_1.default.TYPE) && node.findChild(nodeKind_1.default.TYPE).text === 'Class')
                        classAliases.add(node.findChild(nodeKind_1.default.NAME).text);
                    node.children.forEach(aliasScan);
                };
                aliasScan(cls);
                const isClassAlias = (node, name) => {
                    const local = this.capturedType(node, name);
                    return local === undefined ? classAliases.has(name) : local === 'Class';
                };
                const declaredStaticMethod = (node, receiver) => {
                    if (!generated || receiver.kind !== nodeKind_1.default.IDENTIFIER
                        || ['call', 'apply', 'bind'].indexOf(node.children[1].text) < 0
                        || this.capturedType(node, receiver.text) !== undefined)
                        return false;
                    // A source field or method with the same spelling shadows a Class.
                    if (cls.findChild(nodeKind_1.default.CONTENT).children.some(member => member.findChildren(nodeKind_1.default.NAME_TYPE_INIT).some(value => value.findChild(nodeKind_1.default.NAME).text === receiver.text)
                        || member.findChild(nodeKind_1.default.NAME) && member.findChild(nodeKind_1.default.NAME).text === receiver.text
                            && member.findChild(nodeKind_1.default.NAME).text !== name))
                        return false;
                    const identity = native_generated_declarations_2.nativeGeneratedDeclarationResolver(generated.options.plan, qname, options[qname]).resolve(receiver.text);
                    if (!generated.options.plan.bindings.some(binding => binding.qname === identity)
                        && !generated.options.plan.privateBindings.some(binding => binding.identity === identity))
                        return false;
                    return native_generated_declarations_2.nativeGeneratedDeclarationNode(generated.options.plan, identity).findChild(nodeKind_1.default.CONTENT).children.some(member => {
                        const mods = member.findChild(nodeKind_1.default.MOD_LIST);
                        return member.kind === nodeKind_1.default.FUNCTION && member.findChild(nodeKind_1.default.NAME).text === node.children[1].text
                            && !!mods && ['public', 'static'].every(mod => mods.children.some(value => value.text === mod));
                    });
                };
                const lexicalClassConstruction = (node) => {
                    if (!generated || !generated.lexical.provider || !node.parent || node.parent.kind !== nodeKind_1.default.NEW
                        || node.children[0].kind !== nodeKind_1.default.IDENTIFIER || this.capturedType(node, node.children[0].text) !== undefined)
                        return false;
                    return cls.findChild(nodeKind_1.default.CONTENT).children.some(member => {
                        const mods = member.findChild(nodeKind_1.default.MOD_LIST);
                        if (member.kind !== nodeKind_1.default.VAR_LIST || !mods || !mods.children.some(mod => ['private', 'protected'].indexOf(mod.text) >= 0))
                            return false;
                        return member.findChildren(nodeKind_1.default.NAME_TYPE_INIT).some(field => {
                            const type = field.findChild(nodeKind_1.default.TYPE);
                            return field.findChild(nodeKind_1.default.NAME).text === node.children[0].text && !!type
                                && generated.options.plan.references.some(ref => ref.owner === qname && ref.start === type.start && ref.end === type.end && ref.kind === 'intrinsic' && ref.identity === 'Class');
                        });
                    });
                };
                const callScan = (node) => {
                    const receiver = node.children[0] && node_1.unwrapEncapsulatedExpression(node.children[0]);
                    if (node.kind === nodeKind_1.default.DOT && receiver && isClassAlias(node, receiver.text)
                        && ['call', 'apply', 'bind', 'prototype'].indexOf(node.children[1].text) >= 0
                        && !declaredStaticMethod(node, receiver))
                        this.fail('direct callable-constructor invocation/prototype manipulation');
                    if (node.kind === nodeKind_1.default.CALL && node.children[0] && isClassAlias(node, node.children[0].text)
                        && sourceClassNames.indexOf(node.children[0].text) < 0
                        && !lexicalClassConstruction(node)
                        && !(generated && classValueModule && node.parent && node.parent.kind === nodeKind_1.default.NEW && (this.isCapturedClass(node, node.children[0].text) || this.capturedType(node, node.children[0].text) === undefined && generated.options.plan.embeddedBinary.some(b => b.owner === qname && b.field === node.children[0].text))))
                        this.fail('dynamic Class invocation requires exact constructor authority');
                    node.children.forEach(callScan);
                };
                callScan(cls);
            }
            if (cls.findChild(nodeKind_1.default.IMPLEMENTS_LIST) && !generated)
                this.fail('interface construction identity requires separate authority');
            let base = null;
            const ext = cls.findChild(nodeKind_1.default.EXTENDS);
            if (selected)
                base = selected.base;
            else if (ext) {
                if (ext.text.indexOf('.') >= 0)
                    this.fail('qualified base syntax');
                const candidates = [];
                const local = (namespace ? namespace + '.' : '') + ext.text;
                if (Object.prototype.hasOwnProperty.call(options, local))
                    candidates.push(local);
                pkg.findChild(nodeKind_1.default.CONTENT).findChildren(nodeKind_1.default.IMPORT).forEach(imp => {
                    const candidate = imp.text.endsWith('.*') ? imp.text.slice(0, -1) + ext.text : imp.text;
                    if (candidate.split('.').pop() === ext.text && (Object.prototype.hasOwnProperty.call(options, candidate)
                        || generated && generated.options.plan.nativeBindings.some(binding => binding.qname === candidate && !!binding.nativeBaseExport))
                        && candidates.indexOf(candidate) < 0)
                        candidates.push(candidate);
                });
                if (!candidates.length && ext.text === 'Error' && generated && generated.options.plan.nativeBindings.some(binding => binding.qname === 'Error' && !!binding.nativeBaseExport))
                    candidates.push('Error');
                if (candidates.length !== 1)
                    this.fail('mixed/unknown/ambiguous base chain: ' + qname + ' extends ' + ext.text);
                base = candidates[0];
            }
            const fields = [];
            const instanceMembers = [];
            cls.findChild(nodeKind_1.default.CONTENT).children.forEach(member => {
                const mods = member.findChild(nodeKind_1.default.MOD_LIST);
                const isStatic = mods && mods.children.some(mod => mod.text === 'static');
                const lexicalMember = classLexical && classLexical.proves(member)
                    || generated && (!mods || !mods.children.some(mod => mod.text === 'public'));
                if (!isStatic && !lexicalMember && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(member.kind) >= 0) {
                    const memberName = member.findChild(nodeKind_1.default.NAME).text;
                    if (memberName !== name)
                        instanceMembers.push({ name: memberName, method: member.kind === nodeKind_1.default.FUNCTION });
                }
                if (member.kind !== nodeKind_1.default.VAR_LIST && member.kind !== nodeKind_1.default.CONST_LIST)
                    return;
                if (member.kind === nodeKind_1.default.CONST_LIST && !isStatic && !generated)
                    this.fail('instance const descriptors need separate authority');
                if (isStatic || lexicalMember)
                    return;
                member.findChildren(nodeKind_1.default.NAME_TYPE_INIT).forEach(field => {
                    const fieldName = field.findChild(nodeKind_1.default.NAME).text, typeNode = field.findChild(nodeKind_1.default.TYPE);
                    instanceMembers.push({ name: fieldName, method: false });
                    if (['constructor', '__proto__', 'prototype'].indexOf(fieldName) >= 0)
                        this.fail('reserved construction identity field');
                    const type = native_source_type_1.nativeSourceTypeIdentity(typeNode, qname, imports);
                    fields.push({ name: fieldName, value: type === 'int' || type === 'uint' ? '0' : type === 'Number' ? '(0/0)'
                            : type === 'Boolean' ? 'false' : !type || type === '*' ? 'void 0' : 'null' });
                });
            });
            const constructor = cls.findChild(nodeKind_1.default.CONTENT).children.find(member => member.kind === nodeKind_1.default.FUNCTION && member.findChild(nodeKind_1.default.NAME).text === name);
            if (generated && generated.options.plan.nativeBindings.some(binding => binding.qname === base && !!binding.nativeBaseExport)) {
                let calls = 0;
                const scan = (node) => { if (node.kind === nodeKind_1.default.CALL && node.children[0] && node.children[0].text === 'super')
                    calls++; node.children.forEach(scan); };
                if (constructor)
                    scan(constructor.findChild(nodeKind_1.default.BLOCK));
                if (calls !== 1 && !(calls === 0 && implicitNativeBase(base)))
                    this.fail('native base requires one explicit source base call');
            }
            const parameters = [];
            let usesArguments = false, rest;
            if (constructor) {
                constructor.findChild(nodeKind_1.default.PARAMETER_LIST).children.forEach((parameter, index, list) => {
                    const spread = parameter.findChild(nodeKind_1.default.REST);
                    if (spread) {
                        if (!generated || !generated.lexical.typedLocals || index !== list.length - 1 || rest)
                            this.fail('rest constructor argument authority');
                        rest = spread.text;
                        return;
                    }
                    const value = parameter.findChild(nodeKind_1.default.NAME_TYPE_INIT), type = value.findChild(nodeKind_1.default.TYPE);
                    const vectorNode = value.findChild(nodeKind_1.default.VECTOR);
                    const vector = vectorNode && generated && generated.options.plan.vectors.find(v => v.owner === qname && v.start === vectorNode.start && v.end === vectorNode.end);
                    if (vectorNode && !vector)
                        this.fail('vector constructor parameter coercion requires authenticated specialization');
                    const sourceReference = generated && type && constructorReference(qname, type.start, type.end);
                    const sourceDeclaration = sourceReference && ((sourceReference.kind === 'declaration' || sourceReference.kind === 'private-declaration')
                        ? { qname: sourceReference.identity, tokenExport: native_generated_declarations_2.nativeGeneratedClassDeclaration(generated.options.plan, sourceReference.identity).tokenExport }
                        : sourceReference.kind === 'interface' && native_generated_declarations_1.nativeGeneratedInterfaceBindings(generated.options.plan).find(binding => binding.qname === sourceReference.identity));
                    const nativeReference = sourceReference && sourceReference.kind === 'native'
                        && (generated.options.plan.nativeBindings.some(binding => binding.qname === sourceReference.identity && binding.nativeInterface)
                            || ['flash.events.Event', 'flash.events.MouseEvent'].indexOf(sourceReference.identity) >= 0
                                && generated.options.plan.nativeBindings.some(binding => binding.qname === sourceReference.identity && !!binding.nativeBaseExport)
                            || accessibilityReference && sourceReference.identity === 'flash.accessibility.AccessibilityImplementation'
                            || displayReference && ['flash.display.DisplayObject', 'flash.display.Sprite'].indexOf(sourceReference.identity) >= 0
                            || interactiveReference && sourceReference.identity === 'flash.display.InteractiveObject'
                            || movieClipReference && sourceReference.identity === 'flash.display.MovieClip'
                            || xmlReferences && ['XML', 'XMLList'].indexOf(sourceReference.identity) >= 0
                            || timerReference && sourceReference.identity === 'flash.utils.Timer'
                            || soundLoaderContextReference && sourceReference.identity === 'flash.media.SoundLoaderContext'
                            || textBlockReference && sourceReference.identity === 'flash.text.engine.TextBlock'
                            || rectangleReference && sourceReference.identity === 'flash.geom.Rectangle'
                            || matrixReference && sourceReference.identity === 'flash.geom.Matrix'
                            || textLineReference && sourceReference.identity === 'flash.text.engine.TextLine'
                            || errorEventReference && sourceReference.identity === 'flash.events.ErrorEvent'
                            || containerReference && sourceReference.identity === 'flash.display.DisplayObjectContainer'
                            || spriteValueReferences && native_reference_coercion_1.nativeSpriteValueReferenceNames.indexOf(sourceReference.identity) >= 0
                            || loaderReferences && native_reference_coercion_1.nativeLoaderReferenceNames.indexOf(sourceReference.identity) >= 0
                            || spriteOwnerReferences && native_reference_coercion_1.nativeSpriteOwnerReferenceNames.indexOf(sourceReference.identity) >= 0)
                        && generated.options.plan.nativeBindings.find(binding => binding.qname === sourceReference.identity);
                    const reference = sourceDeclaration ? { identity: sourceDeclaration.qname, exported: sourceDeclaration.tokenExport }
                        : nativeReference ? { identity: nativeReference.qname, exported: nativeReference.referenceExport } : undefined;
                    const sourceType = vector ? vector.identity : reference ? reference.identity : native_source_type_1.nativeSourceTypeIdentity(type, qname, imports);
                    const selfReference = !!metadata && sourceType === qname;
                    const builtinClassReference = sourceReference && sourceReference.kind === 'intrinsic' && sourceReference.identity === 'Class' && !!classValueModule;
                    if (!selfReference && !reference && !vector && !builtinClassReference && !(generated && ['Function', 'Array'].indexOf(sourceType) >= 0) && ['Number', 'int', 'uint', 'Boolean', 'Object', '*', 'String'].indexOf(sourceType) < 0)
                        this.fail('constructor parameter coercion needs common provider authority: ' + (type && type.text || '*') + ' (' + sourceType + ')');
                    if (sourceType === 'String' && (typeof stringModule !== 'string' || !stringModule.trim()
                        || /[\r\n\u0000]/.test(stringModule)))
                        this.fail('String constructor parameters require the common AS3String provider module');
                    if (['Number', 'int', 'uint'].indexOf(sourceType) >= 0
                        && (typeof coercionModule !== 'string' || !coercionModule.trim()
                            || /[\r\n\u0000]/.test(coercionModule)))
                        this.fail('numeric constructor parameters require the common AS3Coercion module');
                    const init = value.findChild(nodeKind_1.default.INIT);
                    if (generated && ['Function', 'Array'].indexOf(sourceType) >= 0 && init && !(init.children[0].kind === nodeKind_1.default.IDENTIFIER && init.children[0].text === 'null'))
                        this.fail(sourceType + ' constructor default requires literal null');
                    if ((reference || vector || builtinClassReference) && init && !(init.children[0].kind === nodeKind_1.default.IDENTIFIER && init.children[0].text === 'null'))
                        this.fail('source reference constructor default requires literal null');
                    if (selfReference && (!init || init.children[0].kind !== nodeKind_1.default.IDENTIFIER || init.children[0].text !== 'null'))
                        this.fail('self-reference constructor parameter requires an optional null default');
                    if (init && sourceType === 'String') {
                        const expression = init.children[0];
                        if (!(expression.kind === nodeKind_1.default.IDENTIFIER && expression.text === 'null')
                            && !(expression.kind === nodeKind_1.default.LITERAL && /^(?:"[\s\S]*"|'[\s\S]*')$/.test(expression.text)))
                            this.fail('String constructor default requires source String or null literal authority');
                    }
                    let defaultLiteral;
                    if (init && ['Number', 'int', 'uint'].indexOf(sourceType) >= 0) {
                        const expression = init.children[0];
                        defaultLiteral = expression.kind === nodeKind_1.default.LITERAL ? expression.text
                            : (expression.kind === nodeKind_1.default.MINUS || expression.kind === nodeKind_1.default.PLUS)
                                && expression.children.length === 1 && expression.children[0].kind === nodeKind_1.default.LITERAL
                                ? (expression.kind === nodeKind_1.default.MINUS ? '-' : '+') + expression.children[0].text : '';
                        const nativeNaN = !!generated && sourceType === 'Number' && expression.kind === nodeKind_1.default.IDENTIFIER && expression.text === 'NaN';
                        if (nativeNaN) {
                            let shadowed = false;
                            const inspect = (node) => {
                                if (node.kind === nodeKind_1.default.NAME && node.text === 'NaN' || node.kind === nodeKind_1.default.IMPORT && /(?:^|\.)NaN$/.test(node.text))
                                    shadowed = true;
                                node.children.forEach(child => { if (child)
                                    inspect(child); });
                            };
                            inspect(native_source_unit_1.nativeSourceUnitAst(native_generated_declarations_2.nativeGeneratedSourceUnit(generated.options.plan, qname)).root);
                            if (shadowed || generated.options.plan.bindings.some(b => /(?:^|\.)NaN$/.test(b.qname))
                                || generated.options.plan.nativeBindings.some(b => /(?:^|\.)NaN$/.test(b.qname)))
                                this.fail('shadowed NaN constructor default requires source constant authority');
                            defaultLiteral = '(0/0)';
                        }
                        const numeric = /^[+-]?(?:0[xX][0-9a-fA-F]+|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)$/.test(defaultLiteral)
                            ? Number(defaultLiteral) : NaN;
                        if (!nativeNaN && (/^[+-]?0[0-9]/.test(defaultLiteral) || !isFinite(numeric) || sourceType !== 'Number'
                            && (Math.floor(numeric) !== numeric || numeric < (sourceType === 'int' ? -2147483648 : 0)
                                || numeric > (sourceType === 'int' ? 2147483647 : 4294967295))))
                            this.fail('numeric constructor default requires finite source literal authority');
                    }
                    parameters.push({ name: value.findChild(nodeKind_1.default.NAME).text, type: sourceType, optional: !!init, defaultLiteral, reference, vector });
                });
                const scanArguments = (node) => {
                    if (node.kind === nodeKind_1.default.FUNCTION || node.kind === nodeKind_1.default.LAMBDA) {
                        const nested = (child) => {
                            if (child.kind === nodeKind_1.default.IDENTIFIER && child.text === 'arguments')
                                this.fail('nested function arguments require separate lexical scope authority');
                            child.children.forEach(nested);
                        };
                        nested(node);
                        return;
                    }
                    if (node.kind === nodeKind_1.default.IDENTIFIER && node.text === 'arguments')
                        usesArguments = true;
                    node.children.forEach(scanArguments);
                };
                scanArguments(constructor.findChild(nodeKind_1.default.BLOCK));
                if (rest && usesArguments)
                    this.fail('combined rest/arguments constructor scope requires qualification');
            }
            const value = { qname, name, base, fields, parameters, usesArguments, rest, instanceMembers };
            this.classes.set(qname, value);
            roots.set(qname, cls);
            this.sourceRoots.set(qname, cls);
            if (options[qname] === source && (!generated || generated.projection.binding.identity === qname)) {
                if (this.own)
                    this.fail('ambiguous current source');
                this.own = value;
            }
        });
        if (!this.own)
            this.fail('current source bytes are absent from exact class map');
        this.classes.forEach(value => {
            const chain = new Set(), slots = new Set();
            for (let current = value; current; current = this.classes.get(current.base)) {
                if (chain.has(current.qname))
                    this.fail('cyclic source inheritance');
                chain.add(current.qname);
                current.fields.forEach(field => {
                    if (slots.has(field.name))
                        this.fail('colliding source slot identity: ' + field.name);
                    slots.add(field.name);
                });
            }
        });
        // This optional compiler pass uses the toolkit's installed TypeScript parser.
        this.ts = require('typescript');
    }
    fail(message) { throw new Error('AS3_CALLABLE_CLASS_UNSUPPORTED: ' + message); }
    /** Find the source slot, stopping at each function or catch shadow. */
    isCapturedClass(node, name) {
        return this.capturedType(node, name) === 'Class';
    }
    /** Undefined means absent; an untyped local still shadows aliases elsewhere. */
    capturedType(node, name) {
        for (let scope = node.parent; scope; scope = scope.parent) {
            if (scope.kind === nodeKind_1.default.CATCH && scope.findChild(nodeKind_1.default.NAME).text === name)
                return scope.findChild(nodeKind_1.default.TYPE) ? scope.findChild(nodeKind_1.default.TYPE).text : '*';
            if (scope.kind !== nodeKind_1.default.FUNCTION && scope.kind !== nodeKind_1.default.LAMBDA)
                continue;
            const declarations = [];
            scope.findChild(nodeKind_1.default.PARAMETER_LIST).children.forEach(p => { const d = p.findChild(nodeKind_1.default.NAME_TYPE_INIT); if (d)
                declarations.push(d); });
            const collect = (value) => {
                if (value.kind === nodeKind_1.default.FUNCTION || value.kind === nodeKind_1.default.LAMBDA)
                    return;
                if ([nodeKind_1.default.VAR_LIST, nodeKind_1.default.CONST_LIST, nodeKind_1.default.VAR, nodeKind_1.default.CONST].indexOf(value.kind) >= 0)
                    declarations.push(...value.findChildren(nodeKind_1.default.NAME_TYPE_INIT));
                value.children.forEach(collect);
            };
            collect(scope.findChild(nodeKind_1.default.BLOCK));
            const binding = declarations.find(d => d.findChild(nodeKind_1.default.NAME).text === name);
            if (binding)
                return binding.findChild(nodeKind_1.default.TYPE) ? binding.findChild(nodeKind_1.default.TYPE).text : '*';
        }
        return undefined;
    }
    lower(source) {
        if (!this.own)
            return source;
        const ts = this.ts, S = ts.SyntaxKind, name = this.own.name;
        const file = ts.createSourceFile('Callable.ts', source, ts.ScriptTarget.Latest, true);
        if (file.parseDiagnostics.length)
            this.fail('intermediate native syntax');
        let cls, alias;
        const visit = (node) => {
            if (node.kind === S.ClassDeclaration && node.name.text === name)
                cls = node;
            if (node.kind === S.TypeAliasDeclaration && node.name.text === name)
                alias = node;
            ts.forEachChild(node, visit);
        };
        visit(file);
        const compilerHelpers = new Set();
        if (this.sourceHelpers)
            this.sourceHelpers.forEach(helper => compilerHelpers.add(helper));
        file.statements.forEach((statement) => {
            if (statement.kind !== S.ImportDeclaration || !statement.importClause || !statement.importClause.namedBindings)
                return;
            if (!/(?:^|\/)(?:nativeClass|callableClass|bound|classBound|AS3MethodBinding)$/.test(statement.moduleSpecifier.text))
                return;
            const bindings = statement.importClause.namedBindings;
            if (bindings.elements)
                bindings.elements.forEach((item) => compilerHelpers.add(item.name.text));
        });
        if (!cls || !alias)
            this.fail('expected complete native class and instance type');
        const unique = (label) => { let result = '__as3_callable_' + label; while (source.indexOf(result) >= 0)
            result += '_'; return result; };
        const baseName = unique('base'), constructorType = unique('constructor'), bindName = unique('bind');
        const intrinsic = unique('intrinsics'), identity = unique('identity'), fresh = unique('fresh'), succeeded = unique('succeeded');
        const argumentCountError = this.generated && this.sourceErrorModule ? unique('argumentCountError') : '';
        const arityFailure = argumentCountError ? argumentCountError + '()' : intrinsic + '.arityError()';
        const functionType = unique('functionType'), superArguments = unique('superArguments');
        const numberCoercion = unique('number'), intCoercion = unique('int'), uintCoercion = unique('uint');
        const stringCoercion = unique('string');
        const sourceArguments = unique('arguments');
        const constructorCompletion = unique('constructorCompletion');
        const superMethods = [];
        const superMethodNames = new Map();
        const validateOptionalDefault = (owner, type, init) => {
            if (type && type.kind === nodeKind_1.default.VECTOR)
                this.fail('optional Vector parameter requires qualification');
            // Legacy unary defaults can have an empty INIT span; their operand
            // descendants carry the end. Validate the complete expression so a
            // truncated prefix cannot accidentally authorize a nonliteral default.
            const defaultEnd = (node) => Math.max(node.start, node.end, ...(node.children || []).filter(child => !!child).map(defaultEnd));
            const raw = this.sourceTexts.get(owner).slice(init.start, defaultEnd(init)).trim(), identity = type && type.text || '*';
            const numeric = /^[+-]?(?:0[xX][0-9a-fA-F]+|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)$/.test(raw) && isFinite(Number(raw));
            if (['int', 'uint'].indexOf(identity) >= 0 && (!numeric || /^[+-]?0[0-9]/.test(raw) || Math.floor(Number(raw)) !== Number(raw)
                || Number(raw) < (identity === 'int' ? -2147483648 : 0) || Number(raw) > (identity === 'int' ? 2147483647 : 4294967295)))
                this.fail('generated optional integer default requires in-range literal');
            if (!(identity === '*' && (raw === 'null' || raw === 'undefined' || raw === 'true' || raw === 'false' || numeric || /^("(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*')$/.test(raw))
                || identity === 'Boolean' && /^(true|false)$/.test(raw)
                || ['Number', 'int', 'uint'].indexOf(identity) >= 0 && numeric
                || identity === 'String' && (raw === 'null' || /^("(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*')$/.test(raw))
                || raw === 'null' && ['Number', 'int', 'uint', 'Boolean', '*'].indexOf(identity) < 0))
                this.fail('generated optional parameter requires qualified literal default');
        };
        const sourceMemberMatches = (node, key, owner, uri) => {
            const names = node.kind === nodeKind_1.default.VAR_LIST || node.kind === nodeKind_1.default.CONST_LIST ? node.findChildren(nodeKind_1.default.NAME_TYPE_INIT).map(n => n.findChild(nodeKind_1.default.NAME)) : [node.findChild(nodeKind_1.default.NAME)];
            return names.some(name => name && name.text === key) && (!this.generated ? !uri : native_generated_namespaces_1.generatedMemberUri(this.generated.options.plan, owner, node) === uri);
        };
        const directSuper = (key, supplied, uri, encoded = JSON.stringify(key)) => {
            let ancestor = this.own.base, owner = this.classes.get(ancestor), depth = 0, method;
            for (; owner; ancestor = owner.base, owner = this.classes.get(ancestor), depth++) {
                const content = this.sourceRoots.get(owner.qname).findChild(nodeKind_1.default.CONTENT);
                const candidates = content.children.filter(member => sourceMemberMatches(member, key, owner.qname, uri));
                if (candidates.length) {
                    if (candidates.length !== 1 || candidates[0].kind !== nodeKind_1.default.FUNCTION)
                        this.fail('super target must be an exact source instance method');
                    method = candidates[0];
                    break;
                }
            }
            if (!uri && !method && ancestor === 'flash.accessibility.AccessibilityImplementation' && this.generated
                && this.generated.options.plan.nativeBindings.some(binding => binding.qname === ancestor && !!binding.nativeBaseExport)) {
                const counts = { accDoDefaultAction: 1, accLocation: 1, get_accSelection: 0, get_accFocus: 0,
                    isLabeledBy: 1, accSelect: 2, getChildIDArray: 0, get_accRole: 1, get_accName: 1, get_accValue: 1, get_accState: 1, get_accDefaultAction: 1 };
                if (!Object.prototype.hasOwnProperty.call(counts, key) || supplied !== counts[key])
                    this.fail('native accessibility super method or arity requires authority');
                let capture = superMethodNames.get(key);
                if (!capture) {
                    capture = unique('superMethod' + superMethods.length);
                    let prototype = baseName + '.prototype';
                    for (let index = 0; index < depth; index++)
                        prototype = intrinsic + '.getPrototypeOf(' + prototype + ')';
                    superMethods.push('const ' + capture + ' = ' + intrinsic + '.getOwnPropertyDescriptor(' + prototype + ', ' + JSON.stringify(key) + ')!.value;');
                    superMethodNames.set(key, capture);
                }
                const args = unique('superCallArguments');
                return '((...' + args + ': any[]): any => ' + intrinsic + '.apply(' + capture + ', this, ' + args + '))';
            }
            if (!uri && !method && ancestor === 'flash.events.EventDispatcher' && this.generated
                && this.generated.options.plan.nativeBindings.some(binding => binding.qname === ancestor && !!binding.nativeBaseExport)) {
                const signature = key === 'addEventListener' ? ['String', 'Function', 'Boolean', 'int', 'Boolean']
                    : key === 'removeEventListener' ? ['String', 'Function', 'Boolean'] : undefined;
                if (!signature || supplied === undefined || supplied < 2 || supplied > signature.length)
                    this.fail('native dispatcher super method or arity requires authority');
                let capture = superMethodNames.get(key);
                if (!capture) {
                    capture = unique('superMethod' + superMethods.length);
                    let prototype = baseName + '.prototype';
                    for (let index = 0; index < depth; index++)
                        prototype = intrinsic + '.getPrototypeOf(' + prototype + ')';
                    superMethods.push('const ' + capture + ' = ' + intrinsic + '.getOwnPropertyDescriptor(' + prototype + ', ' + JSON.stringify(key) + ')!.value;');
                    superMethodNames.set(key, capture);
                }
                // Evaluate all authored arguments once before converting the
                // native signature from the last argument back to the first,
                // as observed for AIR callsuper. Keep omitted defaults
                // owned by the captured native method.
                const args = unique('superCallArguments');
                return '((...' + args + ': any[]): any => {' + signature.slice(0, supplied).map((type, index) => args + '[' + index + '] = ' + generatedProperty + '.coerceAS3PropertyValue(' + args + '[' + index + '], ' + JSON.stringify(type) + ');').reverse().join('')
                    + 'return ' + intrinsic + '.apply(' + capture + ', this, ' + args + ');})';
            }
            if (!method)
                this.fail('super method is absent from complete source ancestry');
            if (key === owner.name)
                this.fail('super constructor is not an instance method');
            const mods = method.findChild(nodeKind_1.default.MOD_LIST);
            if (!mods || mods.children.some(mod => mod.text === 'private' || mod.text === 'static')
                || !uri && !mods.children.some(mod => mod.text === 'public' || mod.text === 'protected'))
                this.fail('super method visibility requires separate authority');
            const parameters = method.findChild(nodeKind_1.default.PARAMETER_LIST).children;
            const rest = parameters.filter(parameter => !!parameter.findChild(nodeKind_1.default.REST));
            if (rest.length && (!this.generated || rest.length !== 1 || parameters[parameters.length - 1] !== rest[0]))
                this.fail('super rest method requires unique final generated parameter');
            if (supplied === undefined && (!this.generated || !rest.length))
                this.fail('super apply requires qualified generated rest method');
            let minimum = 0, optional = false;
            parameters.forEach(parameter => {
                if (parameter.findChild(nodeKind_1.default.REST))
                    return;
                const declaration = parameter.findChild(nodeKind_1.default.NAME_TYPE_INIT), type = declaration.findChild(nodeKind_1.default.TYPE);
                if (this.generated) {
                    const ref = type && this.generated.options.plan.references.find(r => r.owner === owner.qname && r.start === type.start && r.end === type.end);
                    const qualified = ref && (ref.kind === 'intrinsic' && ['*', 'int', 'uint', 'Number', 'Boolean', 'String', 'Object'].indexOf(ref.identity) >= 0
                        || ref.kind === 'declaration' || ref.kind === 'private-declaration' || ref.kind === 'interface'
                        || ref.kind === 'native' && this.generated.options.plan.nativeBindings.some(binding => binding.qname === ref.identity));
                    if (!qualified)
                        this.fail('generated super signature requires qualified parameters');
                    const init = declaration.findChild(nodeKind_1.default.INIT);
                    if (init) {
                        validateOptionalDefault(owner.qname, type, init);
                        optional = true;
                    }
                    else {
                        if (optional)
                            this.fail('required super parameter after optional');
                        minimum++;
                    }
                    // Pass only authored arguments. The actual source parent owns
                    // omitted defaults and explicit undefined/reference coercion.
                    return;
                }
                if (!type || type.text !== 'Boolean')
                    this.fail('super parameter coercion requires separately proved signature');
                const init = declaration.findChild(nodeKind_1.default.INIT);
                if (!init)
                    minimum++;
                else if (!/^\s*(true|false)\s*$/.test(this.sourceTexts.get(owner.qname).slice(init.start, init.end)))
                    this.fail('super optional Boolean literal');
            });
            if (supplied !== undefined && (supplied < minimum || !rest.length && supplied > parameters.length))
                this.fail('super call source arity differs from declared signature');
            const memberIdentity = native_generated_namespaces_1.generatedMemberIdentity(key, uri);
            let capture = superMethodNames.get(memberIdentity);
            if (!capture) {
                capture = unique('superMethod' + superMethods.length);
                let prototype = baseName + '.prototype';
                for (let index = 0; index < depth; index++)
                    prototype = intrinsic + '.getPrototypeOf(' + prototype + ')';
                superMethods.push('const ' + capture + ' = ' + intrinsic + '.getOwnPropertyDescriptor('
                    + prototype + ', ' + encoded + ')!.value;');
                superMethodNames.set(memberIdentity, capture);
            }
            const args = unique('superCallArguments');
            if (supplied === undefined)
                return '((_receiver: any, ' + args + ': any): any => '
                    + provider + '.applyAS3GeneratedSuperMethod(' + capture + ',this,' + args + '))';
            return '((...' + args + ': any[]): any => {'
                + (this.generated ? '' : parameters.slice(0, supplied).map((_, index) => args + '[' + index + '] = !!' + args + '[' + index + '];').join(''))
                + 'return ' + intrinsic + '.apply(' + capture + ', this, ' + args + ');})';
        };
        const directSuperAccessor = (key, side, uri, encoded = JSON.stringify(key)) => {
            if (!this.generated || !this.generated.projection.inheritInstanceLayout && !this.generated.projection.nativeAccessorBase)
                this.fail('super accessor requires selected generated ancestry');
            let owner = this.classes.get(this.own.base), depth = 0, accessor;
            for (; owner; owner = this.classes.get(owner.base), depth++) {
                const candidates = this.sourceRoots.get(owner.qname).findChild(nodeKind_1.default.CONTENT).children.filter(node => sourceMemberMatches(node, key, owner.qname, uri));
                if (candidates.some(node => node.kind !== nodeKind_1.default.GET && node.kind !== nodeKind_1.default.SET))
                    this.fail('super accessor collides with source field or method');
                accessor = candidates.find(node => node.kind === (side === 'get' ? nodeKind_1.default.GET : nodeKind_1.default.SET));
                if (accessor)
                    break;
            }
            if (!uri && !accessor && this.generated.projection.nativeAccessorBase && ['x', 'y'].indexOf(key) >= 0) {
                const identity = side + ':' + key;
                let capture = superMethodNames.get(identity);
                if (!capture) {
                    capture = unique('superAccessor' + superMethods.length);
                    superMethods.push('const ' + capture + ' = ' + provider + '.getAS3GeneratedNativePositionAccessor(' + baseName + ',' + JSON.stringify(key) + ',' + JSON.stringify(side) + ');');
                    superMethodNames.set(identity, capture);
                }
                return capture;
            }
            if (!accessor)
                this.fail('super accessor half absent from complete source ancestry');
            const mods = accessor.findChild(nodeKind_1.default.MOD_LIST), parameters = accessor.findChild(nodeKind_1.default.PARAMETER_LIST).children;
            if (!mods || !uri && !mods.children.some(mod => mod.text === 'public') || mods.children.some(mod => mod.text === 'static'))
                this.fail('super accessor requires public instance authority');
            const type = side === 'get' ? accessor.findChild(nodeKind_1.default.TYPE)
                : parameters.length === 1 && parameters[0].findChild(nodeKind_1.default.NAME_TYPE_INIT).findChild(nodeKind_1.default.TYPE);
            const ref = type && this.generated.options.plan.references.find(r => r.owner === owner.qname && r.start === type.start && r.end === type.end);
            if (!ref || !(uri ? ref.kind === 'intrinsic' && ['*', 'Object', 'int', 'uint', 'Number', 'Boolean', 'String', 'Function', 'Array'].indexOf(ref.identity) >= 0 || ref.kind === 'declaration' || ref.kind === 'private-declaration' || ref.kind === 'interface'
                : ref.kind === 'declaration' || ref.kind === 'interface' || ref.kind === 'native' && ['flash.display.Sprite', 'flash.display.DisplayObject'].indexOf(ref.identity) >= 0
                    || ref.kind === 'intrinsic' && (ref.identity === 'Boolean' || ref.identity === 'String' || ref.identity === '*' || ref.identity === 'Array' || ref.identity === 'Number' || ref.identity === 'Object')))
                this.fail('super accessor requires qualified signature');
            const identity = side + ':' + native_generated_namespaces_1.generatedMemberIdentity(key, uri);
            let capture = superMethodNames.get(identity);
            if (!capture) {
                capture = unique('superAccessor' + superMethods.length);
                let prototype = baseName + '.prototype';
                for (let index = 0; index < depth; index++)
                    prototype = intrinsic + '.getPrototypeOf(' + prototype + ')';
                superMethods.push('const ' + capture + ' = ' + intrinsic + '.getOwnPropertyDescriptor('
                    + prototype + ', ' + encoded + ')!.' + side + '!;');
                superMethodNames.set(identity, capture);
            }
            return capture;
        };
        const provider = unique('provider'), declaration = unique('declaration'), generation = unique('generation');
        const localCoercion = unique('localCoercion'), localString = unique('localString'), localAddition = unique('localAddition');
        const generatedProperty = unique('generatedProperty'), localReference = unique('localReference'), classValue = unique('classValue');
        const typedLocals = this.generated ? this.generated.lexical.typedLocals : this.lexical && this.lexical.typedLocals;
        const planned = this.declarationDomain && this.declarationDomain.bindings.find(binding => binding.qname === this.own.qname);
        if (this.declarationDomain && !planned)
            this.fail('current source declaration is absent from its compiler domain');
        const domainImport = planned || this.generated ? unique('declarationDomain') : '';
        const nativeBase = this.generated && this.generated.nativeBase;
        const nativeBaseClass = nativeBase && domainImport + '.' + nativeBase.referenceExport;
        const directNativeBase = nativeBase && this.own.base === nativeBase.qname;
        const referenceToken = planned || this.generated ? (qname) => {
            const binding = this.declarationDomain && this.declarationDomain.bindings.find(value => value.qname === qname)
                || this.generated && [...native_generated_declarations_1.nativeGeneratedInterfaceBindings(this.generated.options.plan), ...this.generated.options.plan.bindings].find(value => value.qname === qname);
            const helper = this.generated && this.generated.options.plan.privateBindings.find(value => value.identity === qname);
            const native = this.generated && this.generated.options.plan.nativeBindings.find(value => value.qname === qname);
            if (!binding && !helper && !native)
                this.fail('foreign local declaration is absent from its compiler domain');
            return domainImport + '.' + (binding ? binding.tokenExport : helper ? helper.tokenExport : native.referenceExport);
        } : undefined;
        const text = (node) => node.getText(file);
        const namespaceKeys = new Map();
        if (this.generated)
            for (const statement of file.statements)
                if (statement.kind === S.ImportDeclaration && statement.moduleSpecifier.text === this.generated.options.module) {
                    const bindings = statement.importClause && statement.importClause.namedBindings;
                    if (!bindings || bindings.kind !== S.NamedImports)
                        continue;
                    for (const spec of bindings.elements) {
                        const exported = spec.propertyName ? spec.propertyName.text : spec.name.text;
                        const key = (this.generated.options.plan.namespaceKeys || []).find(k => k.exported === exported);
                        if (key)
                            namespaceKeys.set(spec.name.text, { uri: key.uri, name: key.name, encoded: spec.name.text });
                    }
                }
        if (this.generated)
            for (const statement of file.statements)
                if (statement.kind === S.VariableStatement)
                    for (const variable of statement.declarationList.declarations) {
                        const init = variable.initializer;
                        if (!init || init.kind !== S.CallExpression || text(init.expression) !== 'globalThis.Symbol.for' || init.arguments.length !== 1 || init.arguments[0].kind !== S.StringLiteral)
                            continue;
                        const value = init.arguments[0].text, prefix = 'as3.namespace.member@1:';
                        if (!value.startsWith(prefix))
                            continue;
                        let pair;
                        try {
                            pair = JSON.parse(value.slice(prefix.length));
                        }
                        catch (_) {
                            this.fail('namespace key encoding');
                        }
                        if (!Array.isArray(pair) || pair.length !== 2 || pair.some(v => typeof v !== 'string' || !v))
                            this.fail('namespace key identity');
                        namespaceKeys.set(variable.name.text, { uri: pair[0], name: pair[1], encoded: variable.name.text });
                    }
        const superKey = (node) => {
            if (node.kind === S.PropertyAccessExpression)
                return { name: node.name.text, encoded: JSON.stringify(node.name.text) };
            const selected = node.kind === S.ElementAccessExpression && node.argumentExpression.kind === S.Identifier && namespaceKeys.get(node.argumentExpression.text);
            if (!selected)
                this.fail('super computed key requires source namespace identity');
            return selected;
        };
        const namespaceMethods = new Map();
        if (this.generated)
            for (const member of cls.members) {
                if (!member.name || member.name.kind !== S.ComputedPropertyName)
                    continue;
                const expression = member.name.expression;
                if (expression.kind !== S.Identifier)
                    this.fail('computed member identity');
                const plannedKey = namespaceKeys.get(expression.text);
                let identity = plannedKey ? 'as3.namespace.member@1:' + JSON.stringify([plannedKey.uri, plannedKey.name]) : undefined;
                for (const statement of file.statements)
                    if (statement.kind === S.VariableStatement)
                        for (const variable of statement.declarationList.declarations)
                            if (variable.name.text === expression.text) {
                                const init = variable.initializer;
                                if (init && init.kind === S.CallExpression && text(init.expression) === 'globalThis.Symbol.for'
                                    && init.arguments.length === 1 && init.arguments[0].kind === S.StringLiteral)
                                    identity = init.arguments[0].text;
                            }
                const isStatic = !!member.modifiers && member.modifiers.some((mod) => mod.kind === S.StaticKeyword);
                const kinds = member.kind === S.PropertyDeclaration ? [nodeKind_1.default.VAR_LIST, nodeKind_1.default.CONST_LIST] : member.kind === S.MethodDeclaration ? [nodeKind_1.default.FUNCTION] : member.kind === S.GetAccessor ? [nodeKind_1.default.GET] : member.kind === S.SetAccessor ? [nodeKind_1.default.SET] : [];
                let matched;
                for (const node of this.generated.lexical.ownClass.findChild(nodeKind_1.default.CONTENT).children) {
                    if (kinds.indexOf(node.kind) < 0)
                        continue;
                    const mods = node.findChild(nodeKind_1.default.MOD_LIST), sourceStatic = !!mods && mods.children.some(mod => mod.text === 'static');
                    if (sourceStatic !== isStatic)
                        continue;
                    const uri = native_generated_namespaces_1.generatedMemberUri(this.generated.options.plan, this.own.qname, node);
                    const names = node.kind === nodeKind_1.default.VAR_LIST || node.kind === nodeKind_1.default.CONST_LIST ? node.findChildren(nodeKind_1.default.NAME_TYPE_INIT).map(n => n.findChild(nodeKind_1.default.NAME)) : [node.findChild(nodeKind_1.default.NAME)];
                    for (const name of names)
                        if (uri && identity === 'as3.namespace.member@1:' + JSON.stringify([uri, name.text])) {
                            if (matched)
                                this.fail('ambiguous computed source member');
                            matched = { name: name.text, uri, encoded: text(expression), node };
                        }
                }
                if (!matched)
                    this.fail('computed member requires exact source namespace authority');
                namespaceMethods.set(member, matched);
            }
        const params = (member, signature) => member.parameters.filter((p) => signature || !this.generated || !p.dotDotDotToken).map((p) => {
            if (!signature)
                return this.generated ? text(p.name) + ': ' + (p.type ? text(p.type) : 'any') : text(p);
            return (p.dotDotDotToken ? '...' : '') + text(p.name) + (p.questionToken || p.initializer ? '?' : '')
                + ': ' + (p.type ? text(p.type) : 'any');
        }).join(', ');
        const type = (node) => node.type ? text(node.type) : 'any';
        const instanceTypes = [], staticTypes = [], definitions = [], initializers = [];
        const staticMethods = [];
        let ctor, constructorReturns = 0;
        const sourceMethodNode = (member, constructor) => {
            const namespaced = namespaceMethods.get(member);
            if (namespaced)
                return namespaced.node;
            const kind = member.kind === S.GetAccessor ? nodeKind_1.default.GET : member.kind === S.SetAccessor ? nodeKind_1.default.SET : nodeKind_1.default.FUNCTION;
            const isStatic = !!member.modifiers && member.modifiers.some((mod) => mod.kind === S.StaticKeyword);
            return this.generated.lexical.ownClass.findChild(nodeKind_1.default.CONTENT).children.find(node => {
                const mods = node.findChild(nodeKind_1.default.MOD_LIST), sourceStatic = !!mods && mods.children.some(mod => mod.text === 'static');
                return node.kind === kind && node.findChild(nodeKind_1.default.NAME).text === (constructor ? this.own.name : member.name.text)
                    && sourceStatic === isStatic && !native_generated_namespaces_1.generatedMemberUri(this.generated.options.plan, this.own.qname, node);
            });
        };
        const body = (member, constructor, returnType) => {
            if (!member.body)
                this.fail('bodyless member');
            const returnPrefix = '<any>' + (returnType === '"Class"' ? classValue + '.as3CoerceClass(' : generatedProperty + '.coerceAS3PropertyValue(');
            const returnSuffix = returnType === '"Class"' ? ')' : ',' + returnType + ')';
            const edits = [];
            let superCount = 0;
            const deferred = new Map();
            const resetCatches = new Set();
            const deferredReturn = (node) => {
                let outer, child = node;
                for (let scope = node.parent; scope && scope !== member.body; child = scope, scope = scope.parent) {
                    if (scope.kind !== S.TryStatement || !scope.finallyBlock || child === scope.finallyBlock)
                        continue;
                    const blockText = text(scope.finallyBlock);
                    if (this.generated.lexical.finallyMarkers.some(m => blockText.indexOf('{/*' + m.name + '*/') === 0))
                        outer = scope;
                }
                if (!outer)
                    return undefined;
                let entry = deferred.get(outer);
                if (!entry) {
                    const id = deferred.size;
                    entry = { label: unique('returnRegion' + id), value: unique('returnValue' + id), pending: unique('returnPending' + id) };
                    deferred.set(outer, entry);
                    edits.push({ start: outer.getStart(file), end: outer.getStart(file), value: '{let ' + entry.value + ':any;let ' + entry.pending + '=false;' + entry.label + ':' });
                    edits.push({ start: outer.end, end: outer.end, value: ';if(' + entry.pending + ')return ' + returnPrefix + entry.value + returnSuffix + ';}' });
                }
                // A finalizer may throw and an enclosing catch may resume normally.
                // Such a catch cancels this pending return. Catches inside the
                // finalizer itself do not enclose the return and must not clear it.
                child = node;
                for (let scope = node.parent; scope && scope !== member.body; child = scope, scope = scope.parent) {
                    if (scope.kind === S.TryStatement && scope.catchClause && child === scope.tryBlock) {
                        const block = scope.catchClause.block, key = entry.pending + ':' + block.pos;
                        if (!resetCatches.has(key)) {
                            resetCatches.add(key);
                            edits.push({ start: block.getStart(file) + 1, end: block.getStart(file) + 1, value: entry.pending + '=false;' });
                        }
                    }
                    if (scope === outer)
                        break;
                }
                return entry;
            };
            const isSourceArguments = (node) => {
                if (!constructor || node.kind !== S.Identifier || node.text !== 'arguments')
                    return false;
                if ((node.parent.kind === S.PropertyAccessExpression || node.parent.kind === S.PropertyAssignment)
                    && node.parent.name === node)
                    return false;
                let scope = node.parent;
                while (scope !== member.body && scope.kind !== S.FunctionExpression
                    && scope.kind !== S.FunctionDeclaration && scope.kind !== S.ArrowFunction)
                    scope = scope.parent;
                return scope === member.body;
            };
            const argumentExpression = (node) => {
                let result = text(node);
                const references = [];
                const collect = (child) => {
                    if (isSourceArguments(child))
                        references.push(child);
                    ts.forEachChild(child, collect);
                };
                collect(node);
                references.sort((a, b) => b.getStart(file) - a.getStart(file)).forEach(reference => {
                    const start = reference.getStart(file) - node.getStart(file);
                    result = result.slice(0, start) + sourceArguments + result.slice(start + reference.end - reference.getStart(file));
                });
                return result;
            };
            const walk = (node, insideSuperArguments = false, nestedFunction = false) => {
                if (isSourceArguments(node) && (node.parent.kind === S.PropertyAccessExpression
                    && node.parent.name.text === 'callee' || node.parent.kind === S.ElementAccessExpression
                    && node.parent.argumentExpression.kind === S.StringLiteral && node.parent.argumentExpression.text === 'callee'))
                    this.fail('arguments.callee requires separate callable identity authority');
                if (isSourceArguments(node) && !insideSuperArguments)
                    edits.push({ start: node.getStart(file), end: node.end, value: sourceArguments });
                if (node.kind === S.CallExpression && node.expression.kind === S.PropertyAccessExpression
                    && node.expression.name.text === 'apply'
                    && [S.PropertyAccessExpression, S.ElementAccessExpression].indexOf(node.expression.expression.kind) >= 0
                    && node.expression.expression.expression.kind === S.SuperKeyword) {
                    if (constructor || nestedFunction || insideSuperArguments || node.arguments.length !== 2
                        || node.arguments.some((argument) => argument.kind === S.SpreadElement)
                        || member.modifiers && member.modifiers.some((mod) => mod.kind === S.StaticKeyword))
                        this.fail('super apply requires two ordinary instance arguments');
                    const selected = superKey(node.expression.expression);
                    edits.push({ start: node.expression.getStart(file), end: node.expression.end,
                        value: directSuper(selected.name, undefined, selected.uri, selected.encoded) });
                    node.arguments.forEach((argument) => walk(argument, false, nestedFunction));
                    return;
                }
                if (node.kind === S.CallExpression && [S.PropertyAccessExpression, S.ElementAccessExpression].indexOf(node.expression.kind) >= 0
                    && node.expression.expression.kind === S.SuperKeyword) {
                    if (constructor || nestedFunction || insideSuperArguments
                        || member.modifiers && member.modifiers.some((mod) => mod.kind === S.StaticKeyword))
                        this.fail('super direct method call requires an ordinary instance method body');
                    if (node.arguments.some((argument) => argument.kind === S.SpreadElement))
                        this.fail('spread super method arguments');
                    const selected = superKey(node.expression);
                    edits.push({ start: node.expression.getStart(file), end: node.expression.end,
                        value: directSuper(selected.name, node.arguments.length, selected.uri, selected.encoded) });
                    node.arguments.forEach((argument) => walk(argument, false, nestedFunction));
                    return;
                }
                const superProperty = (value) => [S.PropertyAccessExpression, S.ElementAccessExpression].indexOf(value.kind) >= 0 && value.expression.kind === S.SuperKeyword;
                // Binary reads (including comparisons and short-circuit operators)
                // recurse into the getter; only assignment operators own the setter path.
                if (node.kind === S.BinaryExpression && node.operatorToken.kind >= S.FirstAssignment
                    && node.operatorToken.kind <= S.LastAssignment && superProperty(node.left) || superProperty(node)) {
                    if (constructor || nestedFunction || insideSuperArguments
                        || member.modifiers && member.modifiers.some((mod) => mod.kind === S.StaticKeyword))
                        this.fail('super accessor requires ordinary instance body');
                    if (node.kind === S.BinaryExpression) {
                        if (node.operatorToken.kind !== S.EqualsToken)
                            this.fail('super accessor compound assignment requires authority');
                        const selected = superKey(node.left), capture = directSuperAccessor(selected.name, 'set', selected.uri, selected.encoded), value = unique('superAccessorValue');
                        edits.push({ start: node.getStart(file), end: node.right.getStart(file), value: '((' + value + ': any): any => {'
                                + intrinsic + '.apply(' + capture + ',this,[' + value + ']);return ' + value + ';})(' });
                        edits.push({ start: node.end, end: node.end, value: ')' });
                        walk(node.right, false, nestedFunction);
                        return;
                    }
                    if (node.parent.kind === S.PrefixUnaryExpression && (node.parent.operator === S.PlusPlusToken || node.parent.operator === S.MinusMinusToken) || node.parent.kind === S.PostfixUnaryExpression
                        || node.parent.kind === S.DeleteExpression)
                        this.fail('super accessor update/delete requires authority');
                    const selected = superKey(node);
                    edits.push({ start: node.getStart(file), end: node.end, value: intrinsic + '.apply('
                            + directSuperAccessor(selected.name, 'get', selected.uri, selected.encoded) + ',this,[])' });
                    return;
                }
                if (node.kind === S.SuperKeyword)
                    this.fail('super property access requires separate receiver authority');
                if (node.kind === S.ReturnStatement && returnType && !nestedFunction) {
                    if (!node.expression)
                        this.fail('generated typed bare return');
                    const delayed = deferredReturn(node);
                    if (delayed) {
                        edits.push({ start: node.getStart(file), end: node.expression.getStart(file), value: '{' + delayed.value + '=' });
                        edits.push({ start: node.expression.end, end: node.end, value: ';' + delayed.pending + '=true;break ' + delayed.label + ';}' });
                        ts.forEachChild(node, (child) => walk(child, insideSuperArguments, nestedFunction));
                        return;
                    }
                    // Insert around the original return expression. Walk its children
                    // normally, retaining nested compiler-helper return ownership.
                    edits.push({ start: node.expression.getStart(file), end: node.expression.getStart(file), value: returnPrefix });
                    edits.push({ start: node.expression.end, end: node.expression.end, value: returnSuffix });
                }
                if (node.kind === S.ReturnStatement && constructor && !nestedFunction) {
                    if (node.expression)
                        this.fail('constructor return value');
                    constructorReturns++;
                    // Exiting a labeled block preserves all source finally effects.
                    // Completion is recorded only after those effects succeed.
                    edits.push({ start: node.getStart(file), end: node.end,
                        value: 'break ' + constructorCompletion + ';' });
                    return;
                }
                if (node.kind === S.CallExpression && node.expression.kind === S.SuperKeyword) {
                    if (!constructor || node.parent.kind !== S.ExpressionStatement || node.parent.parent !== member.body)
                        this.fail('non-straight-line super construction');
                    if (++superCount > 1)
                        this.fail('repeated super construction');
                    edits.push({ start: node.getStart(file), end: node.end,
                        value: '{const ' + superArguments + ': any[] = [' + node.arguments.map(argumentExpression).join(', ') + ']; '
                            + (directNativeBase ? intrinsic + '.callNativeBase(this,' + identity + ',' + baseName + ',' + superArguments + '); }'
                                : intrinsic + '.expectBase(this, ' + identity + ', ' + baseName + '); '
                                    + intrinsic + '.apply(' + baseName + ', this, ' + superArguments + '); }') });
                    node.arguments.forEach((argument) => walk(argument, true, nestedFunction));
                    return;
                }
                const childFunction = nestedFunction || node.kind === S.FunctionExpression
                    || node.kind === S.FunctionDeclaration || node.kind === S.ArrowFunction
                    || node.kind === S.MethodDeclaration || node.kind === S.GetAccessor || node.kind === S.SetAccessor;
                ts.forEachChild(node, (child) => walk(child, insideSuperArguments, childFunction));
            };
            walk(member.body);
            const implicitNative = constructor && directNativeBase && superCount === 0 && implicitNativeBase(this.own.base);
            if (constructor && this.own.base && superCount !== 1 && !implicitNative)
                this.fail('missing source-base constructor call');
            let result = source.slice(member.body.getStart(file) + 1, member.body.end - 1);
            const offset = member.body.getStart(file) + 1;
            // Replace the original token before inserting a wrapper at the same
            // offset (for example a coerced return of a direct super call).
            edits.sort((a, b) => b.start - a.start || b.end - a.end).forEach(edit => {
                result = result.slice(0, edit.start - offset) + edit.value + result.slice(edit.end - offset);
            });
            if (implicitNative)
                result = intrinsic + '.callNativeBase(this,' + identity + ',' + baseName + ',[]);\n' + result;
            result = this.metadata ? native_source_operations_1.lowerNativeSourceOperations(result, provider, compilerHelpers, unique, this.lexical) : result;
            if (typedLocals)
                result = typedLocals.lower(result, constructor ? this.own.name : namespaceMethods.has(member) ? namespaceMethods.get(member).name : member.name.text, !!member.modifiers && member.modifiers.some((mod) => mod.kind === S.StaticKeyword), this.generated ? localReference : provider, localCoercion, localString, localAddition, intrinsic + '.array', unique, referenceToken, member.kind === S.GetAccessor ? nodeKind_1.default.GET : member.kind === S.SetAccessor ? nodeKind_1.default.SET : nodeKind_1.default.FUNCTION, this.classValueModule ? classValue : undefined, this.generated ? (identity, value) => {
                    const vector = this.generated.options.plan.vectors.find(v => v.identity === identity);
                    if (!vector)
                        this.fail('unplanned Vector local identity');
                    return generatedProperty + '.coerceAS3PropertyValue(' + value + ',{name:' + JSON.stringify(vector.name) + ',vector:' + domainImport + '.' + vector.specExport + '})';
                } : undefined, this.generated ? generatedProperty : undefined, this.generated ? value => domainImport + '.coerceTweenMaxHandle(' + value + ')' : undefined, this.generated ? sourceMethodNode(member, constructor).start : undefined);
            return result;
        };
        const accessorTypes = new Set();
        cls.members.forEach((member) => {
            // A class-level use-namespace directive leaves an empty TS member.
            if (member.kind === S.SemicolonClassElement)
                return;
            const isStatic = member.modifiers && member.modifiers.some((mod) => mod.kind === S.StaticKeyword);
            const destination = isStatic ? name : name + '.prototype';
            if (member.kind === S.Constructor) {
                ctor = member;
                return;
            }
            const namespaced = namespaceMethods.get(member);
            if (!member.name || member.name.kind !== S.Identifier && !namespaced)
                this.fail('computed member identity');
            const key = namespaced ? namespaced.name : member.name.text, lexicalMember = !namespaced && (this.lexical && this.lexical.trait(key, !!isStatic)
                || this.generated && this.generated.lexical.trait(key, !!isStatic));
            const encoded = namespaced ? namespaced.encoded : lexicalMember ? lexicalMember.key : JSON.stringify(key);
            if (!namespaced && key === 'constructor')
                this.fail('reserved constructor member');
            if (!namespaced && isStatic && ['prototype', 'call', 'apply', 'bind'].indexOf(key) >= 0
                && !(this.generated && key !== 'prototype' && member.kind === S.MethodDeclaration
                    && this.generated.projection.staticTraits.some(trait => trait.name === key && trait.kind === 'method')))
                this.fail('reserved static callable constructor identity');
            if (member.kind === S.PropertyDeclaration) {
                if (lexicalMember) {
                    if (lexicalMember.kind === 'constant')
                        return; // Installed before authored effects by the lexical registrar.
                    if (!isStatic && member.initializer && !(this.generated && this.generated.lexical.earlyInstanceValue(lexicalMember) !== undefined))
                        initializers.push(this.generated
                            ? this.generated.lexical.provider + '.as3SetLexicalMember(this,' + lexicalMember.access + ',' + text(member.initializer) + ');'
                            : 'this[' + lexicalMember.key + '] = ' + text(member.initializer) + ';');
                    return;
                }
                const constant = this.generated && this.generated.projection[isStatic ? 'staticTraits' : 'instanceTraits'].find(t => t.name === key && t.uri === (namespaced ? namespaced.uri : undefined) && t.kind === 'constant');
                (isStatic ? staticTypes : instanceTypes).push((constant ? 'readonly ' : '') + (namespaced ? '[' + encoded + ']' : key) + ': ' + type(member) + ';');
                if (constant && !isStatic)
                    return; // Literal storage is installed before all source effects.
                if (constant) {
                    if (!member.initializer)
                        this.fail('generated static constant literal missing');
                    const deferred = this.generated.deferredConstants[native_generated_namespaces_1.generatedMemberIdentity(key, namespaced ? namespaced.uri : undefined)];
                    const constantType = constant.type === 'Array' ? '{name:"Array",reference:' + intrinsic + '.array}'
                        : typeof constant.type === 'string' ? JSON.stringify(constant.type)
                            : '{name:' + JSON.stringify(constant.type.name) + (constant.type.vectorExport ? ',vector:' : ',reference:') + domainImport + '.' + (constant.type.vectorExport || constant.type.referenceExport) + '}';
                    const uintOr = namespaced ? undefined : this.generated.uintOrInitializers.constants[key];
                    definitions.push(deferred ? 'const ' + deferred + '=' + provider + '.declareAS3GeneratedStaticConstant(' + destination + ',' + encoded + ',' + constantType + ');'
                        : provider + '.defineAS3GeneratedStaticConstant(' + destination + ',' + encoded + ','
                            + constantType + ',' + (uintOr === undefined ? text(member.initializer) : uintOr) + ');');
                }
                if (isStatic && !this.generated)
                    definitions.push(intrinsic + '.defineProperty(' + destination + ', ' + encoded
                        + ', {value: ' + (member.initializer ? text(member.initializer) : 'void 0') + ', writable:true, enumerable:true, configurable:false});');
                else if (!isStatic && member.initializer)
                    initializers.push('this[' + encoded + '] = ' + text(member.initializer) + ';');
                return;
            }
            const receiver = isStatic ? constructorType : name;
            let signature = '', returnType;
            if (this.generated && [S.MethodDeclaration, S.GetAccessor, S.SetAccessor].indexOf(member.kind) >= 0) {
                const sourceKind = member.kind === S.GetAccessor ? nodeKind_1.default.GET : member.kind === S.SetAccessor ? nodeKind_1.default.SET : nodeKind_1.default.FUNCTION;
                const sourceMethod = namespaced ? namespaced.node : this.generated.lexical.ownClass.findChild(nodeKind_1.default.CONTENT).children.find(node => {
                    const mods = node.findChild(nodeKind_1.default.MOD_LIST), sourceStatic = !!mods && mods.children.some(mod => mod.text === 'static');
                    return node.kind === sourceKind && node.findChild(nodeKind_1.default.NAME).text === key && sourceStatic === !!isStatic
                        && !native_generated_namespaces_1.generatedMemberUri(this.generated.options.plan, this.own.qname, node);
                });
                const parameters = sourceMethod.findChild(nodeKind_1.default.PARAMETER_LIST).children;
                const fixed = parameters.filter(p => !p.findChild(nodeKind_1.default.REST)), spread = parameters.find(p => !!p.findChild(nodeKind_1.default.REST));
                if (sourceKind !== nodeKind_1.default.FUNCTION && (spread || fixed.length !== (sourceKind === nodeKind_1.default.GET ? 0 : 1) || fixed.some(p => !!p.findChild(nodeKind_1.default.NAME_TYPE_INIT).findChild(nodeKind_1.default.INIT))))
                    this.fail('generated accessor requires exact fixed signature');
                if (spread && parameters[parameters.length - 1] !== spread)
                    this.fail('rest method must be last');
                if (spread && !typedLocals)
                    this.fail('rest method requires typed local storage');
                const minimum = fixed.filter(p => !p.findChild(nodeKind_1.default.NAME_TYPE_INIT).findChild(nodeKind_1.default.INIT)).length;
                const conversions = fixed.map((p, index) => {
                    const value = p.findChild(nodeKind_1.default.NAME_TYPE_INIT), name = value.findChild(nodeKind_1.default.NAME).text, type = value.findChild(nodeKind_1.default.VECTOR) || value.findChild(nodeKind_1.default.TYPE), init = value.findChild(nodeKind_1.default.INIT);
                    if (type && type.kind === nodeKind_1.default.VECTOR && init)
                        this.fail('optional Vector parameter requires qualification');
                    if (!init && index >= minimum)
                        this.fail('required parameter after optional');
                    let fallback = '';
                    if (init) {
                        validateOptionalDefault(this.own.qname, type, init);
                        fallback = 'arguments.length <= ' + index + ' ? ' + text(member.parameters[index].initializer) + ' : ';
                    }
                    if (type && type.text === 'Class') {
                        if (!this.classValueModule)
                            this.fail('Class parameter requires common class provider');
                        return name + '=' + fallback + '<any>' + classValue + '.as3CoerceClass(' + name + ');';
                    }
                    return name + '=' + fallback + '<any>' + generatedProperty + '.coerceAS3PropertyValue(' + name + ',' + this.generated.lexical.typeExpression(type, this.own.qname, domainImport, intrinsic + '.array') + ');';
                });
                // AIR coerces the fixed prefix of a rest method in reverse
                // parameter order, before allocating its fresh untyped tail.
                signature = 'if(arguments.length < ' + minimum + (spread ? '' : ' || arguments.length > ' + fixed.length) + ')throw ' + arityFailure + ';\n'
                    + (spread ? conversions.reverse() : conversions).join('\n')
                    + (spread ? '\nvar ' + spread.findChild(nodeKind_1.default.REST).text + ': any = ' + intrinsic + '.apply(' + intrinsic + '.arraySlice,arguments,[' + fixed.length + ']);\n' : '');
                const returns = sourceMethod.findChild(nodeKind_1.default.VECTOR) || sourceMethod.findChild(nodeKind_1.default.TYPE);
                if (returns && returns.text !== 'void' && returns.text !== '*') {
                    const reference = this.generated.options.plan.references.find(ref => ref.owner === this.own.qname && ref.start === returns.start && ref.end === returns.end);
                    if (reference && reference.kind === 'native' && reference.identity !== 'flash.utils.Dictionary' && reference.identity !== 'flash.net.SharedObject'
                        && !(this.byteArrayReference && reference.identity === 'flash.utils.ByteArray')
                        && !(this.movieClipReference && reference.identity === 'flash.display.MovieClip')
                        && !(this.textFormatReference && reference.identity === 'flash.text.TextFormat')
                        && !(this.accessibilityReference && reference.identity === 'flash.accessibility.AccessibilityImplementation')
                        && !(this.spriteValueReferences && native_reference_coercion_1.nativeSpriteValueReferenceNames.indexOf(reference.identity) >= 0)
                        && !(this.xmlReferences && ['XML', 'XMLList'].indexOf(reference.identity) >= 0)
                        && !(this.loaderReferences && native_reference_coercion_1.nativeLoaderReferenceNames.indexOf(reference.identity) >= 0)
                        && !(this.spriteOwnerReferences && native_reference_coercion_1.nativeSpriteOwnerReferenceNames.indexOf(reference.identity) >= 0)
                        && !(this.interactiveReference && reference.identity === 'flash.display.InteractiveObject')
                        && !(this.containerReference && reference.identity === 'flash.display.DisplayObjectContainer')
                        && !this.generated.options.plan.nativeBindings.some(binding => binding.qname === reference.identity && binding.nativeInterface)
                        && !(reference.identity === 'flash.media.ID3Info' && this.generated.options.plan.nativeBindings.some(binding => binding.qname === reference.identity))
                        && !(reference.identity === 'RegExp' && this.generated.options.plan.nativeBindings.some(binding => binding.qname === 'RegExp' && !binding.nativeInterface))
                        && !(this.bitmapDataReference && reference.identity === 'flash.display.BitmapData')
                        && !(this.bitmapFilterReference && ['flash.filters.BitmapFilter', 'flash.filters.ColorMatrixFilter'].indexOf(reference.identity) >= 0)
                        && !(this.dataEventReference && reference.identity === 'flash.events.DataEvent')
                        && !(this.pointReference && reference.identity === 'flash.geom.Point')
                        && !(this.textFieldReference && reference.identity === 'flash.text.TextField')
                        && !(this.simpleButtonReference && reference.identity === 'flash.display.SimpleButton')
                        && !(this.tabStopReference && reference.identity === 'flash.text.engine.TabStop')
                        && !(this.fontMetricsReference && reference.identity === 'flash.text.engine.FontMetrics')
                        && !(this.textBlockReference && reference.identity === 'flash.text.engine.TextBlock')
                        && !(this.contextMenuClipboardItemsReference && reference.identity === 'flash.ui.ContextMenuClipboardItems')
                        && !(this.elementFormatReference && reference.identity === 'flash.text.engine.ElementFormat')
                        && !(this.textLineReference && reference.identity === 'flash.text.engine.TextLine')
                        && !(this.rectangleReference && reference.identity === 'flash.geom.Rectangle')
                        && !(this.textJustifierReference && ['TextJustifier', 'SpaceJustifier', 'EastAsianJustifier'].some(name => reference.identity === 'flash.text.engine.' + name))
                        && !(this.contentElementReferences && ['ContentElement', 'TextElement', 'GroupElement', 'GraphicElement'].some(type => reference.identity === 'flash.text.engine.' + type))
                        && !(this.dateReference && reference.identity === 'Date')
                        // Canonical display allocation proof also authenticates Sprite
                        // and Shape returns; other native display families remain separately held.
                        && !(this.displayReference && ['flash.display.DisplayObject', 'flash.display.Sprite', 'flash.display.Shape'].indexOf(reference.identity) >= 0) && !(['flash.events.Event', 'flash.events.MouseEvent', 'flash.utils.Proxy'].indexOf(reference.identity) >= 0
                        && this.generated.options.plan.nativeBindings.some(binding => binding.qname === reference.identity && !!binding.nativeBaseExport)))
                        this.fail('generated native return type requires separate qualification');
                    const sourceBody = sourceMethod.findChild(nodeKind_1.default.BLOCK);
                    const inspect = (node, inFinally = false) => {
                        if (node.kind === nodeKind_1.default.FUNCTION || node.kind === nodeKind_1.default.LAMBDA)
                            return;
                        inFinally = inFinally || node.kind === nodeKind_1.default.FINALLY;
                        if (inFinally && (node.kind === nodeKind_1.default.BREAK || node.kind === nodeKind_1.default.CONTINUE))
                            this.fail('generated typed finalizer jumps require separate qualification');
                        if (node.kind === nodeKind_1.default.RETURN && !node.children.length)
                            this.fail('generated typed bare return');
                        node.children.forEach(child => inspect(child, inFinally));
                    };
                    inspect(sourceBody);
                    if (!native_generated_completions_1.generatedMethodCompletes(sourceBody))
                        this.fail('generated typed fallthrough completion requires separate qualification');
                    if (returns.text === 'Class') {
                        if (!this.classValueModule)
                            this.fail('Class return requires common class provider');
                        returnType = '"Class"';
                    }
                    else
                        returnType = this.generated.lexical.typeExpression(returns, this.own.qname, domainImport, intrinsic + '.array');
                }
            }
            const functionValue = 'function(this: ' + receiver + (member.parameters.length ? ', ' : '') + params(member, false)
                + ')' + (member.type ? ': ' + text(member.type) : '') + ' {'
                + (this.lexical ? provider + '.as3CheckArgumentCount(arguments.length,' + member.parameters.length + ',' + member.parameters.length + ');' : '')
                + signature + body(member, false, returnType) + '}';
            if (member.kind === S.MethodDeclaration) {
                // Namespace hooks are selected through the authenticated runtime
                // trait table; do not expose them as public structural members.
                if (!lexicalMember && (!namespaced || namespaced.uri !== native_generated_proxy_1.generatedProxyUri))
                    (isStatic ? staticTypes : instanceTypes).push((namespaced ? '[' + encoded + ']' : key) + '(' + params(member, true) + '): ' + type(member) + ';');
                definitions.push(intrinsic + '.defineProperty(' + destination + ', ' + encoded
                    + ', {value: ' + functionValue + ', writable:true, configurable:true, enumerable:false});');
                if (isStatic && !lexicalMember)
                    staticMethods.push(encoded);
            }
            else if (member.kind === S.GetAccessor || member.kind === S.SetAccessor) {
                const identity = (isStatic ? 'static.' : '') + native_generated_namespaces_1.generatedMemberIdentity(key, namespaced ? namespaced.uri : undefined);
                if (!lexicalMember && !accessorTypes.has(identity)) {
                    const projected = this.generated && this.generated.projection[isStatic ? 'staticTraits' : 'instanceTraits'].find(t => t.kind === 'accessor' && t.name === key && t.uri === (namespaced ? namespaced.uri : undefined));
                    // TS 2.5 cannot express distinct read/write accessor types. The
                    // runtime enforces each source half; the structural surface
                    // must allow the wildcard side in either declaration order.
                    const valueType = projected && projected.setterType !== undefined ? 'any' : member.kind === S.GetAccessor ? type(member) : type(member.parameters[0]);
                    (isStatic ? staticTypes : instanceTypes).push((namespaced ? '[' + encoded + ']' : key) + ': ' + valueType + ';');
                    accessorTypes.add(identity);
                }
                definitions.push(intrinsic + '.defineProperty(' + destination + ', ' + encoded
                    + ', ' + intrinsic + '.assign({}, ' + intrinsic + '.getOwnPropertyDescriptor(' + destination + ', ' + encoded + '), {'
                    + (member.kind === S.GetAccessor ? 'get' : 'set') + ': ' + functionValue + ', configurable:true, enumerable:false}));');
            }
            else
                this.fail('unrecognized complete class member');
        });
        if (!ctor && this.own.base && !(directNativeBase && implicitNativeBase(this.own.base))) {
            // An implicit constructor owns a zero-argument signature and calls
            // its immediate source base with no arguments. The base supplies
            // optional defaults and enters any qualified native ancestor.
            const parent = this.classes.get(this.own.base), root = this.sourceRoots.get(this.own.base);
            if (!this.generated || !parent || !root)
                this.fail('synthesized derived constructor requires complete generated source base');
            if (parent.parameters.some(parameter => !parameter.optional))
                this.fail('synthesized derived constructor requires zero-argument source base entry');
        }
        const chainFields = [];
        for (let current = this.own; current; current = this.classes.get(current.base))
            chainFields.push(...current.fields);
        const memberNames = new Set(), instanceMethods = [];
        for (let current = this.own; current; current = this.classes.get(current.base)) {
            current.instanceMembers.forEach(member => {
                if (this.generated && !this.generated.projection.instanceTraits.some(t => !t.uri && t.name === member.name && t.kind === 'method'))
                    return;
                if (!memberNames.has(member.name)) {
                    memberNames.add(member.name);
                    if (member.method)
                        instanceMethods.push(member.name);
                }
            });
        }
        const bindInstance = instanceMethods.filter(key => !nativeBase || (nativeBase.qname === 'Error' ? ['getStackTrace'] : nativeBase.qname === 'flash.events.EventDispatcher' ? ['addEventListener', 'removeEventListener', 'dispatchEvent', 'hasEventListener', 'willTrigger', 'toString'] : ['clone', 'toString', 'formatToString', 'stopImmediatePropagation', 'preventDefault', 'isDefaultPrevented', 'stopPropagation']).indexOf(key) < 0)
            .map(key => bindName + '(this, ' + JSON.stringify(key) + ');').join('\n')
            + (this.generated ? this.generated.projection.instanceTraits.filter(t => !!t.uri && t.uri !== native_generated_proxy_1.generatedProxyUri && t.kind === 'method').map(t => bindName + '(this,globalThis.Symbol.for(' + JSON.stringify('as3.namespace.member@1:' + JSON.stringify([t.uri, t.name])) + '));').join('\n') : '');
        const defaults = (this.metadata || this.generated ? generation + '.enterInstance(this);\n' : '')
            + (nativeBase ? intrinsic + '.prepareNativeBase(this,' + nativeBaseClass + ');\n' : '')
            + (this.generated ? this.generated.lexical.provider + '.initializeAS3LexicalInstance(' + this.generated.lexical.scope + ',this);\n' : '')
            + (this.lexical ? this.lexical.provider + '.initializeAS3LexicalInstance(' + this.lexical.scope + ',this);\n' : '')
            + (this.generated ? [] : chainFields).map(field => intrinsic + '.defineProperty(this, ' + JSON.stringify(field.name)
                + ', {value:' + field.value + ', writable:true, enumerable:true, configurable:false});').join('\n');
        const ancestry = cls.heritageClauses && cls.heritageClauses.find((clause) => clause.token === S.ExtendsKeyword);
        const base = ancestry ? 'const ' + baseName + ' = ' + intrinsic + '.constructorIdentity(' + (directNativeBase ? nativeBaseClass : text(ancestry.types[0].expression)) + ');\n' : '';
        const sourceBaseName = this.own.base && (directNativeBase ? this.own.base === 'flash.utils.Proxy'
            ? 'Pick<' + nativeBaseClass + ',keyof ' + nativeBaseClass + '>' : nativeBaseClass : this.classes.get(this.own.base).name);
        const constructorBody = ctor ? body(ctor, true) : this.own.base
            ? directNativeBase ? intrinsic + '.callNativeBase(this,' + identity + ',' + baseName + ',[]);'
                : intrinsic + '.expectBase(this,' + identity + ',' + baseName + ');' + intrinsic + '.apply(' + baseName + ',this,[]);' : '';
        const tail = ctor && ctor.body.statements[ctor.body.statements.length - 1];
        const completion = !constructorReturns && tail && tail.kind === S.ThrowStatement ? '' : succeeded + ' = true;';
        const completedBody = constructorReturns ? constructorCompletion + ': {\n' + constructorBody + '\n}' : constructorBody;
        const required = this.own.parameters.filter(parameter => !parameter.optional).length;
        const arity = 'if (arguments.length < ' + required
            + (this.own.usesArguments || this.own.rest ? '' : ' || arguments.length > ' + this.own.parameters.length)
            + ') {throw ' + arityFailure + ';}\n';
        const coercions = this.own.parameters.map((parameter, index) => {
            const value = parameter.name;
            const conversion = parameter.vector
                ? '<any>' + generatedProperty + '.coerceAS3PropertyValue(' + value + ',{name:' + JSON.stringify(parameter.vector.name) + ',vector:' + domainImport + '.' + parameter.vector.specExport + '})'
                : parameter.reference
                    ? '<any>' + generatedProperty + '.coerceAS3PropertyValue(' + value + ',{name:' + JSON.stringify(parameter.reference.identity.replace(/\.([^.]*)$/, '::$1')) + ',reference:' + domainImport + '.' + parameter.reference.exported + '})'
                    : this.generated && parameter.type === 'Class' ? '<any>' + classValue + '.as3CoerceClass(' + value + ')'
                        : this.generated && parameter.type === 'Array' ? '<any>' + generatedProperty + '.coerceAS3PropertyValue(' + value + ',{name:"Array",reference:' + intrinsic + '.array})'
                            : this.generated && parameter.type === 'Function' ? '<any>' + generatedProperty + '.coerceAS3PropertyValue(' + value + ',"Function")'
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
            + (ctor && this.own.parameters.length ? ', ' + (this.generated ? params(ctor, false) : params(ctor, true)) : '') + ')';
        const replacement = (this.lexical ? this.lexical.traits.map(t => 'const ' + t.key + '=' + intrinsic + '.symbol();').join('\n') + '\n' : '')
            + (this.generated ? this.generated.lexical.own.filter(t => t.kind === 'method' || t.kind === 'accessor').map(t => 'const ' + t.key + '=' + intrinsic + '.symbol();').join('\n') + '\n' : '') + base + superMethods.join('\n') + '\nconst ' + name + ': ' + constructorType + ' = function ' + name + constructorParameters + ' {\n'
            + (nativeBase ? 'return ' + intrinsic + '.invokeNativeConstructor(this,' + identity + ',arguments,function' + constructorParameters + ' {\n' : '')
            + 'const ' + fresh + ' = ' + intrinsic + '.enter(this, ' + identity + ');\nlet ' + succeeded + ' = false;\ntry {\n'
            + arity + coercions
            + (this.own.rest ? '\nvar ' + this.own.rest + ': any = ' + intrinsic + '.apply(' + intrinsic + '.arraySlice,arguments,[' + this.own.parameters.length + ']);\n' : '')
            + (this.own.usesArguments ? '\nlet ' + sourceArguments + ': any[] = '
                + intrinsic + '.apply(' + intrinsic + '.arraySlice, arguments, []);\n' : '') + '\nif (' + fresh + ') {\n' + defaults + '\n' + bindInstance + '\n}\n'
            + (this.metadata ? native_source_operations_1.lowerNativeSourceOperations(initializers.join('\n'), provider, compilerHelpers, unique, this.lexical) : initializers.join('\n')) + '\n' + completedBody + '\n' + completion + '\n} finally { '
            + intrinsic + '.leave(this, ' + identity + ', ' + succeeded + '); }\n'
            + (nativeBase ? '});\n' : '') + '} as any;\n'
            + 'const ' + identity + ' = ' + intrinsic + '.constructorIdentity(' + name + ');\n'
            + (this.own.base ? intrinsic + '.setPrototypeOf(' + name + ', ' + baseName + ');\n'
                + name + '.prototype = ' + intrinsic + '.create(' + baseName + '.prototype);\n' : '')
            + intrinsic + '.defineProperty(' + name + '.prototype, "constructor", {value:' + name + ', writable:false, configurable:true});\n'
            + (nativeBase ? intrinsic + '.registerNativeBase(' + nativeBaseClass + ',' + domainImport + '.' + nativeBase.nativeBaseExport + ');\n' : '')
            + intrinsic + '.register(' + identity + ', ' + (this.own.base ? baseName : 'null') + ');\n'
            + definitions.join('\n') + '\n'
            + staticMethods.map(key => bindName + '(' + name + ', ' + key + ');').join('\n')
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
                + this.generated.projection.emitDefinition(domainImport, intrinsic + '.array', baseName) + ');\n'
                + this.generated.lexical.publication(identity, baseName, domainImport, intrinsic) + '\n'
                + Object.keys(this.generated.uintOrInitializers.variables).map(key => generatedProperty + '.as3SetProperty(' + name + ',' + JSON.stringify(key) + ',' + this.generated.uintOrInitializers.variables[key] + ');\n').join('')
                + (this.classValueModule ? classValue + '.registerAS3Constructor(' + identity + ', {minimum:' + required + ',maximum:' + (this.own.usesArguments || this.own.rest ? 'Infinity' : this.own.parameters.length) + ',coerceArguments:(values:any)=>values});\n' : '')
                : '');
        const surface = 'export interface ' + name + (sourceBaseName ? ' extends ' + sourceBaseName : '')
            + ' {\n' + instanceTypes.join('\n') + '\n}\ninterface ' + constructorType
            + ' extends ' + functionType + ' {new(' + (ctor ? params(ctor, true) : '') + '): ' + name + '; prototype: ' + name + ';\n'
            + staticTypes.join('\n') + '\n}';
        const replacements = [{ start: cls.getStart(file), end: cls.end, value: replacement },
            { start: alias.getStart(file), end: alias.end, value: surface }];
        if (this.generated && this.generated.projection.binding.scriptGlobalExport) {
            // The defining global must exist throughout Class creation, including
            // registration and callbacks. Publish the Class only after the whole
            // lazy factory succeeds; the selected common provider owns failed
            // unit lifetime (retained for explicit single-Class script units).
            const body = cls.parent;
            if (body.kind !== S.Block || body.parent.kind !== S.ArrowFunction
                || !body.statements.length || body.statements[body.statements.length - 1].kind !== S.ReturnStatement)
                this.fail('lazy script factory body required for publication');
            replacements.push({ start: body.getStart(file) + 1, end: body.getStart(file) + 1,
                value: '\nreturn ' + domainImport + '.' + this.generated.projection.binding.scriptGlobalExport
                    + '((' + this.generated.lexical.scriptGlobal + ':object)=>{\n' });
            replacements.push({ start: body.end - 1, end: body.end - 1, value: '\n});\n' });
        }
        if (this.metadata) {
            const statements = cls.parent.statements;
            if (!statements)
                this.fail('lazy native factory body required for publication');
            const index = statements.indexOf(cls);
            const finalize = statements[index + 1];
            if (!finalize || finalize.kind !== S.ExpressionStatement || finalize.expression.kind !== S.BinaryExpression
                || finalize.expression.right.kind !== S.CallExpression)
                this.fail('lazy final identity publication marker');
            for (let i = index + 2; i < statements.length; i++) {
                const statement = statements[i];
                if (statement.kind === S.ReturnStatement)
                    break;
                replacements.push({ start: statement.getStart(file), end: statement.end,
                    value: native_source_operations_1.lowerNativeSourceOperations(text(statement), provider, compilerHelpers, unique, this.lexical) });
            }
        }
        replacements.sort((a, b) => b.start - a.start).forEach(edit => source = source.slice(0, edit.start) + edit.value + source.slice(edit.end));
        // Local declaration annotations have become token references. AS3 imports
        // do not execute Class initialization; erase only now-unused named source
        // declaration imports, so two qualified namesakes cannot leave duplicate
        // TypeScript bindings. Any surviving value/type identifier keeps its import.
        if (this.declarationDomain || this.generated) {
            const output = ts.createSourceFile('DomainImports.ts', source, ts.ScriptTarget.Latest, true);
            if (output.parseDiagnostics.length)
                this.fail('domain import intermediate syntax');
            const used = new Set(), imports = [];
            const collect = (node) => {
                if (node.kind === S.ImportDeclaration) {
                    imports.push(node);
                    return;
                }
                if (node.kind === S.Identifier)
                    used.add(node.text);
                ts.forEachChild(node, collect);
            };
            collect(output);
            const sourceNames = new Set((this.declarationDomain ? this.declarationDomain.bindings : this.generated.options.plan.bindings).map(binding => binding.qname.split('.').pop()));
            const erased = imports.filter(node => node.importClause && !node.importClause.name
                && node.importClause.namedBindings && node.importClause.namedBindings.kind === S.NamedImports
                && node.importClause.namedBindings.elements.length === 1
                && sourceNames.has(node.importClause.namedBindings.elements[0].name.text)
                && !node.importClause.namedBindings.elements[0].propertyName
                && node.moduleSpecifier.text.split('/').pop() === node.importClause.namedBindings.elements[0].name.text
                && !used.has(node.importClause.namedBindings.elements[0].name.text));
            erased.sort((a, b) => b.getStart(output) - a.getStart(output)).forEach(node => {
                source = source.slice(0, node.getStart(output)) + source.slice(node.end);
            });
        }
        const boundImport = file.statements.find((node) => node.kind === S.ImportDeclaration && /(?:^|\/)bound$/.test(node.moduleSpecifier.text));
        const helperPath = boundImport ? boundImport.moduleSpecifier.text : './bound';
        return (this.lexical ? 'import * as ' + this.lexical.provider + ' from ' + JSON.stringify(this.lexical.module) + ';\n' : '')
            + (this.generated ? 'import * as ' + provider + ' from ' + JSON.stringify(this.generated.registrar) + ';\n'
                + 'import * as ' + this.generated.lexical.provider + ' from ' + JSON.stringify(this.generated.lexicalModule) + ';\n'
                + 'import * as ' + generatedProperty + ' from ' + JSON.stringify(this.generated.propertyModule) + ';\n'
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
            + (argumentCountError ? 'import {createAS3ArgumentCountError as ' + argumentCountError + '} from ' + JSON.stringify(this.sourceErrorModule) + ';\n' : '')
            + (this.classValueModule ? 'import * as ' + classValue + ' from ' + JSON.stringify(this.classValueModule) + ';\n' : '')
            + 'import {bindAS3Method as ' + bindName + '} from '
            + JSON.stringify(this.methodBindingModule) + ';\n'
            + (this.own.parameters.some(parameter => ['Number', 'int', 'uint'].indexOf(parameter.type) >= 0)
                ? 'import {as3CoerceNumber as ' + numberCoercion + ', as3CoerceInt as ' + intCoercion
                    + ', as3CoerceUint as ' + uintCoercion + '} from ' + JSON.stringify(this.coercionModule) + ';\n' : '')
            + (this.own.parameters.some(parameter => parameter.type === 'String')
                ? 'import {as3CoerceString as ' + stringCoercion + '} from ' + JSON.stringify(this.stringModule) + ';\n' : '')
            + source;
    }
    lexicalPublication(name, intrinsic) {
        const lexical = this.lexical;
        const specs = lexical.traits.map(t => '{name:' + JSON.stringify(t.name) + ',visibility:' + JSON.stringify(t.visibility)
            + ',static:' + t.static + ',kind:' + JSON.stringify(t.kind)
            + (t.kind === 'method' ? ',key:' + t.key + ',parameterCount:' + t.parameterCount
                : ',type:' + (t.type === 'Array' ? '{name:"Array",reference:' + intrinsic + '.array}' : JSON.stringify(t.type || '*'))) + '}');
        return 'const ' + lexical.scope + '=' + lexical.provider + '.registerAS3LexicalMembers(' + name + ',null,[' + specs.join(',') + ']);\n'
            + lexical.traits.map(t => 'const ' + t.access + '=' + lexical.provider + '.resolveAS3LexicalMember(' + lexical.scope + ','
                + JSON.stringify(t.name) + ',' + JSON.stringify(t.visibility) + ',' + t.static + ');').join('\n') + '\n';
    }
    /** Bind authenticated reference storage without resolving authored names at runtime. */
    emitPropertyTraits(traits, declaration, intrinsic) {
        const name = this.metadata.classes[this.own.qname].metadata.name;
        return '[' + traits.map(trait => {
            const reference = trait.type === name ? declaration + '.type'
                : trait.type === 'Array' ? intrinsic + '.array' : null;
            if (!reference)
                return JSON.stringify(trait);
            const fields = Object.keys(trait).filter(key => key !== 'type')
                .map(key => JSON.stringify(key) + ':' + JSON.stringify(trait[key]));
            fields.push('"type":{name:' + JSON.stringify(trait.type) + ',reference:' + reference + '}');
            return '{' + fields.join(',') + '}';
        }).join(',') + ']';
    }
}
exports.NativeCallableClasses = NativeCallableClasses;
//# sourceMappingURL=native-callable-classes.js.map