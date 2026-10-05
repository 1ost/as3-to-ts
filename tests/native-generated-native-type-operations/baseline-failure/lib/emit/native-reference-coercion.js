"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const native_builtin_numeric_constants_1 = require("./native-builtin-numeric-constants");
const native_generated_declarations_1 = require("./native-generated-declarations");
const native_numeric_product_constant_1 = require("./native-numeric-product-constant");
const native_uint_or_constants_1 = require("./native-uint-or-constants");
const node_1 = require("../syntax/node");
const nodeKind_1 = require("../syntax/nodeKind");
const native_generated_declarations_2 = require("./native-generated-declarations");
const native_generated_emission_1 = require("./native-generated-emission");
exports.nativeLoaderReferenceNames = Object.freeze(['flash.display.Loader', 'flash.display.Bitmap', 'flash.net.URLLoader', 'flash.media.Sound']);
exports.nativeSpriteOwnerReferenceNames = Object.freeze(['flash.display.LoaderInfo', 'flash.ui.ContextMenu', 'flash.display.Stage']);
exports.nativeSpriteValueReferenceNames = Object.freeze(['flash.geom.Transform', 'flash.media.SoundTransform', 'flash.accessibility.AccessibilityProperties', 'flash.text.TextSnapshot']);
const functions = [nodeKind_1.default.FUNCTION, nodeKind_1.default.LAMBDA, nodeKind_1.default.GET, nodeKind_1.default.SET];
function fail(reason) { throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: ' + reason); }
/** Exact source bindings, distinct from TS structural type assertions. */
class NativeReferenceCoercion {
    constructor(source, options, generated, nativeDate = false, stringLocals = false, nativeEvent = false, nativeXML = [], nativeDisplayObject = false, nativeByteArray = false, nativeMovieClip = false, nativeTextFormat = false, nativeInteractiveObject = false, nativeAccessibility = false, nativeSpriteValues = false, nativeSpriteOwners = false, nativeLoaders = false, declarationIdentity, nativeDisplayObjectContainer = false, nativeErrorEventSubtypes = false, nativeTextJustifiers = false, nativeTextField = false, nativeDataEvent = false, nativeColorTransform = false, nativeDictionary = false, nativeContentElements = false, nativeTextBlock = false) {
        this.options = options;
        this.generated = generated;
        this.declarations = new Map();
        this.constantDeclarations = new Map();
        this.scopes = new Map();
        this.signatures = new Map();
        if (!options || Object.keys(options).some(key => ['plan', 'module', 'coercionModule'].indexOf(key) < 0))
            fail('exact plan/module/coercion configuration required');
        native_generated_emission_1.generatedModule(options.module);
        native_generated_emission_1.generatedModule(options.coercionModule);
        if (declarationIdentity !== undefined && !generated)
            fail('declaration selection requires generated implementation');
        const consumer = declarationIdentity === undefined ? native_generated_declarations_2.nativeGeneratedConsumerResolver(options.plan, source)
            : native_generated_declarations_2.nativeGeneratedDeclarationResolver(options.plan, declarationIdentity, source);
        this.root = consumer.root;
        this.owner = consumer.owner;
        this.resolve = consumer.resolve;
        // Inspect only this implementation, while keeping the complete original
        // AST (and its package/file imports) available to the emitter.
        const selected = declarationIdentity === undefined ? this.root : native_generated_declarations_2.nativeGeneratedDeclarationNode(options.plan, declarationIdentity);
        const walk = (node, fn) => {
            if (functions.indexOf(node.kind) >= 0) {
                if (fn && !generated)
                    fail('nested consumer functions require lexical scope qualification');
                fn = node;
                this.scopes.set(fn.start, new Map());
                const type = node.findChild(nodeKind_1.default.TYPE);
                if (!generated) {
                    const returned = type && this.type(type.qualifiedName || type.text);
                    const list = node.findChild(nodeKind_1.default.PARAMETER_LIST);
                    const parameters = list ? list.children.map(parameter => {
                        const value = parameter.findChild(nodeKind_1.default.NAME_TYPE_INIT), t = value && value.findChild(nodeKind_1.default.TYPE);
                        const name = value && value.findChild(nodeKind_1.default.NAME);
                        return { node: value, name: name && name.text, type: t ? this.resolve(t.qualifiedName || t.text) : '*',
                            exported: t && this.type(t.qualifiedName || t.text), optional: !!(value && value.findChild(nodeKind_1.default.INIT)) };
                    }) : [];
                    if (returned || parameters.some(p => !!p.exported)) {
                        if (node.kind !== nodeKind_1.default.FUNCTION || node.findChild(nodeKind_1.default.NAME).text === this.owner.split('.').pop())
                            fail('reference constructor/accessor signatures require separate qualification');
                        if (returned && this.resolve(type.qualifiedName || type.text) === 'Date' && !nativeDate)
                            fail('Date reference requires its explicit native global binding');
                        const resultType = type && this.resolve(type.qualifiedName || type.text);
                        const builtinReturn = !returned && ['Number', 'int', 'uint', 'Boolean', 'String', 'Object', 'Array'].indexOf(resultType) >= 0 ? resultType : null;
                        if (type && !returned && !builtinReturn && ['void', '*'].indexOf(resultType) < 0)
                            fail('non-reference return conversion in reference signatures requires qualification');
                        let optional = false;
                        parameters.forEach(p => {
                            if (!p.node)
                                fail('reference signatures with rest parameters require qualification');
                            if (p.name === 'arguments')
                                fail('shadowed arguments in reference signatures');
                            if (!p.exported && ['*', 'Number', 'int', 'uint', 'String', 'Object'].indexOf(p.type) < 0)
                                fail('unqualified mixed reference parameter: ' + p.type);
                            if (optional && !p.optional)
                                fail('required parameter follows optional parameter');
                            optional = optional || p.optional;
                            if (p.optional && p.type === 'Object') {
                                const init = p.node.findChild(nodeKind_1.default.INIT);
                                if (source.slice(init.start, init.end).trim() !== 'null')
                                    fail('Object parameter default requires literal null');
                            }
                            if (p.optional && (p.exported || p.type === '*')) {
                                const init = p.node.findChild(nodeKind_1.default.INIT);
                                if (!p.exported || source.slice(init.start, init.end).trim() !== 'null')
                                    fail('reference parameter default must be literal null');
                            }
                        });
                        this.signatures.set(node.start, { node, returned, builtinReturn, parameters, argumentsUsed: false });
                    }
                }
            }
            if (node.kind === nodeKind_1.default.NAME_TYPE_INIT) {
                const name = node.findChild(nodeKind_1.default.NAME).text, type = node.findChild(nodeKind_1.default.TYPE);
                const exported = type && this.type(type.qualifiedName || type.text);
                if (exported && this.resolve(type.qualifiedName || type.text) === 'Date' && !nativeDate)
                    fail('Date reference requires its explicit native global binding');
                if (exported && !fn && !generated)
                    fail('reference field storage requires generated class registration');
                if (fn) {
                    const stringLocal = stringLocals && !generated && node.parent.kind !== nodeKind_1.default.PARAMETER
                        && type && this.resolve(type.qualifiedName || type.text) === 'String';
                    const objectParameter = !generated && node.parent.kind === nodeKind_1.default.PARAMETER && !!this.signature(node)
                        && type && this.resolve(type.qualifiedName || type.text) === 'Object';
                    if (stringLocal)
                        for (let parent = node.parent; parent && parent !== fn; parent = parent.parent) {
                            if (parent.kind === nodeKind_1.default.CATCH && parent.children.some(child => child.kind === nodeKind_1.default.NAME && child.text === name))
                                fail('String declaration shadows catch storage');
                        }
                    const scope = this.scopes.get(fn.start);
                    // Generated locals (including repeated declarations) belong to
                    // NativeTypedLocals; keep parameter storage conflicts here.
                    if (scope.has(name) && (scope.get(name) || (exported || stringLocal || objectParameter) && (!generated || node.parent.kind === nodeKind_1.default.PARAMETER)))
                        fail('duplicate local declaration requires default-order authority: ' + name);
                    if ((exported || stringLocal) && [nodeKind_1.default.CONST, nodeKind_1.default.CONST_LIST].indexOf(node.parent.kind) >= 0)
                        fail('reference local constant lowering required');
                    let header = false;
                    for (let value = node; value && value !== fn; value = value.parent) {
                        const parent = value.parent;
                        if (parent && [nodeKind_1.default.FORIN, nodeKind_1.default.FOREACH].indexOf(parent.kind) >= 0 && parent.children[0] === value)
                            header = true;
                    }
                    // Generated method storage is lowered once by NativeTypedLocals.
                    const local = (exported || stringLocal || objectParameter) && (!generated || node.parent.kind === nodeKind_1.default.PARAMETER) ? { node, name, exported, header, parameter: node.parent.kind === nodeKind_1.default.PARAMETER, stringLocal, objectParameter } : null;
                    scope.set(name, local);
                    if (local)
                        this.declarations.set(node.start, local);
                }
            }
            node.children.forEach(child => walk(child, fn));
        };
        walk(selected, null);
        const guard = (node) => {
            const signature = this.signature(node);
            if (signature && node.kind === nodeKind_1.default.NAME_TYPE_INIT && node.findChild(nodeKind_1.default.NAME).text === 'arguments')
                fail('shadowed arguments in reference signatures');
            if (signature && node.kind === nodeKind_1.default.CATCH && node.children.some(child => child.kind === nodeKind_1.default.NAME && child.text === 'arguments'))
                fail('shadowed arguments in reference signatures');
            if (signature && node.kind === nodeKind_1.default.RETURN && (signature.returned || signature.builtinReturn) && !node.children.length)
                fail('bare reference return requires source authority');
            if (signature && node.kind === nodeKind_1.default.IDENTIFIER && node.text === 'arguments') {
                const parent = node.parent;
                const index = parent && parent.kind === nodeKind_1.default.ARRAY_ACCESSOR && parent.children[0] === node;
                const length = parent && parent.kind === nodeKind_1.default.DOT && parent.children[0] === node && parent.children[1].text === 'length';
                if (!index && !length)
                    fail('escaping or method-valued arguments requires source Array qualification');
                const target = node_1.outerEncapsulatedExpression(parent), operation = target && target.parent;
                if (length && operation && operation.children[0] === target && [nodeKind_1.default.ASSIGN, nodeKind_1.default.PRE_INC, nodeKind_1.default.PRE_DEC, nodeKind_1.default.POST_INC, nodeKind_1.default.POST_DEC, nodeKind_1.default.DELETE].indexOf(operation.kind) >= 0)
                    fail('arguments length mutation requires source Array qualification');
                if (index) {
                    const key = parent.children[1];
                    const literal = key && source.slice(key.start, key.end).trim();
                    if (!literal || !/^(0|[1-9][0-9]*)$/.test(literal))
                        fail('arguments indexing requires an exact nonnegative integer literal');
                    if (operation && operation.children[0] === target &&
                        [nodeKind_1.default.ASSIGN, nodeKind_1.default.PRE_INC, nodeKind_1.default.PRE_DEC, nodeKind_1.default.POST_INC, nodeKind_1.default.POST_DEC, nodeKind_1.default.DELETE].indexOf(operation.kind) >= 0) {
                        const count = signature.parameters.filter(p => !p.optional).length;
                        if (operation.kind !== nodeKind_1.default.ASSIGN || operation.children[1].text !== '=' || Number(literal) >= count)
                            fail('arguments mutation requires an existing required entry and simple assignment');
                    }
                }
                signature.argumentsUsed = true;
            }
            if ([nodeKind_1.default.PRE_INC, nodeKind_1.default.PRE_DEC, nodeKind_1.default.POST_INC, nodeKind_1.default.POST_DEC, nodeKind_1.default.DELETE].indexOf(node.kind) >= 0) {
                const target = node_1.unwrapEncapsulatedExpression(node.children[0]);
                if (target && target.kind === nodeKind_1.default.IDENTIFIER && this.local(target, target.text))
                    fail('reference update/delete requires separate lowering');
            }
            if (node.kind === nodeKind_1.default.EXTENDS && this.sourceClass(node.qualifiedName || node.text) && !generated)
                fail('source reference ancestry requires generated class registration');
            if (node.kind === nodeKind_1.default.IMPLEMENTS_LIST && !generated && node.children.some(child => !!this.sourceInterface(child.qualifiedName || child.text)))
                fail('source interface implementation requires generated class registration');
            if ([nodeKind_1.default.AS, nodeKind_1.default.RELATION].indexOf(node.kind) >= 0 && node.children.some(child => child.kind === nodeKind_1.default.TYPE && !!this.type(child.qualifiedName || child.text)))
                fail('reference type operation requires class-evaluation authority');
            const nativeDateTest = nativeDate && node.kind === nodeKind_1.default.RELATION && node.children.some(child => child.text === 'is')
                && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
                && this.resolve(node.lastChild.qualifiedName || node.lastChild.text) === 'Date'
                && options.plan.nativeBindings.some(binding => binding.qname === 'Date');
            const nativeXMLTest = generated && node.kind === nodeKind_1.default.RELATION && node.children.some(child => child.text === 'is')
                && node.lastChild.kind === nodeKind_1.default.IDENTIFIER && nativeXML.indexOf(this.resolve(node.lastChild.text)) >= 0
                && options.plan.nativeBindings.some(binding => binding.qname === this.resolve(node.lastChild.text));
            const nativeEventTest = nativeEvent && generated && node.kind === nodeKind_1.default.RELATION && node.children.some(child => child.text === 'is')
                && node.lastChild.kind === nodeKind_1.default.IDENTIFIER && this.resolve(node.lastChild.text) === 'flash.events.Event'
                && options.plan.nativeBindings.some(binding => binding.qname === 'flash.events.Event' && !!binding.eventBaseExport);
            const nativeProxyTest = generated && node.kind === nodeKind_1.default.RELATION && node.children.length === 3
                && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
                && this.resolve(node.lastChild.text) === 'flash.utils.Proxy'
                && options.plan.nativeBindings.some(binding => binding.qname === 'flash.utils.Proxy' && !!binding.nativeBaseExport);
            const nativeRegExpTest = generated && node.kind === nodeKind_1.default.RELATION && node.children.length === 3
                && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
                && this.resolve(node.lastChild.text) === 'RegExp'
                && options.plan.nativeBindings.some(binding => binding.qname === 'RegExp' && !binding.nativeInterface);
            const sourceAs = generated && node.kind === nodeKind_1.default.RELATION && node.children.length === 3
                && node.children[1].kind === nodeKind_1.default.AS && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
                && (this.sourceClass(node.lastChild.text) || !!this.sourceInterface(node.lastChild.text));
            // Interface membership uses the authenticated declaration token;
            // it does not require admitting the consumer as a source Class.
            const interfaceTest = node.kind === nodeKind_1.default.RELATION && node.children.length === 3
                && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
                && !!this.sourceInterface(node.lastChild.text);
            const sourceIs = generated && node.kind === nodeKind_1.default.RELATION && node.children.length === 3
                && node.children[1].text === 'is' && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
                && (!!this.sourceClass(node.lastChild.text) || !!this.nativeInterface(node.lastChild.text));
            const displayTest = node.kind === nodeKind_1.default.RELATION && node.children.length === 3
                && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
                && ((nativeDisplayObject && ['flash.display.DisplayObject', 'flash.display.Sprite'].indexOf(this.resolve(node.lastChild.text)) >= 0)
                    || (nativeDisplayObjectContainer && this.resolve(node.lastChild.text) === 'flash.display.DisplayObjectContainer')
                    || (nativeMovieClip && this.resolve(node.lastChild.text) === 'flash.display.MovieClip')
                    || (nativeTextFormat && this.resolve(node.lastChild.text) === 'flash.text.TextFormat')
                    || (nativeTextField && this.resolve(node.lastChild.text) === 'flash.text.TextField')
                    || (nativeAccessibility && this.resolve(node.lastChild.text) === 'flash.accessibility.AccessibilityImplementation')
                    || (nativeSpriteValues && exports.nativeSpriteValueReferenceNames.indexOf(this.resolve(node.lastChild.text)) >= 0)
                    || (nativeLoaders && exports.nativeLoaderReferenceNames.indexOf(this.resolve(node.lastChild.text)) >= 0)
                    || (nativeSpriteOwners && exports.nativeSpriteOwnerReferenceNames.indexOf(this.resolve(node.lastChild.text)) >= 0)
                    || (nativeInteractiveObject && this.resolve(node.lastChild.text) === 'flash.display.InteractiveObject'));
            const byteArrayTest = nativeByteArray && generated && node.kind === nodeKind_1.default.RELATION && node.children.length === 3
                && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
                && this.resolve(node.lastChild.text) === 'flash.utils.ByteArray';
            const dictionaryTest = nativeDictionary && generated && node.kind === nodeKind_1.default.RELATION && node.children.length === 3
                && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
                && this.resolve(node.lastChild.text) === 'flash.utils.Dictionary';
            const justifierTest = nativeTextJustifiers && generated && node.kind === nodeKind_1.default.RELATION && node.children.length === 3
                && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
                && ['TextJustifier', 'SpaceJustifier', 'EastAsianJustifier'].some(name => this.resolve(node.lastChild.text) === 'flash.text.engine.' + name);
            const contentElementTest = nativeContentElements && generated && node.kind === nodeKind_1.default.RELATION && node.children.length === 3
                && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
                && ['ContentElement', 'TextElement', 'GroupElement', 'GraphicElement'].some(name => this.resolve(node.lastChild.text) === 'flash.text.engine.' + name);
            const textBlockTest = nativeTextBlock && generated && node.kind === nodeKind_1.default.RELATION && node.children.length === 3
                && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
                && this.resolve(node.lastChild.text) === 'flash.text.engine.TextBlock';
            if (nativeColorTransform && node.kind === nodeKind_1.default.CALL && node.children[0].kind === nodeKind_1.default.IDENTIFIER
                && this.resolve(node.children[0].text) === 'flash.geom.ColorTransform')
                fail('ColorTransform construction/cast requires separate Class authority');
            const colorTransformTest = nativeColorTransform && generated && node.kind === nodeKind_1.default.RELATION && node.children.length === 3
                && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
                && this.resolve(node.lastChild.text) === 'flash.geom.ColorTransform';
            const dataEventTest = nativeDataEvent && generated && node.kind === nodeKind_1.default.RELATION && node.children.length === 3
                && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
                && this.resolve(node.lastChild.text) === 'flash.events.DataEvent';
            const errorEventSubtypeTest = nativeErrorEventSubtypes && generated && node.kind === nodeKind_1.default.RELATION && node.children.length === 3
                && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
                && ['flash.events.IOErrorEvent', 'flash.events.SecurityErrorEvent'].indexOf(this.resolve(node.lastChild.text)) >= 0;
            if (node.kind === nodeKind_1.default.RELATION && node.children.some(child => child.text === 'as' || child.text === 'is')
                && this.type(node.lastChild.qualifiedName || node.lastChild.text) && !nativeRegExpTest && !nativeDateTest && !nativeEventTest && !nativeProxyTest && !nativeXMLTest && !sourceAs && !sourceIs && !interfaceTest && !displayTest && !byteArrayTest && !dictionaryTest && !errorEventSubtypeTest && !justifierTest && !contentElementTest && !textBlockTest && !dataEventTest && !colorTransformTest)
                fail('reference type operation requires class-evaluation authority: ' + this.resolve(node.lastChild.qualifiedName || node.lastChild.text) + ' at offset ' + node.start);
            if (node.kind === nodeKind_1.default.DOT) {
                const qualified = (value) => value.kind === nodeKind_1.default.IDENTIFIER ? value.text
                    : value.kind === nodeKind_1.default.DOT && value.children[1].kind === nodeKind_1.default.LITERAL
                        ? qualified(value.children[0]) + '.' + value.children[1].text : '';
                const name = qualified(node);
                if (name && options.plan.bindings.some(binding => binding.qname === name))
                    fail('qualified reference class value requires source binding resolution');
            }
            if (node.kind === nodeKind_1.default.NEW) {
                const expression = node_1.unwrapEncapsulatedExpression(node.children[0]);
                const target = expression && expression.kind === nodeKind_1.default.CALL ? expression.children[0] : expression;
                if (target && target.kind === nodeKind_1.default.IDENTIFIER && this.sourceInterface(target.text))
                    fail('an interface token is not a source constructor');
            }
            node.children.forEach(guard);
        };
        guard(selected);
    }
    signature(node) {
        for (let value = node; value; value = value.parent) {
            if (functions.indexOf(value.kind) >= 0)
                return this.signatures.get(value.start);
        }
        return null;
    }
    type(name) {
        if (!name)
            return null;
        const identity = this.resolve(name), plan = this.options.plan;
        const contract = native_generated_declarations_1.nativeGeneratedInterfaceBindings(plan).find(binding => binding.qname === identity);
        if (contract) {
            // Ordinary method boundaries use the same authenticated nominal token.
            // This does not publish the consumer itself as an interface implementer.
            return contract.tokenExport;
        }
        const source = plan.bindings.find(binding => binding.qname === identity);
        const helper = plan.privateBindings.find(binding => binding.identity === identity);
        const native = plan.nativeBindings.find(binding => binding.qname === identity);
        return source ? source.tokenExport : helper ? helper.tokenExport : native ? native.referenceExport : null;
    }
    literalStaticConstant(name, member) {
        const identity = this.resolve(name), plan = this.options.plan;
        if (!this.sourceClass(name))
            return null;
        const input = native_generated_declarations_2.nativeGeneratedDeclarationInputs(plan, plan.scope), source = input.sources[native_generated_declarations_2.nativeGeneratedClassDeclaration(plan, identity).sourceOwner].source;
        let declaration = this.constantDeclarations.get(identity);
        if (!declaration) {
            declaration = native_generated_declarations_2.nativeGeneratedDeclarationNode(plan, identity);
            this.constantDeclarations.set(identity, declaration);
        }
        for (const group of declaration.findChild(nodeKind_1.default.CONTENT).children) {
            if (group.kind !== nodeKind_1.default.CONST_LIST)
                continue;
            const mods = group.findChild(nodeKind_1.default.MOD_LIST), flags = mods ? mods.children.map(mod => mod.text) : [];
            if (flags.indexOf('public') < 0 || flags.indexOf('static') < 0 || flags.some(flag => ['public', 'static'].indexOf(flag) < 0))
                continue;
            const value = group.findChildren(nodeKind_1.default.NAME_TYPE_INIT).find(field => field.findChild(nodeKind_1.default.NAME).text === member);
            if (!value)
                continue;
            const type = value.findChild(nodeKind_1.default.TYPE), init = value.findChild(nodeKind_1.default.INIT);
            if (!type || !init || value.findChild(nodeKind_1.default.VECTOR))
                fail('consumer constant requires a primitive literal declaration');
            if (['String', 'Number', 'int', 'uint', 'Boolean'].indexOf(type.text) < 0) {
                const reference = plan.references.find(item => item.owner === identity && item.start === type.start && item.end === type.end);
                if (!this.generated || !reference || reference.kind !== 'declaration' && reference.kind !== 'private-declaration'
                    && !(reference.kind === 'intrinsic' && ['Object', 'Array'].indexOf(reference.identity) >= 0))
                    fail('consumer constant requires a primitive literal declaration');
                return { type: type.text, literal: null };
            }
            const end = (node) => node.children.reduce((last, child) => Math.max(last, end(child)), Math.max(node.start, node.end));
            const literal = source.slice(init.start, end(init)).trim();
            const builtin = native_builtin_numeric_constants_1.nativeBuiltinNumericConstants(plan, identity, source)[member];
            if (builtin !== undefined)
                return { type: type.text, literal: builtin };
            const uintOr = native_uint_or_constants_1.nativeUintOrConstants(declaration, source).constants[member];
            if (uintOr !== undefined)
                return { type: type.text, literal: uintOr };
            if (!/^(?:null|true|false|[+-]?(?:0[xX][0-9a-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)|"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*')$/.test(literal) && !native_numeric_product_constant_1.nativeNumericProductConstant(literal, type.text))
                fail('computed consumer constant requires initialization authority');
            return { type: type.text, literal: literal.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') };
        }
        return null;
    }
    publicStaticMethod(name, member) {
        const identity = this.resolve(name), plan = this.options.plan;
        if (!this.sourceClass(name))
            return false;
        let declaration = this.constantDeclarations.get(identity);
        if (!declaration) {
            declaration = native_generated_declarations_2.nativeGeneratedDeclarationNode(plan, identity);
            this.constantDeclarations.set(identity, declaration);
        }
        return declaration.findChild(nodeKind_1.default.CONTENT).children.some(node => {
            if (node.kind !== nodeKind_1.default.FUNCTION || node.findChild(nodeKind_1.default.NAME).text !== member)
                return false;
            const mods = node.findChild(nodeKind_1.default.MOD_LIST), flags = mods ? mods.children.map(mod => mod.text) : [];
            return flags.indexOf('public') >= 0 && flags.indexOf('static') >= 0
                && flags.every(flag => ['public', 'static', 'final'].indexOf(flag) >= 0);
        });
    }
    sourceClass(name) {
        const identity = this.resolve(name);
        return this.options.plan.bindings.some(binding => binding.qname === identity)
            || this.options.plan.privateBindings.some(binding => binding.identity === identity);
    }
    sourceInterface(name) {
        const identity = this.resolve(name);
        const binding = native_generated_declarations_1.nativeGeneratedInterfaceBindings(this.options.plan).find(item => item.qname === identity);
        return binding ? binding.tokenExport : this.nativeInterface(name);
    }
    nativeInterface(name) {
        const identity = this.resolve(name);
        const native = this.options.plan.nativeBindings.find(item => item.qname === identity && item.nativeInterface);
        return native ? native.referenceExport : null;
    }
    declaration(node) { return node && this.declarations.get(node.start); }
    local(node, name) {
        for (let value = node; value; value = value.parent) {
            const scope = functions.indexOf(value.kind) >= 0 && this.scopes.get(value.start);
            if (scope && scope.has(name))
                return scope.get(name);
            if (value.kind === nodeKind_1.default.CATCH && value.children.some(child => child.kind === nodeKind_1.default.NAME && child.text === name))
                return null;
        }
        return null;
    }
    defaults(block) {
        const scope = block.parent && functions.indexOf(block.parent.kind) >= 0 && this.scopes.get(block.parent.start);
        return scope ? Array.from(scope.values()).filter(local => local && !local.header && !local.parameter) : [];
    }
}
exports.NativeReferenceCoercion = NativeReferenceCoercion;
//# sourceMappingURL=native-reference-coercion.js.map