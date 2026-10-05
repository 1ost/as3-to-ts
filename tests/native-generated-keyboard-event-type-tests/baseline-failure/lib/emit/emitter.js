"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const native_generated_proxy_1 = require("./native-generated-proxy");
const native_generated_namespaces_1 = require("./native-generated-namespaces");
const native_generated_declarations_1 = require("./native-generated-declarations");
const native_string_casts_1 = require("./native-string-casts");
const native_tween_plans_1 = require("./native-tween-plans");
const native_reference_coercion_1 = require("./native-reference-coercion");
const native_xml_1 = require("./native-xml");
const native_generated_declarations_2 = require("./native-generated-declarations");
const native_source_type_1 = require("./native-source-type");
const native_typeof_1 = require("./native-typeof");
const nodeKind_1 = require("../syntax/nodeKind");
const Keywords = require("../syntax/keywords");
const node_1 = require("../syntax/node");
const assign = require("object-assign");
const config_1 = require("../config");
const classlist_1 = require("./classlist");
const native_namespaces_1 = require("./native-namespaces");
const logical_assignment_1 = require("./logical-assignment");
const native_class_initializers_1 = require("./native-class-initializers");
const native_callable_classes_1 = require("./native-callable-classes");
const native_lexical_members_1 = require("./native-lexical-members");
const native_global_modules_1 = require("./native-global-modules");
const native_generated_traits_1 = require("./native-generated-traits");
const native_generated_emission_1 = require("./native-generated-emission");
const native_reference_coercion_2 = require("./native-reference-coercion");
const util = require('util');
const GLOBAL_NAMES = [
    'undefined', 'NaN', 'Infinity',
    'Array', 'Boolean', 'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'escape',
    'int', 'isFinite', 'isNaN', 'isXMLName', 'Number', 'Object',
    'parseFloat', 'parseInt', 'String', 'trace', 'uint', 'unescape', 'Vector', 'XML', 'XMLList',
    'arguments', 'Class', 'Date', 'Function', 'Math',
    'Namespace', 'QName', 'RegExp', 'JSON',
    'Error', 'EvalError', 'RangeError', 'ReferenceError',
    'SyntaxError', 'TypeError', 'URIError',
    'getDefinitionByName'
];
const TYPE_REMAP = {
    'Class': 'any',
    'Object': 'any',
    'String': 'string',
    'Boolean': 'boolean',
    'Number': 'number',
    'int': 'number',
    'uint': 'number',
    '*': 'any',
    'Array': 'any[]',
    'Dictionary': 'Object',
    // Inexistent errors
    'ArgumentError': 'Error',
    'DefinitionError': 'Error',
    'SecurityError': 'Error',
    'VerifyError': 'Error'
};
// TODO: improve me (used only on emitType())
const TYPE_REMAP_VALUES = ['void'];
for (var k in TYPE_REMAP) {
    TYPE_REMAP_VALUES.push(TYPE_REMAP[k]);
}
const IDENTIFIER_REMAP = {
    'Dictionary': 'Map<any, any>',
    // Inexistent errors
    'ArgumentError': 'Error',
    'DefinitionError': 'Error',
    'SecurityError': 'Error',
    'VerifyError': 'Error',
    'getDefinitionByName': 'AS3Utils.getDefinitionByName'
};
const VISITORS = {
    [nodeKind_1.default.REST]: (emitter, node) => {
        emitter.catchup(node.start);
        emitter.insert('...' + node.text + ': any[]');
        emitter.skipTo(node.end);
    },
    [nodeKind_1.default.RETURN]: emitReferenceReturn,
    [nodeKind_1.default.TYPEOF]: emitLocalTypeOf,
    [nodeKind_1.default.PACKAGE]: emitPackage,
    [nodeKind_1.default.META]: emitMeta,
    [nodeKind_1.default.IMPORT]: emitImport,
    [nodeKind_1.default.EMBED]: emitEmbed,
    [nodeKind_1.default.USE]: emitUse,
    [nodeKind_1.default.NAMESPACE_DECLARATION]: emitNamespaceDeclaration,
    [nodeKind_1.default.NAMESPACE_ACCESS]: emitNamespaceAccess,
    [nodeKind_1.default.NAME]: emitName,
    [nodeKind_1.default.FUNCTION]: emitFunction,
    [nodeKind_1.default.LAMBDA]: emitFunction,
    [nodeKind_1.default.FOREACH]: emitForEach,
    [nodeKind_1.default.FORIN]: emitForIn,
    [nodeKind_1.default.INTERFACE]: emitInterface,
    [nodeKind_1.default.CLASS]: emitClass,
    [nodeKind_1.default.CLASS_INITIALIZER]: emitClassInitializer,
    [nodeKind_1.default.VECTOR]: emitVector,
    [nodeKind_1.default.SHORT_VECTOR]: emitShortVector,
    [nodeKind_1.default.TYPE]: emitType,
    [nodeKind_1.default.CALL]: emitCall,
    [nodeKind_1.default.LABEL]: emitStatementLabel,
    [nodeKind_1.default.BREAK]: emitStatementJump,
    [nodeKind_1.default.CONTINUE]: emitStatementJump,
    [nodeKind_1.default.CATCH]: emitCatch,
    [nodeKind_1.default.NEW]: emitNew,
    [nodeKind_1.default.RELATION]: emitRelation,
    [nodeKind_1.default.ASSIGN]: emitAssign,
    [nodeKind_1.default.PRE_INC]: emitNamespaceUpdate,
    [nodeKind_1.default.POST_INC]: emitNamespaceUpdate,
    [nodeKind_1.default.PRE_DEC]: emitNamespaceUpdate,
    [nodeKind_1.default.POST_DEC]: emitNamespaceUpdate,
    [nodeKind_1.default.DELETE]: emitDelete,
    [nodeKind_1.default.ADD]: emitAdd,
    [nodeKind_1.default.INIT]: emitInit,
    [nodeKind_1.default.OP]: emitOp,
    [nodeKind_1.default.OR]: emitOr,
    [nodeKind_1.default.IDENTIFIER]: emitIdent,
    [nodeKind_1.default.XML_LITERAL]: emitXMLLiteral,
    [nodeKind_1.default.E4X_DESCENDANT]: emitUnsupportedE4X,
    [nodeKind_1.default.CONST_LIST]: emitConstList,
    [nodeKind_1.default.NAME_TYPE_INIT]: emitNameTypeInit,
    [nodeKind_1.default.VALUE]: emitObjectValue,
    [nodeKind_1.default.OBJECT]: emitObjectLiteral,
    [nodeKind_1.default.DOT]: emitDot,
    [nodeKind_1.default.ARRAY_ACCESSOR]: emitArrayAccessor,
    [nodeKind_1.default.LITERAL]: emitLiteral,
    [nodeKind_1.default.ARRAY]: emitArray,
    [nodeKind_1.default.BLOCK]: emitBlock,
    [nodeKind_1.default.MINUS]: emitMinus,
};
function visitNodes(emitter, nodes) {
    if (nodes) {
        nodes.forEach(node => visitNode(emitter, node));
    }
}
exports.visitNodes = visitNodes;
function visitNode(emitter, node) {
    if (!node) {
        return;
    }
    // use custom visitor. allow custom node manipulation
    for (let i = 0, l = emitter.options.customVisitors.length; i < l; i++) {
        let customVisitor = emitter.options.customVisitors[i];
        if (customVisitor.visit(emitter, node) === true) {
            return;
        }
    }
    if (native_xml_1.emitNativeXML(emitter, node, visitNode))
        return;
    if (emitter.lexical && emitter.lexical.emit(emitter, node, visitNode))
        return;
    if (emitter.generated && emitter.generated.lexical.emit(emitter, node, visitNode))
        return;
    let visitor = VISITORS[node.kind] || function (emitter, node) {
        emitter.catchup(node.start);
        visitNodes(emitter, node.children);
    };
    //if(VERBOSE >= 2 && VISITORS[node.kind]) {
    if ((config_1.VERBOSE_MASK & 4 /* NODES_TREE */) == 4 /* NODES_TREE */ && VISITORS[node.kind]) {
        console.log("visit:" + VISITORS[node.kind].name + "() <=====================================");
        console.log("node: " + node.toString());
    }
    visitor(emitter, node);
}
exports.visitNode = visitNode;
function filterAST(node) {
    function isInteresting(child) {
        // we don't care about comment
        return !!child && child.kind !== nodeKind_1.default.AS_DOC && child.kind !== nodeKind_1.default.MULTI_LINE_COMMENT;
    }
    let newNode = node_1.createNode(node.kind, node, ...node.children.filter(isInteresting).map(filterAST));
    newNode.children.forEach(child => child.parent = newNode);
    return newNode;
}
class Emitter {
    constructor(source, options) {
        this.sourcePackage = '';
        this.generatedReceiverTraits = new Map();
        /** Exact compiler-created callable imports; authored imports grant no exemption. */
        this.nativeSourceHelpers = new Set();
        this.isNew = false;
        this.isExtended = false;
        this.skipNewLines = false;
        this.loopObjectCounter = 0;
        /** Label held while a lowering inserts a wrapper around the labelled loop. */
        this.pendingStatementLabel = null;
        this._emitThisForNextIdent = true;
        this.headOutput = "";
        this.output = '';
        this.logicalAssignmentTemps = new Map();
        this.classFactory = null;
        this.proxyClass = false;
        this.index = 0;
        this.source = source;
        this.options = assign({
            includePath: "",
            lineSeparator: '\n',
            useNamespaces: false,
            customVisitors: []
        }, options || {});
    }
    get typedLocalPlan() { return this.generated ? this.generated.lexical.typedLocals : this.lexical && this.lexical.typedLocals; }
    get emitThisForNextIdent() {
        return this._emitThisForNextIdent;
    }
    set emitThisForNextIdent(val) {
        this._emitThisForNextIdent = val;
    }
    /*	public rootScope:Scope = null;
        public scope:Scope = null;*/
    get scope() {
        return this._scope;
    }
    set scope(value) {
        this._scope = value;
    }
    get rootScope() {
        return this._rootScope;
    }
    set rootScope(value) {
        this._rootScope = value;
    }
    emit(ast) {
        if (this.options.nativeGeneratedDeclarations !== undefined || this.options.nativeClassTraitsModule !== undefined) {
            if (this.options.useNamespaces || this.options.customVisitors.length || this.options.nativeCallableMetadata
                || this.options.nativeCallableClasses || this.options.nativeClassInitialization)
                throw new Error('AS3_GENERATED_EMISSION_UNSUPPORTED: generated declarations own the exact callable/initialization plan');
            this.generated = new native_generated_emission_1.NativeGeneratedEmission(this.source, this.options.nativeGeneratedDeclarations, this.options.nativeClassTraitsModule, this.options.nativeClassHelperModules, this.options.nativeLexicalMembersModule, this.options.nativeGeneratedPropertyModule, this.options.nativeTypedLocals === true);
            if (this.generated.projection.metadata.isDynamic) {
                native_generated_emission_1.generatedModule(this.options.nativeDynamicPropertyReadsModule);
                native_generated_emission_1.generatedModule(this.options.nativeDynamicPropertyWritesModule);
            }
            if (this.options.nativeTypedLocals)
                native_generated_emission_1.generatedModule(this.options.nativeTypedLocalReferenceModule);
            native_generated_emission_1.generatedModule(this.options.nativeCallableMethodBindingModule);
            this.options.nativeCallableClasses = this.generated.sources;
            this.options.nativeClassInitialization = { classes: this.generated.classes };
            // A caller-supplied/mutated AST must not override the authenticated bytes.
            ast = require('../parse')(this.generated.projection.binding.identity + '.as', this.source);
        }
        for (const [qname, moduleOption] of [['flash.display.DisplayObject', this.options.nativeDisplayObjectReferenceModule], ['flash.display.MovieClip', this.options.nativeMovieClipReferenceModule], ['flash.text.TextFormat', this.options.nativeTextFormatReferenceModule], ['flash.display.InteractiveObject', this.options.nativeInteractiveObjectReferenceModule], ['flash.display.DisplayObjectContainer', this.options.nativeDisplayObjectContainerReferenceModule]])
            if (moduleOption !== undefined) {
                if (qname === 'flash.display.DisplayObjectContainer' && !this.generated)
                    throw new Error('AS3_DISPLAY_REFERENCE_UNSUPPORTED: container operations require generated class authority');
                const name = qname.split('.').pop();
                const module = native_generated_emission_1.generatedModule(moduleOption);
                const reference = this.options.nativeReferenceCoercion;
                if (!reference)
                    throw new Error('AS3_DISPLAY_REFERENCE_UNSUPPORTED: authenticated reference plan required');
                const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
                const provider = inputs.providers && inputs.providers[qname];
                if (!provider || provider.exportName !== name
                    || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                    || !this.options.importModules || this.options.importModules[qname] !== module)
                    throw new Error('AS3_DISPLAY_REFERENCE_UNSUPPORTED: exact native display provider binding required');
            }
        if (this.options.nativePointReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativePointReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_POINT_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.geom.Point'];
            if (!provider || provider.exportName !== 'Point' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.geom.Point'] !== module)
                throw new Error('AS3_POINT_REFERENCE_UNSUPPORTED: exact native Point provider binding required');
        }
        if (this.options.nativeRectangleReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeRectangleReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_RECTANGLE_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.geom.Rectangle'];
            if (!provider || provider.exportName !== 'Rectangle' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.geom.Rectangle'] !== module)
                throw new Error('AS3_RECTANGLE_REFERENCE_UNSUPPORTED: exact native Rectangle provider binding required');
        }
        if (this.options.nativeMatrixReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeMatrixReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_MATRIX_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.geom.Matrix'];
            if (!provider || provider.exportName !== 'Matrix' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.geom.Matrix'] !== module)
                throw new Error('AS3_MATRIX_REFERENCE_UNSUPPORTED: exact native Matrix provider binding required');
        }
        if (this.options.nativeMouseEventReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeMouseEventReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_MOUSE_EVENT_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.events.MouseEvent'];
            if (!provider || provider.exportName !== 'MouseEvent' || provider.nativeBase !== 'MouseEvent' || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.events.MouseEvent'] !== module)
                throw new Error('AS3_MOUSE_EVENT_REFERENCE_UNSUPPORTED: exact native MouseEvent provider binding required');
        }
        if (this.options.nativeTextLineReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeTextLineReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_TEXTLINE_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.text.engine.TextLine'];
            if (!provider || provider.exportName !== 'TextLine' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.text.engine.TextLine'] !== module)
                throw new Error('AS3_TEXTLINE_REFERENCE_UNSUPPORTED: exact native TextLine provider binding required');
        }
        if (this.options.nativeTimerReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeTimerReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_TIMER_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.utils.Timer'];
            if (!provider || provider.exportName !== 'Timer' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.utils.Timer'] !== module)
                throw new Error('AS3_TIMER_REFERENCE_UNSUPPORTED: exact canonical Timer provider binding required');
        }
        if (this.options.nativeBitmapFilterReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeBitmapFilterReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_BITMAPFILTER_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            for (const name of ['BitmapFilter', 'ColorMatrixFilter']) {
                const qname = 'flash.filters.' + name, provider = inputs.providers && inputs.providers[qname];
                if (!provider || provider.exportName !== name || provider.nativeBase || provider.nativeInterface
                    || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                    || !this.options.importModules || this.options.importModules[qname] !== module)
                    throw new Error('AS3_BITMAPFILTER_REFERENCE_UNSUPPORTED: exact canonical filter provider bindings required');
            }
        }
        if (this.options.nativeColorTransformReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeColorTransformReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_COLORTRANSFORM_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const qname = 'flash.geom.ColorTransform', provider = inputs.providers && inputs.providers[qname];
            if (!provider || provider.exportName !== 'ColorTransform' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules[qname] !== module)
                throw new Error('AS3_COLORTRANSFORM_REFERENCE_UNSUPPORTED: exact canonical provider binding required');
        }
        if (this.options.nativeDataEventReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeDataEventReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_DATAEVENT_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const qname = 'flash.events.DataEvent', provider = inputs.providers && inputs.providers[qname];
            if (!provider || provider.exportName !== 'DataEvent' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules[qname] !== module)
                throw new Error('AS3_DATAEVENT_REFERENCE_UNSUPPORTED: exact canonical provider binding required');
        }
        if (this.options.nativeDataEventConstructionModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeDataEventConstructionModule), reference = this.options.nativeDataEventReferenceModule;
            if (!reference || !/AS3CanonicalDataEventReference$/.test(reference)
                || module !== reference.replace(/AS3CanonicalDataEventReference$/, 'AS3DataEventConstruction'))
                throw new Error('AS3_DATAEVENT_CONSTRUCTION_UNSUPPORTED: canonical reference and construction modules required');
        }
        if (this.options.nativeErrorEventSubtypeReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeErrorEventSubtypeReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_ERROREVENT_SUBTYPE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            for (const name of ['IOErrorEvent', 'SecurityErrorEvent']) {
                const qname = 'flash.events.' + name, provider = inputs.providers && inputs.providers[qname];
                if (!provider || provider.exportName !== name || provider.nativeBase || provider.nativeInterface
                    || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                    || !this.options.importModules || this.options.importModules[qname] !== module)
                    throw new Error('AS3_ERROREVENT_SUBTYPE_UNSUPPORTED: exact canonical provider binding required: ' + qname);
            }
        }
        if (this.options.nativeErrorEventSubtypeConstructionModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeErrorEventSubtypeConstructionModule), reference = this.options.nativeErrorEventSubtypeReferenceModule;
            if (!reference || !/AS3CanonicalErrorEventSubtypes$/.test(reference)
                || module !== reference.replace(/AS3CanonicalErrorEventSubtypes$/, 'AS3ErrorEventConstruction'))
                throw new Error('AS3_ERROREVENT_CONSTRUCTION_UNSUPPORTED: canonical reference and construction modules required');
        }
        if (this.options.nativeURLRequestReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeURLRequestReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_URLREQUEST_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.net.URLRequest'];
            if (!provider || provider.exportName !== 'URLRequest' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.net.URLRequest'] !== module)
                throw new Error('AS3_URLREQUEST_REFERENCE_UNSUPPORTED: exact native URLRequest provider binding required');
        }
        if (this.options.nativeErrorEventReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeErrorEventReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_ERROREVENT_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.events.ErrorEvent'];
            if (!provider || provider.exportName !== 'ErrorEvent' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.events.ErrorEvent'] !== module)
                throw new Error('AS3_ERROREVENT_REFERENCE_UNSUPPORTED: exact native ErrorEvent provider binding required');
        }
        if (this.options.nativeTextFieldReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeTextFieldReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_TEXTFIELD_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.text.TextField'];
            if (!provider || provider.exportName !== 'TextField' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.text.TextField'] !== module)
                throw new Error('AS3_TEXTFIELD_REFERENCE_UNSUPPORTED: exact native TextField provider binding required');
        }
        if (this.options.nativeSimpleButtonReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeSimpleButtonReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_SIMPLEBUTTON_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.display.SimpleButton'];
            if (!provider || provider.exportName !== 'SimpleButton' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.display.SimpleButton'] !== module)
                throw new Error('AS3_SIMPLEBUTTON_REFERENCE_UNSUPPORTED: exact native SimpleButton provider binding required');
        }
        if (this.options.nativeBitmapDataReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeBitmapDataReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_BITMAP_DATA_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.display.BitmapData'];
            if (!provider || provider.exportName !== 'BitmapData' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.display.BitmapData'] !== module)
                throw new Error('AS3_BITMAP_DATA_REFERENCE_UNSUPPORTED: exact native BitmapData provider binding required');
        }
        if (this.options.nativeSoundLoaderContextReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeSoundLoaderContextReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_SOUND_LOADER_CONTEXT_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.media.SoundLoaderContext'];
            if (!provider || provider.exportName !== 'SoundLoaderContext' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.media.SoundLoaderContext'] !== module)
                throw new Error('AS3_SOUND_LOADER_CONTEXT_REFERENCE_UNSUPPORTED: exact native SoundLoaderContext provider binding required');
        }
        if (this.options.nativeTextBlockReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeTextBlockReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_TEXT_BLOCK_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.text.engine.TextBlock'];
            if (!provider || provider.exportName !== 'TextBlock' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.text.engine.TextBlock'] !== module)
                throw new Error('AS3_TEXT_BLOCK_REFERENCE_UNSUPPORTED: exact native TextBlock provider binding required');
        }
        if (this.options.nativeCapabilitiesReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeCapabilitiesReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_CAPABILITIES_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.system.Capabilities'];
            if (!provider || provider.exportName !== 'Capabilities' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.system.Capabilities'] !== module)
                throw new Error('AS3_CAPABILITIES_REFERENCE_UNSUPPORTED: exact native Capabilities provider binding required');
        }
        if (this.options.nativeContextMenuClipboardItemsReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeContextMenuClipboardItemsReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_CONTEXT_MENU_CLIPBOARD_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.ui.ContextMenuClipboardItems'];
            if (!provider || provider.exportName !== 'ContextMenuClipboardItems' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.ui.ContextMenuClipboardItems'] !== module)
                throw new Error('AS3_CONTEXT_MENU_CLIPBOARD_REFERENCE_UNSUPPORTED: exact native ContextMenuClipboardItems provider binding required');
        }
        if (this.options.nativeElementFormatReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeElementFormatReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_ELEMENT_FORMAT_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.text.engine.ElementFormat'];
            if (!provider || provider.exportName !== 'ElementFormat' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.text.engine.ElementFormat'] !== module)
                throw new Error('AS3_ELEMENT_FORMAT_REFERENCE_UNSUPPORTED: exact native ElementFormat provider binding required');
            if (!this.options.nativeGeneratedPropertyModule
                || this.options.nativeDynamicPropertyReadsModule !== this.options.nativeGeneratedPropertyModule
                || this.options.nativeDynamicPropertyWritesModule !== this.options.nativeGeneratedPropertyModule)
                throw new Error('AS3_ELEMENT_FORMAT_REFERENCE_UNSUPPORTED: common property read/write providers required');
        }
        if (this.options.nativeTabStopReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeTabStopReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_TABSTOP_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.text.engine.TabStop'];
            if (!provider || provider.exportName !== 'TabStop' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.text.engine.TabStop'] !== module)
                throw new Error('AS3_TABSTOP_REFERENCE_UNSUPPORTED: exact native TabStop provider binding required');
        }
        if (this.options.nativeFontMetricsReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeFontMetricsReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_FONT_METRICS_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.text.engine.FontMetrics'];
            if (!provider || provider.exportName !== 'FontMetrics' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.text.engine.FontMetrics'] !== module)
                throw new Error('AS3_FONT_METRICS_REFERENCE_UNSUPPORTED: exact native FontMetrics provider binding required');
        }
        if (this.options.nativeTextJustifierReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeTextJustifierReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_TEXT_JUSTIFIER_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const types = ['TextJustifier', 'SpaceJustifier', 'EastAsianJustifier'].filter(type => inputs.providers && inputs.providers['flash.text.engine.' + type]);
            if (!types.length)
                throw new Error('AS3_TEXT_JUSTIFIER_REFERENCE_UNSUPPORTED: native justifier provider required');
            for (const type of types) {
                const name = 'flash.text.engine.' + type, provider = inputs.providers[name];
                if (provider.exportName !== type || provider.nativeBase || provider.nativeInterface
                    || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                    || !this.options.importModules || this.options.importModules[name] !== module)
                    throw new Error('AS3_TEXT_JUSTIFIER_REFERENCE_UNSUPPORTED: exact native justifier provider binding required');
            }
        }
        if (this.options.nativeContentElementReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeContentElementReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_CONTENT_ELEMENT_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const types = ['ContentElement', 'TextElement', 'GroupElement', 'GraphicElement'].filter(type => inputs.providers && inputs.providers['flash.text.engine.' + type]);
            if (!types.length)
                throw new Error('AS3_CONTENT_ELEMENT_REFERENCE_UNSUPPORTED: native content provider required');
            for (const type of types) {
                const name = 'flash.text.engine.' + type, provider = inputs.providers[name];
                if (provider.exportName !== type || provider.nativeBase || provider.nativeInterface
                    || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                    || !this.options.importModules || this.options.importModules[name] !== module)
                    throw new Error('AS3_CONTENT_ELEMENT_REFERENCE_UNSUPPORTED: exact native content provider binding required: ' + name);
            }
        }
        if (this.options.nativeSpriteValueReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeSpriteValueReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_SPRITE_VALUE_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const names = native_reference_coercion_1.nativeSpriteValueReferenceNames.filter(name => inputs.providers && inputs.providers[name]);
            if (!names.length)
                throw new Error('AS3_SPRITE_VALUE_REFERENCE_UNSUPPORTED: native value provider required');
            for (const name of names) {
                const provider = inputs.providers[name];
                if (provider.exportName !== name.split('.').pop() || provider.nativeBase || provider.nativeInterface
                    || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                    || !this.options.importModules || this.options.importModules[name] !== module)
                    throw new Error('AS3_SPRITE_VALUE_REFERENCE_UNSUPPORTED: exact native provider binding required');
            }
        }
        if (this.options.nativeSpriteOwnerReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeSpriteOwnerReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_SPRITE_OWNER_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const names = native_reference_coercion_1.nativeSpriteOwnerReferenceNames.filter(name => inputs.providers && inputs.providers[name]);
            if (!names.length)
                throw new Error('AS3_SPRITE_OWNER_REFERENCE_UNSUPPORTED: native value provider required');
            for (const name of names) {
                const provider = inputs.providers[name];
                if (provider.exportName !== name.split('.').pop() || provider.nativeBase || provider.nativeInterface
                    || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                    || !this.options.importModules || this.options.importModules[name] !== module)
                    throw new Error('AS3_SPRITE_OWNER_REFERENCE_UNSUPPORTED: exact native provider binding required');
            }
        }
        if (this.options.nativeLoaderReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeLoaderReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference || !this.options.nativeComputedTypeTestModule)
                throw new Error('AS3_LOADER_REFERENCE_UNSUPPORTED: generated declaration/reference plan and type-test module required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const names = native_reference_coercion_1.nativeLoaderReferenceNames.filter(name => inputs.providers && inputs.providers[name]);
            if (!names.length)
                throw new Error('AS3_LOADER_REFERENCE_UNSUPPORTED: native value provider required');
            for (const name of names) {
                const provider = inputs.providers[name];
                if (provider.exportName !== name.split('.').pop() || provider.nativeBase || provider.nativeInterface
                    || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                    || !this.options.importModules || this.options.importModules[name] !== module)
                    throw new Error('AS3_LOADER_REFERENCE_UNSUPPORTED: exact native provider binding required');
            }
        }
        if (this.options.nativeAccessibilityReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeAccessibilityReferenceModule), reference = this.options.nativeReferenceCoercion;
            if (!this.generated || !reference)
                throw new Error('AS3_ACCESSIBILITY_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(reference.plan, reference.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.accessibility.AccessibilityImplementation'];
            if (!provider || provider.exportName !== 'AccessibilityImplementation' || (provider.nativeBase && provider.nativeBase !== 'AccessibilityImplementation') || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, reference.module) !== module
                || !this.options.importModules || this.options.importModules['flash.accessibility.AccessibilityImplementation'] !== module)
                throw new Error('AS3_ACCESSIBILITY_REFERENCE_UNSUPPORTED: exact native provider binding required');
        }
        if (this.options.nativeByteArrayReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeByteArrayReferenceModule);
            if (!this.generated || !this.options.nativeReferenceCoercion)
                throw new Error('AS3_BYTEARRAY_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(this.generated.options.plan, this.generated.options.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.utils.ByteArray'];
            if (!provider || provider.exportName !== 'ByteArray' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, this.generated.options.module) !== module
                || !this.options.importModules || this.options.importModules['flash.utils.ByteArray'] !== module)
                throw new Error('AS3_BYTEARRAY_REFERENCE_UNSUPPORTED: exact ByteArray provider binding required');
        }
        if (this.options.nativeDictionaryReferenceModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeDictionaryReferenceModule);
            if (!this.generated || !this.options.nativeReferenceCoercion)
                throw new Error('AS3_DICTIONARY_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(this.generated.options.plan, this.generated.options.plan.scope);
            const provider = inputs.providers && inputs.providers['flash.utils.Dictionary'];
            if (!provider || provider.exportName !== 'Dictionary' || provider.nativeBase || provider.nativeInterface
                || native_xml_1.xmlGlobalProviderModule(provider.module, this.generated.options.module) !== module
                || !this.options.importModules || this.options.importModules['flash.utils.Dictionary'] !== module)
                throw new Error('AS3_DICTIONARY_REFERENCE_UNSUPPORTED: exact Dictionary provider binding required');
        }
        if (this.options.nativeXMLModule !== undefined) {
            native_generated_emission_1.generatedModule(this.options.nativeXMLModule);
            if (!this.generated || !this.options.nativeReferenceCoercion)
                throw new Error('AS3_XML_UNSUPPORTED: generated declaration/reference plan required');
            const inputs = native_generated_declarations_2.nativeGeneratedDeclarationInputs(this.generated.options.plan, this.generated.options.plan.scope);
            for (const name of ['XML', 'XMLList']) {
                const provider = inputs.providers && inputs.providers[name];
                if (!provider || provider.exportName !== name || !this.options.nativeGlobalModules
                    || this.options.nativeGlobalModules[name] !== native_xml_1.xmlGlobalProviderModule(provider.module, this.generated.options.module))
                    throw new Error('AS3_XML_UNSUPPORTED: exact XML/XMLList provider bindings required');
            }
        }
        if (this.options.nativeReferenceCoercion !== undefined) {
            if (this.options.useNamespaces || this.options.customVisitors.length || this.options.nativeTypedLocals && !this.generated)
                throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: exact source without conflicting transforms required');
            if (this.generated && (this.options.nativeReferenceCoercion.plan !== this.generated.options.plan
                || this.options.nativeReferenceCoercion.module !== this.generated.options.module))
                throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: generated and consumer domain must agree');
            this.references = new native_reference_coercion_2.NativeReferenceCoercion(this.source, this.options.nativeReferenceCoercion, !!this.generated, !!(this.options.nativeGlobalModules && this.options.nativeGlobalModules.Date), this.options.nativeStringLocalCoercionModule !== undefined, !!(this.generated && this.generated.nativeBase && this.generated.nativeBase.qname === 'flash.events.Event'), this.options.nativeXMLModule ? ['XML', 'XMLList'].filter(name => this.options.nativeGlobalModules && this.options.nativeGlobalModules[name]) : [], this.options.nativeDisplayObjectReferenceModule !== undefined, this.options.nativeByteArrayReferenceModule !== undefined, this.options.nativeMovieClipReferenceModule !== undefined, this.options.nativeTextFormatReferenceModule !== undefined, this.options.nativeInteractiveObjectReferenceModule !== undefined, this.options.nativeAccessibilityReferenceModule !== undefined, this.options.nativeSpriteValueReferenceModule !== undefined, this.options.nativeSpriteOwnerReferenceModule !== undefined, this.options.nativeLoaderReferenceModule !== undefined, this.generated ? this.generated.projection.binding.identity : undefined, this.options.nativeDisplayObjectContainerReferenceModule !== undefined, this.options.nativeErrorEventSubtypeReferenceModule !== undefined, this.options.nativeTextJustifierReferenceModule !== undefined, this.options.nativeTextFieldReferenceModule !== undefined, this.options.nativeDataEventReferenceModule !== undefined, this.options.nativeColorTransformReferenceModule !== undefined, this.options.nativeDictionaryReferenceModule !== undefined, this.options.nativeContentElementReferenceModule !== undefined, this.options.nativeTextBlockReferenceModule !== undefined, this.options.nativeTextLineReferenceModule !== undefined, this.options.nativeMouseEventReferenceModule !== undefined, this.options.nativeErrorEventReferenceModule !== undefined, this.options.nativeURLRequestReferenceModule !== undefined, this.options.nativeRectangleReferenceModule !== undefined);
            native_generated_emission_1.generatedModule(this.options.nativeClassHelperModules && this.options.nativeClassHelperModules.nativeClass);
            ast = this.references.root;
        }
        if (this.options.decoratorModules !== undefined) {
            const modules = this.options.decoratorModules;
            if (!modules || typeof modules !== 'object' || Array.isArray(modules)
                || Object.keys(modules).some(name => name !== 'bound' && name !== 'classBound')
                || [modules.bound, modules.classBound].some(value => typeof value !== 'string'
                    || !value.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(value)))
                throw new Error('AS3_DECORATOR_MODULES: explicit bound and classBound module paths required');
        }
        //if(VERBOSE >= 1) {
        if ((config_1.VERBOSE_MASK & 1 /* KEY_POINTS */) == 1 /* KEY_POINTS */) {
            console.log("emit() Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜Ã¢â€ â€˜");
        }
        if (this.options.nativeArrayCreationModule !== undefined) {
            const module = this.options.nativeArrayCreationModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_ARRAY_CREATION_UNSUPPORTED: explicit common Array creation module required');
            if (!this.options.nativeCallableClasses || !this.options.nativeClassInitialization || this.options.useNamespaces)
                throw new Error('AS3_ARRAY_CREATION_UNSUPPORTED: callable source classes with lazy initialization and module imports required');
        }
        if (this.options.nativeReflectionQueryModule !== undefined) {
            const module = this.options.nativeReflectionQueryModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_REFLECTION_QUERY_UNSUPPORTED: explicit common reflection query module required');
        }
        if (this.options.nativeReflectionXMLModule !== undefined) {
            const module = this.options.nativeReflectionXMLModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_REFLECTION_XML_UNSUPPORTED: explicit common reflection XML module required');
        }
        if (this.options.nativeProxyModule !== undefined) {
            const module = this.options.nativeProxyModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_PROXY_UNSUPPORTED: explicit common Proxy module required');
            if (this.options.importModules && this.options.importModules['flash.utils.Proxy']
                && this.options.importModules['flash.utils.Proxy'] !== module)
                throw new Error('AS3_PROXY_UNSUPPORTED: Proxy import binding disagrees with nativeProxyModule');
        }
        if (this.options.nativeSourceErrorModule !== undefined) {
            const module = this.options.nativeSourceErrorModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_SOURCE_ERROR_UNSUPPORTED: explicit common source Error module required');
            if (this.options.importModules && this.options.importModules['flash.errors.AS3SourceError']
                && this.options.importModules['flash.errors.AS3SourceError'] !== module)
                throw new Error('AS3_SOURCE_ERROR_UNSUPPORTED: source Error import binding disagrees with nativeSourceErrorModule');
        }
        if (this.options.nativeStringLocalCoercionModule !== undefined) {
            native_generated_emission_1.generatedModule(this.options.nativeStringLocalCoercionModule);
            if (!this.references)
                throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: String locals require exact reference consumer plan');
        }
        if (this.options.nativeSignaturePropertyModule !== undefined) {
            const module = this.options.nativeSignaturePropertyModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: explicit common signature property module required');
        }
        if (this.options.nativeNumericMethodParametersModule !== undefined) {
            const module = this.options.nativeNumericMethodParametersModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_NUMERIC_PARAMETERS_UNSUPPORTED: explicit common numeric coercion module required');
            if (this.options.importModules && this.options.importModules['flash.utils.AS3Coercion']
                && this.options.importModules['flash.utils.AS3Coercion'] !== module)
                throw new Error('AS3_NUMERIC_PARAMETERS_UNSUPPORTED: numeric coercion import binding disagrees with nativeNumericMethodParametersModule');
        }
        if (this.options.nativeDynamicConstructionModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeDynamicConstructionModule);
            if (this.options.useNamespaces || !this.options.importModules
                || this.options.importModules['compiler.AS3Invocation'] !== module)
                throw new Error('AS3_DYNAMIC_CONSTRUCTION_UNSUPPORTED: exact invocation module binding required');
        }
        if (this.options.nativeClassTypeOperationsModule !== undefined) {
            const module = native_generated_emission_1.generatedModule(this.options.nativeClassTypeOperationsModule);
            if (this.options.useNamespaces || !this.options.importModules
                || this.options.importModules['compiler.AS3Class'] !== module)
                throw new Error('AS3_CLASS_TYPE_OPERATION_UNSUPPORTED: exact common Class module binding required');
        }
        if (this.options.nativeComputedTypeTestModule !== undefined) {
            const module = this.options.nativeComputedTypeTestModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_COMPUTED_TYPE_TEST_UNSUPPORTED: explicit common AS3Type module required');
            if (this.options.importModules && this.options.importModules['flash.utils.AS3Type']
                && this.options.importModules['flash.utils.AS3Type'] !== module)
                throw new Error('AS3_COMPUTED_TYPE_TEST_UNSUPPORTED: AS3Type import binding disagrees with nativeComputedTypeTestModule');
        }
        if (this.options.nativeDirectToStringModule !== undefined) {
            const module = this.options.nativeDirectToStringModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_DIRECT_TOSTRING_UNSUPPORTED: explicit common AS3String module required');
            if (this.options.importModules && this.options.importModules['compiler.AS3String']
                && this.options.importModules['compiler.AS3String'] !== module)
                throw new Error('AS3_DIRECT_TOSTRING_UNSUPPORTED: AS3String import binding disagrees with nativeDirectToStringModule');
        }
        if (this.options.nativeStringCoercionModule !== undefined) {
            const module = this.options.nativeStringCoercionModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_STRING_COERCION_UNSUPPORTED: explicit common AS3String module required');
            if (this.options.importModules && this.options.importModules['compiler.AS3String']
                && this.options.importModules['compiler.AS3String'] !== module)
                throw new Error('AS3_STRING_COERCION_UNSUPPORTED: AS3String import binding disagrees with nativeStringCoercionModule');
        }
        if (this.options.nativeObjectCreationModule !== undefined) {
            const module = this.options.nativeObjectCreationModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_OBJECT_CREATION_UNSUPPORTED: explicit common AS3Class module required');
            if (this.options.importModules && this.options.importModules['compiler.AS3Class']
                && this.options.importModules['compiler.AS3Class'] !== module)
                throw new Error('AS3_OBJECT_CREATION_UNSUPPORTED: AS3Class import binding disagrees with nativeObjectCreationModule');
        }
        if (this.options.nativeDictionaryPropertyModule !== undefined) {
            const module = this.options.nativeDictionaryPropertyModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_DICTIONARY_PROPERTY_UNSUPPORTED: explicit common AS3Property module required');
            if (this.options.importModules && this.options.importModules['compiler.AS3Property']
                && this.options.importModules['compiler.AS3Property'] !== module)
                throw new Error('AS3_DICTIONARY_PROPERTY_UNSUPPORTED: AS3Property import binding disagrees with nativeDictionaryPropertyModule');
        }
        if (this.options.nativeDynamicPropertyWritesModule !== undefined) {
            const module = this.options.nativeDynamicPropertyWritesModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: explicit common AS3Property module required');
            if (this.options.importModules && this.options.importModules['compiler.AS3Property']
                && this.options.importModules['compiler.AS3Property'] !== module)
                throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: AS3Property import binding disagrees with nativeDynamicPropertyWritesModule');
        }
        if (this.options.nativeDynamicPropertyReadsModule !== undefined) {
            const module = this.options.nativeDynamicPropertyReadsModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: explicit common AS3Property module required');
            if (this.options.importModules && this.options.importModules['compiler.AS3Property']
                && this.options.importModules['compiler.AS3Property'] !== module)
                throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: AS3Property import binding disagrees with nativeDynamicPropertyReadsModule');
        }
        if (this.options.nativeJSONModule !== undefined) {
            native_generated_emission_1.generatedModule(this.options.nativeJSONModule);
            if (this.options.importModules && this.options.importModules['compiler.AS3JSON']
                && this.options.importModules['compiler.AS3JSON'] !== this.options.nativeJSONModule)
                throw new Error('AS3_JSON_UNSUPPORTED: common JSON provider binding disagrees');
        }
        if (this.options.nativeObjectPropertyModule !== undefined) {
            native_generated_emission_1.generatedModule(this.options.nativeObjectPropertyModule);
            if (this.options.useNamespaces || !this.options.importModules
                || this.options.importModules['compiler.AS3Property'] !== this.options.nativeObjectPropertyModule)
                throw new Error('AS3_OBJECT_PROPERTY_UNSUPPORTED: explicit common AS3Property binding without namespace mode required');
        }
        if (this.options.nativeArraySortModule !== undefined) {
            const module = this.options.nativeArraySortModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_ARRAY_SORT_UNSUPPORTED: explicit common AS3ArraySort module required');
            if (this.options.importModules && this.options.importModules['flash.utils.AS3ArraySort']
                && this.options.importModules['flash.utils.AS3ArraySort'] !== module)
                throw new Error('AS3_ARRAY_SORT_UNSUPPORTED: AS3ArraySort import binding disagrees with nativeArraySortModule');
        }
        if (this.options.nativeEnumeration !== undefined) {
            const enumeration = this.options.nativeEnumeration;
            if (!enumeration || typeof enumeration.dictionaryModule !== 'string' || !enumeration.dictionaryModule.trim()
                || typeof enumeration.coercionModule !== 'string' || !enumeration.coercionModule.trim()
                || typeof enumeration.stringModule !== 'string' || !enumeration.stringModule.trim())
                throw new Error('AS3_ENUMERATION_UNSUPPORTED: complete common enumeration modules required');
            if (this.options.nativeDictionaryPropertyModule === undefined)
                throw new Error('AS3_ENUMERATION_UNSUPPORTED: Dictionary property provider required for values');
        }
        this.tweenPlans = new native_tween_plans_1.NativeTweenPlans(this.source, ast, this.options.nativeTweenSourcePlans, this.options.nativeTweenModule);
        if (this.options.nativeTweenModule !== undefined) {
            const module = this.options.nativeTweenModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_TWEEN_UNSUPPORTED: explicit FlashTweenRuntime module required');
            if (this.options.importModules && this.options.importModules['migration.FlashTweenRuntime']
                && this.options.importModules['migration.FlashTweenRuntime'] !== module)
                throw new Error('AS3_TWEEN_UNSUPPORTED: FlashTweenRuntime import binding disagrees with nativeTweenModule');
        }
        if (this.options.nativeRelationalModule !== undefined) {
            const module = this.options.nativeRelationalModule;
            if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_RELATIONAL_COMPILER_UNSUPPORTED: explicit common relational module required');
            if (!this.options.nativeCallableClasses || !this.options.nativeClassInitialization
                || !this.options.nativeCallableMetadata || this.options.nativeLexicalMembersModule === undefined
                || this.options.useNamespaces)
                throw new Error('AS3_RELATIONAL_COMPILER_UNSUPPORTED: authenticated lazy callable metadata and lexical source required');
        }
        let selected = this.generated && (this.generated.options.plan.privateBindings.some(b => b.declaration.sourceOwner === this.generated.projection.binding.sourceOwner)
            || this.generated.options.plan.privateInterfaces.some(b => b.declaration.sourceOwner === this.generated.projection.binding.sourceOwner))
            ? native_generated_declarations_2.nativeGeneratedDeclarationNode(this.generated.options.plan, this.generated.projection.binding.identity) : null;
        const interfaceOptions = this.options.nativeVectorTypes;
        if (interfaceOptions && interfaceOptions.declarationIdentity !== undefined) {
            if (this.generated)
                throw new Error('AS3_INTERFACE_EMISSION_UNSUPPORTED: conflicting declaration selection');
            this.selectedInterface = native_generated_declarations_1.nativeGeneratedDeclarationResolver(interfaceOptions.plan, interfaceOptions.declarationIdentity, this.source);
            selected = native_generated_declarations_2.nativeGeneratedDeclarationNode(interfaceOptions.plan, interfaceOptions.declarationIdentity);
            if (selected.kind !== nodeKind_1.default.INTERFACE)
                throw new Error('AS3_INTERFACE_EMISSION_UNSUPPORTED: exact interface declaration required');
        }
        const filtered = filterAST(selected || ast);
        if (selected)
            filtered.parent = selected.parent;
        this.nativeGlobals = new native_global_modules_1.NativeGlobalModules(this.source, this.options.nativeGlobalModules, this.options.definitionsByNamespace, this.options.useNamespaces);
        if (this.options.nativeTypedLocals && !this.options.nativeLexicalMembersModule)
            throw new Error('AS3_TYPED_LOCAL_UNSUPPORTED: authenticated lexical source required');
        if (this.options.nativeTypedLocals && [this.options.nativeCallableCoercionModule, this.options.nativeCallableStringModule, this.options.nativeTypedLocalAdditionModule]
            .some(module => typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module)))
            throw new Error('AS3_TYPED_LOCAL_UNSUPPORTED: explicit common coercion, String and addition modules required');
        if (this.options.nativeLexicalMembersModule !== undefined && !this.generated) {
            if (!this.options.nativeCallableClasses || !this.options.nativeClassInitialization || this.options.useNamespaces)
                throw new Error('AS3_LEXICAL_COMPILER_UNSUPPORTED: authenticated lazy callable source required');
            this.lexical = new native_lexical_members_1.NativeLexicalMembers(this.source, filtered, this.options.nativeLexicalMembersModule, this.options.nativeCallableMetadata, this.options.nativeTypedLocals === true);
        }
        const generatedAncestry = this.generated && this.generated.options.plan.namespaces.length ? native_generated_namespaces_1.generatedNamespaceAncestry(this.generated.options.plan) : undefined;
        if (generatedAncestry && this.options.namespaceUris)
            for (const name of Object.keys(this.options.namespaceUris)) {
                if (generatedAncestry.namespaceUris[name] !== this.options.namespaceUris[name])
                    throw new Error('AS3_NAMESPACE_UNSUPPORTED: configured URI disagrees with generated source plan: ' + name);
            }
        this.namespaces = new native_namespaces_1.NativeNamespaces(filtered, this.source, generatedAncestry ? generatedAncestry.namespaceUris : this.options.namespaceUris, this.options.nativeProxyModule !== undefined || !!this.generated && this.generated.options.plan.nativeBindings.some(b => b.qname === 'flash.utils.Proxy' && !!b.nativeBaseExport), generatedAncestry || this.options.nativeSourceAncestry);
        this.classInitializers = new native_class_initializers_1.NativeClassInitializers(filtered, this.source, this.options.nativeClassInitialization, node => {
            const value = node_1.outerEncapsulatedExpression(node), parent = value.parent;
            return !!(parent && parent.kind === nodeKind_1.default.DOT && parent.children[0] === value
                && (lexicalApplicationDomainModule(this, parent) || qualifiedNativeStaticRead(this, parent)));
        }, this.generated, this.namespaces);
        this.withScope([], (rootScope) => {
            this.rootScope = rootScope;
            if (selected) {
                const pkg = selected.parent && selected.parent.parent && selected.parent.parent.kind === nodeKind_1.default.PACKAGE ? selected.parent.parent : null;
                this.sourcePackage = pkg ? pkg.findChild(nodeKind_1.default.NAME).text : '';
                classlist_1.default.setCurrentClassRecord(new classlist_1.ClassRecord(this.sourcePackage, selected.findChild(nodeKind_1.default.NAME).text));
                // Visit original import and declaration nodes at their original
                // offsets. Other declarations never become emitted source text.
                selected.parent.findChildren(nodeKind_1.default.IMPORT).forEach(node => {
                    this.skipTo(node.start);
                    emitImport(this, node);
                    this.insert(';\n');
                });
                this.skipTo(filtered.start);
                visitNode(this, filtered);
                this.catchup(filtered.end);
                this.skipTo(this.source.length);
            }
            else {
                visitNode(this, filtered);
                this.catchup(this.source.length);
            }
        });
        this.output = this.output.replace(/\s([^\n])\s*?=>/gm, " =>"); //TODO hotfix. To remove new lines between arrow operator nad {
        if (this.logicalAssignmentTemps.size)
            throw new Error('AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED: receiver capture scope was not emitted');
        return new native_callable_classes_1.NativeCallableClasses(this.source, this.options.nativeCallableClasses, this.options.nativeClassInitialization && this.options.nativeClassInitialization.classes, this.options.nativeCallableMethodBindingModule, this.options.nativeCallableCoercionModule, this.options.nativeCallableMetadata, this.nativeSourceHelpers, this.options.nativeCallableStringModule, this.lexical, this.options.nativeTypedLocalAdditionModule, this.generated, this.options.nativeTypedLocalReferenceModule, this.options.nativeObjectCreationModule, this.options.nativeSourceErrorModule, this.options.nativeDisplayObjectReferenceModule !== undefined, !!(this.options.nativeGlobalModules && this.options.nativeGlobalModules.Date), this.options.nativeByteArrayReferenceModule !== undefined, this.options.nativeMovieClipReferenceModule !== undefined, this.options.nativeTextFormatReferenceModule !== undefined, this.options.nativeInteractiveObjectReferenceModule !== undefined, this.options.nativeAccessibilityReferenceModule !== undefined, this.options.nativeSpriteValueReferenceModule !== undefined, this.options.nativeSpriteOwnerReferenceModule !== undefined, this.options.nativeLoaderReferenceModule !== undefined, this.options.nativeXMLModule !== undefined, this.options.nativePointReferenceModule !== undefined, this.options.nativeTextFieldReferenceModule !== undefined, this.options.nativeDisplayObjectContainerReferenceModule !== undefined, this.options.nativeSimpleButtonReferenceModule !== undefined, this.options.nativeTabStopReferenceModule !== undefined, this.options.nativeContentElementReferenceModule !== undefined, this.options.nativeRectangleReferenceModule !== undefined, this.options.nativeMatrixReferenceModule !== undefined, this.options.nativeTextLineReferenceModule !== undefined, this.options.nativeErrorEventReferenceModule !== undefined, this.options.nativeFontMetricsReferenceModule !== undefined, this.options.nativeTextJustifierReferenceModule !== undefined, this.options.nativeSoundLoaderContextReferenceModule !== undefined, this.options.nativeBitmapDataReferenceModule !== undefined, this.options.nativeDataEventReferenceModule !== undefined, this.options.nativeBitmapFilterReferenceModule !== undefined, this.options.nativeTimerReferenceModule !== undefined, this.options.nativeTextBlockReferenceModule !== undefined, this.options.nativeContextMenuClipboardItemsReferenceModule !== undefined, this.options.nativeElementFormatReferenceModule !== undefined)
            .lower(this.headOutput + this.namespaces.keyDeclarations(this.generated && this.generated.options.plan.namespaceKeys ? (uri, name, key) => {
            const binding = this.generated.options.plan.namespaceKeys.find(k => k.uri === uri && k.name === name);
            if (!binding) {
                if (uri === native_generated_proxy_1.generatedProxyUri)
                    return 'const ' + key + '=globalThis.Symbol.for(' + JSON.stringify('as3.namespace.member@1:' + JSON.stringify([uri, name])) + ');\n';
                this.namespaces.fail('generated namespace key is absent from source plan');
            }
            return 'import {' + binding.exported + ' as ' + key + '} from ' + JSON.stringify(this.generated.options.module) + ';\n';
        } : undefined) + this.output);
    }
    enterScope(declarations) {
        return this.scope = { parent: this.scope, declarations };
    }
    exitScope(checkScope = null) {
        if (checkScope && this.scope !== checkScope) {
            throw new Error('Mismatched enterScope() / exitScope().');
        }
        if (!this.scope) {
            throw new Error('Unmatched exitScope().');
        }
        this.scope = this.scope.parent;
    }
    // Failed visitors can leave nested scopes open. Preserve their primary error
    // while unwinding this scope; successful visitors still undergo balance checks.
    withScope(declarations, body) {
        let scope = this.enterScope(declarations);
        try {
            body(scope);
        }
        catch (error) {
            this.scope = scope;
            throw error;
        }
        finally {
            this.exitScope(scope);
        }
    }
    get currentClassName() {
        for (var scope = this.scope; scope; scope = scope.parent) {
            if (scope.className) {
                return scope.className;
            }
        }
        return null;
    }
    declareInScope(declaration) {
        let previousDeclaration = null;
        for (var i = 0, len = this.scope.declarations.length; i < len; i++) {
            if (this.scope.declarations[i].name === declaration.name) {
                previousDeclaration = this.scope.declarations[i];
            }
        }
        if (previousDeclaration) {
            if (declaration.type !== undefined)
                previousDeclaration.type = declaration.type;
            if (declaration.as3Type !== undefined)
                previousDeclaration.as3Type = declaration.as3Type;
            if (declaration.bound !== undefined)
                previousDeclaration.bound = declaration.bound;
        }
        else {
            this.scope.declarations.push(declaration);
        }
    }
    findDefInScope(text) {
        let scope = this.scope;
        while (scope) {
            for (let i = 0; i < scope.declarations.length; i++) {
                if (scope.declarations[i].name === text) {
                    return scope.declarations[i];
                }
            }
            scope = scope.parent;
        }
        return null;
    }
    commentNode(node, catchSemi) {
        this.insert('/*');
        this.catchup(node.end);
        let index = this.index;
        if (catchSemi) {
            while (true) {
                if (index >= this.source.length) {
                    break;
                }
                if (this.source[index] === '\n') {
                    this.catchup(index);
                    break;
                }
                if (this.source[index] === ';') {
                    this.catchup(index + 1);
                    break;
                }
                index++;
            }
        }
        this.insert('*/');
    }
    catchup(index) {
        if (this.index >= index) {
            return;
        }
        let text = this.sourceBetween(this.index, index);
        this.index = index;
        this.insert(text);
    }
    setIndexPos(index) {
        this.index = index;
    }
    sourceBetween(start, end) {
        return this.source.substring(start, end);
    }
    skipTo(index) {
        this.index = index;
    }
    getIndex() {
        return this.index;
    }
    skip(number) {
        this.index += number;
    }
    insert(str) {
        this.output += str;
        // Debug util (comment out on production).
        // let split = this.output.split(" ");
        // let lastWord = split[split.length - 1];
        // console.log("    emitter.ts - output += " + lastWord);
        // process.stdout.write(" " + lastWord);
        // console.log("+++++++++ " + (string.indexOf("for(") !== -1));
        //if(VERBOSE >= 2 ) {
        if ((config_1.VERBOSE_MASK & 2 /* TRANSPILED_CODE */) == 2 /* TRANSPILED_CODE */) {
            console.log("output (all): " + this.output);
            // let a = 1; // insert breakpoint here
        }
    }
    consume(string, limit) {
        let index = this.source.indexOf(string, this.index) + string.length;
        if (index > limit || index < this.index) {
            throw new Error('invalid consume');
        }
        this.index = index;
    }
    consumeRegExp(reg, limit) {
        let matches = this.source.slice(this.index).match(reg);
        if (!matches || matches.length < 1)
            return;
        let matchStr = matches[0];
        let index = this.source.indexOf(matchStr, this.index) + matchStr.length;
        if (index > limit || index < this.index)
            return;
        this.index = index;
    }
    /**
     * Utilities
     */
    ensureImportIdentifier(identifier, from = `./${identifier}`, checkGlobals = true) {
        // The enclosing source declaration is local even when its name is followed
        // by a newline/comment instead of the legacy textual space match below.
        if (identifier === this.currentClassName)
            return;
        if (identifier == "number" || identifier == "number[]"
            || identifier == "any" || identifier == "any[]"
            || identifier == "boolean" || identifier == "boolean[]"
            || identifier == "string" || identifier == "string[]"
            || identifier == "Array")
            return;
        // warning if this is a as3-path, not a plain name (like shared.Node should error)
        if (config_1.WARNINGS >= 1 && identifier.split(".").length > 1) {
            console.log(`emitter.ts: *** MAJOR WARNING *** ensureImportIdentifier() => : invalid object name identifier: ${identifier})`);
        }
        let isGloballyAvailable = checkGlobals
            ? GLOBAL_NAMES.indexOf(identifier) >= 0
            : false;
        // change to root scope temporarily
        let previousScope = this.scope;
        this.scope = this.rootScope;
        // Ensure this file is not declaring this class
        if ((this.generated ? identifier !== this.generated.lexical.ownClass.findChild(nodeKind_1.default.NAME).text : this.source.indexOf(`class ${identifier} `) === -1) && !isGloballyAvailable && !this.findDefInScope(identifier)) {
            // Same-package implicit imports must use the authenticated QName mapping too.
            if (checkGlobals && from === `./${identifier}` && this.options.importModules) {
                const qname = this.generated ? this.generated.lexical.resolveTypeName(identifier) : this.selectedInterface ? this.selectedInterface.resolve(identifier)
                    : (this.sourcePackage ? this.sourcePackage + '.' : '') + identifier;
                if (this.options.importModules[qname])
                    from = native_generated_emission_1.generatedModule(this.options.importModules[qname]);
            }
            this.headOutput += `import { ${identifier} } from "${from}";\n`;
            this.declareInScope({ name: identifier });
        }
        // change back to previous scope
        this.scope = previousScope;
    }
    getTypeRemap(text) {
        for (let i = 0, l = this.options.customVisitors.length; i < l; i++) {
            let customVisitor = this.options.customVisitors[i];
            if (customVisitor.typeMap && customVisitor.typeMap[text]) {
                return customVisitor.typeMap[text];
            }
        }
        return TYPE_REMAP[text];
    }
    getIdentifierRemap(text) {
        for (let i = 0, l = this.options.customVisitors.length; i < l; i++) {
            let customVisitor = this.options.customVisitors[i];
            if (customVisitor.identifierMap && customVisitor.identifierMap[text]) {
                return customVisitor.identifierMap[text];
            }
        }
        return IDENTIFIER_REMAP[text];
    }
}
exports.default = Emitter;
function emitPackage(emitter, node) {
    let packageName = node.findChild(nodeKind_1.default.NAME);
    emitter.sourcePackage = packageName ? packageName.text : '';
    let content = node.findChild(nodeKind_1.default.CONTENT);
    if (content) {
        let classNode = content.findChild(nodeKind_1.default.CLASS);
        let classRecord;
        if (classNode) {
            let className = classNode.findChild(nodeKind_1.default.NAME);
            let classList = classlist_1.default.classList;
            classRecord = new classlist_1.ClassRecord(packageName.text, className.text);
            classRecord.classKind = 1 /* CLASS */;
        }
        let interfaceNode = content.findChild(nodeKind_1.default.INTERFACE);
        if (interfaceNode) {
            let interfaceName = interfaceNode.findChild(nodeKind_1.default.NAME);
            let interfaceList = classlist_1.default.classList;
            classRecord = new classlist_1.ClassRecord(packageName.text, interfaceName.text);
            classRecord.classKind = 2 /* INTERFACE */;
        }
        if (classRecord) {
            if (classlist_1.default.isScanning) {
                classlist_1.default.addClass(classRecord);
            }
            else {
                classlist_1.default.setCurrentClassRecord(classRecord);
            }
        }
    }
    if (emitter.options.useNamespaces) {
        emitter.catchup(node.start);
        emitter.skip(Keywords.PACKAGE.length);
        emitter.insert('namespace');
        visitNodes(emitter, node.children);
    }
    else {
        emitter.catchup(node.start);
        // The first content token already accounts for package whitespace and comments.
        emitter.skipTo(content.start);
        visitNodes(emitter, node.children);
        emitter.catchup(node.end - 1);
        emitter.skip(1);
    }
}
function emitMeta(emitter, node) {
    emitter.catchup(node.start);
    emitter.commentNode(node, false);
}
function emitUse(emitter, node) {
    emitter.catchup(node.start);
    emitter.commentNode(node, false);
}
function emitNamespaceDeclaration(emitter, node) {
    const uri = emitter.namespaces.declarationUri(node, []);
    emitter.catchup(node.start);
    emitter.insert('export const ' + node.findChild(nodeKind_1.default.NAME).text
        + ' = globalThis.Symbol.for(' + JSON.stringify('as3.namespace.uri@1:' + uri) + ');');
    emitter.skipTo(node.end);
}
function emitName(emitter, node) {
    const member = emitter.namespaces.member(node);
    emitter.catchup(node.start);
    if (!member)
        return;
    if (!emitter.generated && emitter.options.nativeProxyModule !== undefined
        && member.uri === 'http://www.adobe.com/2006/actionscript/flash/proxy') {
        emitter.insert(node.text);
        emitter.skipTo(node.end);
        return;
    }
    emitter.insert('[' + emitter.namespaces.key(member.uri, member.name) + ']');
    emitter.skipTo(node.end);
}
function resolveNamespaceAccess(emitter, node) {
    const access = emitter.namespaces.access(node);
    if (hasFunctionLocal(emitter, access.qualifier))
        emitter.namespaces.fail('runtime namespace qualifier shadows a declaration: ' + access.qualifier);
    if (access.receiver && access.receiver.text === emitter.currentClassName && hasFunctionLocal(emitter, access.receiver.text))
        emitter.namespaces.fail('local receiver shadows its class name');
    const receiverDefinition = access.receiver && emitter.findDefInScope(access.receiver.text);
    const receiverType = receiverDefinition && receiverDefinition.type
        || emitter.namespaces.receiverType(node);
    emitter.namespaces.checkReceiver(node, receiverType);
    const target = emitter.namespaces.accessMember(node, receiverType);
    return { access, target };
}
function emitGeneratedClassNamespaceRead(emitter, node) {
    if (!emitter.generated || !emitter.generated.propertyModule)
        return false;
    const access = emitter.namespaces.access(node);
    const definition = access.receiver && access.receiver.kind === nodeKind_1.default.IDENTIFIER
        && emitter.findDefInScope(access.receiver.text);
    const receiverType = emitter.namespaces.receiverType(node) || definition && definition.type;
    if (!emitter.namespaces.classValueReceiver(node, receiverType))
        return false;
    if (hasFunctionLocal(emitter, access.qualifier))
        emitter.namespaces.fail('runtime namespace qualifier shadows a declaration: ' + access.qualifier);
    if (emitter.references && emitter.references.resolve('Class') !== 'Class')
        emitter.namespaces.fail('Class namespace read requires the intrinsic Class type');
    const reference = node_1.outerEncapsulatedExpression(node), parent = reference.parent;
    if (!access.uri || parent && (parent.kind === nodeKind_1.default.ASSIGN && parent.children[0] === reference
        || [nodeKind_1.default.DELETE, nodeKind_1.default.PRE_INC, nodeKind_1.default.PRE_DEC, nodeKind_1.default.POST_INC, nodeKind_1.default.POST_DEC].indexOf(parent.kind) >= 0
        || [nodeKind_1.default.CALL, nodeKind_1.default.NEW].indexOf(parent.kind) >= 0 && parent.children[0] === reference))
        emitter.namespaces.fail('Class namespace operation requires separate lowering; only explicit reads are qualified');
    const helper = propertyHelper(emitter, 'as3GetClassNamespaceProperty', emitter.generated.propertyModule);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitter.skipTo(access.receiver.start);
    visitNode(emitter, access.receiver);
    emitter.catchup(getEffectiveNodeEnd(access.receiver));
    emitter.insert(',' + JSON.stringify(access.uri) + ',' + JSON.stringify(access.name) + '))');
    emitter.skipTo(node.end);
    return true;
}
function emitNamespaceAccess(emitter, node) {
    if (emitGeneratedClassNamespaceRead(emitter, node))
        return;
    const { access, target } = resolveNamespaceAccess(emitter, node);
    const reference = node_1.outerEncapsulatedExpression(node);
    if (reference.parent && reference.parent.kind === nodeKind_1.default.ASSIGN && reference.parent.children[0] === reference
        && target && target.declaration.kind === nodeKind_1.default.CONST_LIST)
        emitter.namespaces.fail('namespace const writes require write protection');
    if (reference.parent && reference.parent.kind === nodeKind_1.default.ASSIGN && reference.parent.children[0] === reference
        && target && target.declaration.kind === nodeKind_1.default.FUNCTION)
        emitter.namespaces.fail('namespace method writes require separate lowering');
    emitter.catchup(node.start);
    if (access.receiver && access.receiver.text === 'super' && target
        && (target.declaration.kind === nodeKind_1.default.VAR_LIST || target.declaration.kind === nodeKind_1.default.CONST_LIST)) {
        // AS3 super slots live on the instance, not the JavaScript prototype.
        emitter.insert('this');
        emitter.skipTo(getEffectiveNodeEnd(access.receiver));
    }
    else if (access.receiver) {
        visitNode(emitter, access.receiver);
        emitter.catchup(getEffectiveNodeEnd(access.receiver));
    }
    else {
        const member = access.implicitMember;
        emitter.insert(member.static ? member.owner.findChild(nodeKind_1.default.NAME).text : 'this');
    }
    emitter.insert('[' + emitter.namespaces.key(access.uri, access.name) + ']');
    emitter.skipTo(node.end);
}
function emitNamespaceUpdate(emitter, node) {
    const operand = node.children.length === 1 && node_1.unwrapEncapsulatedExpression(node.children[0]);
    if (operand && operand.kind === nodeKind_1.default.DOT)
        emitter.namespaces.lowerOpenedAccess(operand, emitter.namespaces.receiverType(operand));
    if (!operand || operand.kind !== nodeKind_1.default.NAMESPACE_ACCESS) {
        // Do not silently emit uncoerced updates for open namespace identifiers.
        if (operand && operand.kind === nodeKind_1.default.IDENTIFIER
            && emitter.namespaces.openedIdentifier(operand, hasFunctionLocal(emitter, operand.text)))
            emitter.namespaces.fail('implicit open namespace update requires separate lowering');
        emitter.catchup(node.start);
        visitNodes(emitter, node.children);
        return;
    }
    const { access, target } = resolveNamespaceAccess(emitter, operand);
    const type = emitter.namespaces.integerUpdateType(operand, target);
    if (!access.receiver || access.receiver.text === 'super')
        emitter.namespaces.fail('implicit/super namespace update requires separate lowering');
    let temporary = '__as3_namespace_update';
    while (emitter.source.indexOf(temporary) >= 0)
        temporary += '_';
    const receiver = temporary + '_receiver', old = temporary + '_old', next = temporary + '_next';
    const key = emitter.namespaces.key(access.uri, access.name);
    const increment = node.kind === nodeKind_1.default.PRE_INC || node.kind === nodeKind_1.default.POST_INC;
    const prefix = node.kind === nodeKind_1.default.PRE_INC || node.kind === nodeKind_1.default.PRE_DEC;
    // The argument evaluates before entering the generated scope. Capture each
    // receiver/getter once; preserve the raw expression result while coercing
    // only the stored value (unlike AS3 int-local prefix increment_i).
    emitter.catchup(node.start);
    emitter.insert('((' + receiver + ') => { const ' + old + ' = ' + receiver + '[' + key + ']; '
        + 'const ' + next + ' = ' + old + (increment ? ' + 1; ' : ' - 1; ')
        + receiver + '[' + key + '] = (' + next + (type === 'uint' ? ' >>> 0); ' : ' | 0); ')
        + 'return ' + (prefix ? next : old) + '; })(');
    emitter.skipTo(access.receiver.start);
    visitNode(emitter, access.receiver);
    emitter.catchup(getEffectiveNodeEnd(access.receiver));
    emitter.insert(')');
    emitter.skipTo(getEffectiveNodeEnd(node));
}
function emitEmbed(emitter, node) {
    emitter.catchup(node.start);
    emitter.commentNode(node, false);
}
/**
 * Resolve a wildcard import against the authenticated platform catalog without
 * importing the entire SDK namespace.  The source graph has already decided
 * that the wildcard is legal; this pass only applies lexical precedence and
 * keeps the generated module surface to names actually used by the file.
 */
function referencedWildcardDefinitions(node, namespace, definitions) {
    if (!node.parent || !definitions || definitions.length === 0)
        return [];
    const candidates = new Set(definitions);
    const references = new Set();
    const shadowed = new Set();
    const walk = (current, parent = null) => {
        if (!current)
            return;
        if (current !== node && current.kind === nodeKind_1.default.IMPORT) {
            const imported = current.text.split('.').pop();
            if (imported && imported !== '*')
                shadowed.add(imported);
            return;
        }
        if (current.kind === nodeKind_1.default.NAME && parent
            && parent.kind !== nodeKind_1.default.PACKAGE && parent.kind !== nodeKind_1.default.IMPORT) {
            shadowed.add(current.text);
        }
        if ((current.kind === nodeKind_1.default.IDENTIFIER || current.kind === nodeKind_1.default.TYPE)
            && candidates.has(current.text)) {
            // A DOT's right-hand literal is a member name, not a lexical binding.
            if (!(parent && parent.kind === nodeKind_1.default.DOT && parent.children[1] === current))
                references.add(current.text);
        }
        if ((current.kind === nodeKind_1.default.EXTENDS || current.kind === nodeKind_1.default.IMPLEMENTS)
            && candidates.has(current.text))
            references.add(current.text);
        if (current.children)
            current.children.forEach(child => walk(child, current));
    };
    walk(node.parent);
    return definitions.filter(definition => references.has(definition) && !shadowed.has(definition));
}
function emitImport(emitter, node, inline = false) {
    // A same-file source Class owns its name ahead of an imported declaration.
    // AS3 imports are lexical declarations, not eager JavaScript module effects.
    const importedName = node.text.split('.').pop();
    if (emitter.options.nativeCallableClasses && importedName !== '*'
        && node.parent && node.parent.findChildren(nodeKind_1.default.CLASS)
        .some(declaration => declaration.findChild(nodeKind_1.default.NAME).text === importedName)) {
        emitter.catchup(node.start);
        emitter.skipTo(node.end + Keywords.IMPORT.length + 1);
        return;
    }
    let statement = Keywords.IMPORT + " ";
    /*	let split = node.text.split('.');
        let name = split[split.length - 1];
        split.pop();
        let ns = split.join(".");*/
    classlist_1.default.addImportToLast(node.text.concat());
    if (emitter.generated && emitter.generated.options.plan.namespaces.some(binding => binding.qname === node.text)) {
        // Namespace selectors become canonical Symbol keys. Their imported
        // declaration is lexical authority, not a JavaScript Class dependency.
        if (!inline)
            emitter.catchup(node.start);
        emitter.declareInScope({ name: importedName, sourceImport: node.text });
        if (!inline)
            emitter.skipTo(node.end + Keywords.IMPORT.length + 1);
        return;
    }
    // This explicit migration routes calls to the runtime, not a replacement
    // TweenMax Class. Preserve the import's identity for shadowing checks.
    if (emitter.options.nativeTweenModule !== undefined
        && (node.text === 'com.greensock.TweenMax' || node.text === 'com.greensock.TweenLite')) {
        if (!inline)
            emitter.catchup(node.start);
        emitter.declareInScope({ name: importedName, sourceImport: node.text });
        if (!inline)
            emitter.skipTo(node.end + Keywords.IMPORT.length + 1);
        return;
    }
    // emit one import statement for each definition found in that namespace
    if (node.text.indexOf("*") !== -1) {
        let ns = node.text.substring(0, node.text.length - 2);
        let definitions = emitter.options.definitionsByNamespace[ns];
        // Flush the source prefix (including the preceding import's semicolon)
        // before inserting bindings for this wildcard.
        emitter.catchup(node.start);
        let skipTo = node.end + Keywords.IMPORT.length + 2;
        if (definitions && definitions.length > 0) {
            if (emitter.options.nativeReferencedWildcardImports)
                definitions = referencedWildcardDefinitions(node, ns, definitions);
            if (definitions.length > 0) {
                definitions.forEach(definition => {
                    let importNode = node_1.createNode(node.kind, node);
                    importNode.text = `${ns}.${definition}`;
                    importNode.parent = node.parent;
                    emitImport(emitter, importNode, true);
                    emitter.insert(";\n");
                });
                skipTo = node.end + Keywords.IMPORT.length + 2;
            }
        }
        else {
            if (config_1.WARNINGS >= 1) {
                console.log(`emitter.ts: *** MINOR WARNING *** emitImport() => : nothing found to import on namespace ${ns}. (import ${node.text})`);
            }
        }
        emitter.skipTo(skipTo);
        return;
    }
    let text = node.text.concat();
    let hasCustomVisitor = false;
    const mappedModule = emitter.options.importModules && emitter.options.importModules[node.text];
    // apply custom visitor import maps
    for (let i = 0, l = emitter.options.customVisitors.length; i < l; i++) {
        let customVisitor = emitter.options.customVisitors[i];
        if (customVisitor.imports) {
            hasCustomVisitor = true;
            customVisitor.imports.forEach((replacement, regexp) => {
                text = text.replace(regexp, replacement);
            });
        }
    }
    // // apply "bridge" translation
    // if (emitter.hasBridge && emitter.options.bridge.imports) {
    //     text = node.text.concat();
    //     emitter.options.bridge.imports.forEach((replacement, regexp) => {
    //         text = text.replace(regexp, replacement);
    //     });
    // }
    if (emitter.options.useNamespaces) {
        if (!inline)
            emitter.catchup(node.start);
        emitter.insert(statement);
        let split = node.text.split('.');
        let name = split[split.length - 1];
        emitter.insert(name + ' = ');
        // apply custom visitor translation
        if (hasCustomVisitor) {
            let diff = node.text.length - text.length;
            emitter.insert(text);
            emitter.skip(text.length + diff + statement.length);
        }
        else {
            if (!inline)
                emitter.catchup(node.end + statement.length);
        }
        emitter.declareInScope({ name, sourceImport: node.text });
    }
    else {
        if (!inline)
            emitter.catchup(node.start);
        emitter.insert(Keywords.IMPORT + " ");
        let split = text.split(".");
        let name = split.pop();
        if (mappedModule) {
            if (typeof mappedModule !== 'string' || !mappedModule.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(mappedModule))
                throw new Error('AS3_IMPORT_MODULE_UNSUPPORTED: invalid authenticated module for ' + node.text);
            emitter.insert(`{ ${name} } from "${mappedModule}"`);
            if (!inline)
                emitter.skipTo(node.end + Keywords.IMPORT.length + 1);
            emitter.declareInScope({ name, sourceImport: node.text });
            return;
        }
        // Find current module name to output relative import
        let currentModule = "";
        let parentNode = node.parent;
        while (parentNode) {
            if (parentNode.kind === nodeKind_1.default.PACKAGE) {
                currentModule = parentNode.children[0].text;
                break;
            }
            parentNode = parentNode.parent;
        }
        text = `{ ${name} } from "${getRelativePath(currentModule.split("."), text.split("."))}"`;
        emitter.insert(text);
        if (!inline)
            emitter.skipTo(node.end + Keywords.IMPORT.length + 1);
        emitter.declareInScope({ name, sourceImport: node.text });
    }
}
function getRelativePath(currentPath, targetPath) {
    while (currentPath.length > 0 && targetPath[0] === currentPath[0]) {
        currentPath.shift();
        targetPath.shift();
    }
    let relative = (currentPath.length === 0)
        ? "."
        : currentPath.map(() => "..").join("/");
    return `${relative}/${targetPath.join("/")}`;
}
function getDeclarationType(emitter, node) {
    let declarationType = null;
    let typeNode = node && node.findChild(nodeKind_1.default.TYPE);
    if (typeNode) {
        declarationType = typeNode.qualifiedName ? typeNode.text : emitter.getTypeRemap(typeNode.text) || typeNode.text;
    }
    return declarationType;
}
function getAS3DeclarationType(node) {
    let typeNode = node && node.findChild(nodeKind_1.default.TYPE);
    return typeNode && (typeNode.qualifiedName || typeNode.text) || null;
}
function emitInterface(emitter, node) {
    if (emitter.selectedInterface && !node.findChild(nodeKind_1.default.MOD_LIST).children.length) {
        emitter.catchup(node.start);
        emitter.insert('export ');
    }
    emitDeclaration(emitter, node);
    //we'll catchup the other part
    emitter.declareInScope({
        name: node.findChild(nodeKind_1.default.NAME).text
    });
    // ensure extends identifier is being imported
    node.findChildren(nodeKind_1.default.EXTENDS).forEach(base => emitter.ensureImportIdentifier(base.text));
    let content = node.findChild(nodeKind_1.default.CONTENT);
    let contentsNode = content && content.children;
    let foundVariables = {};
    if (contentsNode) {
        contentsNode.forEach(node => {
            visitNode(emitter, node.findChild(nodeKind_1.default.META_LIST));
            emitter.catchup(node.start);
            let type = node.findChild(nodeKind_1.default.TYPE) || node.children[2];
            if (node.kind === nodeKind_1.default.TYPE && node.text === "function") {
                emitter.skip(Keywords.FUNCTION.length + 1);
                //visitNode(emitter, node.findChild(NodeKind.PARAMETER_LIST));
                let parametersListNode = node.findChild(nodeKind_1.default.PARAMETER_LIST);
                if (parametersListNode) {
                    let params = parametersListNode.children;
                    for (var i = 0; i < params.length; i++) {
                        let parameterNode = params[i];
                        if (parameterNode.kind == nodeKind_1.default.PARAMETER) {
                            const rest = parameterNode.findChild(nodeKind_1.default.REST);
                            if (rest) {
                                emitter.catchup(rest.start);
                                emitter.insert('...' + rest.text + ': any[]');
                                emitter.skipTo(rest.end);
                                continue;
                            }
                            let nameTypeInitNode = parameterNode.findChild(nodeKind_1.default.NAME_TYPE_INIT);
                            if (nameTypeInitNode) {
                                let nameNode = nameTypeInitNode.findChild(nodeKind_1.default.NAME);
                                let typeParamNode = nameTypeInitNode.findChild(nodeKind_1.default.VECTOR) || nameTypeInitNode.findChild(nodeKind_1.default.TYPE);
                                let initNode = nameTypeInitNode.findChild(nodeKind_1.default.INIT);
                                // Interface signatures are emitted through this specialized path
                                // instead of the ordinary NAME_TYPE_INIT visitor.  Reuse the
                                // numeric declaration guard here so parser spans for unary
                                // defaults (for example `int = -1`) cannot leak `-1` into the
                                // generated TypeScript type.
                                if (emitNumericParameterDeclaration(emitter, nameTypeInitNode)) {
                                    continue;
                                }
                                if (initNode) {
                                    //visitNode(emitter, nameNode);
                                    //emitter.skipTo(nameNode.start);
                                    //emitter.insert(nameNode.text);
                                    if (typeParamNode) {
                                        emitter.catchup(nameNode.start);
                                        //visitNode(emitter, nameNode);
                                        //emitter.skipTo(nameNode.end);
                                        //emitter.skipTo(typeParamNode.start);
                                        emitter.insert(nameNode.text);
                                        emitter.skipTo(typeParamNode.end);
                                        emitter.insert("?:");
                                        visitNode(emitter, typeParamNode);
                                        emitter.skipTo(nameTypeInitNode.end);
                                        //isitNode(emitter, initNode);
                                    }
                                    else {
                                        emitter.insert("?");
                                    }
                                    //emitter.skipTo(nameTypeInitNode.end);
                                }
                                else {
                                    visitNode(emitter, nameNode);
                                    if (typeParamNode)
                                        visitNode(emitter, typeParamNode);
                                    //emitter.catchup(nameTypeInitNode.end);
                                }
                            }
                        }
                        else {
                            console.log(`emitter.ts: *** WARNING *** there is unexpected node "${parameterNode}" in PARAMETER_LIST`);
                        }
                    }
                }
                visitNode(emitter, type);
            }
            else if (node.kind === nodeKind_1.default.GET || node.kind === nodeKind_1.default.SET) {
                let name = node.findChild(nodeKind_1.default.NAME);
                let parameterList = node.findChild(nodeKind_1.default.PARAMETER_LIST);
                if (!foundVariables[name.text]) {
                    emitter.skipTo(name.start);
                    emitter.catchup(name.end);
                    foundVariables[name.text] = true;
                    if (node.kind === nodeKind_1.default.GET) {
                        emitter.skipTo(parameterList.end);
                        if (type) {
                            emitType(emitter, type);
                        }
                    }
                    else if (node.kind === nodeKind_1.default.SET) {
                        let parameterNode = parameterList.findChild(nodeKind_1.default.PARAMETER);
                        let nameTypeInit = parameterNode.findChild(nodeKind_1.default.NAME_TYPE_INIT);
                        emitter.skipTo(nameTypeInit.findChild(nodeKind_1.default.NAME).end);
                        type = nameTypeInit.findChild(nodeKind_1.default.TYPE);
                        if (type) {
                            emitType(emitter, type);
                        }
                        emitter.skipTo(node.end);
                    }
                }
                else {
                    emitter.commentNode(node, true);
                }
            }
            else {
                //include or import in interface content not supported
                emitter.commentNode(node, true);
            }
        });
    }
}
function getFunctionDeclarations(emitter, node) {
    let decls = [];
    let params = node.findChild(nodeKind_1.default.PARAMETER_LIST);
    if (params && params.children.length) {
        decls = params.children.map(param => {
            let nameTypeInit = param.findChild(nodeKind_1.default.NAME_TYPE_INIT);
            if (nameTypeInit) {
                return {
                    name: nameTypeInit.findChild(nodeKind_1.default.NAME).text,
                    type: getDeclarationType(emitter, nameTypeInit),
                    as3Type: getAS3DeclarationType(nameTypeInit)
                };
            }
            let rest = param.findChild(nodeKind_1.default.REST);
            return { name: rest.text, as3Type: 'Array' };
        });
    }
    let block = node.findChild(nodeKind_1.default.BLOCK);
    if (block) {
        function traverse(node) {
            let result = [];
            const nested = emitter.generated && emitter.generated.lexical.nestedFunctions.find(fn => fn.start === node.start && fn.end === node.end);
            if (nested)
                return [{ name: nested.name, type: 'Function', as3Type: 'Function' }];
            if (emitter.generated && node.kind === nodeKind_1.default.LAMBDA)
                return [];
            if (node.kind === nodeKind_1.default.VAR_LIST || node.kind === nodeKind_1.default.CONST_LIST ||
                node.kind === nodeKind_1.default.VAR || node.kind === nodeKind_1.default.CONST) {
                result = result.concat(node
                    .findChildren(nodeKind_1.default.NAME_TYPE_INIT)
                    .map(node => ({
                    name: node.findChild(nodeKind_1.default.NAME).text,
                    type: getDeclarationType(emitter, node),
                    as3Type: getAS3DeclarationType(node)
                })));
            }
            if (node.kind !== nodeKind_1.default.FUNCTION && node.children && node.children.length) {
                result = Array.prototype.concat.apply(result, node.children.map(traverse));
            }
            return result.filter(decl => !!decl);
        }
        decls = decls.concat(traverse(block));
    }
    return decls;
}
function emitFunction(emitter, node) {
    const anonymous = emitter.generated && emitter.generated.lexical.anonymousFunctions.find(fn => fn.start === node.start && fn.end === node.end);
    if (anonymous) {
        const module = native_generated_emission_1.generatedModule(emitter.options.importModules && emitter.options.importModules['compiler.AS3Invocation']);
        let helper = '__as3_registerAnonymous';
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier('registerAS3Function as ' + helper, module, false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        if (anonymous.ownerReceiver)
            emitter.insert('(( ' + anonymous.ownerReceiver + ':any)=>');
        emitter.insert('(<any>' + helper + '(function ' + anonymous.name + '(this:any' + (anonymous.parameters.length ? ',' : ''));
        const parameters = node.findChild(nodeKind_1.default.PARAMETER_LIST), body = node.findChild(nodeKind_1.default.BLOCK);
        emitter.withScope(getFunctionDeclarations(emitter, node), () => {
            parameters.children.forEach((p, index) => { if (index)
                emitter.insert(','); emitter.skipTo(p.start); visitNode(emitter, p); emitter.catchup(p.end); });
            emitter.insert('):any ');
            emitter.skipTo(body.start);
            visitNode(emitter, body);
            if (anonymous.returned === 'Object' || anonymous.returned === 'String') {
                // AIR coerces an implicit undefined completion to null for Object and String returns.
                emitter.catchup(body.end - 1);
                emitter.insert('\nreturn null;\n');
            }
            if (anonymous.returned === 'Boolean') {
                emitter.catchup(body.end - 1);
                emitter.insert('\nreturn false;\n');
            }
            if (anonymous.returned === 'int') {
                emitter.catchup(body.end - 1);
                emitter.insert('\nreturn 0;\n');
            }
            emitter.catchup(body.end);
        });
        emitter.insert(',' + emitter.generated.lexical.scriptGlobal + ',' + (anonymous.parameters.length - (anonymous.restParameter ? 1 : 0)) + '))');
        if (anonymous.ownerReceiver)
            emitter.insert(')(' + emitter.generated.lexical.implicitReceiver(node.parent) + ')');
        emitter.skipTo(node.end);
        return;
    }
    const nested = emitter.generated && emitter.generated.lexical.nestedFunctions.find(fn => fn.start === node.start && fn.end === node.end);
    if (nested) {
        emitter.catchup(node.start);
        emitter.withScope(getFunctionDeclarations(emitter, node), () => {
            visitNode(emitter, node.findChild(nodeKind_1.default.PARAMETER_LIST));
            visitNode(emitter, node.findChild(nodeKind_1.default.TYPE));
            visitNode(emitter, node.findChild(nodeKind_1.default.BLOCK));
            emitter.catchup(node.end);
        });
        return;
    }
    emitDeclaration(emitter, node);
    emitter.withScope(getFunctionDeclarations(emitter, node), () => {
        let rest = node.getChildFrom(nodeKind_1.default.MOD_LIST);
        let blockNode = node.findChild(nodeKind_1.default.BLOCK);
        emitter.skipNewLines = true;
        for (var i = 0; i < rest.length; i++) {
            var childNode = rest[i];
            if (childNode.kind == nodeKind_1.default.PARAMETER_LIST) {
                let params = childNode.children;
                emitter.consume(Keywords.FUNCTION, childNode.end);
            }
            if (childNode.kind == nodeKind_1.default.TYPE) {
                let blockChildren = childNode.children;
            }
            for (var j = childNode.start; j < childNode.end; j++) {
                let char = emitter.source.substr(j, 1);
                //emitter.insert("\n" + NodeKind[childNode.kind] + ")" + j + ")" + char.charCodeAt(0) + ":" + char);
            }
            visitNode(emitter, childNode);
            if (childNode.kind == nodeKind_1.default.TYPE) {
                emitter.insert(" => ");
            }
        }
        emitter.skipNewLines = true;
    });
}
function emitParametersList(emitter, node) {
}
function emitForIn(emitter, node) {
    if (emitter.generated) {
        const declaration = node.children[0].children[0], target = declaration && declaration.kind === nodeKind_1.default.VAR_LIST
            ? declaration.findChild(nodeKind_1.default.NAME_TYPE_INIT).findChild(nodeKind_1.default.NAME) : declaration, receiver = node.children[1].children[0], body = node.children[2];
        const binding = target && [nodeKind_1.default.IDENTIFIER, nodeKind_1.default.NAME].indexOf(target.kind) >= 0 && emitter.findDefInScope(target.text);
        if (!binding || binding.bound || ['*', 'String', 'Object'].indexOf(binding.as3Type) < 0)
            throw new Error('AS3_ENUMERATION_UNSUPPORTED: generated for-in requires a declared wildcard, String or Object target');
        for (let scope = node.parent; scope && [nodeKind_1.default.FUNCTION, nodeKind_1.default.LAMBDA, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(scope.kind) < 0; scope = scope.parent)
            if (scope.kind === nodeKind_1.default.CATCH && scope.findChild(nodeKind_1.default.NAME).text === target.text)
                throw new Error('AS3_ENUMERATION_UNSUPPORTED: catch-shadow loop target held');
        if (!emitter.options.nativeEnumeration)
            throw new Error('AS3_ENUMERATION_UNSUPPORTED: explicit common enumeration providers required');
        const helper = dictionaryEnumerationHelper(emitter, 'as3EnumerableKeys');
        const keyCoercion = binding.as3Type === 'String' ? propertyHelper(emitter, 'as3String', emitter.options.nativeEnumeration.stringModule)
            : binding.as3Type === 'Object' ? propertyHelper(emitter, 'as3CoerceObject', native_generated_emission_1.generatedModule(emitter.options.nativeEnumeration.coercionModule)) : null;
        let cursor, step;
        do {
            emitter.loopObjectCounter++;
            cursor = '__as3_keys_' + emitter.loopObjectCounter;
            step = '__as3_keyStep_' + emitter.loopObjectCounter;
        } while (emitter.source.indexOf(cursor) >= 0 || emitter.source.indexOf(step) >= 0);
        emitter.catchup(node.start);
        emitter.insert('{ const ' + cursor + '=' + helper + '(');
        emitter.skipTo(receiver.start);
        visitNode(emitter, receiver);
        emitter.catchup(receiver.end);
        emitter.insert(');let ' + step + ':any;try{');
        if (emitter.pendingStatementLabel) {
            emitter.insert(emitter.pendingStatementLabel + ':');
            emitter.pendingStatementLabel = null;
        }
        emitter.insert('for(;!(' + step + '=' + cursor + '.next()).done;){' + (emitter.getIdentifierRemap(target.text) || target.text) + '=' + (keyCoercion ? keyCoercion + '(' + step + '.value)' : step + '.value') + ';');
        emitter.skipTo(body.start);
        visitNode(emitter, body);
        finishEnumerationBody(emitter, body, false);
        emitter.insert('}}finally{if(' + step + '&&!' + step + '.done&&' + cursor + '.return)' + cursor + '.return();}}');
        return;
    }
    emitter.catchup(node.start);
    emitter.insert('{ ');
    let initNode = node.children[0];
    let varNode = initNode.children[0];
    let inNode = node.children[1];
    let blockNode = node.children[2];
    const dictionaryReceiver = nativeDictionaryEnumerationReceiver(emitter, inNode && inNode.children[0]);
    let nameTypeInitNode = varNode.findChild(nodeKind_1.default.NAME_TYPE_INIT);
    const reference = emitter.references && (nameTypeInitNode ? emitter.references.declaration(nameTypeInitNode)
        : varNode.kind === nodeKind_1.default.IDENTIFIER && emitter.references.local(varNode, varNode.text));
    let referenceKey;
    if (reference) {
        referenceKey = '__as3_reference_key_' + (++emitter.loopObjectCounter);
        while (emitter.source.indexOf(referenceKey) >= 0)
            referenceKey += '_';
    }
    let typeStr = "";
    if (nameTypeInitNode) {
        // emit variable type on for..of statements, but outside of the loop header.
        let nameNode = nameTypeInitNode.findChild(nodeKind_1.default.NAME);
        let typeNode = nameTypeInitNode.findChild(nodeKind_1.default.TYPE);
        if (typeNode) {
            emitter.catchup(node.start);
            /*            let typeRemapped = emitter.getTypeRemap(typeNode.text) || typeNode.text;
             emitter.insert(`let ${ nameNode.text }:${ typeRemapped };\n`);*/
            let typeRemapped = emitter.getTypeRemap(typeNode.text) || typeNode.text;
            typeStr = typeRemapped == undefined ? '' : ':' + typeRemapped;
        }
        else {
            let vecNode = nameTypeInitNode.findChild(nodeKind_1.default.VECTOR);
            if (vecNode) {
                if (config_1.WARNINGS >= 1) {
                    console.log("emitter.ts: *** WARNING *** for iterators of type vector not supported. Please declare iterator outside of the for's header");
                }
            }
        }
        emitter.insert(`var ${nameNode.text}${typeStr};\n`);
        if (emitter.pendingStatementLabel) {
            emitter.insert(emitter.pendingStatementLabel + ': ');
            emitter.pendingStatementLabel = null;
        }
        emitter.catchup(node.start + Keywords.FOR.length + 1);
        emitter.catchup(varNode.start);
        emitter.insert(reference ? 'var ' + referenceKey : nameNode.text);
        emitter.skipTo(varNode.end);
    }
    else {
        if (emitter.pendingStatementLabel) {
            emitter.insert(emitter.pendingStatementLabel + ': ');
            emitter.pendingStatementLabel = null;
        }
        emitter.catchup(node.start + Keywords.FOR.length + 1);
        if (reference) {
            emitter.insert('var ' + referenceKey);
            emitter.skipTo(varNode.end);
        }
        else
            visitNode(emitter, initNode);
    }
    if (dictionaryReceiver) {
        emitter.skipTo(inNode.start);
        emitter.insert(' of ');
        emitDictionaryEnumerationKeys(emitter, inNode.children[0]);
        emitReferenceForInBody(emitter, blockNode, reference, referenceKey);
        emitter.insert('}');
        return;
    }
    emitter.catchup(inNode.start);
    emitter.insert(' ');
    /*    emitter.skip(Keywords.IN.length + 1); // replace "in " with "of "
     emitter.insert('of ');*/
    visitNodes(emitter, inNode.children);
    emitReferenceForInBody(emitter, blockNode, reference, referenceKey);
    emitter.insert('}');
}
function emitReferenceForInBody(emitter, body, reference, key) {
    if (reference) {
        emitter.catchup(body.start + (body.kind === nodeKind_1.default.BLOCK ? 1 : 0));
        if (body.kind !== nodeKind_1.default.BLOCK)
            emitter.insert('{');
        const parts = referenceCoercionParts(emitter, reference);
        emitter.insert(reference.name + ' = ' + parts[0] + key + parts[1] + ';');
    }
    visitNode(emitter, body);
    finishEnumerationBody(emitter, body, !!reference && body.kind !== nodeKind_1.default.BLOCK);
}
function emitForEach(emitter, node) {
    let varNode = node.children[0];
    let inNode = node.children[1];
    let objNode = inNode.children[0];
    let blockNode = node.children[2];
    const inlineTarget = varNode.kind === nodeKind_1.default.VAR && varNode.findChild(nodeKind_1.default.NAME_TYPE_INIT);
    const targetName = inlineTarget ? inlineTarget.findChild(nodeKind_1.default.NAME).text : varNode.text;
    const localTarget = varNode.kind === nodeKind_1.default.NAME && emitter.findDefInScope(varNode.text);
    if (emitter.generated && (inlineTarget || localTarget && !localTarget.bound && ['*', 'Number', 'int', 'uint', 'Boolean', 'String', 'Object', 'Array', 'Class'].indexOf(localTarget.as3Type) >= 0)) {
        if (inlineTarget && inlineTarget.findChild(nodeKind_1.default.INIT))
            throw new Error('AS3_ENUMERATION_UNSUPPORTED: inline iterator initializer');
        // The legacy parser represents a member target as a NAME plus a malformed
        // IN span. Require the original simple-target separator before lowering.
        const separator = emitter.source.slice(varNode.end, objNode.start).replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, '').trim();
        if (separator !== 'in')
            throw new Error('AS3_ENUMERATION_UNSUPPORTED: for-each requires a simple local target');
        if (!emitter.options.nativeEnumeration)
            throw new Error('AS3_ENUMERATION_UNSUPPORTED: explicit common enumeration providers required');
        const values = dictionaryEnumerationHelper(emitter, 'as3EnumerableValues');
        let receiver, cursor, step;
        do {
            emitter.loopObjectCounter++;
            receiver = '__as3_eachReceiver_' + emitter.loopObjectCounter;
            cursor = '__as3_eachKeys_' + emitter.loopObjectCounter;
            step = '__as3_eachStep_' + emitter.loopObjectCounter;
        } while ([receiver, cursor, step].some(name => emitter.source.indexOf(name) >= 0));
        emitter.catchup(node.start);
        emitter.insert('{ const ' + receiver + ':any=');
        emitter.skipTo(objNode.start);
        visitNode(emitter, objNode);
        emitter.catchup(objNode.end);
        emitter.insert(';const ' + cursor + '=' + values + '(' + receiver + ');let ' + step + ':any;try{');
        if (emitter.pendingStatementLabel) {
            emitter.insert(emitter.pendingStatementLabel + ':');
            emitter.pendingStatementLabel = null;
        }
        // The generated function-local pass supplies declaration defaults and
        // coerces this assignment before publishing the iterator's new value.
        emitter.insert('for(;!(' + step + '=' + cursor + '.next()).done;){' + (inlineTarget ? 'var ' : '') + (emitter.getIdentifierRemap(targetName) || targetName) + '=' + step + '.value;');
        emitter.skipTo(blockNode.start);
        visitNode(emitter, blockNode);
        finishEnumerationBody(emitter, blockNode, false);
        emitter.insert('}}finally{if(' + step + '&&!' + step + '.done&&' + cursor + '.return)' + cursor + '.return();}}');
        return;
    }
    const dictionaryReceiver = nativeDictionaryEnumerationReceiver(emitter, objNode);
    const enumerationKeys = dictionaryReceiver ? dictionaryEnumerationHelper(emitter, 'as3EnumerableKeys') : null;
    // Keep the source receiver stable throughout enumeration, including after
    // body assignments. The surrounding block also preserves an unbraced if/else.
    let receiverName, keyName;
    do {
        emitter.loopObjectCounter++;
        receiverName = config_1.FOR_IN_OBJ + emitter.loopObjectCounter;
        keyName = config_1.FOR_IN_KEY + emitter.loopObjectCounter;
    } while (emitter.source.indexOf(receiverName) >= 0 || emitter.source.indexOf(keyName) >= 0);
    emitter.catchup(node.start);
    emitter.insert('{ var ' + receiverName + '; ');
    if (emitter.pendingStatementLabel) {
        emitter.insert(emitter.pendingStatementLabel + ': ');
        emitter.pendingStatementLabel = null;
    }
    let nameTypeInitNode = varNode.findChild(nodeKind_1.default.NAME_TYPE_INIT);
    let nameNode;
    let typeNode;
    let typeStr = "";
    let castStr = "";
    let variableContNode = nameTypeInitNode ? nameTypeInitNode : node;
    nameNode = variableContNode.findChild(nodeKind_1.default.NAME);
    typeNode = variableContNode.findChild(nodeKind_1.default.TYPE);
    if (typeNode && typeNode.text) {
        emitter.catchup(node.start);
        let typeRemapped = emitter.getTypeRemap(typeNode.text) || typeNode.text;
        emitter.ensureImportIdentifier(typeRemapped);
        typeStr = typeRemapped == undefined ? '' : ':' + typeRemapped;
        castStr = typeRemapped == undefined ? '' : '<' + typeRemapped + '>';
    }
    else {
        if (nameTypeInitNode) {
            let vecNode = nameTypeInitNode.findChild(nodeKind_1.default.VECTOR);
            if (vecNode) {
                if (config_1.WARNINGS >= 1) {
                    console.log("emitter.ts: *** WARNING *** for iterators of type vector not supported. Please declare iterator outside of the for's header");
                }
            }
        }
    }
    emitter.catchup(node.start + Keywords.FOR.length + 1);
    emitter.skip(4); // "each"
    emitter.catchup(varNode.start);
    emitter.insert(`var ${keyName}`);
    emitter.declareInScope({ name: keyName });
    emitter.skipTo(varNode.end);
    if (dictionaryReceiver) {
        emitter.skipTo(inNode.start);
        emitter.insert(' of ');
    }
    else {
        emitter.catchup(inNode.start);
        emitter.insert(' ');
    }
    if (dictionaryReceiver)
        emitter.skipTo(objNode.start);
    else
        emitter.catchup(objNode.start);
    if (dictionaryReceiver)
        emitter.insert(enumerationKeys + '(' + receiverName + ' = ');
    else
        emitter.insert('(' + receiverName + ' = ');
    visitNodes(emitter, inNode.children);
    emitter.catchup(objNode.end);
    if (dictionaryReceiver)
        emitter.insert(')');
    else
        emitter.insert(')');
    const hasBlock = blockNode.kind === nodeKind_1.default.BLOCK;
    emitter.catchup(blockNode.start + (hasBlock ? 1 : 0));
    if (!hasBlock)
        emitter.insert('{');
    let def = emitter.findDefInScope(nameNode.text);
    if (!def && !nameTypeInitNode)
        throw new Error('AS3_FOREACH_UNSUPPORTED: unresolved iterator binding: ' + nameNode.text);
    if (def && def.type && castStr == "") {
        castStr = `<${def.type.toString()}>`;
    }
    let declarationWord = "";
    if (nameTypeInitNode) {
        declarationWord = "var ";
        //emitter.declareInScope({name:nameNode.text});
    }
    else {
        if (def) {
            if (def.bound) {
                declarationWord = def.bound + ".";
            }
            else {
                declarationWord = "";
            }
        }
        else {
            declarationWord = "this.";
        }
    }
    const reference = emitter.references && (nameTypeInitNode ? emitter.references.declaration(nameTypeInitNode)
        : emitter.references.local(node, nameNode.text));
    const value = dictionaryReceiver ? dictionaryEnumerationHelper(emitter, 'as3GetProperty') + '(' + receiverName + ', ' + keyName + ')'
        : receiverName + '[' + keyName + ']';
    const parts = reference ? referenceCoercionParts(emitter, reference) : [castStr, ''];
    emitter.insert('\n' + declarationWord + nameNode.text + typeStr + ' = ' + parts[0] + value + parts[1] + ';\n');
    visitNode(emitter, blockNode);
    finishEnumerationBody(emitter, blockNode, !hasBlock);
    emitter.insert('}');
}
/** Keep the authored statement terminator inside an enclosing generated block. */
function finishEnumerationBody(emitter, blockNode, closeBody) {
    // Legacy compound loop nodes can have end=-1; their last child still owns
    // the complete final expression (including closing call parentheses).
    const lastSourceEnd = (current) => current.children.reduce((end, child) => Math.max(end, lastSourceEnd(child)), current.end);
    const statementEnd = lastSourceEnd(blockNode);
    emitter.catchup(statementEnd);
    if (blockNode.kind !== nodeKind_1.default.BLOCK) {
        // The AS3 expression node excludes its optional terminator and trivia.
        // Keep an explicit terminator inside the generated loop/if body so it
        // cannot become a separate statement between the source if and else.
        let end = statementEnd;
        while (end < emitter.source.length) {
            if (/\s/.test(emitter.source.charAt(end))) {
                end++;
                continue;
            }
            if (emitter.source.substr(end, 2) === "/*") {
                const close = emitter.source.indexOf("*/", end + 2);
                if (close < 0)
                    break;
                end = close + 2;
                continue;
            }
            if (emitter.source.substr(end, 2) === "//") {
                end += 2;
                while (end < emitter.source.length && !/[\r\n]/.test(emitter.source.charAt(end)))
                    end++;
                continue;
            }
            break;
        }
        if (emitter.source.charAt(end) === ';')
            emitter.catchup(end + 1);
    }
    if (closeBody)
        emitter.insert('}');
}
function getNodeNameRecursive(objNode) {
    var obj_name = objNode.text;
    if (obj_name != undefined)
        return obj_name;
    obj_name = "";
    if (objNode.children.length > 0) {
        if (objNode.kind == nodeKind_1.default.CALL) {
            for (var i = 0; i < objNode.children.length; i++) {
                obj_name += getNodeNameRecursive(objNode.children[i]);
                if (i < objNode.children.length - 2) {
                    obj_name += ".";
                }
                else if (i == objNode.children.length - 1) {
                    return obj_name += "()";
                }
            }
        }
        else if (objNode.kind == nodeKind_1.default.ARRAY_ACCESSOR) {
            for (var i = 0; i < objNode.children.length; i++) {
                if (i == objNode.children.length - 1) {
                    obj_name += "[";
                }
                obj_name += getNodeNameRecursive(objNode.children[i]);
                if (i < objNode.children.length - 2) {
                    obj_name += ".";
                }
                else if (i == objNode.children.length - 1) {
                    obj_name += "]";
                }
            }
        }
        else {
            for (var i = 0; i < objNode.children.length; i++) {
                obj_name += getNodeNameRecursive(objNode.children[i]);
                if (i != objNode.children.length - 1) {
                    obj_name += ".";
                }
            }
        }
    }
    return obj_name;
}
function emitBlock(emitter, node) {
    const marker = emitter.generated && emitter.generated.lexical.finallyMarkers.find(m => m.start === node.start && m.end === node.end);
    if (marker) {
        emitter.catchup(node.start + 1);
        emitter.insert('/*' + marker.name + '*/');
    }
    // Logical assignments capture effectful receivers in ordinary function-local
    // variables. Do not introduce an IIFE: that would change lexical arguments.
    emitter.catchup(node.start + 1);
    const anonymous = node.parent && emitter.generated && emitter.generated.lexical.anonymousFunctions.find(fn => fn.start === node.parent.start && fn.end === node.parent.end);
    if (anonymous && anonymous.typedSignature) {
        if (!emitter.references)
            throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: anonymous signature requires authenticated reference plan');
        // AIR accepts extra arguments for a zero-parameter anonymous function.
        const fixedCount = anonymous.parameters.length - (anonymous.restParameter ? 1 : 0);
        if (fixedCount) {
            const count = propertyHelper(emitter, 'as3CheckArgumentCount', emitter.references.options.coercionModule);
            emitter.insert('\n' + count + '(arguments.length,' + fixedCount + (anonymous.restParameter ? '' : ',' + fixedCount) + ');\n');
        }
        node.parent.findChild(nodeKind_1.default.PARAMETER_LIST).children.forEach(parameter => {
            const value = parameter.findChild(nodeKind_1.default.NAME_TYPE_INIT), type = value && value.findChild(nodeKind_1.default.TYPE);
            if (!type || type.text === '*')
                return;
            if (emitter.generated.lexical.resolveTypeName(type.text) === 'String') {
                const name = value.findChild(nodeKind_1.default.NAME).text, parts = signatureBuiltinCoercionParts(emitter, 'String');
                emitter.insert(name + '=' + parts[0] + name + parts[1] + ';\n');
                return;
            }
            const reference = emitter.references.declaration(value);
            if (!reference)
                throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: anonymous parameter requires exact source reference');
            const parts = referenceCoercionParts(emitter, reference);
            emitter.insert(reference.name + '=' + parts[0] + reference.name + parts[1] + ';\n');
        });
    }
    if (!emitReferenceMethodEntry(emitter, node))
        emitNumericMethodParameterCoercion(emitter, node);
    if (emitter.references)
        emitter.references.defaults(node).forEach(local => {
            const global = emitter.nativeGlobals.resolve(local.node.findChild(nodeKind_1.default.TYPE), true);
            const type = global ? global.alias : getDeclarationType(emitter, local.node);
            if (global)
                emitter.ensureImportIdentifier(global.name + ' as ' + global.alias, global.module, false);
            else
                emitter.ensureImportIdentifier(type);
            emitter.insert('\nvar ' + local.name + ':' + type + ' = null;\n');
        });
    const insertion = emitter.output.length;
    visitNodes(emitter, node.children);
    const temporaries = emitter.logicalAssignmentTemps.get(node);
    if (temporaries && temporaries.length) {
        emitter.output = emitter.output.slice(0, insertion) + '\nvar ' + temporaries.join(', ') + ';\n'
            + emitter.output.slice(insertion);
        emitter.logicalAssignmentTemps.delete(node);
    }
}
function emitStatementLabel(emitter, node) {
    const name = node.children[0];
    const statement = node.children[1];
    if (!name || !statement)
        throw new Error('AS3_LABEL_UNSUPPORTED: malformed statement label');
    emitter.catchup(node.start);
    if (statement.kind === nodeKind_1.default.FOREACH || statement.kind === nodeKind_1.default.FORIN) {
        // Enumeration lowering introduces a block before the actual loop;
        // hold the label until that loop is emitted so `continue label` remains
        // legal and targets the AS3 loop rather than the implementation block.
        emitter.pendingStatementLabel = name.text;
        emitter.skipTo(name.end + 1);
    }
    else {
        emitter.insert(name.text + ':');
        emitter.skipTo(name.end + 1);
    }
    visitNode(emitter, statement);
}
function emitStatementJump(emitter, node) {
    // The legacy generic visitor treats a labelled target as an instance
    // identifier (`this.loop0`). Preserve AS3's raw `break label` / `continue
    // label` spelling; TypeScript uses the same statement-label grammar.
    emitter.catchup(node.start);
    emitter.catchup(node.end);
}
function nativeDictionaryEnumerationReceiver(emitter, node) {
    return !!(emitter.options.nativeEnumeration && isDictionaryReceiver(emitter, node));
}
function dictionaryEnumerationHelper(emitter, exported) {
    return propertyHelper(emitter, exported, emitter.options.nativeDictionaryPropertyModule);
}
function emitDictionaryEnumerationKeys(emitter, node) {
    const helper = dictionaryEnumerationHelper(emitter, 'as3EnumerableKeys');
    emitter.insert(helper + '(');
    emitter.skipTo(node.start);
    visitNode(emitter, node);
    emitter.catchup(node.end);
    emitter.insert(')');
    emitter.skipTo(node.end);
}
function emitDictionaryEnumerationBlock(emitter, node) {
    visitNode(emitter, node);
}
function generatedCallableOwnsParameters(emitter, member) {
    return !!emitter.generated && !!member && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(member.kind) >= 0
        && !!member.findChild(nodeKind_1.default.NAME)
        && !!member.parent && member.parent.kind === nodeKind_1.default.CONTENT;
}
function numericParameterPlans(emitter, block) {
    // Generated callable entry owns defaults and parameter conversion once.
    if (generatedCallableOwnsParameters(emitter, block.parent))
        return [];
    if (emitter.options.nativeNumericMethodParametersModule === undefined || !block.parent)
        return [];
    if ([nodeKind_1.default.FUNCTION, nodeKind_1.default.SET].indexOf(block.parent.kind) < 0)
        return [];
    const parameters = block.parent.findChild(nodeKind_1.default.PARAMETER_LIST);
    if (!parameters)
        return [];
    const result = [];
    parameters.children.forEach((parameter, index) => {
        const value = parameter && parameter.findChild(nodeKind_1.default.NAME_TYPE_INIT);
        const type = value && value.findChild(nodeKind_1.default.TYPE);
        const name = value && value.findChild(nodeKind_1.default.NAME);
        if (!value || !type || !name || ['Number', 'int', 'uint'].indexOf(type.text) < 0)
            return;
        result.push({ name: name.text, type: type.text, index, init: value.findChild(nodeKind_1.default.INIT) });
    });
    return result;
}
function numericCoercionExport(type) {
    return type === 'Number' ? 'as3CoerceNumber' : type === 'int' ? 'as3CoerceInt' : 'as3CoerceUint';
}
function numericDefaultSource(emitter, plan) {
    if (!plan.init)
        return null;
    let value = emitter.sourceBetween(plan.init.start, plan.init.end).trim();
    if (!value && plan.init.children.length === 1
        && [nodeKind_1.default.MINUS, nodeKind_1.default.PLUS].indexOf(plan.init.children[0].kind) >= 0) {
        const unary = plan.init.children[0], literal = unary.children.length === 1 && unary.children[0];
        if (literal && literal.kind === nodeKind_1.default.LITERAL)
            value = (unary.kind === nodeKind_1.default.MINUS ? '-' : '+') + emitter.sourceBetween(literal.start, literal.end).trim();
    }
    const as3NumberNaN = plan.type === 'Number' && value === 'NaN';
    if (!as3NumberNaN && !/^[+-]?(?:0[xX][0-9a-fA-F]+|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)$/.test(value)
        || /^[+-]?0[0-9]/.test(value))
        throw new Error('AS3_NUMERIC_PARAMETERS_UNSUPPORTED: default must be an exact numeric literal: ' + plan.name);
    return value;
}
function emitNumericMethodParameterCoercion(emitter, block) {
    const plans = numericParameterPlans(emitter, block);
    if (!plans.length)
        return;
    const module = emitter.options.nativeNumericMethodParametersModule;
    const helpers = {};
    plans.forEach(plan => {
        const exported = numericCoercionExport(plan.type);
        if (!helpers[exported]) {
            let local = '__as3_' + exported;
            while (emitter.source.indexOf(local) >= 0 || Object.keys(helpers).some(key => helpers[key] === local))
                local += '_';
            emitter.ensureImportIdentifier(exported + ' as ' + local, module, false);
            emitter.nativeSourceHelpers.add(local);
            helpers[exported] = local;
        }
    });
    const lines = plans.map(plan => {
        const helper = helpers[numericCoercionExport(plan.type)];
        const converted = helper + '(' + plan.name + ')';
        if (!plan.init)
            return plan.name + ' = ' + converted + ';';
        const fallback = helper + '(' + numericDefaultSource(emitter, plan) + ')';
        return plan.name + ' = arguments.length <= ' + plan.index + ' ? ' + fallback + ' : ' + converted + ';';
    });
    emitter.insert('\n' + lines.join('\n') + '\n');
}
function emitNumericParameterDeclaration(emitter, node) {
    if (node.parent && node.parent.parent && generatedCallableOwnsParameters(emitter, node.parent.parent.parent))
        return false;
    if (emitter.options.nativeNumericMethodParametersModule === undefined
        || !node.parent || node.parent.kind !== nodeKind_1.default.PARAMETER)
        return false;
    const value = node, type = value.findChild(nodeKind_1.default.TYPE), name = value.findChild(nodeKind_1.default.NAME);
    if (!type || !name || ['Number', 'int', 'uint'].indexOf(type.text) < 0)
        return false;
    const init = value.findChild(nodeKind_1.default.INIT);
    emitter.catchup(value.start);
    emitter.insert(name.text + (init ? '?:' : ':'));
    emitter.skipTo(type.start);
    visitNode(emitter, type);
    // The parser represents a unary default such as `=-1` with an empty INIT
    // span and keeps the sign/literal in its children.  Using value.end here
    // would therefore leave the `-1` source text behind after the rewritten
    // declaration (`value?:number-1`).  Consume the full effective subtree
    // extent so both ordinary and unary numeric defaults are removed.
    if (init)
        emitter.skipTo(getEffectiveNodeEnd(value));
    else
        emitter.skipTo(type.end);
    return true;
}
function emitMinus(emitter, node) {
    //emitter.insert("-");
    visitNodes(emitter, node.children);
}
function getClassDeclarations(emitter, className, contentsNode) {
    let found = {};
    let resultDeclarations = [];
    contentsNode.forEach(node => {
        if (emitter.namespaces.memberDeclaration(node))
            return;
        //let nameNode:Node;
        let nameNodeList;
        switch (node.kind) {
            case nodeKind_1.default.SET:
            case nodeKind_1.default.GET:
            case nodeKind_1.default.FUNCTION:
                //nameNode = node.findChild(NodeKind.NAME);
                nameNodeList = node.findChildren(nodeKind_1.default.NAME);
                break;
            case nodeKind_1.default.VAR_LIST:
            case nodeKind_1.default.CONST_LIST:
                //nameNode = node.findChild(NodeKind.NAME_TYPE_INIT).findChild(NodeKind.NAME);
                nameNodeList = node.findChildren(nodeKind_1.default.NAME_TYPE_INIT);
                break;
            default:
                break;
        }
        if (!nameNodeList || nameNodeList.length == 0) {
            return null;
        }
        let modList = node.findChild(nodeKind_1.default.MOD_LIST);
        let isStatic = modList && modList.children.some(mod => mod.text === 'static');
        nameNodeList.forEach(nodeInit => {
            let nameNode = nodeInit.kind == nodeKind_1.default.NAME_TYPE_INIT ? nodeInit.findChild(nodeKind_1.default.NAME) : nodeInit;
            let typeNode = nodeInit.kind == nodeKind_1.default.NAME_TYPE_INIT ? nodeInit : node.findChild(nodeKind_1.default.NAME_TYPE_INIT);
            if (!nameNode || found[nameNode.text]) {
                return null;
            }
            found[nameNode.text] = true;
            if (nameNode.text === className) {
                return;
            }
            let declaration = {
                name: nameNode.text,
                type: getDeclarationType(emitter, typeNode),
                as3Type: getAS3DeclarationType(typeNode),
                bound: isStatic ? className : 'this'
            };
            resultDeclarations.push(declaration);
        });
    });
    resultDeclarations = resultDeclarations.filter(el => !!el);
    if (emitter.generated)
        emitter.generated.projection.instanceTraits.forEach(trait => {
            if (found[trait.name])
                return;
            const sourceType = typeof trait.type === 'string' ? trait.type : trait.type ? trait.type.name.replace('::', '.') : '*';
            resultDeclarations.push({ name: trait.name, as3Type: sourceType, type: TYPE_REMAP[sourceType] || sourceType, bound: 'this' });
        });
    return resultDeclarations;
}
/*
function getClassDeclarations(emitter:Emitter, className:string, contentsNode:Node[]):Declaration[] {
    let found:{ [name:string]:boolean } = {};

    return contentsNode.map(node => {
        let nameNode:Node;

        switch (node.kind) {
            case NodeKind.SET:
            case NodeKind.GET:
            case NodeKind.FUNCTION:
                nameNode = node.findChild(NodeKind.NAME);
                break;
            case NodeKind.VAR_LIST:
            case NodeKind.CONST_LIST:
                nameNode = node.findChild(NodeKind.NAME_TYPE_INIT).findChild(NodeKind.NAME);
                //nameNodeList
                break;
            default:
                break;
        }
        if (!nameNode || found[nameNode.text]) {
            return null;
        }
        found[nameNode.text] = true;
        if (nameNode.text === className) {
            return;
        }

        let modList = node.findChild(NodeKind.MOD_LIST);
        let isStatic = modList && modList.children.some(mod => mod.text === 'static');
        return {
            name: nameNode.text,
            type: getDeclarationType(emitter, node.findChild(NodeKind.NAME_TYPE_INIT)),
            bound: isStatic ? className : 'this'
        };
    }).filter(el => !!el);
}
*/
function emitClass(emitter, node) {
    emitter.catchup(node.start);
    const previousFactory = emitter.classFactory;
    const lazy = emitter.classInitializers.enabled;
    const sourceName = node.findChild(nodeKind_1.default.NAME).text;
    if (lazy) {
        const value = emitter.classInitializers.ownNames.get(node);
        emitter.classFactory = { node, value, fields: [], statements: [] };
        const helperPath = emitter.generated ? emitter.generated.helpers.nativeClass : (classlist_1.default.getLastPathToRoot() || './') + 'nativeClass';
        emitter.ensureImportIdentifier('declareNativeClass as ' + emitter.classInitializers.declareName, helperPath, false);
        emitter.ensureImportIdentifier('readNativeClass as ' + emitter.classInitializers.readName, helperPath, false);
        emitter.insert('export const ' + sourceName + ' = ' + emitter.classInitializers.declareName
            + '((' + value + '_finalize) => {\nlet ' + value + ': any;\n');
    }
    visitNode(emitter, node.findChild(nodeKind_1.default.META_LIST));
    let mods = node.findChild(nodeKind_1.default.MOD_LIST);
    if (mods && mods.children.length) {
        emitter.catchup(mods.start);
        emitter.insert("\n@classBound\n");
        let insertExport = false;
        mods.children.forEach(node => {
            if (node.text !== 'private') {
                insertExport = true;
            }
            emitter.skipTo(node.end);
        });
        if (insertExport && !lazy) {
            emitter.insert('export');
        }
    }
    //let interfaces:string[] = [];
    let name = node.findChild(nodeKind_1.default.NAME);
    let content = node.findChild(nodeKind_1.default.CONTENT);
    let contentsNode = content && content.children;
    if (!contentsNode) {
        return;
    }
    // ensure extends identifier is being imported
    let extendsNode = node.findChild(nodeKind_1.default.EXTENDS);
    if (extendsNode) {
        emitIdent(emitter, extendsNode);
        emitter.isExtended = true;
        classlist_1.default.addExtendToLast(extendsNode.text);
        emitter.ensureImportIdentifier(extendsNode.text);
    }
    else {
        emitter.isExtended = false;
    }
    // ensure implements identifiers are being imported
    let implementsNode = node.findChild(nodeKind_1.default.IMPLEMENTS_LIST);
    if (implementsNode) {
        implementsNode.children.forEach((node) => {
            emitter.ensureImportIdentifier(node.text);
            classlist_1.default.addInterfaceToLast(node.text);
        });
    }
    const previousProxyClass = emitter.proxyClass;
    emitter.proxyClass = emitter.options.nativeProxyModule !== undefined
        && !!extendsNode && extendsNode.text === 'Proxy';
    emitter.withScope(getClassDeclarations(emitter, name.text, contentsNode), scope => {
        scope.className = name.text;
        if (emitter.proxyClass) {
            const fields = [];
            contentsNode.forEach(member => {
                if (member.kind !== nodeKind_1.default.VAR_LIST && member.kind !== nodeKind_1.default.CONST_LIST)
                    return;
                member.findChildren(nodeKind_1.default.NAME_TYPE_INIT).forEach(field => {
                    const fieldName = field.findChild(nodeKind_1.default.NAME);
                    if (fieldName)
                        fields.push(fieldName.text);
                });
            });
            if (fields.length) {
                let helper = '__as3_declareFlashProxyProperties';
                while (emitter.source.indexOf(helper) >= 0)
                    helper += '_';
                emitter.ensureImportIdentifier('declareFlashProxyProperties as ' + helper, emitter.options.nativeProxyModule, false);
                emitter.catchup(content.start);
                emitter.insert('\nstatic readonly flashProxyDeclaredProperties = ' + helper + '(' + fields.map(field => JSON.stringify(field)).join(', ') + ');\n');
            }
        }
        let isInterfaceLinkPrinted = false;
        contentsNode.forEach(node => {
            visitNode(emitter, node.findChild(nodeKind_1.default.META_LIST));
            emitter.catchup(node.start);
            if (isInterfaceLinkPrinted == false) {
                //if (implementsNode) emitter.insert(`static ${INTERFACE_INF};\n`);
                if (implementsNode && !emitter.generated) {
                    let classesList = "";
                    implementsNode.children.forEach((node) => {
                        classesList += `"${node.text}", `;
                    });
                    classesList = classesList.substring(0, classesList.length - 2);
                    //emitter.insert(`\n${name.text}.${INTERFACE_INF} = [${classesList}];`);
                    emitter.insert(`static ${config_1.INTERFACE_INF} = [${classesList}];\n`);
                }
                isInterfaceLinkPrinted = true;
            }
            // console.log(node)
            if (!emitter.generated && !emitter.namespaces.memberDeclaration(node))
                storeClassMember(node);
            switch (node.kind) {
                case nodeKind_1.default.SET:
                    emitSet(emitter, node);
                    break;
                case nodeKind_1.default.GET:
                    emitGet(emitter, node);
                    break;
                case nodeKind_1.default.FUNCTION:
                    emitMethod(emitter, node);
                    break;
                case nodeKind_1.default.VAR_LIST:
                    emitPropertyDecl(emitter, node);
                    break;
                case nodeKind_1.default.CONST_LIST:
                    emitPropertyDecl(emitter, node, true);
                    break;
                default:
                    visitNode(emitter, node);
            }
        });
        let pathToRoot = classlist_1.default.getLastPathToRoot();
        emitter.ensureImportIdentifier("classBound", emitter.options.decoratorModules
            ? emitter.options.decoratorModules.classBound : `${lazy ? pathToRoot || './' : pathToRoot}classBound`);
    });
    emitter.proxyClass = previousProxyClass;
    emitter.catchup(node.end);
    if (lazy) {
        const factory = emitter.classFactory;
        emitter.insert('\n' + factory.value + ' = ' + factory.value + '_finalize(' + sourceName + ');\n'
            + factory.fields.join('\n') + '\n' + factory.statements.join('\n')
            + '\nreturn ' + sourceName + ';\n});\nexport type ' + sourceName + ' = typeof ' + sourceName + '.prototype;\n');
        emitter.classFactory = previousFactory;
    }
}
function emitClassInitializer(emitter, node) {
    if (!emitter.classFactory)
        throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: no native class factory');
    emitter.catchup(node.start);
    const start = emitter.output.length;
    emitter.withScope([], () => visitNodes(emitter, node.children));
    emitter.catchup(node.end);
    emitter.classFactory.statements.push(emitter.output.slice(start));
    emitter.output = emitter.output.slice(0, start);
}
function storeClassMember(node) {
    let modeListNode = node.findChild(nodeKind_1.default.MOD_LIST);
    let isStatic = false;
    let isOverridden = false;
    let nsModifier = 0;
    if (modeListNode) {
        let modifiers = modeListNode.findChildren(nodeKind_1.default.MODIFIER);
        modifiers.forEach((mode) => {
            if (mode.text == Keywords.STATIC)
                isStatic = true;
            if (mode.text == Keywords.OVERRIDE)
                isOverridden = true;
            nsModifier = classlist_1.MODIFIERS[mode.text];
            //if (mode.text == Keywords.PUBLIC || )
        });
    }
    let nameNode;
    let typeNode;
    let namesInitList;
    switch (node.kind) {
        case nodeKind_1.default.SET:
        case nodeKind_1.default.GET:
        case nodeKind_1.default.FUNCTION:
            nameNode = node.findChild(nodeKind_1.default.NAME);
            typeNode = node.findChild(nodeKind_1.default.TYPE);
            break;
        case nodeKind_1.default.VAR_LIST:
        case nodeKind_1.default.CONST_LIST:
            let nameInitNode = node.findChild(nodeKind_1.default.NAME_TYPE_INIT);
            namesInitList = node.findChildren(nodeKind_1.default.NAME_TYPE_INIT);
            if (nameInitNode) {
                nameNode = nameInitNode.findChild(nodeKind_1.default.NAME);
                typeNode = nameInitNode.findChild(nodeKind_1.default.TYPE);
            }
            break;
        default:
            return;
    }
    if (namesInitList && namesInitList.length > 1) {
        for (var i = 0; i < namesInitList.length; i++) {
            let nameInitNode = namesInitList[i];
            if (nameInitNode) {
                nameNode = nameInitNode.findChild(nodeKind_1.default.NAME);
                typeNode = nameInitNode.findChild(nodeKind_1.default.TYPE);
                processClassMember(node, nameNode, typeNode, nsModifier, isStatic, isOverridden);
            }
        }
    }
    else {
        processClassMember(node, nameNode, typeNode, nsModifier, isStatic, isOverridden);
    }
}
function processClassMember(node, nameNode, typeNode, nsModifier, isStatic, isOverridden) {
    let classMemberKind = 0;
    switch (node.kind) {
        case nodeKind_1.default.SET:
            classMemberKind = 5 /* SET */;
            break;
        case nodeKind_1.default.GET:
            classMemberKind = 4 /* GET */;
            break;
        case nodeKind_1.default.FUNCTION:
            classMemberKind = 1 /* METHOD */;
            break;
        case nodeKind_1.default.VAR_LIST:
            classMemberKind = 3 /* VARIABLE */;
            break;
        case nodeKind_1.default.CONST_LIST:
            classMemberKind = 2 /* CONST */;
            break;
    }
    if (nameNode) {
        let typeStr = typeNode && typeNode.text ? typeNode.text : "";
        let classMember = new classlist_1.ClassMember(nameNode.text, 3 /* VARIABLE */, typeStr);
        classMember.nsModifier = nsModifier ? nsModifier : 2 /* PROTECTED */;
        classMember.isStatic = isStatic;
        classMember.isOverridden = isOverridden;
        classMember.kind = classMemberKind;
        if (isStatic) {
            classlist_1.default.addStaticMemberToLast(classMember);
        }
        else {
            classlist_1.default.addClassMemberToLast(classMember);
        }
        //console.log("***<" + nameNode.text +  ":" + typeStr + "/" + classMember.nsModifier  + "/isStatic:" + isStatic + "/isOverride:" + isOverride + ">***");
    }
}
function emitSet(emitter, node) {
    emitClassField(emitter, node);
    let name = node.findChild(nodeKind_1.default.NAME);
    emitter.consume('function', name.start);
    if (emitter.namespaces.member(name))
        emitName(emitter, name);
    let params = node.findChild(nodeKind_1.default.PARAMETER_LIST);
    visitNode(emitter, params);
    emitter.catchup(params.end);
    let type = node.findChild(nodeKind_1.default.TYPE);
    if (type) {
        emitter.skipTo(type.end);
    }
    emitter.withScope(getFunctionDeclarations(emitter, node), () => {
        visitNodes(emitter, node.getChildFrom(nodeKind_1.default.TYPE));
    });
}
function emitConstList(emitter, node) {
    emitter.catchup(node.start);
    let nameTypeInit = node.findChild(nodeKind_1.default.NAME_TYPE_INIT);
    emitter.skipTo(nameTypeInit.start);
    emitter.insert('const ');
    visitNode(emitter, nameTypeInit);
}
function emitObjectValue(emitter, node) {
    visitNodes(emitter, node.children);
}
function emitObjectLiteral(emitter, node) {
    if (emitter.options.nativeObjectCreationModule === undefined) {
        visitNodes(emitter, node.children);
        return;
    }
    let helper = '__as3_source_objectLiteral';
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    emitter.ensureImportIdentifier('as3CreateObjectLiteral as ' + helper, emitter.options.nativeObjectCreationModule, false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);
    emitter.insert('(' + helper + '([');
    node.children.forEach((property, index) => {
        const key = property.findChild(nodeKind_1.default.NAME), value = property.findChild(nodeKind_1.default.VALUE);
        if (!key || !value || value.children.length !== 1)
            throw new Error('AS3_OBJECT_CREATION_UNSUPPORTED: literal property shape');
        const text = key.text;
        if (index)
            emitter.insert(',');
        // Keys are static source tokens, never host object-literal syntax (__proto__).
        const token = /^["'0-9]/.test(text) ? text : JSON.stringify(text);
        emitter.insert('[' + token.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') + ',');
        const expression = value.children[0];
        emitter.skipTo(getExpressionStart(expression));
        visitNode(emitter, expression);
        emitter.catchup(getEffectiveNodeEnd(expression));
        emitter.insert(']');
    });
    emitter.insert(']))');
    emitter.skipTo(node.end);
}
function emitNameTypeInit(emitter, node) {
    const pattern = emitter.generated && emitter.generated.options.plan.patternLocals.find(p => p.owner === emitter.generated.lexical.owner && p.declarationStart === node.start);
    if (pattern) {
        const module = nativePatternModule(emitter), compile = propertyHelper(emitter, 'compileSourceStringPattern', module);
        emitter.declareInScope({ name: pattern.name, type: 'any', as3Type: 'RegExp' });
        emitter.catchup(node.start);
        emitter.insert(pattern.name + ': any = ' + compile + '(' + JSON.stringify(pattern.source) + ',' + JSON.stringify(pattern.flags) + ')');
        emitter.skipTo(Math.max(getEffectiveNodeEnd(node), pattern.declarationEnd));
        return;
    }
    if (emitReferenceStringParameter(emitter, node))
        return;
    if (emitNumericParameterDeclaration(emitter, node))
        return;
    const namespaceMember = emitter.namespaces.member(node.findChild(nodeKind_1.default.NAME));
    if (!namespaceMember)
        emitter.declareInScope({
            name: node.findChild(nodeKind_1.default.NAME).text,
            type: getDeclarationType(emitter, node),
            as3Type: getAS3DeclarationType(node)
        });
    emitter.catchup(node.start);
    const builtin = emitter.generated && emitter.generated.builtinNumericConstants[node.findChild(nodeKind_1.default.NAME).text];
    if (builtin !== undefined && node.parent.kind === nodeKind_1.default.CONST_LIST && emitter.classFactory && node.parent.parent === emitter.classFactory.node.findChild(nodeKind_1.default.CONTENT)) {
        const init = node.findChild(nodeKind_1.default.INIT);
        visitNodes(emitter, node.children.filter(child => child !== init));
        emitter.catchup(init.start);
        emitter.insert(builtin);
        emitter.skipTo(getEffectiveNodeEnd(init));
        return;
    }
    const declaration = node.parent;
    const mods = declaration && declaration.findChild(nodeKind_1.default.MOD_LIST);
    if (emitter.classFactory && declaration && declaration.parent === emitter.classFactory.node.findChild(nodeKind_1.default.CONTENT)
        && mods && mods.children.some(mod => mod.text === 'static')) {
        const binaryTrait = !namespaceMember && emitter.generated && emitter.generated.lexical.trait(node.findChild(nodeKind_1.default.NAME).text, true);
        const binary = emitter.generated && emitter.generated.lexical.embeddedConstant(binaryTrait);
        if (binary) {
            const lexical = emitter.generated.lexical;
            const getter = propertyHelper(emitter, binary.getterExport, emitter.generated.options.module);
            emitter.classFactory.fields.push(lexical.provider + '.getAS3LexicalClassConstantInitializer(' + emitter.classFactory.value + ',' + binaryTrait.access + ')(' + getter + '());');
            visitNodes(emitter, node.children);
            return;
        }
        const deferredVector = emitter.generated && emitter.generated.lexical.deferredVectorConstant(binaryTrait);
        const deferredObject = emitter.generated && emitter.generated.lexical.deferredObjectConstant(binaryTrait);
        const deferredRegExp = emitter.generated && emitter.generated.lexical.deferredRegExpConstant(binaryTrait);
        const deferredString = emitter.generated && emitter.generated.lexical.deferredStringConstant(binaryTrait);
        const deferredBoolean = emitter.generated && emitter.generated.lexical.deferredBooleanConstant(binaryTrait);
        const deferred = emitter.generated && declaration.kind === nodeKind_1.default.CONST_LIST
            && emitter.generated.deferredConstants[native_generated_namespaces_1.generatedMemberIdentity(node.findChild(nodeKind_1.default.NAME).text, native_generated_namespaces_1.generatedMemberUri(emitter.generated.options.plan, emitter.generated.projection.binding.identity, declaration))];
        if (emitter.generated && declaration.kind === nodeKind_1.default.CONST_LIST && !deferred && !deferredVector && !deferredObject && !deferredRegExp && !deferredString && !deferredBoolean) {
            // Literal constants are installed before publication by the common
            // generated-class provider, not rewritten as later mutable stores.
            visitNodes(emitter, node.children);
            return;
        }
        const init = node.findChild(nodeKind_1.default.INIT);
        if (!namespaceMember && emitter.generated && emitter.generated.uintOrInitializers.variables[node.findChild(nodeKind_1.default.NAME).text] !== undefined) {
            visitNodes(emitter, node.children.filter(child => child && child !== init));
            if (init)
                emitter.skipTo(getEffectiveNodeEnd(init));
            return;
        }
        const generatedLexical = !namespaceMember && emitter.generated && emitter.generated.lexical.trait(node.findChild(nodeKind_1.default.NAME).text, true);
        visitNodes(emitter, node.children.filter(child => child && child !== init));
        const type = getAS3DeclarationType(node);
        const last = node.findChild(nodeKind_1.default.TYPE) || node.findChild(nodeKind_1.default.NAME);
        emitter.catchup(last.end);
        if (init) {
            emitter.skipTo(init.start);
            const start = emitter.output.length;
            visitNode(emitter, init);
            emitter.catchup(getEffectiveNodeEnd(init));
            const lexical = emitter.lexical && emitter.lexical.trait(node.findChild(nodeKind_1.default.NAME).text, true);
            if (generatedLexical) {
                if (deferredVector)
                    emitter.classFactory.fields.push(emitter.generated.lexical.provider + '.getAS3LexicalVectorConstantInitializer(' + emitter.classFactory.value + ',' + generatedLexical.access + ')(' + emitter.output.slice(start) + ');');
                else if (deferredObject)
                    emitter.classFactory.fields.push(emitter.generated.lexical.provider + '.getAS3LexicalObjectConstantInitializer(' + emitter.classFactory.value + ',' + generatedLexical.access + ')(' + emitter.output.slice(start) + ');');
                else if (deferredRegExp)
                    emitter.classFactory.fields.push(emitter.generated.lexical.provider + '.getAS3LexicalReferenceConstantInitializer(' + emitter.classFactory.value + ',' + generatedLexical.access + ')(' + emitter.output.slice(start) + ');');
                else if (deferredBoolean)
                    emitter.classFactory.fields.push(emitter.generated.lexical.provider + '.getAS3LexicalBooleanConstantInitializer(' + emitter.classFactory.value + ',' + generatedLexical.access + ')(' + emitter.output.slice(start) + ');');
                else if (deferredString)
                    emitter.classFactory.fields.push(emitter.generated.lexical.provider + '.getAS3LexicalStringConstantInitializer(' + emitter.classFactory.value + ',' + generatedLexical.access + ')(' + emitter.output.slice(start) + ');');
                else if (generatedLexical.kind !== 'constant' && emitter.generated.lexical.earlyStaticValue(generatedLexical) === undefined)
                    emitter.classFactory.fields.push(emitter.generated.lexical.provider + '.as3SetLexicalMember(' + emitter.classFactory.value + ',' + generatedLexical.access + ',' + emitter.output.slice(start) + ');');
            }
            else
                emitter.classFactory.fields.push(deferred ? deferred + '(' + emitter.output.slice(start) + ');'
                    : emitter.classFactory.value + '[' + (namespaceMember ? emitter.namespaces.key(namespaceMember.uri, namespaceMember.name) : lexical ? lexical.key : JSON.stringify(node.findChild(nodeKind_1.default.NAME).text))
                        + '] = ' + emitter.output.slice(start) + ';');
            emitter.output = emitter.output.slice(0, start);
        }
        const initial = type === 'int' || type === 'uint' ? '0' : type === 'Number' ? '(0 / 0)'
            : type === 'Boolean' ? 'false' : !type || type === '*' ? 'void 0' : 'null';
        emitter.insert(' = ' + initial);
        return;
    }
    visitNodes(emitter, node.children);
    if (namespaceMember && !node.findChild(nodeKind_1.default.INIT)) {
        // AS3 slot defaults use source types before Number/int/uint are mapped to TS.
        // Keep this bounded to namespace fields; locals and parameters have separate
        // initialization rules and are not admitted through this member authority.
        const type = getAS3DeclarationType(node);
        const value = type === 'int' || type === 'uint' ? '0'
            : type === 'Number' ? '(0 / 0)' : type === 'Boolean' ? 'false'
                : !type || type === '*' ? 'void 0' : 'null';
        emitter.catchup(node.end);
        emitter.insert(' = ' + value);
    }
}
function emitMethod(emitter, node) {
    var isConstructor = false;
    let name = node.findChild(nodeKind_1.default.NAME);
    if (node.kind !== nodeKind_1.default.FUNCTION || name.text !== emitter.currentClassName) {
        let pathToRoot = classlist_1.default.getLastPathToRoot();
        emitter.ensureImportIdentifier("bound", emitter.options.decoratorModules
            ? emitter.options.decoratorModules.bound : `${emitter.classInitializers.enabled ? pathToRoot || './' : pathToRoot}bound`);
        let mods = node.findChild(nodeKind_1.default.MOD_LIST);
        if (mods)
            emitter.catchup(mods.start);
        else
            emitter.catchup(name.start);
        emitter.insert("@bound\n");
        emitClassField(emitter, node);
        emitter.consume('function', name.start);
        emitName(emitter, name);
        emitter.catchup(name.end);
        //emitter.insert(" = ");
    }
    else {
        let mods = node.findChild(nodeKind_1.default.MOD_LIST);
        if (mods) {
            emitter.catchup(mods.start);
        }
        emitter.insert('constructor');
        isConstructor = true;
        // Check if the class extends an Array, in which an insertion
        // is required in the constructor. It's a weird
        // case but necessary.
        if (emitter.output.indexOf('extends Array') > -1) {
            // Prepare the injection.
            var className = name.text;
            var injection = '\nvar thisAny:any=this;\nthisAny.__proto__ = ' + className + '.prototype;\n';
            // Find position of insertion.
            // Enter child nodes and process 1 by 1...
            emitter.withScope(getFunctionDeclarations(emitter, node), () => {
                emitter.skipTo(name.end);
                var children = node.getChildFrom(nodeKind_1.default.NAME);
                for (var i = 0; i < children.length; i++) {
                    var child = children[i];
                    if (child.kind !== nodeKind_1.default.BLOCK) {
                        visitNode(emitter, child);
                        // emitter.skipTo(child.end);
                    }
                    else {
                        // Find super()
                        for (var j = 0; j < child.children.length; j++) {
                            var grandChild = child.children[j];
                            visitNode(emitter, grandChild);
                            emitter.catchup(grandChild.end + 1);
                            if (containsSuperCall(grandChild)) {
                                emitter.insert(injection);
                            }
                        }
                    }
                }
            });
            return;
        }
        else {
            emitter.skipTo(name.end);
        }
        // // find "super" on constructor and move it to the beginning of the
        // // block
        // let blockNode = node.findChild(NodeKind.BLOCK);
        // let blockSuperIndex = -1;
        // for (var i = 0, len = blockNode.children.length; i < len; i++) {
        //     let blockChildNode = blockNode.children[i];
        //     if (blockChildNode.kind === NodeKind.CALL
        //         && blockChildNode.children[0].text === "super") {
        //         blockSuperIndex = i;
        //         break;
        //     }
        // }
        //
        // if (childCalls.length > 0) {
        //     console.log(childCalls)
        //     let superIndex = -1;
        //     childCalls.forEach((child, i) => {
        //         if (child.children[0].text === "super") superIndex = blockNode.children.indexOf(child);
        //     })
        //     console.log("super index:", superIndex)
        // }
    }
    //emitter.catchup(blockNode.start + 1);
    emitter.withScope(getFunctionDeclarations(emitter, node), () => {
        let children = node.getChildFrom(nodeKind_1.default.NAME);
        let nameNode = children[0];
        for (var i = 0; i < children.length; i++) {
            let childNode = children[i];
            //var implemented = emitter.scope.parent.parent.declarations[0].name; //can not use because it icludes also imports
            if (childNode.kind == nodeKind_1.default.BLOCK) {
                if (isConstructor) {
                    if (emitter.isExtended) {
                        emitter.catchup(childNode.start + 1);
                        if (!containsSuperCall(childNode)) {
                            emitter.insert("\n\t\tsuper();");
                        }
                    }
                }
                else {
                    //emitter.insert(" => ");
                }
                visitNode(emitter, childNode);
                /*                if (isConstructor) {
                 let  blockChildren = childNode.children;
                 emitter.insert("super()");
                 let firstChild = blockChildren[0];
                 visitNode(emitter, firstChild);
                 for (var j = 1; j < blockChildren.length; j++) {
                 var blockChild = blockChildren[j];
                 visitNode(emitter, firstChild);
                 }
                 } else {
                 emitter.insert(" => ");
                 visitNode(emitter, childNode);
                 }*/
            }
            else {
                visitNode(emitter, childNode);
            }
        }
        //visitNodes(emitter, node.getChildFrom(NodeKind.NAME));
    });
}
function emitGet(emitter, node) {
    let name = node.findChild(nodeKind_1.default.NAME);
    if (node.kind !== nodeKind_1.default.FUNCTION || name.text !== emitter.currentClassName) {
        emitClassField(emitter, node);
        emitter.consume('function', name.start);
        if (emitter.namespaces.member(name))
            emitName(emitter, name);
        else
            emitter.catchup(name.end);
    }
    else {
        let mods = node.findChild(nodeKind_1.default.MOD_LIST);
        if (mods) {
            emitter.catchup(mods.start);
        }
        emitter.insert('constructor');
        // Check if the class extends an Array, in which an insertion
        // is required in the constructor. It's a weird
        // case but necessary.
        if (emitter.output.indexOf('extends Array') > -1) {
            // Prepare the injection.
            var className = name.text;
            var injection = '\nvar thisAny:any=this;\nthisAny.__proto__ = ' + className + '.prototype;\n';
            // Find position of insertion.
            // Enter child nodes and process 1 by 1...
            emitter.withScope(getFunctionDeclarations(emitter, node), () => {
                emitter.skipTo(name.end);
                var children = node.getChildFrom(nodeKind_1.default.NAME);
                for (var i = 0; i < children.length; i++) {
                    var child = children[i];
                    if (child.kind !== nodeKind_1.default.BLOCK) {
                        visitNode(emitter, child);
                        // emitter.skipTo(child.end);
                    }
                    else {
                        // Find super()
                        for (var j = 0; j < child.children.length; j++) {
                            var grandChild = child.children[j];
                            visitNode(emitter, grandChild);
                            emitter.catchup(grandChild.end + 1);
                            if (containsSuperCall(grandChild)) {
                                emitter.insert(injection);
                            }
                        }
                    }
                }
            });
            return;
        }
        else {
            emitter.skipTo(name.end);
        }
    }
    emitter.withScope(getFunctionDeclarations(emitter, node), () => {
        visitNodes(emitter, node.getChildFrom(nodeKind_1.default.NAME));
    });
}
function containsSuperCall(node) {
    if (node.kind === nodeKind_1.default.CALL && node.children[0].kind === nodeKind_1.default.IDENTIFIER
        && node.children[0].text === 'super')
        return true;
    return node.children.some(child => child && child.kind !== nodeKind_1.default.FUNCTION
        && child.kind !== nodeKind_1.default.LAMBDA && containsSuperCall(child));
}
function emitPropertyDecl(emitter, node, isConst = false) {
    let names = node.findChildren(nodeKind_1.default.NAME_TYPE_INIT);
    if (names.length > 1) {
        //emitter.insert("<prop:>");
        let typeNode;
        let typeStr;
        let lastNameNode = names[names.length - 1];
        let type = lastNameNode.findChild(nodeKind_1.default.TYPE);
        if (type.text != "")
            typeNode = type;
        typeStr = typeNode ? `:${typeNode.text}` : "";
        let mods = node.findChild(nodeKind_1.default.MOD_LIST);
        let start = node.start;
        names.forEach((nameTypeInit, i) => {
            emitClassField(emitter, node, isConst);
            emitter.consume(isConst ? Keywords.CONST : Keywords.VAR, nameTypeInit.start);
            //visitNode(emitter, name);
            emitter.declareInScope({
                name: nameTypeInit.findChild(nodeKind_1.default.NAME).text,
                type: getDeclarationType(emitter, nameTypeInit),
                as3Type: getAS3DeclarationType(nameTypeInit)
            });
            //emitter.catchup(nameTypeInit.start);
            let nameNode = nameTypeInit.children[0];
            //let typeNode:Node = nameTypeInit.children[1];
            //visitNodes(emitter, nameTypeInit.children);
            //emitter.index
            emitter.insert(` ${nameNode.text}`);
            if (typeNode) {
                emitter.insert(":");
                emitter.skipTo(typeNode.start);
                visitNode(emitter, typeNode);
                emitter.insert(";\n\t");
            }
            //emitter.insert(`${typeStr};\n\t`);
            emitter.setIndexPos(start);
        });
        //emitter.insert("</prop:>");
        emitter.skipTo(node.nextSibling.start);
    }
    else {
        emitClassField(emitter, node, isConst);
        names.forEach((nameTypeInit, i) => {
            if (i === 0) {
                emitter.consume(isConst ? Keywords.CONST : Keywords.VAR, nameTypeInit.start);
            }
            visitNode(emitter, nameTypeInit);
        });
    }
}
function emitClassField(emitter, node, isConst = false) {
    let mods = node.findChild(nodeKind_1.default.MOD_LIST);
    if (mods) {
        emitter.catchup(mods.start);
        mods.children.forEach(node => {
            emitter.catchup(node.start);
            if (emitter.namespaces.memberDeclaration(mods.parent)
                && ['static', 'public', 'private', 'protected', 'override', 'final'].indexOf(node.text) < 0) {
                emitter.skipTo(node.end);
                return;
            }
            if (node.text !== Keywords.PRIVATE &&
                node.text !== Keywords.PUBLIC &&
                node.text !== Keywords.PROTECTED &&
                node.text !== Keywords.STATIC) {
                emitter.commentNode(node, false);
            }
            emitter.catchup(node.end);
        });
        const name = node.findChild(nodeKind_1.default.NAME)
            || (node.findChild(nodeKind_1.default.NAME_TYPE_INIT) && node.findChild(nodeKind_1.default.NAME_TYPE_INIT).findChild(nodeKind_1.default.NAME));
        const member = name && emitter.namespaces.member(name);
        if (isConst && member)
            emitter.insert(' readonly ');
        if (member && emitter.options.nativeProxyModule !== undefined
            && member.uri === 'http://www.adobe.com/2006/actionscript/flash/proxy'
            && node.kind === nodeKind_1.default.FUNCTION)
            emitter.insert('protected ');
    }
}
function emitDeclaration(emitter, node) {
    emitter.catchup(node.start);
    visitNode(emitter, node.findChild(nodeKind_1.default.META_LIST));
    let mods = node.findChild(nodeKind_1.default.MOD_LIST);
    if (mods && mods.children.length) {
        emitter.catchup(mods.start);
        let insertExport = false;
        mods.children.forEach(node => {
            if (node.text !== 'private') {
                insertExport = true;
            }
            emitter.skipTo(node.end);
        });
        if (insertExport) {
            emitter.insert('export');
        }
    }
}
function emitType(emitter, node) {
    const tweenLocal = emitter.generated && emitter.generated.options.plan.references.some(r => r.owner === emitter.generated.lexical.owner && r.start === node.start && r.end === node.end && r.kind === 'tween-handle-local');
    if (tweenLocal) {
        const input = native_generated_declarations_2.nativeGeneratedDeclarationInputs(emitter.generated.options.plan, emitter.generated.options.plan.scope);
        if (!emitter.options.nativeTypedLocals || !emitter.options.nativeTweenModule
            || emitter.options.nativeTweenModule !== native_xml_1.xmlGlobalProviderModule(input.tweenHandleProviderModule, emitter.generated.options.module))
            throw new Error('AS3_TWEEN_UNSUPPORTED: exact planned migration provider and typed locals required');
        emitter.catchup(node.start);
        emitter.insert('any');
        emitter.skipTo(node.end);
        return;
    }
    // Don't emit type on 'constructor' functions.
    if (node.parent.kind === nodeKind_1.default.FUNCTION) {
        let name = node.parent.findChild(nodeKind_1.default.NAME);
        if (name && name.text === emitter.currentClassName) {
            emitter.catchup(node.previousSibling.end);
            emitter.skipTo(node.end);
            return;
        }
    }
    emitter.catchup(node.start);
    if (!node.text) {
        if (node.kind === nodeKind_1.default.VECTOR) {
            emitVector(emitter, node);
        }
        return;
    }
    emitter.skipTo(node.end);
    const global = emitter.nativeGlobals.resolve(node, true);
    if (global) {
        emitter.ensureImportIdentifier(global.name + ' as ' + global.alias, global.module, false);
        emitter.insert(global.alias);
        return;
    }
    // Source RegExp annotations must name the same nominal provider as their
    // runtime coercions. Resolve the exact planned type span, not its spelling:
    // an imported/source class named RegExp must retain its own identity.
    if (emitter.generated && emitter.generated.options.plan.references.some(ref => ref.owner === emitter.generated.lexical.owner && ref.start === node.start && ref.end === node.end
        && ref.kind === 'native' && ref.identity === 'RegExp')) {
        const input = native_generated_declarations_2.nativeGeneratedDeclarationInputs(emitter.generated.options.plan, emitter.generated.options.plan.scope);
        const provider = input.providers.RegExp;
        emitter.insert(propertyHelper(emitter, provider.exportName, native_xml_1.xmlGlobalProviderModule(provider.module, emitter.generated.options.module)));
        return;
    }
    let sourceClassType = !!node.qualifiedName;
    if (emitter.options.nativeCallableMetadata) {
        let declaration = node.parent;
        while (declaration && declaration.kind !== nodeKind_1.default.CLASS)
            declaration = declaration.parent;
        let pkg = declaration && declaration.parent;
        while (pkg && pkg.kind !== nodeKind_1.default.PACKAGE)
            pkg = pkg.parent;
        if (declaration && pkg) {
            const name = declaration.findChild(nodeKind_1.default.NAME).text;
            const namespace = pkg.findChild(nodeKind_1.default.NAME).text;
            const identity = native_source_type_1.nativeSourceTypeIdentity(node, namespace + '.' + name, pkg.findChild(nodeKind_1.default.CONTENT).findChildren(nodeKind_1.default.IMPORT).map(value => value.text));
            if (identity === namespace + '.' + name)
                sourceClassType = true;
        }
    }
    // ensure type is imported
    if (sourceClassType || GLOBAL_NAMES.indexOf(node.text) === -1 && !emitter.getTypeRemap(node.text) &&
        TYPE_REMAP_VALUES.indexOf(node.text) === -1) {
        emitter.ensureImportIdentifier(node.text);
    }
    let typeName = sourceClassType ? node.text : emitter.getTypeRemap(node.text) || node.text;
    emitter.insert(typeName);
}
/** Vector provider bindings are relative to the plan's declaration module. */
function vectorProviderModule(module, domain) {
    native_generated_emission_1.generatedModule(module);
    native_generated_emission_1.generatedModule(domain);
    if (module.charAt(0) !== '.')
        return module;
    const path = require('path').posix;
    const result = path.normalize(path.join(path.dirname(domain), module));
    return result.charAt(0) === '.' ? result : './' + result;
}
function emitVector(emitter, node) {
    const options = emitter.options.nativeVectorTypes || emitter.options.nativeGeneratedDeclarations;
    if (options) {
        const input = native_generated_declarations_2.nativeGeneratedDeclarationInputs(options.plan, options.plan.scope);
        if (input.vectorProviderModule) {
            const owners = Object.keys(input.sources).filter(owner => input.sources[owner].source === emitter.source);
            const owner = emitter.generated ? emitter.generated.projection.binding.identity : owners.length === 1 ? owners[0] : undefined;
            const vector = owner && options.plan.vectors.find(v => v.owner === owner && v.start === node.start && v.end === node.end);
            if (vector)
                native_generated_declarations_2.nativeGeneratedDeclarationSource(options.plan, options.plan.scope, owner, emitter.source);
            if (!vector)
                throw new Error('AS3_VECTOR_EMISSION_UNSUPPORTED: exact source specialization required');
            if (emitter.isNew)
                throw new Error('AS3_VECTOR_EMISSION_UNSUPPORTED: construction requires separate qualification');
            let alias = '__as3_Vector';
            while (emitter.source.indexOf(alias) >= 0)
                alias += '_';
            emitter.ensureImportIdentifier('AS3Vector as ' + alias, vectorProviderModule(input.vectorProviderModule, options.module), false);
            emitter.catchup(node.start);
            emitter.insert(alias + '<');
            const element = node.findChild(nodeKind_1.default.TYPE);
            emitter.skipTo(element.start);
            emitType(emitter, element);
            emitter.insert('>');
            emitter.skipTo(node.end);
            return;
        }
    }
    if (!emitter.isNew) {
        emitter.catchup(node.start);
    }
    let type = node.findChild(nodeKind_1.default.TYPE);
    if (!type) {
        type = node_1.createNode(nodeKind_1.default.TYPE, {
            text: 'any',
            start: node.start,
            end: node.end
        });
        type.parent = node;
    }
    emitter.skipTo(type.start);
    if (!emitter.isNew) {
        emitType(emitter, type);
    }
    emitter.insert('[]');
    emitter.skipTo(node.end);
}
function emitShortVector(emitter, node) {
    emitter.catchup(node.start);
    let vector = node.findChild(nodeKind_1.default.VECTOR);
    emitter.insert('Array');
    let type = vector.findChild(nodeKind_1.default.TYPE);
    if (type) {
        emitType(emitter, type);
    }
    else {
        emitter.insert('any');
    }
    emitter.catchup(vector.end);
    emitter.insert('(');
    let arrayLiteral = node.findChild(nodeKind_1.default.ARRAY);
    emitArray(emitter, arrayLiteral);
    emitter.insert(')');
    emitter.skipTo(node.end);
}
function emitDynamicConstruction(emitter, node) {
    if ((!emitter.references && !emitter.generated) || node.children.length !== 1)
        return false;
    const call = node.children[0];
    const callee = call.kind === nodeKind_1.default.CALL ? call.children[0] : call;
    const args = call.kind === nodeKind_1.default.CALL ? call.findChild(nodeKind_1.default.ARGUMENTS) : undefined;
    const target = node_1.unwrapEncapsulatedExpression(callee);
    const binding = target.kind === nodeKind_1.default.IDENTIFIER && emitter.findDefInScope(target.text);
    if (!emitter.references) {
        if (binding && !binding.bound && ['Object', 'Function', '*'].indexOf(binding.as3Type) >= 0)
            throw new Error('AS3_DYNAMIC_CONSTRUCTION_UNSUPPORTED: explicit reference authority required');
        return false;
    }
    const classCast = target.kind === nodeKind_1.default.RELATION && target.children.length === 3
        && target.children[1].text === 'as' && target.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && target.lastChild.text === 'Class' && emitter.references.resolve('Class') === 'Class'
        && !emitter.references.sourceClass('Class') && !emitter.references.sourceInterface('Class');
    if (!classCast && (!binding || binding.bound || ['Object', 'Function', '*'].indexOf(binding.as3Type) < 0))
        return false;
    const module = emitter.options.nativeDynamicConstructionModule;
    if (!module || !args)
        throw new Error('AS3_DYNAMIC_CONSTRUCTION_UNSUPPORTED: explicit invocation module and argument list required');
    let helper = '__as3_constructValue';
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    emitter.ensureImportIdentifier('as3ConstructValue as ' + helper, module, false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitter.skipTo(callee.start);
    visitNode(emitter, callee);
    emitter.catchup(callee.end);
    emitter.insert(',()=>[');
    args.children.forEach((arg, index) => { if (index)
        emitter.insert(','); emitter.skipTo(arg.start); visitNode(emitter, arg); emitter.catchup(arg.end); });
    const scriptGlobal = emitter.generated && emitter.generated.projection.binding.scriptGlobalExport ? emitter.generated.lexical.scriptGlobal : null;
    emitter.insert(']' + (scriptGlobal ? ',' + scriptGlobal : '') + '))');
    emitter.skipTo(node.end);
    return true;
}
function nativeRegExpReference(emitter, node) {
    if (!emitter.generated || !emitter.references || !node || node.kind !== nodeKind_1.default.IDENTIFIER || node.text !== 'RegExp'
        || emitter.references.resolve(node.text) !== 'RegExp')
        return null;
    const binding = emitter.generated.options.plan.nativeBindings.find(b => b.qname === 'RegExp' && !b.nativeInterface);
    if (!binding)
        return null;
    const shadow = emitter.findDefInScope(node.text);
    if (shadow && (shadow.bound || Object.prototype.hasOwnProperty.call(shadow, 'as3Type'))
        || native_typeof_1.typeOfBinding(node, emitter.source, []) === 'lexical')
        return null;
    return propertyHelper(emitter, binding.referenceExport, emitter.generated.options.module);
}
function emitRegExpConstruction(emitter, node, conversion) {
    const call = conversion ? node : node.children[0], callee = call && call.kind === nodeKind_1.default.CALL && call.children[0];
    const token = callee && nativeRegExpReference(emitter, callee);
    if (!token)
        return false;
    const args = call.findChild(nodeKind_1.default.ARGUMENTS);
    if (!args)
        return false;
    if (conversion && args.children.length !== 1)
        throw new Error('AS3_REGEXP_LITERAL_UNSUPPORTED: direct Class call requires one source argument');
    const helper = propertyHelper(emitter, conversion ? 'as3CallClass' : 'as3ConstructClass', native_generated_emission_1.generatedModule(emitter.options.nativeObjectCreationModule));
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(' + token + ',[');
    args.children.forEach((arg, index) => { if (index)
        emitter.insert(','); emitter.skipTo(getExpressionStart(arg)); visitNode(emitter, arg); emitter.catchup(getEffectiveNodeEnd(arg)); });
    emitter.insert(']))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitNew(emitter, node) {
    if (emitRegExpConstruction(emitter, node, false))
        return;
    if (emitDataEventConstruction(emitter, node) || emitErrorEventSubtypeConstruction(emitter, node))
        return;
    if (emitLexicalSpriteConstruction(emitter, node))
        return;
    if (emitDynamicConstruction(emitter, node))
        return;
    if (emitGeneratedVectorLiteral(emitter, node))
        return;
    if (emitGeneratedVectorConstruction(emitter, node))
        return;
    if (emitter.generated && node.children.length === 1 && node.children[0].kind === nodeKind_1.default.CALL) {
        const call = node.children[0], callee = call.children[0], args = call.findChild(nodeKind_1.default.ARGUMENTS);
        const binding = callee && callee.kind === nodeKind_1.default.IDENTIFIER && emitter.findDefInScope(callee.text);
        const embedded = callee && callee.kind === nodeKind_1.default.IDENTIFIER && (!binding || binding.bound)
            && emitter.generated.lexical.embeddedConstant(emitter.generated.lexical.trait(callee.text, true));
        if ((binding && !binding.bound && binding.as3Type === 'Class' || embedded) && args) {
            const module = native_generated_emission_1.generatedModule(emitter.options.nativeObjectCreationModule);
            let helper = '__as3_constructCapturedClass';
            while (emitter.source.indexOf(helper) >= 0)
                helper += '_';
            emitter.ensureImportIdentifier('as3ConstructClass as ' + helper, module, false);
            emitter.nativeSourceHelpers.add(helper);
            emitter.catchup(node.start);
            emitter.insert('(<any>' + helper + '(');
            emitter.skipTo(callee.start);
            visitNode(emitter, callee);
            emitter.catchup(callee.end);
            emitter.insert(',[');
            args.children.forEach((arg, index) => { if (index)
                emitter.insert(','); emitter.skipTo(arg.start); visitNode(emitter, arg); emitter.catchup(arg.end); });
            const scriptGlobal = emitter.generated.projection.binding.scriptGlobalExport ? emitter.generated.lexical.scriptGlobal : null;
            emitter.insert(']' + (scriptGlobal ? ',' + scriptGlobal : '') + '))');
            emitter.skipTo(node.end);
            return;
        }
    }
    if (emitSourceErrorConstruction(emitter, node))
        return;
    if (emitBuiltinObjectCreation(emitter, node))
        return;
    if (emitBuiltinEmptyStringConstruction(emitter, node))
        return;
    emitter.catchup(node.start);
    emitter.isNew = true;
    emitter.emitThisForNextIdent = false;
    visitNodes(emitter, node.children);
    emitter.isNew = false;
    emitter.emitThisForNextIdent = true;
}
function emitGeneratedVectorLiteral(emitter, node) {
    const options = emitter.options.nativeVectorTypes || emitter.options.nativeGeneratedDeclarations;
    const literal = node.children.length === 1 && node.children[0];
    if (!options || !literal || literal.kind !== nodeKind_1.default.SHORT_VECTOR)
        return false;
    const input = native_generated_declarations_2.nativeGeneratedDeclarationInputs(options.plan, options.plan.scope);
    const fail = (reason) => { throw new Error('AS3_VECTOR_EMISSION_UNSUPPORTED: ' + reason); };
    if (!input.vectorProviderModule || !emitter.generated)
        fail('literal requires generated class and Vector provider authority');
    const owner = emitter.generated.projection.binding.identity, vector = literal.findChild(nodeKind_1.default.VECTOR), values = literal.findChild(nodeKind_1.default.ARRAY);
    const spec = vector && options.plan.vectors.find(v => v.owner === owner && v.start === vector.start && v.end === vector.end);
    if (!spec || spec.identity !== 'Vector.<Class>' || !values)
        fail('exact Class literal specialization required');
    native_generated_declarations_2.nativeGeneratedDeclarationSource(options.plan, options.plan.scope, owner, emitter.source);
    let helper = '__as3_literalVector', specialization = '__as3_vectorSpec_' + spec.specExport, value = '__as3_literalResult';
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    while (emitter.source.indexOf(specialization) >= 0)
        specialization += '_';
    while (emitter.source.indexOf(value) >= 0)
        value += '_';
    emitter.ensureImportIdentifier('as3VectorCreate as ' + helper, vectorProviderModule(input.vectorProviderModule, options.module), false);
    emitter.ensureImportIdentifier(spec.specExport + ' as ' + specialization, native_generated_emission_1.generatedModule(options.module), false);
    emitter.nativeSourceHelpers.add(helper);
    // AIR converts each element before evaluating the following expression. An
    // eager temporary array would execute effects after a failed Class coercion.
    emitter.catchup(node.start);
    emitter.insert('(()=>{const ' + value + '=' + helper + '(' + specialization + ');');
    values.children.forEach(element => { emitter.insert(value + '.push('); emitter.skipTo(element.start); visitNode(emitter, element); emitter.catchup(element.end); emitter.insert(');'); });
    emitter.insert('return ' + value + ';})()');
    emitter.skipTo(node.end);
    return true;
}
function emitGeneratedVectorConstruction(emitter, node, conversion = false) {
    const options = emitter.options.nativeVectorTypes || emitter.options.nativeGeneratedDeclarations;
    if (!options || !conversion && node.children.length !== 1)
        return false;
    const call = conversion ? node : node.children[0], vector = call && call.kind === nodeKind_1.default.CALL && call.children[0];
    if (!vector || vector.kind !== nodeKind_1.default.VECTOR)
        return false;
    const input = native_generated_declarations_2.nativeGeneratedDeclarationInputs(options.plan, options.plan.scope);
    const fail = (reason) => { throw new Error('AS3_VECTOR_EMISSION_UNSUPPORTED: ' + reason); };
    if (!input.vectorProviderModule) {
        if (emitter.generated)
            fail('explicit Vector provider required');
        return false;
    }
    if (!emitter.generated)
        fail('construction requires generated class authority');
    const owner = emitter.generated.projection.binding.identity;
    const spec = options.plan.vectors.find(v => v.owner === owner && v.start === vector.start && v.end === vector.end);
    if (!spec)
        fail('exact construction specialization required');
    native_generated_declarations_2.nativeGeneratedDeclarationSource(options.plan, options.plan.scope, owner, emitter.source);
    const args = call.findChild(nodeKind_1.default.ARGUMENTS);
    if (!args || (conversion ? args.children.length !== 1 : args.children.length > 2))
        fail('Vector argument count requires qualification');
    // The engine validates the numeric length atom and performs uint conversion.
    // Pass authored arguments unchanged so both expressions run before validation;
    // in particular, an omitted length differs from explicitly supplied undefined.
    let helper = conversion ? '__as3_convertVector' : '__as3_createVector', specialization = '__as3_vectorSpec_' + spec.specExport;
    // Each specialization needs a distinct binding even when a class constructs several types.
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    while (emitter.source.indexOf(specialization) >= 0)
        specialization += '_';
    emitter.ensureImportIdentifier((conversion ? 'as3VectorConvert' : 'as3VectorCreate') + ' as ' + helper, vectorProviderModule(input.vectorProviderModule, options.module), false);
    emitter.ensureImportIdentifier(spec.specExport + ' as ' + specialization, native_generated_emission_1.generatedModule(options.module), false);
    emitter.nativeSourceHelpers.add(helper);
    if (spec.elementNative) {
        const element = vector.findChild(nodeKind_1.default.TYPE), name = element.text, shadow = emitter.findDefInScope(name);
        if (shadow && (shadow.bound || Object.prototype.hasOwnProperty.call(shadow, 'as3Type')))
            fail('shadowed native element construction');
        if (!/^[A-Za-z_$][\w$]*$/.test(name) || emitter.references.resolve(name) !== spec.elementNative
            || !emitter.options.importModules || emitter.options.importModules[spec.elementNative] !== input.providers[spec.elementNative].module)
            fail('native element construction requires the exact provider binding');
    }
    emitter.catchup(node.start);
    if (spec.elementClass) {
        const element = vector.findChild(nodeKind_1.default.TYPE), name = element.text, shadow = emitter.findDefInScope(name);
        if (shadow && (shadow.bound || Object.prototype.hasOwnProperty.call(shadow, 'as3Type')))
            fail('shadowed class element construction');
        if (!/^[A-Za-z_$][\w$]*$/.test(name) || emitter.references.resolve(name) !== spec.elementClass)
            fail('class element construction requires an exact imported identifier');
        const own = emitter.classFactory && emitter.currentClassName === name;
        if (own)
            emitter.insert('(' + emitter.classFactory.value + ',');
        else {
            emitter.ensureImportIdentifier(name);
            const read = propertyHelper(emitter, 'readNativeClass', native_generated_emission_1.generatedModule(emitter.options.nativeClassHelperModules && emitter.options.nativeClassHelperModules.nativeClass));
            emitter.insert('(' + read + '(' + name + '),');
        }
    }
    emitter.insert(helper + '(' + specialization);
    args.children.forEach(arg => { emitter.insert(','); emitter.skipTo(arg.start); visitNode(emitter, arg); emitter.catchup(arg.end); });
    emitter.insert(spec.elementClass ? '))' : ')');
    emitter.skipTo(node.end);
    return true;
}
function emitBuiltinEmptyStringConstruction(emitter, node) {
    const module = emitter.options.nativeStringCoercionModule;
    if (module === undefined || !node || node.kind !== nodeKind_1.default.NEW || node.children.length !== 1)
        return false;
    const call = node.children[0];
    if (!call || call.kind !== nodeKind_1.default.CALL || call.children.length < 2)
        return false;
    const callee = call.children[0], args = call.findChild(nodeKind_1.default.ARGUMENTS);
    if (!callee || callee.kind !== nodeKind_1.default.IDENTIFIER || callee.text !== 'String'
        || emitter.findDefInScope('String') || !args || args.children.length !== 0)
        return false;
    emitter.catchup(node.start);
    emitter.skipTo(node.end);
    emitter.insert('""');
    return true;
}
function emitSourceErrorConstruction(emitter, node) {
    const module = emitter.options.nativeSourceErrorModule;
    if (module === undefined || !node || node.kind !== nodeKind_1.default.NEW && node.kind !== nodeKind_1.default.CALL)
        return false;
    const call = node.kind === nodeKind_1.default.NEW ? node.children[0] : node;
    if (!call || call.kind !== nodeKind_1.default.CALL || call.children.length < 2)
        return false;
    const callee = call.children[0];
    if (!callee || callee.kind !== nodeKind_1.default.IDENTIFIER || emitter.findDefInScope(callee.text))
        return false;
    const exports = {
        Error: 'as3CreateError',
        ArgumentError: 'as3CreateArgumentError',
        ReferenceError: 'as3CreateReferenceError',
        RangeError: 'as3CreateRangeError'
    };
    const exported = exports[callee.text];
    if (!exported)
        return false;
    const args = call.findChild(nodeKind_1.default.ARGUMENTS);
    if (!args)
        return false;
    if (node.kind === nodeKind_1.default.CALL && args.children.length !== 1)
        throw new Error('AS3_SOURCE_ERROR_UNSUPPORTED: direct Error call requires one message');
    let helper = '__as3_' + exported;
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    emitter.ensureImportIdentifier(exported + ' as ' + helper, module, false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);
    emitter.insert(helper + '(');
    if (args.children.length) {
        emitter.skipTo(args.children[0].start);
        visitNodes(emitter, args.children);
        // Replace the source call's closing parenthesis with the helper's one;
        // retain any source whitespace immediately before it.
        const close = args.end > args.start && emitter.source.charAt(args.end - 1) === ')' ? args.end - 1 : args.end;
        emitter.catchup(close);
    }
    else {
        emitter.skipTo(args.end);
    }
    emitter.insert(')');
    emitter.skipTo(node.end);
    return true;
}
function reflectionStringLiteral(emitter, node) {
    if (!node || node.kind !== nodeKind_1.default.LITERAL)
        return null;
    const raw = emitter.sourceBetween(node.start, node.end).trim();
    if (raw.length < 2 || (raw.charAt(0) !== '"' && raw.charAt(0) !== "'")
        || raw.charAt(raw.length - 1) !== raw.charAt(0))
        return null;
    if (raw.charAt(0) === '"') {
        try {
            return JSON.parse(raw);
        }
        catch (_) {
            return null;
        }
    }
    // The admitted query corpus uses literal attribute values. Decode only the
    // AS3 escapes needed for those literals; reject everything else instead of
    // silently changing a predicate.
    let value = raw.substring(1, raw.length - 1);
    if (/\\(?![\\'"nrtbfu0-9x])/.test(value))
        return null;
    return value.replace(/\\([\\'"nrt])/g, (_match, escaped) => {
        return escaped === 'n' ? '\n' : escaped === 'r' ? '\r' : escaped === 't' ? '\t' : escaped === 'b' ? '\b' : escaped;
    });
}
function reflectionFilterStep(emitter, node) {
    if (!node || node.kind !== nodeKind_1.default.EQUALITY || node.children.length !== 3)
        return null;
    const attribute = node.children[0];
    const operator = node.children[1];
    const value = reflectionStringLiteral(emitter, node.children[2]);
    if (!attribute || attribute.kind !== nodeKind_1.default.IDENTIFIER || !attribute.text
        || attribute.text.charAt(0) !== '@' || !operator || operator.kind !== nodeKind_1.default.OP
        || operator.text !== '==' || value === null)
        return null;
    return { kind: 'filter', attribute: attribute.text.substring(1), value };
}
function reflectionQueryPlan(emitter, node) {
    if (!node || node.kind !== nodeKind_1.default.CALL || node.children.length < 2)
        return null;
    const finalCallee = node.children[0];
    const finalArgs = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!finalCallee || finalCallee.kind !== nodeKind_1.default.DOT || !finalArgs || finalArgs.children.length)
        return null;
    const finalName = finalCallee.children[1];
    if (!finalName || finalName.kind !== nodeKind_1.default.LITERAL || finalName.text !== 'length')
        return null;
    const steps = [];
    function consume(current) {
        if (!current)
            return null;
        if (current.kind === nodeKind_1.default.DOT) {
            if (current.children.length !== 2 || !current.children[1]
                || current.children[1].kind !== nodeKind_1.default.LITERAL
                || !current.children[1].text || current.children[1].text === 'length')
                return null;
            const root = consume(current.children[0]);
            if (!root)
                return null;
            steps.push({ kind: 'child', name: current.children[1].text });
            return root;
        }
        if (current.kind === nodeKind_1.default.E4X_FILTER) {
            if (current.children.length !== 2)
                return null;
            const root = consume(current.children[0]);
            const filter = reflectionFilterStep(emitter, current.children[1]);
            if (!root || !filter)
                return null;
            steps.push(filter);
            return root;
        }
        if (current.kind === nodeKind_1.default.CALL && current.children.length >= 2
            && current.children[0].kind === nodeKind_1.default.IDENTIFIER
            && current.children[0].text === 'describeType') {
            const args = current.findChild(nodeKind_1.default.ARGUMENTS);
            if (!args || args.children.length !== 1)
                return null;
            return current;
        }
        return null;
    }
    const root = consume(finalCallee.children[0]);
    if (!root)
        return null;
    const rootArgs = root.findChild(nodeKind_1.default.ARGUMENTS);
    return { root, argument: rootArgs && rootArgs.children[0], steps };
}
function reflectionImportedDescribeType(emitter) {
    const declaration = emitter.findDefInScope('describeType');
    return !!declaration && declaration.sourceImport === 'flash.utils.describeType';
}
function hasReflectionFilter(node) {
    if (!node)
        return false;
    if (node.kind === nodeKind_1.default.E4X_FILTER)
        return true;
    return !!node.children && node.children.some(hasReflectionFilter);
}
function emitReflectionQuery(emitter, node) {
    if (emitter.options.nativeReflectionQueryModule === undefined)
        return false;
    const plan = reflectionQueryPlan(emitter, node);
    if (!plan) {
        if (hasReflectionFilter(node) && reflectionImportedDescribeType(emitter))
            throw new Error('AS3_REFLECTION_QUERY_UNSUPPORTED: filter requires a qualified describeType child/count query');
        return false;
    }
    if (!reflectionImportedDescribeType(emitter))
        return false;
    if (!plan.argument)
        throw new Error('AS3_REFLECTION_QUERY_UNSUPPORTED: describeType query receiver is missing');
    const module = emitter.options.nativeReflectionQueryModule;
    if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
        throw new Error('AS3_REFLECTION_QUERY_UNSUPPORTED: explicit common reflection query module required');
    let helper = '__as3_describeTypeQueryLength';
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    emitter.ensureImportIdentifier('as3DescribeTypeQueryLength as ' + helper, module, false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);
    emitter.insert(helper + '(');
    emitter.skipTo(plan.argument.start);
    visitNode(emitter, plan.argument);
    emitter.catchup(plan.argument.end);
    emitter.insert(', ' + JSON.stringify(plan.steps) + ')');
    emitter.skipTo(node.end);
    return true;
}
function reflectionXMLRoot(node) {
    if (!node || node.kind !== nodeKind_1.default.CALL || node.children.length < 2
        || node.children[0].kind !== nodeKind_1.default.IDENTIFIER
        || node.children[0].text !== 'describeType')
        return null;
    const args = node.findChild(nodeKind_1.default.ARGUMENTS);
    return args && args.children.length === 1 ? node : null;
}
function reflectionXMLArgument(node) {
    const root = reflectionXMLRoot(node);
    return root && root.findChild(nodeKind_1.default.ARGUMENTS).children[0];
}
function emitReflectionXMLRoot(emitter, node, helper) {
    const argument = reflectionXMLArgument(node);
    emitter.catchup(node.start);
    emitter.insert(helper + '(');
    emitter.skipTo(argument.start);
    visitNode(emitter, argument);
    emitter.catchup(argument.end);
    emitter.insert(')');
    emitter.skipTo(node.end);
}
function emitReflectionXML(emitter, node) {
    if (emitter.options.nativeReflectionXMLModule === undefined)
        return false;
    if (!reflectionImportedDescribeType(emitter))
        return false;
    const module = emitter.options.nativeReflectionXMLModule;
    if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
        throw new Error('AS3_REFLECTION_XML_UNSUPPORTED: explicit common reflection XML module required');
    // These scalar E4X reads need exact identity fields, not a fabricated
    // complete describeType document for a generated trait projection.
    if (node.kind === nodeKind_1.default.CALL && node.children[0].kind === nodeKind_1.default.IDENTIFIER && node.children[0].text === 'String'
        && !emitter.findDefInScope('String')) {
        const args = node.findChild(nodeKind_1.default.ARGUMENTS), attribute = args && args.children.length === 1 && args.children[0];
        if (attribute && attribute.kind === nodeKind_1.default.DOT && attribute.children[1].kind === nodeKind_1.default.LITERAL) {
            let root = attribute.children[0], field;
            if (attribute.children[1].text === '@name' && reflectionXMLRoot(root))
                field = 'name';
            else if (attribute.children[1].text === '@type' && root.kind === nodeKind_1.default.ARRAY_ACCESSOR
                && root.children[1].kind === nodeKind_1.default.LITERAL && root.children[1].text === '0') {
                const child = root.children[0];
                if (child.kind === nodeKind_1.default.DOT && child.children[1].text === 'extendsClass' && reflectionXMLRoot(child.children[0])) {
                    root = child.children[0];
                    field = 'base';
                }
            }
            if (field) {
                const helper = propertyHelper(emitter, 'as3DescribeTypeIdentityAttribute', module);
                emitter.catchup(node.start);
                emitter.insert(helper + '(');
                const receiver = reflectionXMLArgument(root);
                emitter.skipTo(receiver.start);
                visitNode(emitter, receiver);
                emitter.catchup(receiver.end);
                emitter.insert(',' + JSON.stringify(field) + ')');
                emitter.skipTo(node.end);
                return true;
            }
        }
    }
    // A literal attribute followed by toString() is the scalar form used by
    // the maintained JSON encoder. Missing attributes stringify to the empty
    // string in Flash; the provider's nominal reader returns undefined.
    if (node.kind === nodeKind_1.default.CALL && node.children.length >= 2
        && node.children[0].kind === nodeKind_1.default.DOT) {
        const toStringName = node.children[0].children[1];
        const attributeDot = node.children[0].children[0];
        const attribute = attributeDot && attributeDot.kind === nodeKind_1.default.DOT
            ? attributeDot.children[1] : null;
        const root = attributeDot && attributeDot.children[0];
        const args = node.findChild(nodeKind_1.default.ARGUMENTS);
        if (toStringName && toStringName.kind === nodeKind_1.default.LITERAL && toStringName.text === 'toString'
            && args && args.children.length === 0 && attribute && attribute.kind === nodeKind_1.default.LITERAL
            && /^@[A-Za-z_$][A-Za-z0-9_$]*$/.test(attribute.text) && reflectionXMLRoot(root)) {
            let xmlHelper = '__as3_describeTypeXML';
            while (emitter.source.indexOf(xmlHelper) >= 0)
                xmlHelper += '_';
            emitter.ensureImportIdentifier('as3DescribeTypeXML as ' + xmlHelper, module, false);
            emitter.nativeSourceHelpers.add(xmlHelper);
            let attributeHelper = '__as3_xmlAttributeValue';
            while (emitter.source.indexOf(attributeHelper) >= 0)
                attributeHelper += '_';
            emitter.ensureImportIdentifier('as3XMLAttributeValue as ' + attributeHelper, module, false);
            emitter.nativeSourceHelpers.add(attributeHelper);
            emitter.catchup(node.start);
            emitter.insert('(' + attributeHelper + '(' + xmlHelper + '(');
            const argument = reflectionXMLArgument(root);
            emitter.skipTo(argument.start);
            visitNode(emitter, argument);
            emitter.catchup(argument.end);
            emitter.insert('), ' + JSON.stringify(attribute.text.substring(1)) + ') || "")');
            emitter.skipTo(node.end);
            return true;
        }
        // A named descendant list exposes a property in XMLList, whereas AS3's
        // source spelling invokes length(). Preserve that distinction explicitly.
        const lengthName = node.children[0].children[1];
        const descendant = node.children[0].children[0];
        const descendantName = descendant && descendant.kind === nodeKind_1.default.E4X_DESCENDANT
            ? descendant.children[1] : null;
        const descendantRoot = descendant && descendant.kind === nodeKind_1.default.E4X_DESCENDANT
            ? descendant.children[0] : null;
        if (lengthName && lengthName.kind === nodeKind_1.default.LITERAL && lengthName.text === 'length'
            && args && args.children.length === 0 && descendantName && descendantName.kind === nodeKind_1.default.LITERAL
            && descendantName.text !== '*' && reflectionXMLRoot(descendantRoot)) {
            let xmlHelper = '__as3_describeTypeXML';
            while (emitter.source.indexOf(xmlHelper) >= 0)
                xmlHelper += '_';
            emitter.ensureImportIdentifier('as3DescribeTypeXML as ' + xmlHelper, module, false);
            emitter.nativeSourceHelpers.add(xmlHelper);
            let descendantsHelper = '__as3_xmlDescendantsByName';
            while (emitter.source.indexOf(descendantsHelper) >= 0)
                descendantsHelper += '_';
            emitter.ensureImportIdentifier('as3XMLDescendantsByName as ' + descendantsHelper, module, false);
            emitter.nativeSourceHelpers.add(descendantsHelper);
            const argument = reflectionXMLArgument(descendantRoot);
            emitter.catchup(node.start);
            emitter.insert(descendantsHelper + '(' + xmlHelper + '(');
            emitter.skipTo(argument.start);
            visitNode(emitter, argument);
            emitter.catchup(argument.end);
            emitter.insert('), ' + JSON.stringify(descendantName.text) + ').length');
            emitter.skipTo(node.end);
            return true;
        }
    }
    // A bare describeType call is a complete source XML request. Other E4X
    // shapes remain explicit failures until their source semantics are admitted.
    if (reflectionXMLRoot(node)) {
        let helper = '__as3_describeTypeXML';
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier('as3DescribeTypeXML as ' + helper, module, false);
        emitter.nativeSourceHelpers.add(helper);
        emitReflectionXMLRoot(emitter, node, helper);
        return true;
    }
    if (hasReflectionFilter(node) || node.kind === nodeKind_1.default.E4X_DESCENDANT)
        throw new Error('AS3_REFLECTION_XML_UNSUPPORTED: only literal XML attributes and named descendant counts are admitted');
    return false;
}
function isInterfaceCast(emitter, receiver) {
    const value = node_1.unwrapEncapsulatedExpression(receiver);
    return !!emitter.references && !!value && value.kind === nodeKind_1.default.RELATION && value.children.length === 3
        && value.children[1].kind === nodeKind_1.default.AS && value.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && !!emitter.references.sourceInterface(value.lastChild.text);
}
function emitInterfaceReceiverCall(emitter, node) {
    if (!emitter.references)
        return false;
    const callee = node.children[0], args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!callee || callee.kind !== nodeKind_1.default.DOT || callee.children.length !== 2 || !args)
        return false;
    const receiver = callee.children[0], value = node_1.unwrapEncapsulatedExpression(receiver), member = callee.children[1];
    if (!value || member.kind !== nodeKind_1.default.LITERAL)
        return false;
    const cast = isInterfaceCast(emitter, receiver);
    const field = emitter.generated && value.kind === nodeKind_1.default.DOT && value.children[0].kind === nodeKind_1.default.IDENTIFIER
        && value.children[0].text === 'this' && value.children[1].kind === nodeKind_1.default.LITERAL
        && emitter.generated.lexical.own.find(t => t.name === value.children[1].text
            && !t.static && t.kind === 'variable' && t.visibility === 'private' && !!t.type);
    const interfaceField = field && emitter.generated.options.plan.references.some(r => r.owner === field.owner
        && r.start === field.type.start && r.end === field.type.end && r.kind === 'interface');
    if (!cast && !interfaceField)
        return false;
    if (emitter.isNew)
        throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: interface-cast method construction requires separate authority');
    const module = native_generated_emission_1.generatedModule(emitter.options.nativeDynamicPropertyReadsModule);
    const helper = propertyHelper(emitter, 'as3CallProperty', module);
    // AIR evaluates the receiver and every argument before resolving the method.
    // An argument throw precedes a null error from a cast or typed interface field.
    emitter.catchup(node.start);
    emitter.insert('(<any>(function(target:any,values:any[]){return ' + helper + '(target,' + JSON.stringify(member.text) + ',()=>values);})(');
    emitter.skipTo(receiver.start);
    visitNode(emitter, receiver);
    emitter.catchup(receiver.end);
    emitter.insert(',[');
    args.children.forEach((arg, index) => {
        if (index)
            emitter.insert(',');
        emitter.skipTo(getExpressionStart(arg));
        visitNode(emitter, arg);
        emitter.catchup(getEffectiveNodeEnd(arg));
    });
    emitter.insert(']))');
    emitter.skipTo(node.end);
    return true;
}
function dataEventName(emitter, name) {
    return emitter.options.nativeDataEventReferenceModule !== undefined && !!emitter.references
        && emitter.references.resolve(name) === 'flash.events.DataEvent';
}
function dataEventTarget(emitter, node) {
    if (!node || node.kind !== nodeKind_1.default.IDENTIFIER || !dataEventName(emitter, node.text))
        return false;
    const definition = emitter.findDefInScope(node.text);
    if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
        throw new Error('AS3_DATAEVENT_REFERENCE_UNSUPPORTED: shadowed target requires separate Class authority');
    let method = node.parent;
    while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
        method = method.parent;
    if (!method)
        throw new Error('AS3_DATAEVENT_REFERENCE_UNSUPPORTED: class initializer reference operation held');
    return true;
}
function emitDataEventConstruction(emitter, node) {
    if (!emitter.options.nativeDataEventConstructionModule || node.children.length !== 1)
        return false;
    const call = node.children[0], callee = node_1.unwrapEncapsulatedExpression(call.kind === nodeKind_1.default.CALL ? call.children[0] : call);
    if (!dataEventTarget(emitter, callee))
        return false;
    const args = call.kind === nodeKind_1.default.CALL ? call.findChild(nodeKind_1.default.ARGUMENTS) : undefined;
    if (!args || args.children.length < 1 || args.children.length > 4)
        throw new Error('AS3_DATAEVENT_CONSTRUCTION_UNSUPPORTED: one through four arguments required');
    const helper = propertyHelper(emitter, 'constructAS3DataEvent', emitter.options.nativeDataEventConstructionModule);
    const target = propertyHelper(emitter, emitter.references.resolve(callee.text).split('.').pop(), emitter.options.nativeDataEventReferenceModule);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(' + target + ',[');
    args.children.forEach((arg, index) => { if (index)
        emitter.insert(','); emitter.skipTo(getExpressionStart(arg)); visitNode(emitter, arg); emitter.catchup(getEffectiveNodeEnd(arg)); });
    emitter.insert(']))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
/** Canonical native cast authority, excluding lexical functions with the same name. */
function movieClipCastTarget(emitter, node) {
    if (!emitter.references || emitter.options.nativeMovieClipReferenceModule === undefined
        || !node || node.kind !== nodeKind_1.default.CALL)
        return false;
    const target = node.children[0];
    if (!target || target.kind !== nodeKind_1.default.IDENTIFIER
        || emitter.references.resolve(target.text) !== 'flash.display.MovieClip')
        return false;
    const definition = emitter.findDefInScope(target.text);
    return !(definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
        && native_typeof_1.typeOfBinding(target, emitter.source, []) !== 'lexical';
}
function emitMovieClipCast(emitter, node) {
    if (emitter.isNew || !movieClipCastTarget(emitter, node))
        return false;
    const args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!args || args.children.length !== 1)
        throw new Error('AS3_DISPLAY_REFERENCE_UNSUPPORTED: MovieClip cast requires exactly one argument');
    const helper = propertyHelper(emitter, 'as3CoerceReference', emitter.references.options.coercionModule);
    const argument = args.children[0];
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitter.skipTo(getExpressionStart(argument));
    visitNode(emitter, argument);
    emitter.catchup(getEffectiveNodeEnd(argument));
    emitter.insert(',' + propertyHelper(emitter, 'MovieClip', emitter.options.nativeMovieClipReferenceModule) + '))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitMovieClipCastCall(emitter, node) {
    const callee = node.children[0];
    if (emitter.isNew || !callee || callee.kind !== nodeKind_1.default.DOT || callee.children.length !== 2
        || !movieClipCastTarget(emitter, node_1.unwrapEncapsulatedExpression(callee.children[0])))
        return false;
    const receiver = callee.children[0], member = callee.children[1], args = node.findChild(nodeKind_1.default.ARGUMENTS);
    const invocation = emitter.options.importModules && emitter.options.importModules['compiler.AS3Invocation'];
    if (!args || member.kind !== nodeKind_1.default.LITERAL || !invocation || !emitter.options.nativeSourceErrorModule)
        throw new Error('AS3_DISPLAY_REFERENCE_UNSUPPORTED: native cast dot call requires invocation and source errors');
    const call = propertyHelper(emitter, 'as3CallValue', invocation);
    const nullError = propertyHelper(emitter, 'createAS3PropertyError', emitter.options.nativeSourceErrorModule);
    // Native instance dispatch does not require a generated source-property table.
    // Coerce first; evaluate arguments before receiver lookup, including null errors.
    emitter.catchup(node.start);
    emitter.insert('(<any>(function(target:any,values:any[]){if(target===null)throw ' + nullError + '("TypeError",1009);return ' + call + '(target[' + JSON.stringify(member.text) + '],()=>values,target);})(');
    emitter.skipTo(receiver.start);
    visitNode(emitter, receiver);
    emitter.catchup(getEffectiveNodeEnd(receiver));
    emitter.insert(',[');
    args.children.forEach((argument, index) => { if (index)
        emitter.insert(','); emitter.skipTo(getExpressionStart(argument)); visitNode(emitter, argument); emitter.catchup(getEffectiveNodeEnd(argument)); });
    emitter.insert(']))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitDataEventCast(emitter, node) {
    const callee = node_1.unwrapEncapsulatedExpression(node.children[0]), args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!dataEventTarget(emitter, callee))
        return false;
    if (emitter.isNew || !args || args.children.length !== 1)
        throw new Error('AS3_DATAEVENT_REFERENCE_UNSUPPORTED: cast requires one argument and no construction');
    const helper = propertyHelper(emitter, 'as3CoerceReference', emitter.references.options.coercionModule), argument = args.children[0];
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitter.skipTo(getExpressionStart(argument));
    visitNode(emitter, argument);
    emitter.catchup(getEffectiveNodeEnd(argument));
    emitter.insert(',');
    // The cast target precedes the argument in source, so import its exact provider
    // directly instead of rewinding the source cursor.
    const name = emitter.references.resolve(callee.text).split('.').pop();
    emitter.insert(propertyHelper(emitter, name, emitter.options.nativeDataEventReferenceModule) + '))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitCapabilitiesStaticRead(emitter, node) {
    const module = emitter.options.nativeCapabilitiesReferenceModule;
    if (!emitter.references || node.children.length !== 2)
        return false;
    const receiver = node_1.unwrapEncapsulatedExpression(node.children[0]), key = node.children[1];
    if (receiver.kind !== nodeKind_1.default.IDENTIFIER || emitter.references.resolve(receiver.text) !== 'flash.system.Capabilities')
        return false;
    const definition = emitter.findDefInScope(receiver.text);
    if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')) || native_typeof_1.typeOfBinding(receiver, emitter.source, []) === 'lexical')
        return false;
    if (!emitter.references.options.plan.nativeBindings.some(binding => binding.qname === 'flash.system.Capabilities'))
        return false;
    if (!module)
        throw new Error('AS3_CAPABILITIES_REFERENCE_UNSUPPORTED: explicit canonical Capabilities module required');
    const expression = node_1.outerEncapsulatedExpression(node), operation = expression.parent;
    if (operation && operation.children[0] === expression && [nodeKind_1.default.ASSIGN, nodeKind_1.default.PRE_INC, nodeKind_1.default.PRE_DEC, nodeKind_1.default.POST_INC, nodeKind_1.default.POST_DEC, nodeKind_1.default.DELETE, nodeKind_1.default.CALL, nodeKind_1.default.NEW].indexOf(operation.kind) >= 0)
        throw new Error('AS3_CAPABILITIES_REFERENCE_UNSUPPORTED: only direct literal static reads are qualified');
    let name;
    if (node.kind === nodeKind_1.default.DOT && key.kind === nodeKind_1.default.LITERAL)
        name = key.text;
    else if (node.kind === nodeKind_1.default.ARRAY_ACCESSOR && key.kind === nodeKind_1.default.LITERAL && /^(["'])[A-Za-z_$][A-Za-z0-9_$]*\1$/.test(key.text))
        name = key.text.slice(1, -1);
    else
        throw new Error('AS3_CAPABILITIES_REFERENCE_UNSUPPORTED: static key requires a literal identifier');
    const helper = propertyHelper(emitter, 'readAS3CapabilitiesStatic', module);
    emitter.catchup(node.start);
    emitter.insert(helper + '(' + JSON.stringify(name) + ')');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitDataEventData(emitter, node) {
    if (!emitter.options.nativeDataEventReferenceModule || node.children.length !== 2)
        return false;
    const receiver = node_1.unwrapEncapsulatedExpression(node.children[0]), key = node.children[1];
    let qualified = false;
    if (receiver.kind === nodeKind_1.default.IDENTIFIER) {
        const definition = emitter.findDefInScope(receiver.text);
        qualified = !!definition && !definition.bound && !!definition.as3Type && dataEventName(emitter, definition.as3Type);
    }
    else if (receiver.kind === nodeKind_1.default.CALL) {
        qualified = dataEventTarget(emitter, node_1.unwrapEncapsulatedExpression(receiver.children[0]));
    }
    else if (receiver.kind === nodeKind_1.default.RELATION && receiver.children.length === 3 && receiver.children[1].text === 'as'
        && dataEventTarget(emitter, receiver.lastChild)) {
        throw new Error('AS3_DATAEVENT_REFERENCE_UNSUPPORTED: direct as-result member access requires separate authority');
    }
    if (!qualified)
        return false;
    const expression = node_1.outerEncapsulatedExpression(node), operation = expression.parent;
    if (node.kind !== nodeKind_1.default.DOT || key.kind !== nodeKind_1.default.LITERAL || key.text !== 'data' || operation && operation.children[0] === expression
        && [nodeKind_1.default.ASSIGN, nodeKind_1.default.PRE_INC, nodeKind_1.default.PRE_DEC, nodeKind_1.default.POST_INC, nodeKind_1.default.POST_DEC, nodeKind_1.default.DELETE, nodeKind_1.default.CALL, nodeKind_1.default.NEW].indexOf(operation.kind) >= 0)
        throw new Error('AS3_DATAEVENT_REFERENCE_UNSUPPORTED: only a data read is qualified');
    const helper = propertyHelper(emitter, 'readAS3DataEventData', emitter.options.nativeDataEventReferenceModule);
    emitter.catchup(node.start);
    emitter.insert(helper + '(');
    emitter.skipTo(node.children[0].start);
    visitNode(emitter, node.children[0]);
    emitter.catchup(getEffectiveNodeEnd(node.children[0]));
    emitter.insert(')');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function errorEventSubtypeName(emitter, name) {
    return emitter.options.nativeErrorEventSubtypeReferenceModule !== undefined && !!emitter.references
        && ['flash.events.IOErrorEvent', 'flash.events.SecurityErrorEvent'].indexOf(emitter.references.resolve(name)) >= 0;
}
function errorEventSubtypeTarget(emitter, node) {
    if (!node || node.kind !== nodeKind_1.default.IDENTIFIER || !errorEventSubtypeName(emitter, node.text))
        return false;
    const definition = emitter.findDefInScope(node.text);
    if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
        throw new Error('AS3_ERROREVENT_SUBTYPE_UNSUPPORTED: shadowed target requires separate Class authority');
    let method = node.parent;
    while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
        method = method.parent;
    if (!method)
        throw new Error('AS3_ERROREVENT_SUBTYPE_UNSUPPORTED: class initializer reference operation held');
    return true;
}
function emitErrorEventSubtypeConstruction(emitter, node) {
    if (!emitter.options.nativeErrorEventSubtypeConstructionModule || node.children.length !== 1)
        return false;
    const call = node.children[0], callee = node_1.unwrapEncapsulatedExpression(call.kind === nodeKind_1.default.CALL ? call.children[0] : call);
    if (!errorEventSubtypeTarget(emitter, callee))
        return false;
    const args = call.kind === nodeKind_1.default.CALL ? call.findChild(nodeKind_1.default.ARGUMENTS) : undefined;
    if (!args || args.children.length < 1 || args.children.length > 5)
        throw new Error('AS3_ERROREVENT_CONSTRUCTION_UNSUPPORTED: one through five arguments required');
    const helper = propertyHelper(emitter, 'constructAS3ErrorEventSubtype', emitter.options.nativeErrorEventSubtypeConstructionModule);
    const target = propertyHelper(emitter, emitter.references.resolve(callee.text).split('.').pop(), emitter.options.nativeErrorEventSubtypeReferenceModule);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(' + target + ',[');
    args.children.forEach((arg, index) => { if (index)
        emitter.insert(','); emitter.skipTo(getExpressionStart(arg)); visitNode(emitter, arg); emitter.catchup(getEffectiveNodeEnd(arg)); });
    emitter.insert(']))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitErrorEventSubtypeCast(emitter, node) {
    const callee = node_1.unwrapEncapsulatedExpression(node.children[0]), args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!errorEventSubtypeTarget(emitter, callee))
        return false;
    if (emitter.isNew || !args || args.children.length !== 1)
        throw new Error('AS3_ERROREVENT_SUBTYPE_UNSUPPORTED: cast requires one argument and no construction');
    const helper = propertyHelper(emitter, 'as3CoerceReference', emitter.references.options.coercionModule), argument = args.children[0];
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitter.skipTo(getExpressionStart(argument));
    visitNode(emitter, argument);
    emitter.catchup(getEffectiveNodeEnd(argument));
    emitter.insert(',');
    // The cast target precedes the argument in source, so import its exact provider
    // directly instead of rewinding the source cursor.
    const name = emitter.references.resolve(callee.text).split('.').pop();
    emitter.insert(propertyHelper(emitter, name, emitter.options.nativeErrorEventSubtypeReferenceModule) + '))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitErrorEventSubtypeText(emitter, node) {
    if (!emitter.options.nativeErrorEventSubtypeReferenceModule || node.children.length !== 2)
        return false;
    const receiver = node_1.unwrapEncapsulatedExpression(node.children[0]), key = node.children[1];
    let qualified = false;
    if (receiver.kind === nodeKind_1.default.IDENTIFIER) {
        const definition = emitter.findDefInScope(receiver.text);
        qualified = !!definition && !definition.bound && !!definition.as3Type && errorEventSubtypeName(emitter, definition.as3Type);
    }
    else if (receiver.kind === nodeKind_1.default.CALL) {
        qualified = errorEventSubtypeTarget(emitter, node_1.unwrapEncapsulatedExpression(receiver.children[0]));
    }
    else if (receiver.kind === nodeKind_1.default.RELATION && receiver.children.length === 3 && receiver.children[1].text === 'as'
        && errorEventSubtypeTarget(emitter, receiver.lastChild)) {
        throw new Error('AS3_ERROREVENT_SUBTYPE_UNSUPPORTED: direct as-result member access requires separate authority');
    }
    if (!qualified)
        return false;
    const expression = node_1.outerEncapsulatedExpression(node), operation = expression.parent;
    if (node.kind !== nodeKind_1.default.DOT || key.kind !== nodeKind_1.default.LITERAL || key.text !== 'text' || operation && operation.children[0] === expression
        && [nodeKind_1.default.ASSIGN, nodeKind_1.default.PRE_INC, nodeKind_1.default.PRE_DEC, nodeKind_1.default.POST_INC, nodeKind_1.default.POST_DEC, nodeKind_1.default.DELETE, nodeKind_1.default.CALL, nodeKind_1.default.NEW].indexOf(operation.kind) >= 0)
        throw new Error('AS3_ERROREVENT_SUBTYPE_UNSUPPORTED: only a text read is qualified');
    const helper = propertyHelper(emitter, 'readAS3ErrorEventSubtypeText', emitter.options.nativeErrorEventSubtypeReferenceModule);
    emitter.catchup(node.start);
    emitter.insert(helper + '(');
    emitter.skipTo(node.children[0].start);
    visitNode(emitter, node.children[0]);
    emitter.catchup(getEffectiveNodeEnd(node.children[0]));
    emitter.insert(')');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitInterfaceCoercionCall(emitter, node) {
    if (!emitter.generated || !emitter.references)
        return false;
    const callee = node_1.unwrapEncapsulatedExpression(node.children[0]), args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!callee || callee.kind !== nodeKind_1.default.IDENTIFIER || !args)
        return false;
    const definition = emitter.findDefInScope(callee.text);
    if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
        return false;
    const token = emitter.references.sourceInterface(callee.text);
    if (!token)
        return false;
    if (emitter.isNew || args.children.length !== 1)
        throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: interface coercion requires one argument and no construction');
    const parts = referenceCoercionParts(emitter, { exported: token }), argument = args.children[0];
    emitter.catchup(node.start);
    emitter.insert(parts[0]);
    emitter.skipTo(getExpressionStart(argument));
    visitNode(emitter, argument);
    emitter.catchup(getEffectiveNodeEnd(argument));
    emitter.insert(parts[1]);
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
/** Recognize declared method values without granting Function authority to an
 * arbitrary property or a shadowed class/method spelling. Normal member emission
 * still selects the authenticated class or lexical method closure. */
function generatedMethodValue(emitter, node) {
    const generated = emitter.generated;
    if (!generated || !node)
        return false;
    const method = (traits, name) => traits.some(t => t.name === name && t.kind === 'method');
    if (node.kind === nodeKind_1.default.IDENTIFIER) {
        if (hasFunctionLocal(emitter, node.text))
            return false;
        return method(generated.lexical.traits, node.text) || method(generated.projection.instanceTraits, node.text) || method(generated.projection.staticTraits, node.text);
    }
    if (node.kind !== nodeKind_1.default.DOT || node.children.length !== 2 || node.children[1].kind !== nodeKind_1.default.LITERAL)
        return false;
    const receiver = node_1.unwrapEncapsulatedExpression(node.children[0]), name = node.children[1].text;
    if (!receiver || receiver.kind !== nodeKind_1.default.IDENTIFIER)
        return false;
    const projection = generatedReceiver(emitter, receiver);
    if (projection)
        return method(projection.instanceTraits, name) || receiver.text === 'this' && generated.lexical.traits.some(t => !t.static && t.kind === 'method' && t.name === name);
    const definition = emitter.findDefInScope(receiver.text);
    if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
        return false;
    const qname = generated.lexical.resolveTypeName(receiver.text), plan = generated.options.plan;
    if (!plan.bindings.some(b => b.qname === qname) || !generated.sources[qname])
        return false;
    let traits = emitter.generatedReceiverTraits.get(qname);
    if (!traits) {
        traits = new native_generated_traits_1.NativeGeneratedClassTraits(plan, plan.scope, qname, generated.sources[qname]);
        emitter.generatedReceiverTraits.set(qname, traits);
    }
    return method(traits.staticTraits, name) || qname === generated.lexical.owner && generated.lexical.traits.some(t => t.static && t.kind === 'method' && t.name === name);
}
/** A declared Function return keeps its nominal call/apply behavior when the
 * source uses the result immediately instead of assigning a typed local. */
function generatedFunctionResult(emitter, node) {
    if (!emitter.generated || !node || node.kind !== nodeKind_1.default.CALL)
        return false;
    const callee = node.children[0];
    if (callee.kind !== nodeKind_1.default.DOT || callee.children[1].kind !== nodeKind_1.default.LITERAL)
        return false;
    const projection = generatedReceiver(emitter, node_1.unwrapEncapsulatedExpression(callee.children[0]));
    return !!projection && projection.instanceMethods.some(method => method.name === callee.children[1].text && method.returns === 'Function');
}
function emitLocalFunctionIntrinsic(emitter, node) {
    const callee = node.children[0], args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!emitter.generated || !emitter.typedLocalPlan || !callee || callee.kind !== nodeKind_1.default.DOT || !args)
        return false;
    const receiver = node_1.unwrapEncapsulatedExpression(callee.children[0]), member = callee.children[1];
    if (!member || ['call', 'apply'].indexOf(member.text) < 0 || !emitter.typedLocalPlan.functionLocal(receiver, emitter) && !generatedMethodValue(emitter, receiver) && !generatedFunctionResult(emitter, receiver))
        return false;
    if (emitter.isNew)
        throw new Error('AS3_TYPED_LOCAL_UNSUPPORTED: Function intrinsic construction');
    // Capture the Function before argument effects; resolve its intrinsic only
    // afterwards, preserving AIR null errors and declaration-global receivers.
    const helper = propertyHelper(emitter, 'as3CallNamedProperty', emitter.generated.propertyModule);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitter.skipTo(receiver.start);
    visitNode(emitter, receiver);
    emitter.catchup(receiver.end);
    emitter.insert(',' + JSON.stringify(member.text) + ',()=>[');
    args.children.forEach((arg, index) => { if (index)
        emitter.insert(','); emitter.skipTo(getExpressionStart(arg)); visitNode(emitter, arg); emitter.catchup(getEffectiveNodeEnd(arg)); });
    emitter.insert(']))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
/** Native Sprite allocations retain the defining script's movie, including
 * callbacks invoked by another movie. Zero-argument construction is the
 * qualified canonical form; other display constructors remain separate work. */
function emitLexicalSpriteConstruction(emitter, node) {
    if (!emitter.generated || node.children.length !== 1)
        return false;
    const call = node.children[0], callee = call.kind === nodeKind_1.default.CALL && call.children[0];
    if (!callee || callee.kind !== nodeKind_1.default.IDENTIFIER)
        return false;
    const binding = emitter.findDefInScope(callee.text);
    if (binding && (binding.bound || Object.prototype.hasOwnProperty.call(binding, 'as3Type')))
        return false;
    if (emitter.generated.lexical.resolveTypeName(callee.text) !== 'flash.display.Sprite')
        return false;
    const input = native_generated_declarations_2.nativeGeneratedDeclarationInputs(emitter.generated.options.plan, emitter.generated.options.plan.scope);
    const provider = input.providers && input.providers['flash.display.Sprite'];
    const fail = (reason) => { throw new Error('AS3_SPRITE_ALLOCATION_UNSUPPORTED: ' + reason); };
    if (!provider || provider.exportName !== 'Sprite' || !emitter.options.importModules
        || emitter.options.importModules['flash.display.Sprite'] !== native_xml_1.xmlGlobalProviderModule(provider.module, emitter.generated.options.module))
        fail('exact native Sprite provider required');
    const args = call.findChild(nodeKind_1.default.ARGUMENTS);
    if (!args || args.children.length)
        fail('only canonical zero-argument construction is qualified');
    if (!input.scriptDomainProvider || !input.scriptGlobalProviderModule || !emitter.generated.projection.binding.scriptGlobalExport)
        fail('defining script requires an explicit cohort domain');
    const module = native_generated_emission_1.generatedModule(native_xml_1.xmlGlobalProviderModule(input.scriptGlobalProviderModule, emitter.generated.options.module));
    const helper = propertyHelper(emitter, 'withAS3ScriptAllocationContext', module);
    emitter.catchup(node.start);
    emitter.insert(helper + '(' + emitter.generated.lexical.scriptGlobal + ',()=>');
    const wasNew = emitter.isNew, wasThis = emitter.emitThisForNextIdent;
    emitter.isNew = true;
    emitter.emitThisForNextIdent = false;
    visitNodes(emitter, node.children);
    emitter.catchup(node.end);
    emitter.insert(')');
    emitter.isNew = wasNew;
    emitter.emitThisForNextIdent = wasThis;
    return true;
}
function emitSourceDefinitionLookup(emitter, node) {
    if (!emitter.generated || !emitter.options.importModules || !emitter.options.importModules['flash.utils.getDefinitionByName'])
        return false;
    const target = node_1.unwrapEncapsulatedExpression(node.children[0]);
    if (!target || target.kind !== nodeKind_1.default.IDENTIFIER || target.text !== 'getDefinitionByName')
        return false;
    const definition = emitter.findDefInScope(target.text);
    if (!definition || definition.sourceImport !== 'flash.utils.getDefinitionByName' || native_typeof_1.typeOfBinding(target, emitter.source, []) === 'lexical')
        return false;
    const input = native_generated_declarations_2.nativeGeneratedDeclarationInputs(emitter.generated.options.plan, emitter.generated.options.plan.scope);
    if (!input.scriptDomainProvider || !emitter.generated.projection.binding.scriptGlobalExport)
        return false;
    const args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!args || node.parent && node.parent.kind === nodeKind_1.default.NEW)
        throw new Error('AS3_DEFINITION_LOOKUP_UNSUPPORTED: package function requires direct call');
    const module = native_generated_emission_1.generatedModule(native_xml_1.xmlGlobalProviderModule(input.scriptGlobalProviderModule, emitter.generated.options.module));
    const helper = propertyHelper(emitter, 'getAS3ScriptDefinitionByName', module);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(' + emitter.generated.lexical.scriptGlobal);
    args.children.forEach(argument => {
        emitter.insert(',');
        emitter.skipTo(getExpressionStart(argument));
        visitNode(emitter, argument);
        emitter.catchup(getEffectiveNodeEnd(argument));
    });
    emitter.insert('))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
/** A generated Flash display object's parent has the source container API,
 * not Laya Node's implementation signature. Keep both property lookup and
 * method invocation in source dispatch, without widening the generated type. */
function emitGeneratedParentRemoval(emitter, node) {
    if (!emitter.generated)
        return false;
    const callee = node.children[0], args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!callee || callee.kind !== nodeKind_1.default.DOT || callee.children[1].text !== 'removeChild' || !args)
        return false;
    const receiver = node_1.unwrapEncapsulatedExpression(callee.children[0]);
    let root = null, projection = null;
    if (receiver.kind === nodeKind_1.default.IDENTIFIER && receiver.text === 'parent') {
        if (hasFunctionLocal(emitter, 'parent') || emitter.generated.lexical.traits.some(t => t.name === 'parent'))
            return false;
        let member = node;
        while (member.parent && member.parent.kind !== nodeKind_1.default.CONTENT)
            member = member.parent;
        const mods = member.findChild(nodeKind_1.default.MOD_LIST);
        if (mods && mods.children.some(m => m.text === 'static'))
            return false;
        projection = emitter.generated.projection;
    }
    else if (receiver.kind === nodeKind_1.default.DOT && receiver.children[1].text === 'parent') {
        root = node_1.unwrapEncapsulatedExpression(receiver.children[0]);
        if (root.kind === nodeKind_1.default.IDENTIFIER && root.text === 'this'
            && emitter.generated.lexical.traits.some(t => t.name === 'parent'))
            return false;
        projection = generatedReceiver(emitter, root);
    }
    const parent = projection && projection.instanceTraits.find(t => t.name === 'parent');
    if (!parent || parent.kind !== 'accessor' || typeof parent.type !== 'object'
        || parent.type.name !== 'flash.display::DisplayObjectContainer')
        return false;
    const plan = emitter.generated.options.plan;
    const container = plan.nativeBindings.find(b => b.qname === 'flash.display.DisplayObjectContainer');
    if (!container || parent.type.referenceExport !== container.referenceExport
        || !emitter.options.nativeReferenceCoercion || emitter.options.nativeReferenceCoercion.plan !== plan)
        throw new Error('AS3_DISPLAY_REFERENCE_UNSUPPORTED: parent removal requires authenticated container reference');
    if (emitter.isNew)
        throw new Error('AS3_DISPLAY_REFERENCE_UNSUPPORTED: parent method construction');
    const get = propertyHelper(emitter, 'as3GetProperty', emitter.generated.propertyModule);
    const call = propertyHelper(emitter, 'as3CallProperty', emitter.generated.propertyModule);
    // Read parent once before arguments. Method dispatch (including null and
    // ownership failures) follows all argument effects, matching Flash.
    emitter.catchup(node.start);
    emitter.insert('(<any>((target:any,values:any[])=>' + call + '(target,"removeChild",()=>values))(' + get + '(');
    if (root) {
        emitter.skipTo(root.start);
        visitNode(emitter, root);
        emitter.catchup(root.end);
    }
    else
        emitter.insert('this');
    emitter.insert(',"parent"),[');
    args.children.forEach((arg, index) => { if (index)
        emitter.insert(','); emitter.skipTo(getExpressionStart(arg)); visitNode(emitter, arg); emitter.catchup(getEffectiveNodeEnd(arg)); });
    emitter.insert(']))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitGeneratedProxyNamespaceCall(emitter, node) {
    if (!emitter.generated || node.children[0].kind !== nodeKind_1.default.NAMESPACE_ACCESS)
        return false;
    const access = emitter.namespaces.access(node.children[0]), args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (access.uri !== native_generated_proxy_1.generatedProxyUri || !native_generated_proxy_1.generatedProxySignatures[access.name] || !access.receiver
        || access.receiver.kind !== nodeKind_1.default.IDENTIFIER || !args)
        return false;
    if (emitter.isNew || hasFunctionLocal(emitter, access.qualifier))
        emitter.namespaces.fail('namespace construction or shadowed qualifier requires separate lowering');
    const qnameModule = emitter.options.nativeGlobalModules && emitter.options.nativeGlobalModules.QName;
    if (!qnameModule)
        emitter.namespaces.fail('qualified Proxy call requires canonical QName provider');
    let qname = '__as3_proxyQName';
    while (emitter.source.indexOf(qname) >= 0)
        qname += '_';
    emitter.ensureImportIdentifier('QName as ' + qname, qnameModule, false);
    emitter.nativeSourceHelpers.add(qname);
    const helper = propertyHelper(emitter, 'as3CallNamedProperty', emitter.generated.propertyModule);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitter.skipTo(access.receiver.start);
    visitNode(emitter, access.receiver);
    emitter.catchup(access.receiver.end);
    emitter.insert(',new ' + qname + '(' + JSON.stringify(access.uri) + ',' + JSON.stringify(access.name) + '),()=>[');
    args.children.forEach((arg, index) => { if (index)
        emitter.insert(','); emitter.skipTo(getExpressionStart(arg)); visitNode(emitter, arg); emitter.catchup(getEffectiveNodeEnd(arg)); });
    emitter.insert(']))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitBuiltinMathRound(emitter, node) {
    const module = emitter.options.nativeCallableCoercionModule;
    if (!module || !emitter.generated || emitter.isNew)
        return false;
    const callee = node.children[0], args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!callee || callee.kind !== nodeKind_1.default.DOT || callee.children.length !== 2)
        return false;
    const receiver = callee.children[0], member = callee.children[1];
    if (receiver.kind !== nodeKind_1.default.IDENTIFIER || receiver.text !== 'Math' || member.text !== 'round')
        return false;
    if (emitter.generated.lexical.traits.concat(emitter.generated.projection.instanceTraits, emitter.generated.projection.staticTraits).some(trait => trait.name === 'Math'))
        return false;
    const binding = native_typeof_1.typeOfBinding(receiver, emitter.source, Object.keys(emitter.options.nativeClassInitialization.classes));
    if (binding === 'lexical' || binding === 'class' || emitter.findDefInScope('Math') || emitter.references && emitter.references.resolve('Math') !== 'Math')
        return false;
    if (!args || args.children.length !== 1)
        throw new Error('AS3_NUMERIC_CALL_UNSUPPORTED: Math.round requires exactly one source argument');
    let helper = '__as3_mathRound';
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    emitter.ensureImportIdentifier('as3MathRound as ' + helper, module, false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);
    emitter.insert(helper + '(');
    emitter.skipTo(args.children[0].start);
    visitNode(emitter, args.children[0]);
    emitter.catchup(args.children[0].end);
    emitter.insert(')');
    emitter.skipTo(node.end);
    return true;
}
function emitCall(emitter, node) {
    if (emitRegExpConstruction(emitter, node, true))
        return;
    const regexpAccess = regExpAccess(emitter, node.children[0]);
    if (regexpAccess) {
        const args = node.findChild(nodeKind_1.default.ARGUMENTS), helper = propertyHelper(emitter, 'as3CallProperty', emitter.generated.propertyModule);
        emitter.catchup(node.start);
        emitter.insert('(<any>' + helper + '(');
        emitPropertyKey(emitter, regexpAccess);
        emitter.insert(',()=>[');
        args.children.forEach((arg, index) => { if (index)
            emitter.insert(','); emitter.skipTo(getExpressionStart(arg)); visitNode(emitter, arg); emitter.catchup(getEffectiveNodeEnd(arg)); });
        emitter.insert(']))');
        emitter.skipTo(getEffectiveNodeEnd(node));
        return;
    }
    if (emitBuiltinMathRound(emitter, node))
        return;
    if (emitGeneratedVectorConstruction(emitter, node, true))
        return;
    if (emitGeneratedProxyNamespaceCall(emitter, node))
        return;
    if (emitGeneratedParentRemoval(emitter, node))
        return;
    if (emitSourceDefinitionLookup(emitter, node))
        return;
    if (emitLocalFunctionIntrinsic(emitter, node))
        return;
    const pattern = emitter.generated && emitter.generated.options.plan.patternLocals.find(p => p.owner === emitter.generated.lexical.owner && p.calls.indexOf(node.start) >= 0);
    if (pattern) {
        const helper = propertyHelper(emitter, 'sourcePatternTest', nativePatternModule(emitter));
        emitter.catchup(node.start);
        emitter.insert(helper + '(' + pattern.name);
        node.findChild(nodeKind_1.default.ARGUMENTS).children.forEach(argument => {
            emitter.insert(',');
            emitter.skipTo(getExpressionStart(argument));
            visitNode(emitter, argument);
            emitter.catchup(getEffectiveNodeEnd(argument));
        });
        emitter.insert(')');
        emitter.skipTo(getEffectiveNodeEnd(node));
        return;
    }
    if (emitMovieClipCastCall(emitter, node) || emitMovieClipCast(emitter, node))
        return;
    if (emitDataEventCast(emitter, node) || emitErrorEventSubtypeCast(emitter, node) || emitInterfaceCoercionCall(emitter, node) || emitInterfaceReceiverCall(emitter, node))
        return;
    if (emitSourceErrorConstruction(emitter, node))
        return;
    if (emitNativeTrace(emitter, node))
        return;
    if (emitJSONParse(emitter, node))
        return;
    if (emitStringValueMethodCall(emitter, node))
        return;
    if (emitStringPatternCall(emitter, node))
        return;
    if (emitReflectionQuery(emitter, node))
        return;
    if (emitReflectionXML(emitter, node))
        return;
    if (emitDirectToString(emitter, node))
        return;
    if (emitBuiltinStringCoercion(emitter, node))
        return;
    if (emitBuiltinIntCoercion(emitter, node))
        return;
    if (emitBuiltinBooleanCoercion(emitter, node))
        return;
    if (emitBuiltinObjectCreation(emitter, node))
        return;
    if (emitGeneratedArraySortCall(emitter, node))
        return;
    if (emitArraySortOn(emitter, node))
        return;
    if (emitTweenMigrationCall(emitter, node))
        return;
    if (emitDictionaryPropertyCall(emitter, node))
        return;
    if (emitInterfaceMethodCall(emitter, node))
        return;
    if (emitInternalDynamicCall(emitter, node))
        return;
    if (emitObjectPropertyCall(emitter, node))
        return;
    const callee = node.children[0];
    if (callee.kind === nodeKind_1.default.IDENTIFIER && callee.text === 'parseInt') {
        const binding = emitter.nativeGlobals.resolve(callee), args = node.findChild(nodeKind_1.default.ARGUMENTS);
        if (binding) {
            if (emitter.isNew || !args || args.children.length > 2)
                throw new Error('AS3_GLOBAL_MODULE_UNSUPPORTED: parseInt requires a direct zero-to-two argument call');
            emitter.nativeSourceHelpers.add(binding.alias);
            emitter.catchup(node.start);
            visitNodes(emitter, node.children);
            emitter.catchup(node.end);
            return;
        }
    }
    if (!emitter.isNew && callee.kind === nodeKind_1.default.IDENTIFIER && emitter.nativeGlobals.resolve(callee))
        throw new Error('AS3_GLOBAL_MODULE_UNSUPPORTED: callable builtin conversion requires native lowering: ' + callee.text);
    if (callee.kind === nodeKind_1.default.IDENTIFIER && callee.text === 'super') {
        let owner = node.parent;
        while (owner && owner.kind !== nodeKind_1.default.FUNCTION)
            owner = owner.parent;
        let classNode = owner && owner.parent;
        while (classNode && classNode.kind !== nodeKind_1.default.CLASS)
            classNode = classNode.parent;
        if (owner && classNode && owner.findChild(nodeKind_1.default.NAME).text === classNode.findChild(nodeKind_1.default.NAME).text
            && !classNode.findChild(nodeKind_1.default.EXTENDS)) {
            const argumentsNode = node.findChild(nodeKind_1.default.ARGUMENTS);
            if (!argumentsNode || argumentsNode.children.length)
                throw new Error('AS3_IMPLICIT_OBJECT_SUPER_UNSUPPORTED: nonempty super arguments');
            // AS3 supplies Object as the implicit base. Native classes without
            // an extends clause already have that base and cannot call super().
            emitter.catchup(node.start);
            emitter.skipTo(node.end);
            emitter.insert('/* implicit Object constructor */');
            return;
        }
    }
    let isNew = emitter.isNew;
    emitter.isNew = false;
    let isRETURNINDEXEDARRAY = false;
    //is RETURNINDEXEDARRAY
    let args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (args) {
        let arrayDotNode = args.findChild(nodeKind_1.default.DOT);
        if (arrayDotNode) {
            let arrayCNode = arrayDotNode.children[0];
            let literalNode = arrayDotNode.children[1];
            if (arrayCNode && arrayCNode && literalNode.text == 'RETURNINDEXEDARRAY') {
                let callDot = node.findChild(nodeKind_1.default.DOT);
                if (callDot) {
                    let identifierNode = callDot.findChild(nodeKind_1.default.IDENTIFIER);
                    let literalSortNode = callDot.findChild(nodeKind_1.default.LITERAL);
                    if (identifierNode && literalSortNode && literalSortNode.text == 'sort') {
                        //emitter.consume(")", 1);
                        emitter.catchup(node.start);
                        emitter.skipTo(node.end);
                        emitter.insert(`AS3Utils.sortRETURNINDEXEDARRAY(${identifierNode.text})`);
                        let pathToRoot = classlist_1.default.getLastPathToRoot();
                        emitter.ensureImportIdentifier(config_1.AS3_UTIL, `${pathToRoot}${config_1.AS3_UTIL}`);
                        //emitter.insert("*|*");
                        isRETURNINDEXEDARRAY = true;
                    }
                }
            }
        }
    }
    if (node.children[0].kind === nodeKind_1.default.VECTOR) {
        if (isNew) {
            let vector = node.children[0];
            let args = node.children[1];
            emitter.insert('[');
            if (config_1.WARNINGS >= 2 && args.children.length > 0) {
                console.log("emitter.ts: *** MINOR WARNING *** emitCall() => NodeKind.VECTOR with arguments not implemented.");
            }
            emitter.insert(']');
            emitter.skipTo(args.end);
            return;
        }
        else {
            if (isCast(emitter, node)) {
                emitter.catchup(node.start);
                emitter.insert('(<');
                const vec = node.findChild(nodeKind_1.default.VECTOR);
                visitNodes(emitter, [vec]);
                emitter.insert('>');
                const args = node.findChild(nodeKind_1.default.ARGUMENTS);
                emitter.skipTo(args.start);
                visitNodes(emitter, [args]);
                emitter.catchup(args.end);
                emitter.insert(')');
                return;
            }
        }
    }
    else {
        if (!isNew && isCast(emitter, node)) {
            const type = node.findChild(nodeKind_1.default.IDENTIFIER);
            const args = node.findChild(nodeKind_1.default.ARGUMENTS);
            const rtype = emitter.getTypeRemap(type.text) || type.text;
            if (emitter.generated && emitter.references && emitter.references.sourceClass(type.text)) {
                if (!args || args.children.length !== 1)
                    throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: source Class cast requires exactly one argument');
                const parts = referenceCoercionParts(emitter, { exported: emitter.references.type(type.text) });
                // Resolve the Class before evaluating the operand, then perform the
                // nominal coercion before any enclosing call evaluates its arguments.
                // A TypeScript assertion alone erases the AVM2 cast at runtime.
                emitter.catchup(node.start);
                emitter.insert('(');
                visitNode(emitter, type);
                emitter.catchup(type.end);
                emitter.insert(',' + parts[0]);
                const value = args.children[0];
                emitter.skipTo(getExpressionStart(value));
                visitNode(emitter, value);
                emitter.catchup(getEffectiveNodeEnd(value));
                emitter.insert(parts[1] + ')');
                emitter.skipTo(getEffectiveNodeEnd(node));
                return;
            }
            emitter.catchup(node.start);
            if (rtype === "string" || rtype === "number") {
                emitter.catchup(node.start);
            }
            else {
                const lazyCast = emitter.classInitializers.resolve(type, type.text) === 'lazy'
                    && (!emitter.classFactory || type.text !== emitter.classFactory.node.findChild(nodeKind_1.default.NAME).text);
                if (lazyCast)
                    emitter.insert('(' + emitter.classInitializers.readName + '(' + type.text + ', "unsupported"), ');
                emitter.insert('(<');
                emitter.insert(rtype);
                emitter.insert('>');
                emitter.skipTo(args.start);
                visitNodes(emitter, [args]);
                emitter.catchup(args.end);
                emitter.insert(')');
                if (lazyCast)
                    emitter.insert(')');
                return;
            }
        }
        else {
            emitter.catchup(node.start);
        }
    }
    if (isRETURNINDEXEDARRAY == false) {
        // `new Type().method()` is parsed as NEW(CALL(DOT(CALL(Type),
        // method))). Carry construction into the receiver call only; without
        // this, the receiver is misclassified as a cast and emits
        // `new (<Type>()).method()`.
        const chainedConstructor = isNew && callee && callee.kind === nodeKind_1.default.DOT
            && callee.children[0] && callee.children[0].kind === nodeKind_1.default.CALL;
        if (chainedConstructor)
            emitter.isNew = true;
        visitNodes(emitter, node.children);
        if (chainedConstructor)
            emitter.isNew = false;
    }
}
/** The qualified trace surface is a direct call with one String expression. */
function emitNativeTrace(emitter, node) {
    const callee = node.children[0];
    if (!callee || callee.kind !== nodeKind_1.default.IDENTIFIER || callee.text !== 'trace')
        return false;
    const binding = emitter.nativeGlobals.resolve(callee);
    if (!binding)
        return false;
    const stringExpression = (value) => {
        if (value.kind === nodeKind_1.default.ENCAPSULATED && value.children.length === 1)
            return stringExpression(value.children[0]);
        if (value.kind === nodeKind_1.default.LITERAL && /^["']/.test(value.text))
            return true;
        if (value.kind === nodeKind_1.default.IDENTIFIER) {
            const definition = emitter.findDefInScope(value.text);
            return !!definition && !definition.bound && definition.as3Type === 'String';
        }
        return value.kind === nodeKind_1.default.ADD && value.children.length >= 3 && value.children.length % 2 === 1
            && value.children.every((child, index) => index % 2 ? child.text === '+' : stringExpression(child));
    };
    // A literal String prefix in an all-plus chain guarantees a String result, even
    // with dynamic operands. Require source addition lowering: JavaScript's
    // object conversion hints are not Flash's. Nullable String annotations
    // alone do not establish this stronger guarantee.
    const literalStringResult = (value) => {
        if (value.kind === nodeKind_1.default.ENCAPSULATED && value.children.length === 1)
            return literalStringResult(value.children[0]);
        if (value.kind === nodeKind_1.default.LITERAL && /^["']/.test(value.text))
            return true;
        return value.kind === nodeKind_1.default.ADD && value.children.length >= 3 && value.children.length % 2 === 1
            && value.children.every((child, index) => index % 2 === 0 || child.text === '+')
            && literalStringResult(value.children[0]);
    };
    const args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (emitter.isNew || !args || args.children.length !== 1
        || !(stringExpression(args.children[0]) || (emitter.typedLocalPlan && literalStringResult(args.children[0]))))
        throw new Error('AS3_GLOBAL_MODULE_UNSUPPORTED: trace requires a direct single String expression');
    emitter.ensureImportIdentifier('trace as ' + binding.alias, binding.module, false);
    emitter.nativeSourceHelpers.add(binding.alias);
    emitter.catchup(node.start);
    emitter.insert(binding.alias + '(');
    const value = args.children[0];
    emitter.skipTo(value.start);
    visitNode(emitter, value);
    emitter.catchup(value.end);
    emitter.insert(')');
    emitter.skipTo(node.end);
    return true;
}
function emitBuiltinObjectCreation(emitter, node) {
    const module = emitter.options.nativeObjectCreationModule;
    if (module === undefined || !node)
        return false;
    let call = node;
    let construct = false;
    if (node.kind === nodeKind_1.default.NEW) {
        if (node.children.length !== 1 || !node.children[0] || node.children[0].kind !== nodeKind_1.default.CALL)
            return false;
        call = node.children[0];
        construct = true;
    }
    else if (node.kind !== nodeKind_1.default.CALL)
        return false;
    const callee = call.children[0], args = call.findChild(nodeKind_1.default.ARGUMENTS);
    if (!callee || callee.kind !== nodeKind_1.default.IDENTIFIER || callee.text !== 'Object'
        || emitter.findDefInScope('Object') || !args)
        return false;
    let helper = construct ? '__as3_as3ConstructClass' : '__as3_as3CallClass';
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    const exported = construct ? 'as3ConstructClass' : 'as3CallClass';
    emitter.ensureImportIdentifier(exported + ' as ' + helper, module, false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);
    emitter.insert(helper + '(Object, [');
    if (args.children.length) {
        emitter.skipTo(args.children[0].start);
        visitNodes(emitter, args.children);
        const close = args.end > args.start && emitter.source.charAt(args.end - 1) === ')' ? args.end - 1 : args.end;
        emitter.catchup(close);
    }
    else {
        emitter.skipTo(args.end);
    }
    emitter.insert('])');
    emitter.skipTo(node.end);
    return true;
}
function emitJSONParse(emitter, node) {
    const module = emitter.options.nativeJSONModule, callee = node.children[0];
    if (module === undefined || emitter.isNew || !callee || callee.kind !== nodeKind_1.default.DOT || callee.children.length !== 2)
        return false;
    const receiver = callee.children[0], method = callee.children[1];
    if (receiver.kind !== nodeKind_1.default.IDENTIFIER || receiver.text !== 'JSON' || method.text !== 'parse')
        return false;
    const classes = Object.keys(emitter.options.definitionsByNamespace || {}).reduce((all, ns) => all.concat(emitter.options.definitionsByNamespace[ns].map(name => (ns ? ns + '.' : '') + name)), []);
    if (emitter.findDefInScope('JSON') || native_typeof_1.typeOfBinding(receiver, emitter.source, classes))
        return false;
    const args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!args || args.children.length < 1 || args.children.length > 2)
        throw new Error('AS3_JSON_UNSUPPORTED: source text parse requires one or two arguments');
    const text = node_1.unwrapEncapsulatedExpression(args.children[0]);
    const def = text.kind === nodeKind_1.default.IDENTIFIER && emitter.findDefInScope(text.text);
    if (!(def && def.as3Type === 'String') && !(text.kind === nodeKind_1.default.LITERAL && /^["']/.test(text.text)) && text.text !== 'null' && !native_string_casts_1.intrinsicStringAs(emitter, text))
        throw new Error('AS3_JSON_UNSUPPORTED: text must have source String binding or literal');
    if (args.children.length === 2) {
        const reviver = node_1.unwrapEncapsulatedExpression(args.children[1]);
        const binding = reviver.kind === nodeKind_1.default.IDENTIFIER && emitter.findDefInScope(reviver.text);
        if (reviver.text !== 'null' && !(binding && binding.as3Type === 'Function')
            && reviver.kind !== nodeKind_1.default.LAMBDA && reviver.kind !== nodeKind_1.default.FUNCTION)
            throw new Error('AS3_JSON_UNSUPPORTED: reviver must have source Function binding, literal function or null');
    }
    const helper = propertyHelper(emitter, 'parseSourceJSON', module);
    emitter.catchup(node.start);
    emitter.insert(helper + '(');
    emitter.skipTo(getExpressionStart(args.children[0]));
    visitNodes(emitter, args.children);
    const close = args.end > args.start && emitter.source.charAt(args.end - 1) === ')' ? args.end - 1 : args.end;
    emitter.catchup(close);
    emitter.insert(')');
    emitter.skipTo(node.end);
    return true;
}
function nativePatternModule(emitter) {
    const input = native_generated_declarations_2.nativeGeneratedDeclarationInputs(emitter.generated.options.plan, emitter.generated.options.plan.scope);
    const module = emitter.options.nativeStringIntrinsicsModule;
    if (!module || !input.patternProviderModule || !emitter.options.nativeTypedLocals
        || module !== native_xml_1.xmlGlobalProviderModule(input.patternProviderModule, emitter.generated.options.module))
        throw new Error('AS3_PATTERN_LOCAL_UNSUPPORTED: exact generated pattern provider and typed locals required');
    return native_generated_emission_1.generatedModule(module);
}
function isQualifiedStringMethodReceiver(emitter, input) {
    const value = node_1.unwrapEncapsulatedExpression(input);
    if (!value)
        return false;
    if (value.kind === nodeKind_1.default.LITERAL && /^["']/.test(value.text))
        return true;
    if (value.kind === nodeKind_1.default.IDENTIFIER) {
        const binding = emitter.findDefInScope(value.text);
        return !!binding && !binding.bound && binding.as3Type === 'String';
    }
    // Addition becomes String once either source operand is a String, even
    // when another operand needs source valueOf/toString conversion.
    if (value.kind === nodeKind_1.default.ADD && value.children.length >= 3 && value.children.length % 2 === 1)
        return value.children.every((child, index) => !index || index % 2 === 0 || child.text === '+')
            && value.children.some((child, index) => index % 2 === 0 && isQualifiedStringMethodReceiver(emitter, child));
    const callee = value.kind === nodeKind_1.default.CALL && value.children[0];
    return !!callee && callee.kind === nodeKind_1.default.DOT && ['slice', 'toLowerCase'].indexOf(callee.children[1].text) >= 0
        && isQualifiedStringMethodReceiver(emitter, callee.children[0]);
}
function emitStringValueMethodCall(emitter, node) {
    if (!emitter.generated || emitter.options.nativeStringIntrinsicsModule === undefined || emitter.isNew)
        return false;
    const callee = node.children[0];
    if (!callee || callee.kind !== nodeKind_1.default.DOT || ['slice', 'toLowerCase'].indexOf(callee.children[1].text) < 0)
        return false;
    if (!isQualifiedStringMethodReceiver(emitter, callee.children[0]))
        return false;
    if (!emitter.references || emitter.references.resolve('String') !== 'String')
        throw new Error('AS3_STRING_INTRINSIC_UNSUPPORTED: exact builtin String source binding required');
    const args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!args)
        return false;
    const helper = propertyHelper(emitter, 'as3CallNamedProperty', emitter.generated.propertyModule);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitter.skipTo(getExpressionStart(callee.children[0]));
    visitNode(emitter, callee.children[0]);
    emitter.catchup(getEffectiveNodeEnd(callee.children[0]));
    emitter.insert(',' + JSON.stringify(callee.children[1].text) + ',()=>[');
    args.children.forEach((arg, index) => { if (index)
        emitter.insert(','); emitter.skipTo(getExpressionStart(arg)); visitNode(emitter, arg); emitter.catchup(getEffectiveNodeEnd(arg)); });
    emitter.insert(']))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitStringPatternCall(emitter, node) {
    const module = emitter.options.nativeStringIntrinsicsModule;
    if (module === undefined || emitter.isNew)
        return false;
    const callee = node.children[0];
    if (!callee || callee.kind !== nodeKind_1.default.DOT || ['replace', 'match', 'split'].indexOf(callee.children[1].text) < 0)
        return false;
    const method = callee.children[1].text, replacing = method === 'replace', splitting = method === 'split';
    const args = node.findChild(nodeKind_1.default.ARGUMENTS);
    const patternExpression = args && args.children.length && node_1.unwrapEncapsulatedExpression(args.children[0]);
    const nativeRegExp = emitter.generated && emitter.generated.options.plan.nativeBindings.some(b => b.qname === 'RegExp' && !b.nativeInterface);
    const patternCall = patternExpression && (patternExpression.kind === nodeKind_1.default.NEW ? patternExpression.children[0] : patternExpression);
    const nominal = patternExpression && (isRegExpValue(emitter, patternExpression)
        || nativeRegExp && patternExpression.kind === nodeKind_1.default.LITERAL && /^\/[\s\S]*\/[a-z]*$/.test(patternExpression.text)
        || patternCall.kind === nodeKind_1.default.CALL && !!nativeRegExpReference(emitter, patternCall.children[0]));
    // Ordinary String delimiters retain their separate dispatch path. This
    // source-pattern provider admits literal RegExp delimiters without limits.
    if (splitting && !nominal && (!args || !args.children[0] || args.children[0].kind !== nodeKind_1.default.LITERAL || !/^\/[\s\S]+\/[a-z]*$/.test(args.children[0].text)))
        return false;
    const receiver = node_1.unwrapEncapsulatedExpression(callee.children[0]);
    const stringExpression = (input) => {
        const value = node_1.unwrapEncapsulatedExpression(input);
        if (value.kind === nodeKind_1.default.LITERAL && /^["']/.test(value.text))
            return true;
        if (value.kind === nodeKind_1.default.IDENTIFIER) {
            const binding = emitter.findDefInScope(value.text);
            return !!binding && !binding.bound && binding.as3Type === 'String';
        }
        return value.kind === nodeKind_1.default.ADD && value.children.length >= 3 && value.children.length % 2 === 1
            && value.children.every((child, index) => index % 2 ? child.text === '+' : stringExpression(child));
    };
    if (!stringExpression(receiver) || !replacing && receiver.kind !== nodeKind_1.default.IDENTIFIER) {
        if (!nominal)
            return false;
        // Property values and call results can be Strings or user objects.
        // Runtime dispatch preserves custom methods instead of coercing the
        // receiver, and evaluates arguments before the final named lookup.
        const helper = propertyHelper(emitter, 'as3CallRegExpStringProperty', emitter.generated.propertyModule);
        emitter.catchup(node.start);
        emitter.insert('(<any>' + helper + '(');
        emitter.skipTo(getExpressionStart(callee.children[0]));
        visitNode(emitter, callee.children[0]);
        emitter.catchup(getEffectiveNodeEnd(callee.children[0]));
        emitter.insert(',' + JSON.stringify(method) + ',()=>[');
        args.children.forEach((arg, index) => { if (index)
            emitter.insert(','); emitter.skipTo(getExpressionStart(arg)); visitNode(emitter, arg); emitter.catchup(getEffectiveNodeEnd(arg)); });
        emitter.insert(']))');
        emitter.skipTo(getEffectiveNodeEnd(node));
        return true;
    }
    if (!emitter.references || emitter.references.resolve('String') !== 'String')
        throw new Error('AS3_STRING_INTRINSIC_UNSUPPORTED: exact builtin String source binding required');
    if (splitting && !nominal)
        nativePatternModule(emitter);
    else
        native_generated_emission_1.generatedModule(module);
    if (!args || args.children.length !== (replacing ? 2 : 1))
        throw new Error('AS3_STRING_INTRINSIC_UNSUPPORTED: ' + method + ' requires exactly ' + (replacing ? 'two' : 'one') + ' authored arguments');
    if (nominal) {
        const input = native_generated_declarations_2.nativeGeneratedDeclarationInputs(emitter.generated.options.plan, emitter.generated.options.plan.scope);
        const helper = propertyHelper(emitter, replacing ? 'sourceRegExpStringReplace' : splitting ? 'sourceRegExpStringSplit' : 'sourceRegExpStringMatch', native_xml_1.xmlGlobalProviderModule(input.providers.RegExp.module, emitter.generated.options.module));
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        [callee.children[0], ...args.children].forEach((arg, index) => { if (index)
            emitter.insert(','); emitter.skipTo(getExpressionStart(arg)); visitNode(emitter, arg); emitter.catchup(getEffectiveNodeEnd(arg)); });
        emitter.insert(')');
        emitter.skipTo(getEffectiveNodeEnd(node));
        return true;
    }
    // The legacy regex token end excludes flags; its exact text includes them.
    const pattern = args.children[0], raw = pattern.text;
    const primitiveLiteral = (value) => value.kind === nodeKind_1.default.LITERAL
        && /^(?:null|true|false|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|0[xX][\da-fA-F]+)$/.test(value.text);
    const literalSearch = node_1.unwrapEncapsulatedExpression(pattern);
    const primitiveKeyword = literalSearch.kind === nodeKind_1.default.IDENTIFIER
        && ['null', 'true', 'false', 'undefined'].indexOf(literalSearch.text) >= 0
        && !emitter.findDefInScope(literalSearch.text);
    if (replacing && (stringExpression(pattern) || primitiveLiteral(literalSearch) || primitiveKeyword)) {
        const replace = propertyHelper(emitter, 'sourceStringLiteralReplace', module);
        emitter.catchup(node.start);
        emitter.insert(replace + '(');
        [callee.children[0], ...args.children].forEach((argument, index) => {
            if (index)
                emitter.insert(',');
            emitter.skipTo(getExpressionStart(argument));
            visitNode(emitter, argument);
            emitter.catchup(getEffectiveNodeEnd(argument));
        });
        emitter.insert(')');
        emitter.skipTo(getEffectiveNodeEnd(node));
        return true;
    }
    let construction = null, match = null;
    if (pattern.kind === nodeKind_1.default.NEW) {
        if (!replacing)
            throw new Error('AS3_STRING_INTRINSIC_UNSUPPORTED: match requires a qualified literal');
        const call = pattern.children[0], target = call && call.children[0];
        const shadow = target && emitter.findDefInScope(target.text);
        if (!call || call.kind !== nodeKind_1.default.CALL || !target || target.kind !== nodeKind_1.default.IDENTIFIER
            || target.text !== 'RegExp' || emitter.references.resolve('RegExp') !== 'RegExp'
            || shadow && (shadow.bound || Object.prototype.hasOwnProperty.call(shadow, 'as3Type') || shadow.sourceImport))
            throw new Error('AS3_STRING_INTRINSIC_UNSUPPORTED: exact builtin RegExp construction required');
        construction = call.findChild(nodeKind_1.default.ARGUMENTS);
        if (!construction || construction.children.length !== 2)
            throw new Error('AS3_STRING_INTRINSIC_UNSUPPORTED: pattern construction requires two authored arguments');
    }
    else {
        if (typeof raw !== 'string' || emitter.source.slice(pattern.start, pattern.start + raw.length) !== raw)
            throw new Error('AS3_STRING_INTRINSIC_UNSUPPORTED: exact source regex token required');
        match = pattern.kind === nodeKind_1.default.LITERAL && /^\/([\s\S]+)\/([a-z]*)$/.exec(raw);
        if (!match)
            throw new Error('AS3_STRING_INTRINSIC_UNSUPPORTED: replace pattern requires a qualified literal');
    }
    const replace = propertyHelper(emitter, replacing ? 'sourceStringReplace' : splitting ? 'sourceStringSplit' : 'sourceStringMatch', module);
    const compile = propertyHelper(emitter, construction ? 'constructSourceStringReplacePattern' : 'compileSourceStringPattern', module);
    emitter.catchup(node.start);
    emitter.insert(replace + '(');
    emitter.skipTo(callee.children[0].start);
    visitNode(emitter, callee.children[0]);
    emitter.catchup(getEffectiveNodeEnd(callee.children[0]));
    emitter.insert(',' + compile + '(');
    if (construction) {
        construction.children.forEach((argument, index) => {
            if (index)
                emitter.insert(',');
            emitter.skipTo(getExpressionStart(argument));
            visitNode(emitter, argument);
            emitter.catchup(getEffectiveNodeEnd(argument));
        });
    }
    else
        emitter.insert(JSON.stringify(match[1]) + ',' + JSON.stringify(match[2]));
    emitter.insert(')');
    if (replacing) {
        emitter.insert(',');
        emitter.skipTo(getExpressionStart(args.children[1]));
        visitNode(emitter, args.children[1]);
        emitter.catchup(getEffectiveNodeEnd(args.children[1]));
    }
    emitter.insert(')');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function isDictionaryReceiver(emitter, node) {
    // Resolve field identity in its declaring class, including protected ancestors.
    // A local with the same spelling continues to own an unqualified identifier.
    const lexicalDictionary = (name) => {
        if (!emitter.generated)
            return false;
        const trait = emitter.generated.lexical.traits.find(t => t.name === name && !t.static && t.kind === 'variable');
        const ref = trait && trait.type && emitter.generated.options.plan.references.find(r => r.owner === trait.owner && r.start === trait.type.start && r.end === trait.type.end);
        return !!ref && ref.kind === 'native' && ref.identity === 'flash.utils.Dictionary';
    };
    if (node && node.kind === nodeKind_1.default.DOT && emitter.generated
        && node.children[0].kind === nodeKind_1.default.IDENTIFIER && node.children[0].text === 'this'
        && node.children[1].kind === nodeKind_1.default.LITERAL) {
        const trait = emitter.generated.projection.instanceTraits.find(t => t.name === node.children[1].text);
        const binding = emitter.generated.options.plan.nativeBindings.find(b => b.qname === 'flash.utils.Dictionary');
        return lexicalDictionary(node.children[1].text) || !!binding && !!trait
            && (trait.kind === 'accessor' || trait.kind === 'variable') && typeof trait.type === 'object'
            && trait.type.referenceExport === binding.referenceExport;
    }
    if (!node || node.kind !== nodeKind_1.default.IDENTIFIER)
        return false;
    const definition = emitter.findDefInScope(node.text);
    if ((!definition || definition.bound) && lexicalDictionary(node.text))
        return true;
    const dictionary = emitter.findDefInScope('Dictionary');
    return !!definition && (definition.as3Type === 'Dictionary' || definition.as3Type === 'flash.utils.Dictionary')
        && !!dictionary && dictionary.sourceImport === 'flash.utils.Dictionary';
}
function propertyHelper(emitter, exported, module) {
    let helper = '__as3_' + exported;
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    emitter.ensureImportIdentifier(exported + ' as ' + helper, module, false);
    emitter.nativeSourceHelpers.add(helper);
    return helper;
}
function dictionaryAccess(emitter, node) {
    const module = emitter.options.nativeDictionaryPropertyModule;
    if (module === undefined || !node || (node.kind !== nodeKind_1.default.DOT && node.kind !== nodeKind_1.default.ARRAY_ACCESSOR)
        || node.children.length !== 2)
        return null;
    const receiver = node.children[0], key = node.children[1];
    if (!receiver || !key)
        return null;
    if (!isDictionaryReceiver(emitter, receiver))
        return null;
    return node.kind === nodeKind_1.default.DOT && key.kind === nodeKind_1.default.LITERAL
        ? { receiver, key, literalKey: key.text } : { receiver, key };
}
function dictionaryHelper(emitter, exported) {
    return propertyHelper(emitter, exported, emitter.options.nativeDictionaryPropertyModule);
}
function emitDictionaryKey(emitter, access) {
    visitNode(emitter, access.receiver);
    emitter.catchup(access.receiver.end);
    emitter.insert(', ');
    if (access.literalKey !== undefined) {
        emitter.insert(JSON.stringify(access.literalKey));
    }
    else {
        emitter.skipTo(access.key.start);
        visitNode(emitter, access.key);
        emitter.catchup(access.key.end);
    }
}
function emitPropertyKey(emitter, access) {
    emitDictionaryKey(emitter, access);
}
function emitDictionaryProperty(emitter, node, exported) {
    const access = dictionaryAccess(emitter, node);
    if (!access)
        return false;
    const target = node_1.outerEncapsulatedExpression(node), parent = target && target.parent;
    if (parent && parent.children[0] === target
        && [nodeKind_1.default.ASSIGN, nodeKind_1.default.PRE_INC, nodeKind_1.default.PRE_DEC, nodeKind_1.default.POST_INC, nodeKind_1.default.POST_DEC].indexOf(parent.kind) >= 0)
        throw new Error('AS3_DICTIONARY_PROPERTY_UNSUPPORTED: indexed read cannot substitute compound/update dispatch');
    const helper = dictionaryHelper(emitter, exported);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitDictionaryKey(emitter, access);
    emitter.insert('))');
    emitter.skipTo(node.end);
    return true;
}
function emitDictionaryPropertyAssignment(emitter, target, value) {
    const access = dictionaryAccess(emitter, target);
    if (!access)
        return false;
    const helper = dictionaryHelper(emitter, 'as3SetProperty');
    emitter.catchup(target.parent.start);
    emitter.insert(helper + '(');
    emitDictionaryKey(emitter, access);
    emitter.insert(', ');
    emitter.skipTo(value.start);
    visitNode(emitter, value);
    emitter.catchup(getEffectiveNodeEnd(value));
    emitter.insert(')');
    emitter.skipTo(getEffectiveNodeEnd(target.parent));
    return true;
}
function generatedReceiver(emitter, receiver) {
    if (!emitter.generated || receiver.kind !== nodeKind_1.default.IDENTIFIER)
        return null;
    if (receiver.text === 'this')
        return emitter.generated.projection;
    const definition = emitter.findDefInScope(receiver.text);
    const token = definition && emitter.references && emitter.references.type(definition.as3Type);
    const plan = emitter.generated.options.plan, binding = token && plan.bindings.find(b => b.tokenExport === token);
    const helper = token && plan.privateBindings.find(b => b.tokenExport === token), identity = binding ? binding.qname : helper ? helper.identity : null;
    if (!identity)
        return null;
    let projection = emitter.generatedReceiverTraits.get(identity);
    if (!projection) {
        projection = new native_generated_traits_1.NativeGeneratedClassTraits(plan, plan.scope, identity, emitter.generated.sources[identity]);
        emitter.generatedReceiverTraits.set(identity, projection);
    }
    return projection;
}
function isRegExpValue(emitter, node) {
    if (!emitter.generated || !emitter.references || !node)
        return false;
    const receiver = node_1.unwrapEncapsulatedExpression(node);
    if (receiver.kind !== nodeKind_1.default.IDENTIFIER)
        return false;
    const binding = emitter.generated.options.plan.nativeBindings.find(b => b.qname === 'RegExp' && !b.nativeInterface);
    if (!binding)
        return false;
    const definition = emitter.findDefInScope(receiver.text);
    let qualified = definition && !definition.bound && emitter.references.type(definition.as3Type) === binding.referenceExport;
    if (!definition || definition.bound) {
        const trait = emitter.generated.lexical.trait(receiver.text, true) || emitter.generated.lexical.trait(receiver.text, false);
        qualified = !!trait && !!trait.type && emitter.generated.options.plan.references.some(ref => ref.owner === trait.owner
            && ref.start === trait.type.start && ref.end === trait.type.end && ref.kind === 'native' && ref.identity === 'RegExp');
    }
    return !!qualified;
}
function regExpAccess(emitter, node) {
    if (!node || [nodeKind_1.default.DOT, nodeKind_1.default.ARRAY_ACCESSOR].indexOf(node.kind) < 0 || node.children.length !== 2)
        return null;
    return isRegExpValue(emitter, node.children[0]) ? Object.assign({ receiver: node.children[0], key: node.children[1] }, (node.kind === nodeKind_1.default.DOT ? { literalKey: node.children[1].text } : {})) : null;
}
function dynamicAccess(emitter, node) {
    const regexp = regExpAccess(emitter, node);
    if (regexp)
        return regexp;
    if (!node || [nodeKind_1.default.ARRAY_ACCESSOR, nodeKind_1.default.DOT].indexOf(node.kind) < 0 || node.children.length !== 2)
        return null;
    const receiver = node.children[0], key = node.children[1];
    if (!receiver || !key)
        return null;
    // The exact qualified native token owns dispatch as well as coercion. Raw
    // JavaScript member access leaks host null errors and unbound methods.
    if (emitter.options.nativeElementFormatReferenceModule !== undefined && emitter.generated && emitter.references) {
        const root = node_1.unwrapEncapsulatedExpression(receiver);
        const definition = root.kind === nodeKind_1.default.IDENTIFIER && emitter.findDefInScope(root.text);
        const binding = emitter.generated.options.plan.nativeBindings.find(b => b.qname === 'flash.text.engine.ElementFormat');
        if (binding && definition && !definition.bound && typeof definition.as3Type === 'string'
            && emitter.references.type(definition.as3Type) === binding.referenceExport)
            return Object.assign({ receiver, key, lexical: true }, (node.kind === nodeKind_1.default.DOT ? { literalKey: key.text } : {}));
    }
    if (node.kind === nodeKind_1.default.ARRAY_ACCESSOR && receiver.kind === nodeKind_1.default.IDENTIFIER && emitter.generated && emitter.references) {
        const definition = emitter.findDefInScope(receiver.text), plan = emitter.generated.options.plan;
        const movie = plan.nativeBindings.find(b => b.qname === 'flash.display.MovieClip');
        if (movie && definition && !definition.bound && emitter.references.type(definition.as3Type) === movie.referenceExport) {
            const input = native_generated_declarations_2.nativeGeneratedDeclarationInputs(plan, plan.scope), provider = input.providers['flash.display.MovieClip'];
            if (provider.nativeBase !== 'MovieClip' || emitter.options.nativeMovieClipReferenceModule !== provider.module
                || !emitter.options.importModules || emitter.options.importModules['flash.display.MovieClip'] !== provider.module)
                throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: MovieClip requires authenticated native base/reference plan');
            // The canonical dynamic property store is distinct from raw JS own
            // properties. Computed source reads/writes must use that same store.
            return { receiver, key };
        }
    }
    const interfaceMethod = sourceInterfaceAccessorAccess(emitter, node, 'method');
    if (interfaceMethod)
        return interfaceMethod;
    if (isInterfaceCast(emitter, receiver)) {
        if (node.kind !== nodeKind_1.default.DOT || key.kind !== nodeKind_1.default.LITERAL)
            throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: computed interface-cast properties require separate authority');
        return { receiver, key, literalKey: key.text };
    }
    const internal = emitter.generated && native_generated_declarations_2.nativeGeneratedDeclarationInputs(emitter.generated.options.plan, emitter.generated.options.plan.scope).lexicalProviderModule;
    if (internal && node.kind === nodeKind_1.default.ARRAY_ACCESSOR && receiver.kind === nodeKind_1.default.CALL
        && receiver.children[0].kind === nodeKind_1.default.IDENTIFIER && receiver.children[0].text === 'Object'
        && !emitter.findDefInScope('Object') && native_typeof_1.typeOfBinding(receiver.children[0], emitter.source, Object.keys(emitter.generated.classes)) === 'builtin'
        && receiver.children[1].children.length === 1) {
        const argument = receiver.children[1].children[0];
        const definition = argument.kind === nodeKind_1.default.IDENTIFIER && emitter.findDefInScope(argument.text);
        if (argument.kind === nodeKind_1.default.IDENTIFIER && (!definition || !Object.prototype.hasOwnProperty.call(definition, 'as3Type'))
            && emitter.generated.options.plan.bindings.some(b => b.qname.split('.').pop() === argument.text))
            return { receiver, key, lexical: true };
    }
    if (receiver.kind !== nodeKind_1.default.IDENTIFIER) {
        if (emitter.generated && emitter.generated.projection.metadata.isDynamic)
            throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: computed receiver in dynamic class held');
        return null;
    }
    const generated = generatedReceiver(emitter, receiver), definition = emitter.findDefInScope(receiver.text);
    if (internal && !generated && node.kind === nodeKind_1.default.DOT && key.kind === nodeKind_1.default.LITERAL
        && definition && !definition.bound && ['Object', '*', 'Class'].indexOf(definition.as3Type) >= 0)
        return { receiver, key, literalKey: key.text, lexical: true };
    if (node.kind === nodeKind_1.default.ARRAY_ACCESSOR && emitter.generated && emitter.classFactory
        && receiver.text === emitter.generated.lexical.owner.split('.').pop()
        && (!definition || !Object.prototype.hasOwnProperty.call(definition, 'as3Type'))
        && emitter.generated.lexical.own.some(t => t.static && (t.kind === 'constant'
            || t.kind === 'variable' && t.visibility === 'protected' && t.type && t.type.text === 'String'))) {
        let member = node;
        while (member.parent && member.parent.kind !== nodeKind_1.default.CONTENT)
            member = member.parent;
        const mods = member.findChild(nodeKind_1.default.MOD_LIST), keyDefinition = key.kind === nodeKind_1.default.IDENTIFIER && emitter.findDefInScope(key.text);
        const privateStatic = emitter.generated.lexical.own.some(t => t.static && t.kind === 'constant' && t.visibility === 'private');
        if (member.kind !== nodeKind_1.default.FUNCTION || !privateStatic && (!mods || !mods.children.some(mod => mod.text === 'static'))
            || !keyDefinition || keyDefinition.bound || keyDefinition.as3Type !== 'String')
            throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: own static constant lookup requires a method String key');
        return { receiver, key, lexical: true, ownStatic: true };
    }
    if (!generated && (!definition || ['Object', '*'].indexOf(definition.as3Type) < 0))
        return null;
    const lexical = !!generated && receiver.text === 'this' || !!internal && node.kind === nodeKind_1.default.ARRAY_ACCESSOR;
    if (lexical && receiver.text === 'this') {
        let member = node;
        while (member.parent && member.parent.kind !== nodeKind_1.default.CONTENT)
            member = member.parent;
        const mods = member.findChild(nodeKind_1.default.MOD_LIST);
        if (mods && mods.children.some(mod => mod.text === 'static'))
            throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: static this dispatch held');
    }
    if (node.kind === nodeKind_1.default.DOT) {
        if (!generated || !generated.metadata.isDynamic || key.kind !== nodeKind_1.default.LITERAL
            || generated.instanceTraits.some(t => t.name === key.text))
            return null;
        return { receiver, key, literalKey: key.text, lexical };
    }
    return { receiver, key, lexical };
}
/** Public paths rooted in Object/wildcard locals or an intrinsic Object(value)
 * conversion. Other computed roots need their own source type/visibility proof;
 * do not infer it from TypeScript's any type. */
function objectPropertyAccess(emitter, node) {
    if (!emitter.options.nativeObjectPropertyModule || !emitter.references || !node
        || [nodeKind_1.default.DOT, nodeKind_1.default.ARRAY_ACCESSOR].indexOf(node.kind) < 0 || node.children.length !== 2)
        return null;
    const receiver = node.children[0], key = node.children[1], root = node_1.unwrapEncapsulatedExpression(receiver);
    if (!root || !key || node.kind === nodeKind_1.default.DOT && key.kind !== nodeKind_1.default.LITERAL)
        return null;
    const methodName = node.kind === nodeKind_1.default.DOT ? key.text : reflectionStringLiteral(emitter, key);
    const stringMethod = emitter.generated && emitter.options.nativeStringIntrinsicsModule !== undefined
        && ['slice', 'toLowerCase'].indexOf(methodName) >= 0;
    if (stringMethod && isQualifiedStringMethodReceiver(emitter, root)) {
        if (emitter.references.resolve('String') !== 'String')
            throw new Error('AS3_STRING_INTRINSIC_UNSUPPORTED: exact builtin String source binding required');
        return node.kind === nodeKind_1.default.DOT ? { receiver, key, literalKey: key.text } : { receiver, key };
    }
    if (root.kind === nodeKind_1.default.IDENTIFIER) {
        const definition = emitter.findDefInScope(root.text);
        // Event exposes these getters as AS3 Object, even though the shared
        // native API deliberately returns unknown. Preserve source dispatch on
        // their values without granting arbitrary native properties that type.
        if (emitter.generated && definition && !definition.bound && definition.as3Type
            && node.kind === nodeKind_1.default.DOT && ['target', 'currentTarget'].indexOf(key.text) >= 0
            && emitter.generated.lexical.resolveTypeName(definition.as3Type) === 'flash.events.Event'
            && emitter.generated.options.plan.nativeBindings.some(b => b.qname === 'flash.events.Event' && !!b.nativeBaseExport))
            return { receiver, key, literalKey: key.text };
        if (!definition || definition.bound || ['Object', '*'].indexOf(definition.as3Type) < 0
            || definition.as3Type === 'Object' && (emitter.references.sourceClass('Object') || emitter.references.sourceInterface('Object')))
            return null;
    }
    else if (root.kind === nodeKind_1.default.CALL && root.children[0]
        && root.children[0].kind === nodeKind_1.default.IDENTIFIER && root.children[0].text === 'Object') {
        const classes = Object.keys(emitter.options.definitionsByNamespace || {}).reduce((all, ns) => all.concat(emitter.options.definitionsByNamespace[ns].map(name => (ns ? ns + '.' : '') + name)), []);
        if (emitter.findDefInScope('Object') || native_typeof_1.typeOfBinding(root.children[0], emitter.source, classes) !== 'builtin')
            return null;
        const args = root.findChild(nodeKind_1.default.ARGUMENTS);
        if (!emitter.options.nativeObjectCreationModule || !args || args.children.length !== 1)
            throw new Error('AS3_OBJECT_PROPERTY_UNSUPPORTED: intrinsic Object receiver requires one argument and source Object conversion provider');
        // Retain the conversion expression: Object(null/undefined) allocates a
        // fresh object, while primitive and genuine instance values keep identity.
    }
    else if (stringMethod && root.kind === nodeKind_1.default.CALL && objectPropertyAccess(emitter, root.children[0])) {
        // A call through an Object/wildcard property has an untyped result.
        // Preserve dynamic method dispatch on that result, including custom
        // objects; it is not evidence that the result must be a String.
    }
    else if (!objectPropertyAccess(emitter, root))
        return null;
    return node.kind === nodeKind_1.default.DOT ? { receiver, key, literalKey: key.text } : { receiver, key };
}
function emitObjectPropertyCall(emitter, node) {
    const access = objectPropertyAccess(emitter, node.children[0]), args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!access || !args)
        return false;
    if (emitter.isNew)
        throw new Error('AS3_OBJECT_PROPERTY_UNSUPPORTED: property constructor requires separate construction lowering');
    const helper = propertyHelper(emitter, access.literalKey === undefined ? 'as3CallProperty' : 'as3CallNamedProperty', emitter.options.nativeObjectPropertyModule);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitPropertyKey(emitter, access);
    emitter.insert(',()=>[');
    args.children.forEach((arg, index) => { if (index)
        emitter.insert(','); emitter.skipTo(getExpressionStart(arg)); visitNode(emitter, arg); emitter.catchup(getEffectiveNodeEnd(arg)); });
    emitter.insert(']))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitObjectPropertyAssignment(emitter, node) {
    const access = objectPropertyAccess(emitter, node_1.unwrapEncapsulatedExpression(node.children[0]));
    if (!access)
        return false;
    const value = node.children[2], helper = propertyHelper(emitter, 'as3SetProperty', emitter.options.nativeObjectPropertyModule);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitPropertyKey(emitter, access);
    // Receiver and key are captured before RHS effects. The provider validates
    // after evaluation, stores typed coercion and returns the original RHS.
    emitter.insert(',(');
    emitter.skipTo(getExpressionStart(value));
    visitNode(emitter, value);
    emitter.catchup(getEffectiveNodeEnd(value));
    emitter.insert(')))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitObjectPropertyAddition(emitter, node) {
    const access = objectPropertyAccess(emitter, node_1.unwrapEncapsulatedExpression(node.children[0]));
    if (!access || access.literalKey === undefined)
        return false;
    const value = node.children[2], helper = propertyHelper(emitter, 'as3AddAssignProperty', emitter.options.nativeObjectPropertyModule);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    const start = emitter.output.length;
    visitNode(emitter, access.receiver);
    emitter.catchup(getEffectiveNodeEnd(access.receiver));
    const receiver = emitter.output.slice(start);
    emitter.insert(', ' + JSON.stringify(access.literalKey) + ',()=>(');
    emitter.skipTo(getExpressionStart(value));
    visitNode(emitter, value);
    emitter.catchup(getEffectiveNodeEnd(value));
    // Flash repeats the receiver path for storage, after RHS addition/coercion.
    // Capturing just the first receiver would lose reassignment/getter effects.
    emitter.insert('),()=>(' + receiver + ')))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitObjectPropertyRead(emitter, node) {
    const access = objectPropertyAccess(emitter, node);
    if (!access)
        return false;
    const outer = node_1.outerEncapsulatedExpression(node), parent = outer && outer.parent;
    if (parent && (parent.children[0] === outer && [nodeKind_1.default.ASSIGN, nodeKind_1.default.CALL].indexOf(parent.kind) >= 0
        || [nodeKind_1.default.DELETE, nodeKind_1.default.PRE_INC, nodeKind_1.default.PRE_DEC, nodeKind_1.default.POST_INC, nodeKind_1.default.POST_DEC].indexOf(parent.kind) >= 0))
        throw new Error('AS3_OBJECT_PROPERTY_UNSUPPORTED: path read cannot substitute write, update, delete or unqualified call');
    const helper = propertyHelper(emitter, 'as3GetProperty', emitter.options.nativeObjectPropertyModule);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitPropertyKey(emitter, access);
    emitter.insert('))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function dynamicWriteAccess(emitter, node) {
    const setter = sourceInterfaceAccessorAccess(emitter, node, 'set');
    const access = dynamicAccess(emitter, node) || setter;
    if (access && emitter.options.nativeDynamicPropertyWritesModule === undefined) {
        if (setter)
            throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: source interface writes require provider');
        if (isInterfaceCast(emitter, access.receiver))
            native_generated_emission_1.generatedModule(emitter.options.nativeDynamicPropertyWritesModule);
        if (generatedReceiver(emitter, access.receiver))
            throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: generated property writes require provider');
        return null;
    }
    return access;
}
function dynamicHelper(emitter, access, operation, module) {
    return propertyHelper(emitter, 'as3' + operation + (access.lexical ? 'LexicalProperty' : 'Property'), access.lexical ? emitter.generated.lexicalModule : module);
}
function emitDynamicKey(emitter, access) {
    if (access.lexical)
        emitter.insert(emitter.generated.lexical.scope + ', ');
    if (access.ownStatic) {
        emitter.insert(emitter.classFactory.value + ', ');
        emitter.skipTo(access.key.start);
        visitNode(emitter, access.key);
        emitter.catchup(access.key.end);
        return;
    }
    emitPropertyKey(emitter, access);
}
function emitDynamicPropertyRead(emitter, node) {
    const module = emitter.options.nativeDynamicPropertyReadsModule;
    const found = dynamicAccess(emitter, node) || sourceInterfaceAccessorAccess(emitter, node, 'get');
    if (!found)
        return false;
    if (module === undefined) {
        if (isInterfaceCast(emitter, found.receiver))
            native_generated_emission_1.generatedModule(module);
        if (generatedReceiver(emitter, found.receiver))
            throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: generated property reads require provider');
        return false;
    }
    let access = node, parent = node.parent;
    while (parent && parent.kind === nodeKind_1.default.ENCAPSULATED) {
        access = parent;
        parent = parent.parent;
    }
    if (parent && ((parent.kind === nodeKind_1.default.ASSIGN || parent.kind === nodeKind_1.default.CALL) && parent.children[0] === access
        || [nodeKind_1.default.DELETE, nodeKind_1.default.PRE_INC, nodeKind_1.default.POST_INC, nodeKind_1.default.PRE_DEC, nodeKind_1.default.POST_DEC].indexOf(parent.kind) >= 0))
        throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: indexed read cannot substitute call, write, update or delete dispatch');
    const helper = dynamicHelper(emitter, found, 'Get', module);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitDynamicKey(emitter, found);
    emitter.insert('))');
    emitter.skipTo(node.end);
    return true;
}
/** Authenticated interface members preserve null errors and canonical dispatch. */
function sourceInterfaceAccessorAccess(emitter, node, kind) {
    if (!emitter.generated || !emitter.references || !node || node.kind !== nodeKind_1.default.DOT || node.children.length !== 2)
        return null;
    const receiver = node.children[0], key = node.children[1];
    if (receiver.kind !== nodeKind_1.default.IDENTIFIER || key.kind !== nodeKind_1.default.LITERAL)
        return null;
    const definition = emitter.findDefInScope(receiver.text);
    if (!definition || definition.bound || typeof definition.as3Type !== 'string')
        return null;
    const token = emitter.references.sourceInterface(definition.as3Type), plan = emitter.generated.options.plan;
    const contract = native_generated_declarations_1.nativeGeneratedInterfaceBindings(plan).find(binding => binding.tokenExport === token);
    const native = plan.nativeBindings.find(binding => binding.nativeInterface && binding.referenceExport === token);
    if (!contract && !native)
        return null;
    const owners = new Set();
    const visit = (name) => {
        if (owners.has(name))
            return;
        owners.add(name);
        const binding = native_generated_declarations_1.nativeGeneratedInterfaceBindings(plan).find(value => value.qname === name);
        if (binding)
            binding.bases.forEach(visit);
    };
    visit(contract ? contract.qname : native.qname);
    return plan.interfaceContracts.members.some(member => owners.has(member.owner) && member.name === key.text && member.kind === kind)
        ? { receiver, key, literalKey: key.text } : null;
}
function emitDynamicPropertyAddition(emitter, target, value) {
    const dictionary = dictionaryAccess(emitter, target);
    const access = dictionary || dynamicWriteAccess(emitter, target);
    if (!access)
        return false;
    if (access.ownStatic || !access.lexical && access.literalKey !== undefined)
        throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: own-static/nonlexical dot compound assignment held');
    const helper = dynamicHelper(emitter, access, 'AddAssign', dictionary
        ? emitter.options.nativeDictionaryPropertyModule : emitter.options.nativeDynamicPropertyWritesModule);
    emitter.catchup(target.parent.start);
    emitter.insert('(<any>' + helper + '(');
    if (access.lexical)
        emitter.insert(emitter.generated.lexical.scope + ', ');
    const start = emitter.output.length;
    visitNode(emitter, access.receiver);
    emitter.catchup(access.receiver.end);
    const receiver = emitter.output.slice(start);
    emitter.insert(', ');
    emitter.skipTo(access.key.start);
    if (access.literalKey !== undefined) {
        emitter.insert(JSON.stringify(access.literalKey));
        emitter.skipTo(access.key.end);
    }
    else {
        visitNode(emitter, access.key);
        emitter.catchup(access.key.end);
    }
    emitter.insert(', () => (');
    emitter.skipTo(getExpressionStart(value));
    visitNode(emitter, value);
    emitter.catchup(getEffectiveNodeEnd(value));
    emitter.insert('), () => ' + receiver + '))');
    emitter.skipTo(getEffectiveNodeEnd(target.parent));
    return true;
}
function emitDynamicPropertyAssignment(emitter, target, value) {
    const access = dynamicWriteAccess(emitter, target);
    if (!access)
        return false;
    const helper = dynamicHelper(emitter, access, 'Set', emitter.options.nativeDynamicPropertyWritesModule);
    emitter.catchup(target.parent.start);
    emitter.insert(helper + '(');
    emitDynamicKey(emitter, access);
    emitter.insert(', ');
    emitter.skipTo(value.start);
    visitNode(emitter, value);
    emitter.catchup(getEffectiveNodeEnd(value));
    emitter.insert(')');
    emitter.skipTo(getEffectiveNodeEnd(target.parent));
    return true;
}
function emitInternalDynamicCall(emitter, node) {
    if (!emitter.generated || !native_generated_declarations_2.nativeGeneratedDeclarationInputs(emitter.generated.options.plan, emitter.generated.options.plan.scope).lexicalProviderModule
        || [nodeKind_1.default.ARRAY_ACCESSOR, nodeKind_1.default.DOT].indexOf(node.children[0].kind) < 0)
        return false;
    const access = dynamicAccess(emitter, node.children[0]), args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!access || !access.lexical || access.ownStatic || !args)
        return false;
    const helper = dynamicHelper(emitter, access, 'Call', emitter.options.nativeDynamicPropertyReadsModule);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitDynamicKey(emitter, access);
    emitter.insert(',()=>[');
    args.children.forEach((arg, index) => { if (index)
        emitter.insert(','); emitter.skipTo(arg.start); visitNode(emitter, arg); emitter.catchup(arg.end); });
    emitter.insert(']))');
    emitter.skipTo(node.end);
    return true;
}
function emitInterfaceMethodCall(emitter, node) {
    const access = sourceInterfaceAccessorAccess(emitter, node.children[0], 'method'), args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!access || !args)
        return false;
    if (emitter.isNew)
        throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: interface method is not a constructor');
    const helper = propertyHelper(emitter, 'as3CallNamedProperty', emitter.options.nativeDynamicPropertyReadsModule);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitPropertyKey(emitter, access);
    emitter.insert(',()=>[');
    args.children.forEach((arg, index) => { if (index)
        emitter.insert(','); emitter.skipTo(getExpressionStart(arg)); visitNode(emitter, arg); emitter.catchup(getEffectiveNodeEnd(arg)); });
    emitter.insert(']))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitDictionaryPropertyCall(emitter, node) {
    if (!node || node.kind !== nodeKind_1.default.CALL || node.children.length < 2)
        return false;
    const access = dictionaryAccess(emitter, node.children[0]);
    const args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!access || !args)
        return false;
    const helper = dictionaryHelper(emitter, 'as3CallProperty');
    emitter.catchup(node.start);
    emitter.insert(helper + '(');
    emitDictionaryKey(emitter, access);
    emitter.insert(', () => [');
    if (args.children.length) {
        emitter.skipTo(args.children[0].start);
        visitNodes(emitter, args.children);
        const close = args.end > args.start && emitter.source.charAt(args.end - 1) === ')' ? args.end - 1 : args.end;
        emitter.catchup(close);
    }
    else {
        emitter.skipTo(args.end);
    }
    emitter.insert('])');
    emitter.skipTo(node.end);
    return true;
}
function emitDelete(emitter, node) {
    const dynamic = node.children.length === 1 && dynamicWriteAccess(emitter, node.children[0]);
    if (dynamic) {
        const helper = dynamicHelper(emitter, dynamic, 'Delete', emitter.options.nativeDynamicPropertyWritesModule);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        emitter.skipTo(dynamic.receiver.start);
        emitDynamicKey(emitter, dynamic);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    const object = node.children.length === 1 && objectPropertyAccess(emitter, node_1.unwrapEncapsulatedExpression(node.children[0]));
    if (object) {
        const helper = propertyHelper(emitter, 'as3DeleteProperty', emitter.options.nativeObjectPropertyModule);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        emitter.skipTo(object.receiver.start);
        emitPropertyKey(emitter, object);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (node.children.length === 1) {
        const access = dictionaryAccess(emitter, node.children[0]);
        if (access) {
            if (emitter.getIndex() < node.start)
                emitter.insert(emitter.sourceBetween(emitter.getIndex(), node.start));
            emitter.skipTo(node.children[0].start);
            emitDictionaryProperty(emitter, node.children[0], 'as3DeleteProperty');
            return;
        }
    }
    emitter.catchup(node.start);
    visitNodes(emitter, node.children);
}
/** Resolve source Array authority before lexical fields become native accesses. */
function generatedArraySortAccess(emitter, node) {
    if (!emitter.generated || emitter.options.nativeArraySortModule === undefined || !node
        || node.kind !== nodeKind_1.default.DOT || node.children.length !== 2)
        return null;
    const receiver = node_1.unwrapEncapsulatedExpression(node.children[0]), key = node.children[1];
    if (key.kind !== nodeKind_1.default.LITERAL || ['sort', 'sortOn'].indexOf(key.text) < 0
        || emitter.generated.lexical.resolveTypeName('Array') !== 'Array')
        return null;
    let array = false;
    if (receiver.kind === nodeKind_1.default.IDENTIFIER) {
        const definition = emitter.findDefInScope(receiver.text);
        array = !!definition && !definition.bound && definition.as3Type === 'Array';
        if (!definition || definition.bound)
            array = emitter.generated.lexical.own.some(t => !t.static && t.kind === 'variable'
                && t.name === receiver.text && !!t.type && t.type.text === 'Array')
                || emitter.generated.projection.instanceTraits.some(t => t.kind === 'variable' && t.name === receiver.text && t.type === 'Array');
    }
    else if (receiver.kind === nodeKind_1.default.DOT && receiver.children.length === 2
        && receiver.children[0].kind === nodeKind_1.default.IDENTIFIER && receiver.children[0].text === 'this'
        && receiver.children[1].kind === nodeKind_1.default.LITERAL) {
        const name = receiver.children[1].text;
        array = emitter.generated.lexical.own.some(t => !t.static && t.kind === 'variable' && t.name === name && !!t.type && t.type.text === 'Array')
            || emitter.generated.projection.instanceTraits.some(t => t.kind === 'variable' && t.name === name && t.type === 'Array');
    }
    return array ? { receiver: node.children[0], key, literalKey: key.text } : null;
}
function emitGeneratedArraySortRead(emitter, node) {
    const access = generatedArraySortAccess(emitter, node);
    if (!access)
        return false;
    const outer = node_1.outerEncapsulatedExpression(node), parent = outer && outer.parent;
    if (parent && (parent.children[0] === outer && [nodeKind_1.default.ASSIGN, nodeKind_1.default.NEW].indexOf(parent.kind) >= 0
        || [nodeKind_1.default.DELETE, nodeKind_1.default.PRE_INC, nodeKind_1.default.PRE_DEC, nodeKind_1.default.POST_INC, nodeKind_1.default.POST_DEC].indexOf(parent.kind) >= 0))
        throw new Error('AS3_ARRAY_SORT_UNSUPPORTED: generated Array method mutation/construction held');
    const helper = propertyHelper(emitter, 'as3GetProperty', emitter.generated.propertyModule);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitPropertyKey(emitter, access);
    emitter.insert('))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitGeneratedArraySortCall(emitter, node) {
    const callee = node.children[0], args = node.findChild(nodeKind_1.default.ARGUMENTS);
    let access = generatedArraySortAccess(emitter, callee);
    if (!access && callee && callee.kind === nodeKind_1.default.DOT && callee.children.length === 2
        && callee.children[1].kind === nodeKind_1.default.LITERAL && ['call', 'apply'].indexOf(callee.children[1].text) >= 0
        && generatedArraySortAccess(emitter, node_1.unwrapEncapsulatedExpression(callee.children[0])))
        access = { receiver: callee.children[0], key: callee.children[1], literalKey: callee.children[1].text };
    if (!access || !args)
        return false;
    if (emitter.isNew)
        throw new Error('AS3_ARRAY_SORT_UNSUPPORTED: Array method construction held');
    const helper = propertyHelper(emitter, 'as3CallNamedProperty', emitter.generated.propertyModule);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitPropertyKey(emitter, access);
    emitter.insert(',()=>[');
    args.children.forEach((arg, index) => { if (index)
        emitter.insert(','); emitter.skipTo(getExpressionStart(arg)); visitNode(emitter, arg); emitter.catchup(getEffectiveNodeEnd(arg)); });
    emitter.insert(']))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitArraySortOn(emitter, node) {
    const module = emitter.options.nativeArraySortModule;
    if (module === undefined || !node || node.kind !== nodeKind_1.default.CALL || node.children.length < 2)
        return false;
    const callee = node.children[0], args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!callee || callee.kind !== nodeKind_1.default.DOT || callee.children.length !== 2 || !args)
        return false;
    const receiver = callee.children[0], name = callee.children[1];
    if (!receiver || receiver.kind !== nodeKind_1.default.IDENTIFIER || !name || name.kind !== nodeKind_1.default.LITERAL
        || name.text !== 'sortOn')
        return false;
    const definition = emitter.findDefInScope(receiver.text);
    if (!definition || definition.as3Type !== 'Array')
        return false;
    let helper = '__as3_as3ArraySortOn';
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    emitter.ensureImportIdentifier('as3ArraySortOn as ' + helper, module, false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);
    emitter.insert(helper + '(');
    visitNode(emitter, receiver);
    emitter.catchup(receiver.end);
    if (args.children.length) {
        emitter.insert(', ');
        emitter.skipTo(args.children[0].start);
        visitNodes(emitter, args.children);
        const close = args.end > args.start && emitter.source.charAt(args.end - 1) === ')' ? args.end - 1 : args.end;
        emitter.catchup(close);
    }
    emitter.insert(')');
    emitter.skipTo(node.end);
    return true;
}
function emitTweenMigrationCall(emitter, node) {
    const module = emitter.options.nativeTweenModule;
    if (module === undefined || !node || node.kind !== nodeKind_1.default.CALL || node.children.length < 2)
        return false;
    const callee = node.children[0], args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!callee || callee.kind !== nodeKind_1.default.DOT || callee.children.length !== 2 || !args)
        return false;
    const receiver = callee.children[0], name = callee.children[1];
    if (!receiver || receiver.kind !== nodeKind_1.default.IDENTIFIER || (receiver.text !== 'TweenMax' && receiver.text !== 'TweenLite')
        || !name || name.kind !== nodeKind_1.default.LITERAL)
        return false;
    const query = receiver.text === 'TweenMax' && name.text === 'getTweensOf';
    const control = receiver.text === 'TweenMax' && (name.text === 'killTweensOf' || name.text === 'isTweening');
    const delayedCall = receiver.text === 'TweenMax' && name.text === 'delayedCall';
    if (name.text !== 'to' && !query && !control && !delayedCall)
        return false;
    const binding = emitter.findDefInScope(receiver.text);
    const sourcePlan = emitter.tweenPlans.get(node);
    if (sourcePlan && (!binding || binding.bound || Object.prototype.hasOwnProperty.call(binding, 'as3Type')
        || binding.sourceImport !== 'com.greensock.TweenMax' || emitter.isNew))
        throw new Error('AS3_TWEEN_UNSUPPORTED: planned call requires exact imported TweenMax ownership');
    if (binding && (binding.bound || Object.prototype.hasOwnProperty.call(binding, 'as3Type')
        || binding.sourceImport !== 'com.greensock.' + receiver.text))
        return false;
    // Query authority comes from the exact legacy import. Unlike the older to()
    // migration, an unbound namesake is not sufficient. The optional legacy
    // onlyActive overload has no corresponding runtime contract.
    if ((query || control || delayedCall) && !binding)
        return false;
    if ((query || control || delayedCall) && emitter.isNew)
        throw new Error('AS3_TWEEN_UNSUPPORTED: tween query construction is not qualified');
    if ((query || control) && args.children.length !== 1)
        throw new Error('AS3_TWEEN_UNSUPPORTED: ' + name.text + ' requires exactly one target argument');
    // AIR-qualified seconds-based calls retain the optional callback Array by reference.
    // The frame overload still requires its own source evidence.
    if (delayedCall && args.children.length !== 2 && args.children.length !== 3)
        throw new Error('AS3_TWEEN_UNSUPPORTED: delayedCall requires two or three arguments');
    if (name.text === 'to' && args.children.length === 3 && native_tween_plans_1.tweenOptionNames(args.children[2]).indexOf('bezier') >= 0 && !sourcePlan)
        throw new Error('AS3_TWEEN_UNSUPPORTED: Bezier call requires authenticated source plan');
    let helper = '__as3_FlashTweenRuntime';
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    emitter.ensureImportIdentifier('FlashTweenRuntime as ' + helper, module, false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);
    const method = receiver.text === 'TweenLite' && name.text === 'to' ? 'toLite' : name.text;
    emitter.insert(helper + '.current().' + method + '(');
    if (args.children.length) {
        emitter.skipTo(args.children[0].start);
        if (sourcePlan) {
            args.children.forEach((arg, index) => {
                if (index === 2) {
                    emitter.catchup(arg.start);
                    emitter.insert('(function(__vars:any){__vars.sourcePlan=' + JSON.stringify({ kind: 'TweenMax', initialization: sourcePlan }) + ';return __vars;})(');
                }
                visitNode(emitter, arg);
                emitter.catchup(arg.end);
                if (index === 2)
                    emitter.insert(')');
            });
        }
        else
            visitNodes(emitter, args.children);
        const close = args.end > args.start && emitter.source.charAt(args.end - 1) === ')' ? args.end - 1 : args.end;
        emitter.catchup(close);
    }
    else {
        emitter.skipTo(args.end);
    }
    emitter.insert(')');
    emitter.skipTo(node.end);
    return true;
}
function emitDirectToString(emitter, node) {
    const module = emitter.options.nativeDirectToStringModule;
    if (module === undefined || !node || node.kind !== nodeKind_1.default.CALL || node.children.length < 2)
        return false;
    const callee = node.children[0], args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!callee || callee.kind !== nodeKind_1.default.DOT || !args || args.children.length
        || callee.children.length !== 2)
        return false;
    const receiver = callee.children[0], name = callee.children[1];
    if (!receiver || !name || name.kind !== nodeKind_1.default.LITERAL || name.text !== 'toString')
        return false;
    let helper = '__as3_as3InvokeToString';
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    emitter.ensureImportIdentifier('as3InvokeToString as ' + helper, module, false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);
    // The common provider retains a raw source result. Its unknown boundary must
    // not leak into generated AS3 calls as a TypeScript-only argument rejection.
    emitter.insert('(<any>' + helper + '(');
    visitNode(emitter, receiver);
    emitter.catchup(receiver.end);
    emitter.insert('))');
    emitter.skipTo(node.end);
    return true;
}
/** Explicit source int conversion must truncate and wrap, not call host Number. */
function emitBuiltinIntCoercion(emitter, node) {
    const module = emitter.options.nativeCallableCoercionModule;
    if (module === undefined || !emitter.generated || !node || node.kind !== nodeKind_1.default.CALL)
        return false;
    const callee = node.children[0], args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!callee || callee.kind !== nodeKind_1.default.IDENTIFIER || native_typeof_1.sourceIdentifier(callee, emitter.source) !== 'int'
        || native_typeof_1.typeOfBinding(callee, emitter.source, Object.keys(emitter.options.nativeClassInitialization.classes)) !== 'builtin'
        || emitter.findDefInScope('int') || !args)
        return false;
    if (args.children.length !== 1)
        throw new Error('AS3_NUMERIC_CALL_UNSUPPORTED: int requires exactly one source argument');
    let helper = '__as3_int';
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    emitter.ensureImportIdentifier('as3CoerceInt as ' + helper, module, false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);
    emitter.insert(helper + '(');
    emitter.skipTo(args.children[0].start);
    visitNode(emitter, args.children[0]);
    emitter.catchup(args.children[0].end);
    emitter.insert(')');
    emitter.skipTo(node.end);
    return true;
}
/** A source Boolean call is a runtime conversion, never a TS type assertion. */
function emitBuiltinBooleanCoercion(emitter, node) {
    if (!emitter.generated || emitter.isNew || !node || node.kind !== nodeKind_1.default.CALL)
        return false;
    const callee = node.children[0], args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!callee || callee.kind !== nodeKind_1.default.IDENTIFIER || native_typeof_1.sourceIdentifier(callee, emitter.source) !== 'Boolean'
        || native_typeof_1.typeOfBinding(callee, emitter.source, Object.keys(emitter.options.nativeClassInitialization.classes)) !== 'builtin'
        || emitter.findDefInScope('Boolean') || !args)
        return false;
    if (args.children.length !== 1)
        throw new Error('AS3_BOOLEAN_CALL_UNSUPPORTED: Boolean requires exactly one source argument');
    const module = native_generated_emission_1.generatedModule(emitter.options.nativeObjectCreationModule);
    let helper = '__as3_booleanCall';
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    emitter.ensureImportIdentifier('as3CallClass as ' + helper, module, false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);
    emitter.insert(helper + '(Boolean,[');
    emitter.skipTo(args.children[0].start);
    visitNode(emitter, args.children[0]);
    emitter.catchup(args.children[0].end);
    emitter.insert('])');
    emitter.skipTo(node.end);
    return true;
}
function emitBuiltinStringCoercion(emitter, node) {
    const module = emitter.options.nativeStringCoercionModule;
    if (module === undefined || !node || node.kind !== nodeKind_1.default.CALL || node.children.length < 2)
        return false;
    const callee = node.children[0], args = node.findChild(nodeKind_1.default.ARGUMENTS);
    if (!callee || callee.kind !== nodeKind_1.default.IDENTIFIER || callee.text !== 'String'
        || emitter.findDefInScope('String') || !args)
        return false;
    if (args.children.length !== 1)
        throw new Error('AS3_STRING_COERCION_UNSUPPORTED: builtin String requires exactly one source argument');
    let helper = '__as3_as3String';
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    emitter.ensureImportIdentifier('as3String as ' + helper, module, false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);
    emitter.insert(helper + '(');
    emitter.skipTo(args.children[0].start);
    visitNode(emitter, args.children[0]);
    emitter.catchup(args.end - (emitter.source.charAt(args.end - 1) === ')' ? 1 : 0));
    emitter.insert(')');
    emitter.skipTo(node.end);
    return true;
}
function isCast(emitter, node) {
    if (node.children.length == 0) {
        return false;
    }
    const isVector = node.children[0].kind === nodeKind_1.default.VECTOR;
    if (isVector && !emitter.isNew) {
        return true;
    }
    const type = node.findChild(nodeKind_1.default.IDENTIFIER);
    if (!type || !type.text) {
        return false;
    }
    const declaration = emitter.findDefInScope(type.text);
    if (emitter.classInitializers.enabled && emitter.classInitializers.resolve(type, type.text)
        && (!declaration || !declaration.bound && !Object.prototype.hasOwnProperty.call(declaration, 'as3Type'))) {
        emitter.ensureImportIdentifier(type.text);
        return true;
    }
    if (declaration) {
        return false;
    }
    if (emitter.classInitializers.enabled && GLOBAL_NAMES.indexOf(type.text) < 0
        && !emitter.classInitializers.resolve(type, type.text) && /^[A-Z]/.test(type.text))
        throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: unresolved cast class identity: ' + type.text);
    // If the declaration is not found in scope, AND
    // starts with an uppercase, consider it a cast.
    // (this is quite vague, but its a start)
    const firstLetter = type.text.substring(0, 1);
    if (firstLetter === firstLetter.toLowerCase()) {
        return false;
    }
    emitter.ensureImportIdentifier(type.text);
    return true;
}
function emitCatch(emitter, node) {
    const name = node.findChild(nodeKind_1.default.NAME), type = node.findChild(nodeKind_1.default.TYPE);
    if (emitter.references && type && type.text !== '*') {
        const spelling = type.qualifiedName || type.text;
        const identity = emitter.references.resolve(spelling), definition = emitter.findDefInScope(spelling);
        const builtinError = spelling === 'Error' && identity === 'Error' && !definition
            && emitter.references.owner !== 'Error';
        const builtinSecurityError = spelling === 'SecurityError' && identity === 'SecurityError'
            && !definition && emitter.references.owner !== 'SecurityError'
            && !emitter.references.options.plan.nativeBindings.some(binding => binding.qname === 'SecurityError')
            && !emitter.references.options.plan.bindings.some(binding => binding.qname === 'SecurityError');
        const ioError = identity === 'flash.errors.IOError'
            && emitter.references.owner !== identity
            && (!definition || definition.sourceImport === identity && !definition.bound
                && !Object.prototype.hasOwnProperty.call(definition, 'as3Type'))
            && emitter.references.options.plan.nativeBindings.some(binding => binding.qname === identity)
            && emitter.references.options.plan.references.some(reference => reference.owner === emitter.references.owner
                && reference.start === type.start && reference.end === type.end
                && reference.kind === 'native' && reference.identity === identity);
        if ((!builtinError && !builtinSecurityError && !ioError)
            || node.previousSibling && node.previousSibling.kind === nodeKind_1.default.CATCH
            || node.nextSibling && node.nextSibling.kind === nodeKind_1.default.CATCH)
            throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: only a single builtin Error/SecurityError or bound native IOError catch is qualified');
        native_generated_emission_1.generatedModule(emitter.options.nativeSourceErrorModule);
        let helper = '__as3_reference_catch' + (ioError ? 'IOError' : builtinSecurityError ? 'SecurityError' : 'Error');
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier((ioError ? 'as3IsSourceIOErrorInstance' : builtinSecurityError ? 'as3IsSourceSecurityErrorInstance' : 'as3IsSourceErrorInstance') + ' as ' + helper, emitter.options.nativeSourceErrorModule, false);
        const scope = emitter.enterScope([{ name: name.text, as3Type: '*' }]);
        emitter.catchup(name.end);
        emitter.skipTo(type.end);
        const body = node.findChild(nodeKind_1.default.BLOCK);
        emitter.catchup(body.start + 1);
        emitter.insert('if (!' + helper + '(' + name.text + ')) throw ' + name.text + ';');
        visitNode(emitter, body);
        emitter.catchup(body.end);
        emitter.exitScope(scope);
        return;
    }
    if (emitter.options.nativeCallableClasses) {
        if (type && type.text !== '*')
            throw new Error('AS3_CALLABLE_CLASS_UNSUPPORTED: typed catch requires AS3 exception dispatch');
        if (node.previousSibling && node.previousSibling.kind === nodeKind_1.default.CATCH
            || node.nextSibling && node.nextSibling.kind === nodeKind_1.default.CATCH)
            throw new Error('AS3_CALLABLE_CLASS_UNSUPPORTED: multiple catch clauses require AS3 exception dispatch');
    }
    const catchScope = (emitter.lexical || emitter.references) && emitter.enterScope([]);
    emitter.declareInScope({ name: name.text, as3Type: '*' });
    emitter.catchup(node.start);
    if (type && type.text === '*') {
        // Preserve AS3 wildcard typing in modern strict TS. Legacy non-generated
        // output keeps its historical unannotated catch for old TS consumers.
        emitter.catchup(name.end);
        emitter.skipTo(type.end);
        if (emitter.generated)
            emitter.insert(': any');
        visitNodes(emitter, node.children.slice(node.children.indexOf(type) + 1));
        if (catchScope)
            emitter.exitScope(catchScope);
        return;
    }
    visitNodes(emitter, node.children);
    if (catchScope)
        emitter.exitScope(catchScope);
}
function emitRelation(emitter, node) {
    if (emitter.generated && emitter.references && node.children.length === 3 && node.children[1].text === 'as'
        && node.lastChild.kind === nodeKind_1.default.IDENTIFIER && node.lastChild.text === 'Array'
        && emitter.references.resolve('Array') === 'Array' && !emitter.references.sourceClass('Array')
        && !emitter.references.sourceInterface('Array')) {
        if (emitter.findDefInScope('Array') || native_typeof_1.typeOfBinding(node.lastChild, emitter.source, []) !== 'builtin'
            || emitter.generated.options.plan.nativeBindings.some(binding => binding.qname === 'Array'))
            throw new Error('AS3_ARRAY_AS_UNSUPPORTED: shadowed Array target requires Class operand authority');
        const helper = propertyHelper(emitter, 'as3As', native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule));
        // AS3 as returns null on a mismatch. A TS assertion erases the test and
        // can turn a following typed assignment into a throwing coercion.
        emitter.catchup(node.start);
        emitter.insert('(<any>' + helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(getEffectiveNodeEnd(node.children[0]));
        emitter.insert(',Array))');
        emitter.skipTo(node.end);
        return;
    }
    if (node.children.length === 3 && ['is', 'as'].indexOf(node.children[1].text) >= 0 && nativeRegExpReference(emitter, node.lastChild)) {
        const token = nativeRegExpReference(emitter, node.lastChild), helper = propertyHelper(emitter, node.children[1].text === 'is' ? 'as3Is' : 'as3As', native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule));
        emitter.catchup(node.start);
        emitter.insert('(' + helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(getEffectiveNodeEnd(node.children[0]));
        emitter.insert(',' + token + '))');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.generated && node.children.length === 3 && node.children[1].text === 'in'
        && emitter.options.nativeObjectPropertyModule && node.lastChild.kind === nodeKind_1.default.IDENTIFIER) {
        const definition = emitter.findDefInScope(node.lastChild.text);
        if (definition && !definition.bound && ['*', 'Object'].indexOf(definition.as3Type) >= 0
            && !(definition.as3Type === 'Object' && emitter.references.sourceClass('Object'))) {
            const helper = propertyHelper(emitter, 'as3HasProperty', emitter.options.nativeObjectPropertyModule);
            emitter.catchup(node.start);
            emitter.insert(helper + '(');
            visitNode(emitter, node.children[0]);
            emitter.catchup(node.children[0].end);
            emitter.insert(',');
            emitter.skipTo(node.lastChild.start);
            visitNode(emitter, node.lastChild);
            emitter.catchup(node.lastChild.end);
            emitter.insert(')');
            emitter.skipTo(node.end);
            return;
        }
    }
    if (emitter.generated && emitter.references && node.children.length === 3 && node.children[1].text === 'is'
        && node.lastChild.kind === nodeKind_1.default.IDENTIFIER && node.lastChild.text === 'TypeError'
        && emitter.references.resolve('TypeError') === 'TypeError' && !emitter.findDefInScope('TypeError')
        && emitter.references.owner !== 'TypeError'
        && !emitter.generated.options.plan.nativeBindings.some(b => b.qname === 'TypeError')
        && !emitter.generated.options.plan.bindings.some(b => b.qname === 'TypeError')) {
        const helper = propertyHelper(emitter, 'as3IsSourceTypeErrorInstance', native_generated_emission_1.generatedModule(emitter.options.nativeSourceErrorModule));
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (native_string_casts_1.intrinsicStringAs(emitter, node)) {
        const helper = propertyHelper(emitter, 'as3As', native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule));
        emitter.catchup(node.start);
        emitter.insert('(<any>' + helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',String))');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.references && node.children.length === 3
        && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && node.lastChild.text === 'Class' && emitter.references.resolve('Class') === 'Class'
        && !emitter.references.sourceClass('Class') && !emitter.references.sourceInterface('Class')) {
        const target = node.lastChild, definition = emitter.findDefInScope('Class');
        if (definition || native_typeof_1.typeOfBinding(target, emitter.source, []) !== 'builtin'
            || emitter.references.options.plan.nativeBindings.some(binding => binding.qname === 'Class'))
            throw new Error('AS3_CLASS_TYPE_OPERATION_UNSUPPORTED: shadowed Class target requires separate authority');
        const module = emitter.options.nativeClassTypeOperationsModule;
        if (module === undefined)
            throw new Error('AS3_CLASS_TYPE_OPERATION_UNSUPPORTED: explicit common Class module required');
        let helper = '__as3_class_as';
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier('as3AsClass as ' + helper, module, false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        emitter.insert('(' + helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(node.children[1].text === 'is' ? ') !== null)' : '))');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.options.nativeRectangleReferenceModule !== undefined && emitter.references && node.children.length === 3
        && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && emitter.references.resolve(node.lastChild.text) === 'flash.geom.Rectangle') {
        const target = node.lastChild, definition = emitter.findDefInScope(target.text);
        if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
            throw new Error('AS3_RECTANGLE_REFERENCE_UNSUPPORTED: shadowed target requires separate Class authority');
        let method = node.parent;
        while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
            method = method.parent;
        if (!method)
            throw new Error('AS3_RECTANGLE_REFERENCE_UNSUPPORTED: class initializer type operation held');
        const operation = node.children[1].text;
        let helper = '__as3_rectangle_' + operation;
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier((operation === 'is' ? 'as3Is' : 'as3As') + ' as ' + helper, native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule), false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',');
        emitter.skipTo(target.start);
        visitNode(emitter, target);
        emitter.catchup(target.end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.options.nativeColorTransformReferenceModule !== undefined && emitter.references && node.children.length === 3
        && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && emitter.references.resolve(node.lastChild.text) === 'flash.geom.ColorTransform') {
        const target = node.lastChild, definition = emitter.findDefInScope(target.text);
        if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
            throw new Error('AS3_COLORTRANSFORM_REFERENCE_UNSUPPORTED: shadowed target requires separate Class authority');
        let method = node.parent;
        while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
            method = method.parent;
        if (!method)
            throw new Error('AS3_COLORTRANSFORM_REFERENCE_UNSUPPORTED: class initializer type operation held');
        const operation = node.children[1].text;
        let helper = '__as3_color_transform_' + operation;
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier((operation === 'is' ? 'as3Is' : 'as3As') + ' as ' + helper, native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule), false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',');
        emitter.skipTo(target.start);
        visitNode(emitter, target);
        emitter.catchup(target.end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.options.nativeDataEventReferenceModule !== undefined && emitter.references && node.children.length === 3
        && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && dataEventName(emitter, node.lastChild.text)) {
        const target = node.lastChild, definition = emitter.findDefInScope(target.text);
        if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
            throw new Error('AS3_DATAEVENT_REFERENCE_UNSUPPORTED: shadowed target requires separate Class authority');
        let method = node.parent;
        while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
            method = method.parent;
        if (!method)
            throw new Error('AS3_DATAEVENT_REFERENCE_UNSUPPORTED: class initializer type operation held');
        const operation = node.children[1].text;
        let helper = '__as3_data_event_' + operation;
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier((operation === 'is' ? 'as3Is' : 'as3As') + ' as ' + helper, native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule), false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',');
        emitter.skipTo(target.start);
        visitNode(emitter, target);
        emitter.catchup(target.end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.options.nativeURLRequestReferenceModule !== undefined && emitter.references && node.children.length === 3
        && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && emitter.references.resolve(node.lastChild.text) === 'flash.net.URLRequest') {
        const target = node.lastChild, definition = emitter.findDefInScope(target.text);
        if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
            throw new Error('AS3_URLREQUEST_REFERENCE_UNSUPPORTED: shadowed target requires separate Class authority');
        let method = node.parent;
        while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
            method = method.parent;
        if (!method)
            throw new Error('AS3_URLREQUEST_REFERENCE_UNSUPPORTED: class initializer type operation held');
        const operation = node.children[1].text;
        let helper = '__as3_url_request_' + operation;
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier((operation === 'is' ? 'as3Is' : 'as3As') + ' as ' + helper, native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule), false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',');
        emitter.skipTo(target.start);
        visitNode(emitter, target);
        emitter.catchup(target.end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.options.nativeErrorEventReferenceModule !== undefined && emitter.references && node.children.length === 3
        && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && emitter.references.resolve(node.lastChild.text) === 'flash.events.ErrorEvent') {
        const target = node.lastChild, definition = emitter.findDefInScope(target.text);
        if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
            throw new Error('AS3_ERROREVENT_REFERENCE_UNSUPPORTED: shadowed target requires separate Class authority');
        let method = node.parent;
        while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
            method = method.parent;
        if (!method)
            throw new Error('AS3_ERROREVENT_REFERENCE_UNSUPPORTED: class initializer type operation held');
        const operation = node.children[1].text;
        let helper = '__as3_error_event_base_' + operation;
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier((operation === 'is' ? 'as3Is' : 'as3As') + ' as ' + helper, native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule), false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',');
        emitter.skipTo(target.start);
        visitNode(emitter, target);
        emitter.catchup(target.end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.options.nativeErrorEventSubtypeReferenceModule !== undefined && emitter.references && node.children.length === 3
        && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && errorEventSubtypeName(emitter, node.lastChild.text)) {
        const target = node.lastChild, definition = emitter.findDefInScope(target.text);
        if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
            throw new Error('AS3_ERROREVENT_SUBTYPE_UNSUPPORTED: shadowed target requires separate Class authority');
        let method = node.parent;
        while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
            method = method.parent;
        if (!method)
            throw new Error('AS3_ERROREVENT_SUBTYPE_UNSUPPORTED: class initializer type operation held');
        const operation = node.children[1].text;
        let helper = '__as3_error_event_' + operation;
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier((operation === 'is' ? 'as3Is' : 'as3As') + ' as ' + helper, native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule), false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',');
        emitter.skipTo(target.start);
        visitNode(emitter, target);
        emitter.catchup(target.end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.options.nativeByteArrayReferenceModule !== undefined && emitter.references && node.children.length === 3
        && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && emitter.references.resolve(node.lastChild.text) === 'flash.utils.ByteArray') {
        const target = node.lastChild, definition = emitter.findDefInScope(target.text);
        if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
            throw new Error('AS3_BYTEARRAY_REFERENCE_UNSUPPORTED: shadowed target requires separate Class authority');
        let method = node.parent;
        while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
            method = method.parent;
        if (!method)
            throw new Error('AS3_BYTEARRAY_REFERENCE_UNSUPPORTED: class initializer type operation held');
        const operation = node.children[1].text;
        let helper = '__as3_bytearray_' + operation;
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier((operation === 'is' ? 'as3Is' : 'as3As') + ' as ' + helper, native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule), false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',');
        emitter.skipTo(target.start);
        visitNode(emitter, target);
        emitter.catchup(target.end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.options.nativeDictionaryReferenceModule !== undefined && emitter.references && node.children.length === 3
        && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && emitter.references.resolve(node.lastChild.text) === 'flash.utils.Dictionary') {
        const target = node.lastChild, definition = emitter.findDefInScope(target.text);
        if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
            throw new Error('AS3_DICTIONARY_REFERENCE_UNSUPPORTED: shadowed target requires separate Class authority');
        let method = node.parent;
        while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
            method = method.parent;
        if (!method)
            throw new Error('AS3_DICTIONARY_REFERENCE_UNSUPPORTED: class initializer type operation held');
        const operation = node.children[1].text;
        let helper = '__as3_dictionary_' + operation;
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier((operation === 'is' ? 'as3Is' : 'as3As') + ' as ' + helper, native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule), false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',');
        emitter.skipTo(target.start);
        visitNode(emitter, target);
        emitter.catchup(target.end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.options.nativeTextJustifierReferenceModule !== undefined && emitter.references && node.children.length === 3
        && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && ['TextJustifier', 'SpaceJustifier', 'EastAsianJustifier'].some(name => emitter.references.resolve(node.lastChild.text) === 'flash.text.engine.' + name)) {
        const target = node.lastChild, definition = emitter.findDefInScope(target.text);
        if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
            throw new Error('AS3_TEXT_JUSTIFIER_REFERENCE_UNSUPPORTED: shadowed target requires separate Class authority');
        let method = node.parent;
        while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
            method = method.parent;
        if (!method)
            throw new Error('AS3_TEXT_JUSTIFIER_REFERENCE_UNSUPPORTED: class initializer type operation held');
        const operation = node.children[1].text;
        let helper = '__as3_justifier_' + operation;
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier((operation === 'is' ? 'as3Is' : 'as3As') + ' as ' + helper, native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule), false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',');
        emitter.skipTo(target.start);
        visitNode(emitter, target);
        emitter.catchup(target.end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.options.nativeContentElementReferenceModule !== undefined && emitter.references && node.children.length === 3
        && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && ['ContentElement', 'TextElement', 'GroupElement', 'GraphicElement'].some(name => emitter.references.resolve(node.lastChild.text) === 'flash.text.engine.' + name)) {
        const target = node.lastChild, definition = emitter.findDefInScope(target.text);
        if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
            throw new Error('AS3_CONTENT_ELEMENT_REFERENCE_UNSUPPORTED: shadowed target requires separate Class authority');
        let method = node.parent;
        while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
            method = method.parent;
        if (!method)
            throw new Error('AS3_CONTENT_ELEMENT_REFERENCE_UNSUPPORTED: class initializer type operation held');
        if (emitter.options.nativeComputedTypeTestModule === undefined)
            throw new Error('AS3_CONTENT_ELEMENT_REFERENCE_UNSUPPORTED: computed type test provider required');
        const operation = node.children[1].text;
        let helper = '__as3_content_' + operation;
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier((operation === 'is' ? 'as3Is' : 'as3As') + ' as ' + helper, native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule), false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',');
        emitter.skipTo(target.start);
        visitNode(emitter, target);
        emitter.catchup(target.end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.options.nativeTextBlockReferenceModule !== undefined && emitter.references && node.children.length === 3
        && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && emitter.references.resolve(node.lastChild.text) === 'flash.text.engine.TextBlock') {
        const target = node.lastChild, definition = emitter.findDefInScope(target.text);
        if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
            throw new Error('AS3_TEXT_BLOCK_REFERENCE_UNSUPPORTED: shadowed target requires separate Class authority');
        let method = node.parent;
        while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
            method = method.parent;
        if (!method)
            throw new Error('AS3_TEXT_BLOCK_REFERENCE_UNSUPPORTED: class initializer type operation held');
        if (emitter.options.nativeComputedTypeTestModule === undefined)
            throw new Error('AS3_TEXT_BLOCK_REFERENCE_UNSUPPORTED: computed type test provider required');
        const operation = node.children[1].text;
        let helper = '__as3_textblock_' + operation;
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier((operation === 'is' ? 'as3Is' : 'as3As') + ' as ' + helper, native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule), false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',');
        emitter.skipTo(target.start);
        visitNode(emitter, target);
        emitter.catchup(target.end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.options.nativeTextLineReferenceModule !== undefined && emitter.references && node.children.length === 3
        && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && emitter.references.resolve(node.lastChild.text) === 'flash.text.engine.TextLine') {
        const target = node.lastChild, definition = emitter.findDefInScope(target.text);
        if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
            throw new Error('AS3_TEXT_LINE_REFERENCE_UNSUPPORTED: shadowed target requires separate Class authority');
        let method = node.parent;
        while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
            method = method.parent;
        if (!method)
            throw new Error('AS3_TEXT_LINE_REFERENCE_UNSUPPORTED: class initializer type operation held');
        if (emitter.options.nativeComputedTypeTestModule === undefined)
            throw new Error('AS3_TEXT_LINE_REFERENCE_UNSUPPORTED: computed type test provider required');
        const operation = node.children[1].text;
        let helper = '__as3_textline_' + operation;
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier((operation === 'is' ? 'as3Is' : 'as3As') + ' as ' + helper, native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule), false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',');
        emitter.skipTo(target.start);
        visitNode(emitter, target);
        emitter.catchup(target.end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.options.nativeMouseEventReferenceModule !== undefined && emitter.references && node.children.length === 3
        && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && emitter.references.resolve(node.lastChild.text) === 'flash.events.MouseEvent') {
        const target = node.lastChild, definition = emitter.findDefInScope(target.text);
        if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
            throw new Error('AS3_MOUSE_EVENT_REFERENCE_UNSUPPORTED: shadowed target requires separate Class authority');
        let method = node.parent;
        while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
            method = method.parent;
        if (!method)
            throw new Error('AS3_MOUSE_EVENT_REFERENCE_UNSUPPORTED: class initializer type operation held');
        if (emitter.options.nativeComputedTypeTestModule === undefined)
            throw new Error('AS3_MOUSE_EVENT_REFERENCE_UNSUPPORTED: computed type test provider required');
        const operation = node.children[1].text;
        let helper = '__as3_mouseevent_' + operation;
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier((operation === 'is' ? 'as3Is' : 'as3As') + ' as ' + helper, native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule), false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',');
        emitter.skipTo(target.start);
        visitNode(emitter, target);
        emitter.catchup(target.end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.references && node.children.length === 3
        && ['is', 'as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && ((emitter.options.nativeDisplayObjectReferenceModule !== undefined && ['flash.display.DisplayObject', 'flash.display.Sprite'].indexOf(emitter.references.resolve(node.lastChild.text)) >= 0)
            || (emitter.options.nativeMovieClipReferenceModule !== undefined && emitter.references.resolve(node.lastChild.text) === 'flash.display.MovieClip')
            || (emitter.options.nativeTextFormatReferenceModule !== undefined && emitter.references.resolve(node.lastChild.text) === 'flash.text.TextFormat')
            || (emitter.options.nativeTextFieldReferenceModule !== undefined && emitter.references.resolve(node.lastChild.text) === 'flash.text.TextField')
            || (emitter.options.nativeAccessibilityReferenceModule !== undefined && emitter.references.resolve(node.lastChild.text) === 'flash.accessibility.AccessibilityImplementation')
            || (emitter.options.nativeSpriteValueReferenceModule !== undefined && native_reference_coercion_1.nativeSpriteValueReferenceNames.indexOf(emitter.references.resolve(node.lastChild.text)) >= 0)
            || (emitter.options.nativeLoaderReferenceModule !== undefined && native_reference_coercion_1.nativeLoaderReferenceNames.indexOf(emitter.references.resolve(node.lastChild.text)) >= 0)
            || (emitter.options.nativeSpriteOwnerReferenceModule !== undefined && native_reference_coercion_1.nativeSpriteOwnerReferenceNames.indexOf(emitter.references.resolve(node.lastChild.text)) >= 0)
            || (emitter.options.nativeInteractiveObjectReferenceModule !== undefined && emitter.references.resolve(node.lastChild.text) === 'flash.display.InteractiveObject')
            || (emitter.options.nativeDisplayObjectContainerReferenceModule !== undefined && emitter.references.resolve(node.lastChild.text) === 'flash.display.DisplayObjectContainer'))) {
        const target = node.lastChild, definition = emitter.findDefInScope(target.text);
        if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
            throw new Error('AS3_DISPLAY_REFERENCE_UNSUPPORTED: shadowed target requires separate Class authority');
        let method = node.parent;
        while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
            method = method.parent;
        if (!method)
            throw new Error('AS3_DISPLAY_REFERENCE_UNSUPPORTED: class initializer type operation held');
        const operation = node.children[1].text;
        let helper = '__as3_display_' + operation;
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier((operation === 'is' ? 'as3Is' : 'as3As') + ' as ' + helper, native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule), false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',');
        emitter.skipTo(target.start);
        visitNode(emitter, target);
        emitter.catchup(target.end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.options.nativeDictionaryPropertyModule !== undefined && node.children.length === 3
        && node.children[1].text === 'in' && isDictionaryReceiver(emitter, node.lastChild)) {
        const helper = dictionaryHelper(emitter, 'as3HasProperty');
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',');
        emitter.skipTo(node.lastChild.start);
        visitNode(emitter, node.lastChild);
        emitter.catchup(node.lastChild.end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    const interfaceAs = emitter.references && node.children.length === 3
        && (node.children[1].kind === nodeKind_1.default.AS || node.children[1].text === 'is') && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && emitter.references.sourceInterface(node.lastChild.text);
    const sourceIs = emitter.generated && emitter.references && node.children.length === 3
        && node.children[1].text === 'is' && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && (emitter.references.sourceClass(node.lastChild.text) || !!emitter.references.nativeInterface(node.lastChild.text));
    if (interfaceAs || emitter.generated && node.children.length === 3 && (node.children[1].kind === nodeKind_1.default.AS || sourceIs)
        && node.lastChild.kind === nodeKind_1.default.IDENTIFIER
        && (interfaceAs || emitter.classInitializers.resolve(node, node.lastChild.text) === 'lazy'
            || node.lastChild.text === emitter.currentClassName)) {
        const target = node.lastChild, definition = emitter.findDefInScope(target.text);
        const operation = node.children[1].text === 'is' ? 'is' : 'as';
        if (definition && (definition.bound || Object.prototype.hasOwnProperty.call(definition, 'as3Type')))
            throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: shadowed source ' + operation + ' target requires Class operand authority');
        let method = node.parent;
        while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
            method = method.parent;
        if (!method)
            throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: source ' + operation + ' during class initialization requires separate authority');
        const module = native_generated_emission_1.generatedModule(emitter.options.nativeComputedTypeTestModule);
        let helper = '__as3_source_' + operation;
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier((operation === 'is' ? 'as3Is' : 'as3As') + ' as ' + helper, module, false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);
        emitter.insert(helper + '(');
        visitNode(emitter, node.children[0]);
        emitter.catchup(node.children[0].end);
        emitter.insert(',');
        emitter.skipTo(target.start);
        if (interfaceAs) {
            // An interface token has no implementing-class initializer. Keep
            // operand evaluation in place and use the authenticated domain token.
            let token = '__as3_interface_as_' + interfaceAs;
            while (emitter.source.indexOf(token) >= 0)
                token += '_';
            emitter.ensureImportIdentifier(interfaceAs + ' as ' + token, emitter.references.options.module, false);
            emitter.nativeSourceHelpers.add(token);
            emitter.insert(token);
            emitter.skipTo(target.end);
        }
        else
            visitNode(emitter, target);
        emitter.catchup(target.end);
        emitter.insert(')');
        emitter.skipTo(node.end);
        return;
    }
    if (containsIsKeyword(node) && node.children.length === 3) {
        const target = node.lastChild, global = emitter.nativeGlobals.resolve(target);
        const targetBinding = target.kind === nodeKind_1.default.IDENTIFIER && emitter.findDefInScope(target.text);
        const nativeEvent = emitter.generated && emitter.generated.nativeBase && emitter.generated.nativeBase.qname === 'flash.events.Event' && targetBinding
            && targetBinding.sourceImport === 'flash.events.Event';
        const nativeArray = emitter.generated && target.kind === nodeKind_1.default.IDENTIFIER && target.text === 'Array'
            && !targetBinding && emitter.generated.projection.binding.identity.split('.').pop() !== 'Array';
        if (global && (global.name === 'AS3Date' || emitter.options.nativeXMLModule && ['XML', 'XMLList'].indexOf(global.name) >= 0) || nativeEvent || nativeArray) {
            const module = emitter.options.nativeComputedTypeTestModule;
            native_generated_emission_1.generatedModule(module);
            let helper = nativeArray ? '__as3_array_is' : nativeEvent ? '__as3_event_is' : global.name === 'AS3Date' ? '__as3_date_is' : '__as3_xml_is';
            while (emitter.source.indexOf(helper) >= 0)
                helper += '_';
            emitter.ensureImportIdentifier('as3Is as ' + helper, module, false);
            emitter.catchup(node.start);
            emitter.insert(helper + '(');
            visitNode(emitter, node.children[0]);
            emitter.catchup(node.children[0].end);
            emitter.insert(',');
            emitter.skipTo(target.start);
            visitNode(emitter, target);
            emitter.catchup(target.end);
            emitter.insert(')');
            emitter.skipTo(node.end);
            return;
        }
    }
    if (emitComputedTypeTest(emitter, node))
        return;
    if (emitter.options.nativeRelationalModule !== undefined) {
        const symbolic = ['<', '<=', '>', '>='];
        const aliases = ['lt', 'le', 'gt', 'ge'];
        const operators = node.children.filter((_, index) => index % 2 === 1);
        if (operators.some(operator => operator && symbolic.concat(aliases).indexOf(operator.text) >= 0)) {
            if (node.children.length < 3 || node.children.length % 2 !== 1
                || node.children.some(child => !child)
                || operators.some(operator => operator.kind !== nodeKind_1.default.OP || symbolic.indexOf(operator.text) < 0))
                throw new Error('AS3_RELATIONAL_COMPILER_UNSUPPORTED: mixed relation operators and AS2 aliases held');
            const exports = ['as3LessThan', 'as3LessThanOrEqual', 'as3GreaterThan', 'as3GreaterThanOrEqual'];
            const helper = (operator) => {
                const exported = exports[symbolic.indexOf(operator)];
                let local = '__as3_source_' + exported;
                while (emitter.source.indexOf(local) >= 0)
                    local += '_';
                emitter.ensureImportIdentifier(exported + ' as ' + local, emitter.options.nativeRelationalModule, false);
                emitter.nativeSourceHelpers.add(local);
                return local;
            };
            emitter.catchup(node.start);
            // Fold only original source comparisons. Both expressions evaluate
            // left-to-right; the common helper owns primitive conversion order.
            const through = (index) => {
                if (index === 0) {
                    visitNode(emitter, node.children[0]);
                    emitter.catchup(getEffectiveNodeEnd(node.children[0]));
                    return;
                }
                const operator = node.children[index - 1], right = node.children[index];
                emitter.insert('(' + helper(operator.text) + '(');
                through(index - 2);
                emitter.catchup(operator.start);
                emitter.insert(',');
                emitter.skipTo(operator.end);
                emitter.catchup(getExpressionStart(right));
                visitNode(emitter, right);
                emitter.catchup(getEffectiveNodeEnd(right));
                emitter.insert('))');
            };
            through(node.children.length - 1);
            emitter.skipTo(getEffectiveNodeEnd(node));
            return;
        }
    }
    emitter.catchup(node.start);
    const sourceOperand = emitter.source.slice(node.lastChild.start, node.lastChild.end).trim();
    const relationType = sourceOperand === 'int' || sourceOperand === 'uint' ? sourceOperand : node.lastChild.text;
    // Check for 'as' in relation.
    let as = node.findChild(nodeKind_1.default.AS);
    if (as) {
        const global = emitter.nativeGlobals.resolve(node.lastChild);
        if (global && global.name === 'AS3Date')
            throw new Error('AS3_GLOBAL_MODULE_UNSUPPORTED: Date as conversion requires native lowering');
        if (emitter.options.nativeCallableMetadata) {
            let helper = node.lastChild.text === 'Class' ? '__as3_source_asClass' : '__as3_source_asType';
            while (emitter.source.indexOf(helper) >= 0)
                helper += '_';
            emitter.ensureImportIdentifier((node.lastChild.text === 'Class' ? 'as3AsClass' : 'as3As') + ' as ' + helper, emitter.options.nativeCallableMetadata.module, false);
            emitter.nativeSourceHelpers.add(helper);
            emitter.insert(helper + '(');
            visitNodes(emitter, node.getChildUntil(nodeKind_1.default.AS));
            emitter.catchup(as.start);
            if (node.lastChild.text !== 'Class') {
                emitter.insert(',');
                emitter.skipTo(node.lastChild.start);
                if (relationType === 'int' || relationType === 'uint') {
                    let operand = helper + '_operand_' + relationType;
                    while (emitter.source.indexOf(operand) >= 0)
                        operand += '_';
                    emitter.ensureImportIdentifier((relationType === 'int' ? 'AS3Int' : 'AS3Uint') + ' as ' + operand, emitter.options.nativeCallableMetadata.module, false);
                    emitter.insert(operand);
                }
                else
                    visitNode(emitter, node.lastChild);
            }
            emitter.insert(')');
            emitter.skipTo(node.end);
            return;
        }
        if (emitter.classInitializers.resolve(node, node.lastChild.text) === 'lazy')
            throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: lazy-class as coercion requires separate type authority');
        // TODO: implement relation with type cast to vectors
        //       e.g. (myVector as Vector.<Boolean>)
        if (node.lastChild.kind === nodeKind_1.default.IDENTIFIER) {
            emitter.insert('(<');
            let typeText = emitter.getTypeRemap(node.lastChild.text) || node.lastChild.text;
            emitter.insert(typeText);
            emitter.ensureImportIdentifier(typeText);
            emitter.insert('>');
            visitNodes(emitter, node.getChildUntil(nodeKind_1.default.AS));
            emitter.catchup(as.start);
            emitter.insert(')');
            emitter.skipTo(node.end);
        }
        else if (node.lastChild.kind === nodeKind_1.default.VECTOR) {
            visitNodes(emitter, node.children);
        }
        else {
            emitter.commentNode(node, false);
        }
        return;
    }
    // Check for 'is' in relation.
    let is = containsIsKeyword(node);
    if (is) {
        if (emitter.options.nativeCallableMetadata) {
            let helper = node.lastChild.text === 'Class' ? '__as3_source_isClass' : '__as3_source_isType';
            while (emitter.source.indexOf(helper) >= 0)
                helper += '_';
            const classTest = node.lastChild.text === 'Class';
            emitter.ensureImportIdentifier((classTest ? 'as3AsClass' : 'as3Is') + ' as ' + helper, emitter.options.nativeCallableMetadata.module, false);
            emitter.nativeSourceHelpers.add(helper);
            emitter.insert(helper + '(');
            visitNode(emitter, node.children[0]);
            emitter.catchup(node.children[0].end);
            if (!classTest) {
                emitter.insert(',');
                emitter.skipTo(node.lastChild.start);
                if (relationType === 'int' || relationType === 'uint') {
                    let operand = helper + '_operand_' + relationType;
                    while (emitter.source.indexOf(operand) >= 0)
                        operand += '_';
                    emitter.ensureImportIdentifier((relationType === 'int' ? 'AS3Int' : 'AS3Uint') + ' as ' + operand, emitter.options.nativeCallableMetadata.module, false);
                    emitter.insert(operand);
                }
                else
                    visitNode(emitter, node.lastChild);
            }
            emitter.insert(classTest ? ') !== null' : ')');
            emitter.skipTo(node.end);
            return;
        }
        // Determine if the check is against a primitive or a custom type.
        // console.log(node.toString());
        var isPrimitiveCheck = containsPrimitiveIdentifier(node);
        var isClassCheck = containsClassIdentifier(node);
        if (isPrimitiveCheck || isClassCheck) {
            // Identify players.
            var varNode = node.children[0];
            var isNode = node.children[1];
            var typeNode = node.children[2];
            // Insert 'typeof' before instance name.
            emitter.catchup(node.start);
            emitter.insert('typeof ');
            // Emit variable name.
            visitNode(emitter, varNode);
            // 80pro hotfix for missing "]"
            if (varNode.kind == nodeKind_1.default.ARRAY_ACCESSOR) {
                emitter.insert('] ');
            }
            emitter.skipTo(varNode.end);
            // Emit equality check.
            emitter.insert(' === ');
            //emitter.insert(' instanceof ');
            // Replace type with string comparison.
            let typeRemapped = emitter.getTypeRemap(typeNode.text) || typeNode.text;
            //if (typeRemapped == "number") typeRemapped = "Number";
            //if (typeRemapped == "string") typeRemapped = "String";
            if (isClassCheck)
                typeRemapped = "function";
            emitter.insert(`'${typeRemapped}'`);
            if (isClassCheck == false)
                emitter.ensureImportIdentifier(typeRemapped);
            // Skip the rest... 'is Number/String/Boolean'
            emitter.skipTo(node.end);
            return;
        }
        else {
            /*			// TODO: custom type interface checks are currently not checked by the compiler
                        if (WARNINGS >= 1) {
                            console.log("emitter.ts: *** WARNING *** custom type interface checks are currently not treated by the compiler.");
                        }*/
            let children = node.children;
            let leftIdent = children[0];
            let castedStr;
            let castedComplexNode;
            let arrayAccessorNode;
            if (leftIdent.kind == nodeKind_1.default.IDENTIFIER) {
                castedStr = leftIdent.text;
            }
            else {
                castedComplexNode = leftIdent;
            }
            let middleNode = children[1];
            let rightIdent = children[2];
            //visitNode(emitter, leftIdent);
            //visitNode(emitter, middleNode);
            let isInterface = classlist_1.default.checkIsInterface(rightIdent.text);
            if (isInterface) {
                emitter.insert(`${config_1.AS3_UTIL}.${config_1.INTERFACE_METHOD}(`);
                if (castedStr) {
                    emitter.insert(castedStr);
                }
                else if (castedComplexNode) {
                    visitNode(emitter, castedComplexNode);
                    emitter.catchup(castedComplexNode.end);
                }
                emitter.insert(`, "${rightIdent.text}")`);
                if ((config_1.VERBOSE_MASK & 32768 /* EXT_AST_SHOW_CASTING_INTERFACE */) == 32768 /* EXT_AST_SHOW_CASTING_INTERFACE */) {
                    console.log(">>>Class: " + classlist_1.default.currentClassRecord.getFullPath() + "; ident: " + castedStr + " casts " + isInterface.getFullPath());
                }
            }
            else {
                /*				if (castedStr){
                                    emitter.insert(castedStr);
                                }else if (castedComplexNode){
                
                                    visitNode(emitter, castedComplexNode);
                                    emitter.catchup(castedComplexNode.end);
                                }*/
                if (rightIdent.text === 'Class') {
                }
                else {
                }
                visitNode(emitter, leftIdent);
                emitter.catchup(leftIdent.end);
                emitter.insert(' instanceof ');
                if (emitter.classInitializers.enabled) {
                    emitter.skipTo(rightIdent.start);
                    visitNode(emitter, rightIdent);
                }
                else
                    emitter.insert(rightIdent.text);
            }
            emitter.skipTo(node.end);
            if (isInterface) {
                let pathToRoot = classlist_1.default.getLastPathToRoot();
                emitter.ensureImportIdentifier(config_1.AS3_UTIL, `${pathToRoot}${config_1.AS3_UTIL}`);
            }
            return;
        }
    }
    visitNodes(emitter, node.children);
}
function emitComputedTypeTest(emitter, node) {
    const module = emitter.options.nativeComputedTypeTestModule;
    if (module === undefined || !node || !containsIsKeyword(node) || node.children.length !== 3)
        return false;
    const left = node.children[0], operator = node.children[1], target = node.children[2];
    if (!left || !operator || operator.kind !== nodeKind_1.default.OP || operator.text !== 'is'
        || !target || target.kind === nodeKind_1.default.IDENTIFIER)
        return false;
    let helper = '__as3_source_is';
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    emitter.ensureImportIdentifier('as3Is as ' + helper, module, false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);
    emitter.insert(helper + '(');
    visitNode(emitter, left);
    emitter.catchup(left.end);
    emitter.insert(',');
    emitter.skipTo(target.start);
    visitNode(emitter, target);
    emitter.catchup(target.end);
    emitter.insert(')');
    emitter.skipTo(node.end);
    return true;
}
function containsIsKeyword(node) {
    for (var i = 0; i < node.children.length; i++) {
        var child = node.children[i];
        if (child.text == 'is') {
            return true;
        }
    }
    return false;
    ;
}
function containsPrimitiveIdentifier(node) {
    for (var i = 0; i < node.children.length; i++) {
        var child = node.children[i];
        if (child.kind == nodeKind_1.default.IDENTIFIER) {
            if (child.text === 'Number' || child.text === 'String' || child.text === 'Boolean') {
                return true;
            }
        }
    }
    return false;
}
function containsClassIdentifier(node) {
    for (var i = 0; i < node.children.length; i++) {
        var child = node.children[i];
        if (child.kind == nodeKind_1.default.IDENTIFIER) {
            if (child.text === 'Class') {
                return true;
            }
        }
    }
    return false;
}
function isIntegerAS3Type(type) {
    return type === 'int' || type === 'uint';
}
function findBoundDeclaration(emitter, name, bound) {
    let scope = emitter.scope;
    while (scope) {
        for (let i = 0; i < scope.declarations.length; i++) {
            let declaration = scope.declarations[i];
            if (declaration.name === name && declaration.bound === bound) {
                return declaration;
            }
        }
        scope = scope.parent;
    }
    return null;
}
/**
 * Resolve only targets whose declaration and receiver are statically known.
 * Arbitrary member/index receivers are deliberately excluded because repeating
 * them for compound assignment could change evaluation order or side effects.
 */
function getTypedAssignmentTarget(emitter, node) {
    if (emitter.typedLocalPlan && emitter.typedLocalPlan.owns(node, emitter))
        return null;
    node = node_1.unwrapEncapsulatedExpression(node);
    let declaration = null;
    let repeatText = null;
    if (node.kind === nodeKind_1.default.NAMESPACE_ACCESS) {
        const access = emitter.namespaces.access(node);
        const receiver = access.receiver && emitter.findDefInScope(access.receiver.text);
        const member = emitter.namespaces.accessMember(node, receiver && receiver.type);
        if (member && member.declaration.kind === nodeKind_1.default.VAR_LIST) {
            const field = member.declaration.findChild(nodeKind_1.default.NAME_TYPE_INIT);
            declaration = { name: member.name, as3Type: getAS3DeclarationType(field) };
            const receiverText = access.receiver && access.receiver.text === 'super' ? 'this' : access.receiver
                ? (receiver && receiver.bound ? receiver.bound + '.' : '') + access.receiver.text
                : member.static ? member.owner.findChild(nodeKind_1.default.NAME).text : 'this';
            repeatText = receiverText
                + '[' + emitter.namespaces.key(member.uri, member.name) + ']';
        }
    }
    else if (node.kind === nodeKind_1.default.IDENTIFIER) {
        const opened = emitter.namespaces.openedIdentifier(node, hasFunctionLocal(emitter, node.text));
        if (opened) {
            if (opened.declaration.kind !== nodeKind_1.default.VAR_LIST)
                return null;
            const field = opened.declaration.findChild(nodeKind_1.default.NAME_TYPE_INIT);
            if (!field)
                return null;
            const as3Type = getAS3DeclarationType(field);
            return isIntegerAS3Type(as3Type) ? { declaration: { name: opened.name, as3Type }, repeatText: (opened.static ? emitter.currentClassName : 'this') + '[' + emitter.namespaces.key(opened.uri, opened.name) + ']' } : null;
        }
        declaration = emitter.findDefInScope(node.text);
        if (declaration) {
            let identifier = emitter.getIdentifierRemap(node.text) || node.text;
            repeatText = declaration.bound
                ? declaration.bound + '.' + identifier
                : identifier;
        }
    }
    else if (node.kind === nodeKind_1.default.DOT && node.children.length === 2) {
        let receiver = node.children[0];
        let property = node.children[1];
        if (receiver.kind === nodeKind_1.default.IDENTIFIER && property.kind === nodeKind_1.default.LITERAL &&
            (receiver.text === 'this' || receiver.text === emitter.currentClassName)) {
            declaration = findBoundDeclaration(emitter, property.text, receiver.text);
            repeatText = receiver.text + '.' + property.text;
        }
    }
    if (!declaration || !isIntegerAS3Type(declaration.as3Type)) {
        return null;
    }
    return { declaration, repeatText };
}
function emitIntegerCoercionStart(emitter) {
    if (emitter.options.nativeCallableClasses) {
        let alias = '__as3_callable_integerIntrinsics';
        while (emitter.source.indexOf(alias) >= 0)
            alias += '_';
        emitter.ensureImportIdentifier('callableClassIntrinsics as ' + alias, emitter.generated
            ? emitter.generated.helpers.callableClass : (classlist_1.default.getLastPathToRoot() || './') + 'callableClass', false);
        emitter.insert('(' + alias + '.number(');
    }
    else
        emitter.insert('(Number(');
}
function emitIntegerCoercionEnd(emitter, as3Type) {
    emitter.insert(as3Type === 'uint' ? ') >>> 0)' : ') | 0)');
}
function getEffectiveNodeEnd(node) {
    let end = Math.max(node.start, node.end);
    if (node.children) {
        node.children.forEach(child => {
            end = Math.max(end, getEffectiveNodeEnd(child));
        });
    }
    return end;
}
function getExpressionStart(node) {
    // The parser records unary +/- at node.end and the operand at node.start.
    // Preserve the prefix inside the destination coercion instead of emitting
    // it before the wrapper.
    if ((node.kind === nodeKind_1.default.MINUS || node.kind === nodeKind_1.default.PLUS) && node.end < node.start) {
        return node.end;
    }
    return node.start;
}
function emitIntegerCoercedNode(emitter, node, as3Type) {
    emitIntegerCoercionStart(emitter);
    visitNode(emitter, node);
    emitter.catchup(getEffectiveNodeEnd(node));
    emitIntegerCoercionEnd(emitter, as3Type);
}
function referenceCoercionParts(emitter, reference) {
    if (reference.objectParameter)
        return signatureBuiltinCoercionParts(emitter, 'Object');
    if (reference.stringLocal) {
        const helper = propertyHelper(emitter, 'as3CoerceString', emitter.options.nativeStringLocalCoercionModule);
        return [helper + '(', ')'];
    }
    let helper = '__as3_reference_coerce', token = '__as3_reference_' + reference.exported;
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    while (emitter.source.indexOf(token) >= 0)
        token += '_';
    emitter.ensureImportIdentifier('as3CoerceReference as ' + helper, emitter.references.options.coercionModule, false);
    emitter.ensureImportIdentifier(reference.exported + ' as ' + token, emitter.references.options.module, false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.nativeSourceHelpers.add(token);
    return ['(<any>' + helper + '(', ',' + token + '))'];
}
function emitReferenceMethodEntry(emitter, block) {
    const signature = emitter.references && emitter.references.signature(block);
    if (!signature || !block.parent || signature.node.start !== block.parent.start)
        return false;
    const count = propertyHelper(emitter, 'as3CheckArgumentCount', emitter.references.options.coercionModule);
    const required = signature.parameters.filter(p => !p.optional).length;
    const lines = [count + '(arguments.length,' + required + (signature.argumentsUsed ? '' : ',' + signature.parameters.length) + ');'];
    signature.parameters.forEach((p, index) => {
        let converted;
        if (p.exported) {
            const parts = referenceCoercionParts(emitter, p);
            converted = parts[0] + p.name + parts[1];
        }
        else if (p.type === 'Object') {
            const parts = signatureBuiltinCoercionParts(emitter, p.type);
            converted = parts[0] + p.name + parts[1];
        }
        else if (p.type === 'String') {
            const parts = signatureBuiltinCoercionParts(emitter, p.type);
            converted = parts[0] + p.name + parts[1];
            if (p.optional)
                converted = 'arguments.length <= ' + index + ' ? ' + parts[0] +
                    referenceStringDefault(emitter, p.node) + parts[1] + ' : ' + converted;
        }
        else if (p.type !== '*') {
            if (!emitter.options.nativeNumericMethodParametersModule)
                throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: mixed numeric parameters require common coercion module');
            const helper = propertyHelper(emitter, numericCoercionExport(p.type), emitter.options.nativeNumericMethodParametersModule);
            converted = helper + '(' + p.name + ')';
            if (p.optional)
                converted = 'arguments.length <= ' + index + ' ? ' + helper + '(' +
                    numericDefaultSource(emitter, { name: p.name, type: p.type, index, init: p.node.findChild(nodeKind_1.default.INIT) }) + ') : ' + converted;
        }
        if (converted)
            lines.push(p.name + ' = ' + converted + ';');
        // Emitted modules run in strict mode on both supported targets. Update
        // only supplied entries, after coercion, without aliasing later writes.
        if (signature.argumentsUsed)
            lines.push('if (arguments.length > ' + index + ') arguments[' + index + '] = ' + p.name + ';');
    });
    emitter.insert('\n' + lines.join('\n') + '\n');
    return true;
}
function emitLocalTypeOf(emitter, node) {
    const operand = node.children.length === 1 && node_1.unwrapEncapsulatedExpression(node.children[0]);
    const local = operand && operand.kind === nodeKind_1.default.IDENTIFIER && emitter.references
        && emitter.references.local(operand, operand.text);
    if (operand && emitter.generated && emitter.typedLocalPlan && emitter.typedLocalPlan.booleanLocal(operand, emitter)) {
        // Flash folds typeof a declared Boolean local, including raw values
        // retained by logical assignment. Effectful operands are not folded.
        emitter.catchup(node.start);
        emitter.insert('("boolean")');
        emitter.skipTo(getEffectiveNodeEnd(node));
        return;
    }
    const generatedString = operand && emitter.generated && emitter.typedLocalPlan && emitter.typedLocalPlan.stringLocal(operand, emitter);
    if ((!local || !local.stringLocal) && !generatedString) {
        visitNodes(emitter, node.children);
        return;
    }
    // Qualified String storage includes the source null String atom. The read
    // has no side effects; never fold property/call/assignment operands here.
    emitter.catchup(node.start);
    emitter.insert('("string")');
    emitter.skipTo(getEffectiveNodeEnd(node));
}
function emitReferenceReturn(emitter, node) {
    const signature = emitter.references && emitter.references.signature(node);
    emitter.catchup(node.start);
    // The legacy parser also represents `throw expression` as RETURN.
    // A thrown value never passes through the method's return type coercion.
    if (emitter.source.slice(node.start, node.start + 6) !== 'return') {
        visitNodes(emitter, node.children);
        return;
    }
    let owner = node.parent;
    while (owner && [nodeKind_1.default.FUNCTION, nodeKind_1.default.LAMBDA, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(owner.kind) < 0)
        owner = owner.parent;
    const anonymous = owner && emitter.generated && emitter.generated.lexical.anonymousFunctions.find(fn => fn.start === owner.start && fn.end === owner.end);
    if (anonymous && ['Object', 'String', 'int', 'Boolean'].indexOf(anonymous.returned) >= 0) {
        const expression = node.children[0], parts = signatureBuiltinCoercionParts(emitter, anonymous.returned);
        emitter.catchup(getExpressionStart(expression));
        emitter.insert(parts[0]);
        visitNode(emitter, expression);
        emitter.catchup(getEffectiveNodeEnd(expression));
        emitter.insert(parts[1]);
        return;
    }
    if (!signature || !signature.returned && !signature.builtinReturn) {
        visitNodes(emitter, node.children);
        return;
    }
    const expression = node.children[0], parts = signature.returned
        ? referenceCoercionParts(emitter, { exported: signature.returned }) : signatureBuiltinCoercionParts(emitter, signature.builtinReturn);
    emitter.catchup(getExpressionStart(expression));
    emitter.insert(parts[0]);
    visitNode(emitter, expression);
    emitter.catchup(getEffectiveNodeEnd(expression));
    emitter.insert(parts[1]);
}
function signatureBuiltinCoercionParts(emitter, type) {
    if (type === 'Array') {
        const helper = propertyHelper(emitter, 'as3CoerceArray', emitter.references.options.coercionModule);
        return ['(<any>' + helper + '(', '))'];
    }
    if (!emitter.options.nativeSignaturePropertyModule)
        throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: scalar signature requires common property coercion module');
    const helper = propertyHelper(emitter, 'coerceAS3PropertyValue', emitter.options.nativeSignaturePropertyModule);
    return ['(<any>' + helper + '(', ',' + JSON.stringify(type) + '))'];
}
function referenceStringDefault(emitter, node) {
    const init = node.findChild(nodeKind_1.default.INIT), text = emitter.sourceBetween(init.start, init.end).trim();
    const value = init.children[0];
    if (text !== 'null' && (!value || value.kind !== nodeKind_1.default.LITERAL || !/^(["'])[\s\S]*\1$/.test(text)))
        throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: String parameter default must be a literal string or null');
    return text.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
function emitReferenceStringParameter(emitter, node) {
    const signature = emitter.references && emitter.references.signature(node);
    const parameter = signature && signature.parameters.find(p => p.node.start === node.start);
    if (!parameter || parameter.type !== 'String' || !parameter.optional)
        return false;
    referenceStringDefault(emitter, node);
    const type = node.findChild(nodeKind_1.default.TYPE), name = node.findChild(nodeKind_1.default.NAME);
    emitter.catchup(node.start);
    emitter.insert(name.text + '?:');
    emitter.skipTo(type.start);
    visitNode(emitter, type);
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
function emitInit(emitter, node) {
    let declarationNode = node.parent;
    let as3Type = declarationNode && declarationNode.kind === nodeKind_1.default.NAME_TYPE_INIT
        ? getAS3DeclarationType(declarationNode)
        : null;
    emitter.catchup(node.start);
    const reference = emitter.references && emitter.references.declaration(declarationNode);
    if (reference) {
        const parts = referenceCoercionParts(emitter, reference);
        emitter.insert(parts[0]);
        visitNodes(emitter, node.children);
        emitter.catchup(getEffectiveNodeEnd(node));
        emitter.insert(parts[1]);
        return;
    }
    if (!isIntegerAS3Type(as3Type) || emitter.typedLocalPlan && emitter.typedLocalPlan.owns(declarationNode, emitter)) {
        visitNodes(emitter, node.children);
        return;
    }
    emitIntegerCoercionStart(emitter);
    visitNodes(emitter, node.children);
    emitter.catchup(getEffectiveNodeEnd(node));
    emitIntegerCoercionEnd(emitter, as3Type);
}
function logicalAssignmentTemporary(emitter, node) {
    let body = null;
    for (let current = node; current && current.parent; current = current.parent) {
        if ([nodeKind_1.default.FUNCTION, nodeKind_1.default.LAMBDA, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(current.parent.kind) >= 0) {
            if (current.kind === nodeKind_1.default.BLOCK)
                body = current;
            break;
        }
    }
    if (!body)
        throw new Error('AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED: receiver capture outside a function body');
    const allocated = [];
    emitter.logicalAssignmentTemps.forEach(names => allocated.push(...names));
    let index = allocated.length;
    let name;
    do {
        name = '__as3_logical_receiver_' + index++;
    } while (emitter.source.indexOf(name) >= 0 || allocated.indexOf(name) >= 0);
    emitter.logicalAssignmentTemps.set(body, (emitter.logicalAssignmentTemps.get(body) || []).concat(name));
    return name;
}
function emitLogicalAssignment(emitter, node) {
    const left = node_1.unwrapEncapsulatedExpression(node.children[0]);
    const operator = node.children[1].text.slice(0, -1);
    const right = node.children[2];
    const type = logical_assignment_1.logicalAssignmentType(left, name => emitter.findDefInScope(name));
    if (['*', 'int', 'uint', 'Boolean', 'Object'].indexOf(type) < 0)
        throw new Error('AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED: selected-result coercion requires provider authority for ' + type);
    emitter.catchup(node.start);
    emitter.insert('(');
    emitter.skipTo(left.start);
    let reference;
    if (left.kind === nodeKind_1.default.IDENTIFIER) {
        const start = emitter.output.length;
        visitNode(emitter, left);
        emitter.catchup(left.end);
        reference = emitter.output.slice(start);
    }
    else if (left.kind === nodeKind_1.default.DOT && left.children[1].kind === nodeKind_1.default.LITERAL
        && left.children[0].text !== 'super') {
        emitter.namespaces.checkDot(left, emitter.namespaces.receiverType(left));
        const temporary = logicalAssignmentTemporary(emitter, node);
        emitter.insert(temporary + ' = ');
        visitNode(emitter, left.children[0]);
        emitter.catchup(getEffectiveNodeEnd(left.children[0]));
        reference = temporary + '[' + JSON.stringify(left.children[1].text) + ']';
        emitter.insert(', ' + reference);
    }
    else {
        throw new Error('AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED: only identifier and ordinary dot references are proven');
    }
    emitter.insert(' = ');
    const selected = type === 'Object' ? logicalAssignmentTemporary(emitter, node) : null;
    if (selected)
        emitter.insert('(' + selected + ' = ');
    if (type === 'int' || type === 'uint')
        emitIntegerCoercionStart(emitter);
    else if (type === 'Boolean')
        emitter.insert('!!');
    emitter.insert('(' + reference + ' ' + operator + ' (');
    emitter.skipTo(getExpressionStart(right));
    visitNode(emitter, right);
    emitter.catchup(getEffectiveNodeEnd(right));
    emitter.insert('))');
    if (type === 'int' || type === 'uint')
        emitIntegerCoercionEnd(emitter, type);
    if (selected)
        emitter.insert(', ' + selected + ' === void 0 ? null : ' + selected + ')');
    emitter.insert(')');
    emitter.skipTo(getEffectiveNodeEnd(node));
}
function emitAssign(emitter, node) {
    if (node.children.length !== 3) {
        emitter.catchup(node.start);
        visitNodes(emitter, node.children);
        return;
    }
    let left = node.children[0];
    let operator = node.children[1];
    let right = node.children[2];
    const referenceTarget = node_1.unwrapEncapsulatedExpression(left);
    const reference = emitter.references && referenceTarget.kind === nodeKind_1.default.IDENTIFIER && emitter.references.local(referenceTarget, referenceTarget.text);
    if (reference) {
        const addition = reference.stringLocal && operator.text === '+=';
        if (operator.text !== '=' && !addition)
            throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: compound reference write');
        if (addition && !emitter.options.nativeTypedLocalAdditionModule)
            throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: String compound addition requires common addition module');
        if (addition)
            native_generated_emission_1.generatedModule(emitter.options.nativeTypedLocalAdditionModule);
        const temporary = logicalAssignmentTemporary(emitter, node);
        const parts = referenceCoercionParts(emitter, reference);
        emitter.catchup(node.start);
        emitter.insert('(' + temporary + ' = ');
        // Call arguments capture the old local before evaluating the RHS.
        // Coercion of the addition result happens only after both expressions.
        if (addition)
            emitter.insert(sourceAdditionHelper(emitter) + '(' + reference.name + ',(');
        emitter.skipTo(getExpressionStart(right));
        visitNode(emitter, right);
        emitter.catchup(getEffectiveNodeEnd(right));
        if (addition)
            emitter.insert('))');
        emitter.insert(', ' + reference.name + ' = ' + parts[0] + temporary + parts[1] + ', ' + temporary + ')');
        return;
    }
    if (operator.text === '=' && emitDictionaryPropertyAssignment(emitter, left, right))
        return;
    if (operator.text === '=' && emitDynamicPropertyAssignment(emitter, left, right))
        return;
    if (operator.text === '=' && emitObjectPropertyAssignment(emitter, node))
        return;
    if (operator.text === '+=' && emitDynamicPropertyAddition(emitter, left, right))
        return;
    if (operator.text === '+=' && emitObjectPropertyAddition(emitter, node))
        return;
    if ((operator.text === '+=' || operator.text === '=') && emitter.typedLocalPlan) {
        const target = emitter.typedLocalPlan.wildcardReference(left, emitter);
        if (target && (operator.text === '+=' || target.write)) {
            emitter.catchup(node.start);
            emitter.insert(target.write ? target.write + '(' : '(' + target.reference + '=');
            emitter.skipTo(getEffectiveNodeEnd(left));
            emitter.catchup(operator.start);
            emitter.skipTo(operator.end);
            if (operator.text === '+=')
                emitter.insert('(<any>' + sourceAdditionHelper(emitter) + '(' + (target.read ? target.read + '()' : target.reference) + ',');
            emitter.catchup(getExpressionStart(right));
            visitNode(emitter, right);
            emitter.catchup(getEffectiveNodeEnd(right));
            emitter.insert(operator.text === '+=' ? ')))' : ')');
            emitter.skipTo(getEffectiveNodeEnd(node));
            return;
        }
    }
    if (operator.text === '||=' || operator.text === '&&=') {
        if (emitter.typedLocalPlan && emitter.typedLocalPlan.owns(left, emitter)) {
            const marker = emitter.typedLocalPlan.logicalAssignmentMarker(left, emitter);
            emitter.catchup(node.start);
            emitter.insert('(');
            visitNode(emitter, left);
            emitter.catchup(getEffectiveNodeEnd(left));
            emitter.insert(' ' + operator.text.slice(0, -1) + ' ' + marker + '(');
            visitNode(emitter, left);
            emitter.catchup(getEffectiveNodeEnd(left));
            emitter.insert(',');
            emitter.skipTo(getExpressionStart(right));
            visitNode(emitter, right);
            emitter.catchup(getEffectiveNodeEnd(right));
            emitter.insert('))');
            emitter.skipTo(getEffectiveNodeEnd(node));
            return;
        }
        emitLogicalAssignment(emitter, node);
        return;
    }
    let target = getTypedAssignmentTarget(emitter, left);
    let supportedOperators = [
        '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '>>>='
    ];
    if (!target || supportedOperators.indexOf(operator.text) < 0) {
        emitter.catchup(node.start);
        visitNodes(emitter, node.children);
        return;
    }
    emitter.catchup(node.start);
    visitNode(emitter, left);
    emitter.catchup(left.end);
    if (operator.text === '=') {
        visitNode(emitter, operator);
        emitter.catchup(getExpressionStart(right));
        emitIntegerCoercedNode(emitter, right, target.declaration.as3Type);
    }
    else {
        emitter.catchup(operator.start);
        emitter.insert('=');
        emitter.skipTo(operator.end);
        emitter.catchup(getExpressionStart(right));
        emitIntegerCoercionStart(emitter);
        emitter.insert(target.repeatText + ' ' + operator.text.substring(0, operator.text.length - 1) + ' (');
        visitNode(emitter, right);
        emitter.catchup(getEffectiveNodeEnd(right));
        emitter.insert(')');
        emitIntegerCoercionEnd(emitter, target.declaration.as3Type);
    }
}
function sourceAdditionHelper(emitter) {
    let helper = '__as3_source_add';
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    emitter.ensureImportIdentifier('as3Add as ' + helper, emitter.options.nativeTypedLocalAdditionModule, false);
    emitter.nativeSourceHelpers.add(helper);
    return helper;
}
/** Mark original source addition before any generated callable/local scaffolding. */
function emitAdd(emitter, node) {
    if (!emitter.typedLocalPlan
        || !node.children.some(child => child.kind === nodeKind_1.default.OP && child.text === '+')) {
        emitter.catchup(node.start);
        visitNodes(emitter, node.children);
        return;
    }
    const helper = sourceAdditionHelper(emitter);
    emitter.catchup(node.start);
    // ADD contains a flat, left-associative sequence of + and - operands.
    // Nest the source operations without evaluating an operand more than once.
    const through = (index) => {
        if (index === 0) {
            visitNode(emitter, node.children[0]);
            emitter.catchup(getEffectiveNodeEnd(node.children[0]));
            return;
        }
        const operator = node.children[index - 1], right = node.children[index];
        const addition = operator.text === '+';
        emitter.insert(addition ? '(<any>' + helper + '(' : '(');
        through(index - 2);
        emitter.catchup(operator.start);
        emitter.insert(addition ? ',' : '-');
        emitter.skipTo(operator.end);
        emitter.catchup(getExpressionStart(right));
        visitNode(emitter, right);
        emitter.catchup(getEffectiveNodeEnd(right));
        emitter.insert(addition ? '))' : ')');
    };
    through(node.children.length - 1);
    emitter.skipTo(getEffectiveNodeEnd(node));
}
function emitOp(emitter, node) {
    emitter.catchup(node.start);
    if (node.text === Keywords.IS) {
        emitter.insert(Keywords.INSTANCE_OF);
        emitter.skipTo(node.end);
        return;
    }
    emitter.catchup(node.end);
}
function emitOr(emitter, node) {
    // // TODO: support for `value ||= 10` expressions;
    // if (node.children.length === 3 && node.children[2].text === "=")
    // {
    //     node.children[2].text = node.children[0].text + " =";
    // }
    emitter.catchup(node.start);
    visitNodes(emitter, node.children);
}
function hasFunctionLocal(emitter, name) {
    for (let scope = emitter.scope; scope && scope !== emitter.rootScope; scope = scope.parent) {
        if (!scope.className && scope.declarations.some(declaration => declaration.name === name && !declaration.bound))
            return true;
    }
    return false;
}
function emitIdent(emitter, node) {
    const regexp = nativeRegExpReference(emitter, node);
    if (regexp) {
        emitter.catchup(node.start);
        emitter.insert(regexp);
        emitter.skipTo(node.end);
        emitter.emitThisForNextIdent = true;
        return;
    }
    const global = emitter.nativeGlobals.resolve(node);
    if (global) {
        emitter.ensureImportIdentifier(global.name + ' as ' + global.alias, global.module, false);
        emitter.catchup(node.start);
        emitter.insert(global.alias);
        emitter.skipTo(node.end);
        emitter.emitThisForNextIdent = true;
        return;
    }
    // An exact package-function provider owns imported lookup calls. A same-named
    // source parameter/member/import must retain its own binding, not AS3Utils.
    const nativeLookupName = node.text === 'getDefinitionByName' && emitter.options.importModules
        && emitter.options.importModules['flash.utils.getDefinitionByName'];
    if (nativeLookupName) {
        if (emitter.options.useNamespaces)
            throw new Error('AS3_DEFINITION_LOOKUP_UNSUPPORTED: module emission required');
        const declaration = emitter.findDefInScope(node.text);
        const lexical = native_typeof_1.typeOfBinding(node, emitter.source, []) === 'lexical';
        if (!lexical && declaration && declaration.sourceImport === 'flash.utils.getDefinitionByName') {
            const expression = node_1.outerEncapsulatedExpression(node), call = expression.parent;
            if (!call || call.kind !== nodeKind_1.default.CALL || call.children[0] !== expression
                || call.parent && call.parent.kind === nodeKind_1.default.NEW)
                throw new Error('AS3_DEFINITION_LOOKUP_UNSUPPORTED: package function requires direct call');
            native_generated_emission_1.generatedModule(nativeLookupName);
            let alias = '__as3_getDefinitionByName';
            while (emitter.source.indexOf(alias) >= 0)
                alias += '_';
            emitter.ensureImportIdentifier('getDefinitionByName as ' + alias, nativeLookupName, false);
            emitter.catchup(node.start);
            emitter.insert(alias);
            emitter.skipTo(node.end);
            emitter.emitThisForNextIdent = true;
            return;
        }
        if (!declaration && !lexical)
            throw new Error('AS3_DEFINITION_LOOKUP_UNSUPPORTED: exact package import or source binding required');
    }
    let preservedTypeOfName;
    if (emitter.options.nativeCallableMetadata && native_typeof_1.insideTypeOf(node)
        && !(node.parent.kind === nodeKind_1.default.DOT && node.parent.children[0] !== node)) {
        const name = native_typeof_1.sourceIdentifier(node, emitter.source);
        const binding = native_typeof_1.typeOfBinding(node, emitter.source, Object.keys(emitter.options.nativeClassInitialization.classes));
        if (binding === 'builtin' && ['Class', 'int', 'uint'].indexOf(name) >= 0) {
            let alias = '__as3_typeof_builtin_' + name;
            while (emitter.source.indexOf(alias) >= 0)
                alias += '_';
            const exported = name === 'Class' ? 'AS3ClassType' : name === 'int' ? 'AS3Int' : 'AS3Uint';
            emitter.ensureImportIdentifier(exported + ' as ' + alias, emitter.options.nativeCallableMetadata.module, false);
            let classValue = '__as3_typeof_classValue';
            while (emitter.source.indexOf(classValue) >= 0)
                classValue += '_';
            emitter.ensureImportIdentifier('as3AsClass as ' + classValue, emitter.options.nativeCallableMetadata.module, false);
            emitter.nativeSourceHelpers.add(classValue);
            emitter.nativeSourceHelpers.add(alias);
            emitter.catchup(node.start);
            emitter.insert(classValue + '(' + alias + ')');
            emitter.skipTo(node.end);
            return;
        }
        // Preserve source spelling when an authored declaration shadows int/uint.
        if ((name === 'int' || name === 'uint') && binding !== 'builtin')
            node.text = preservedTypeOfName = name;
    }
    const openedNamespaceMember = emitter.namespaces.openedIdentifier(node, hasFunctionLocal(emitter, node.text));
    if (openedNamespaceMember) {
        emitter.catchup(node.start);
        const receiver = openedNamespaceMember.static ? emitter.currentClassName : 'this';
        emitter.insert(receiver + '[' + emitter.namespaces.key(openedNamespaceMember.uri, openedNamespaceMember.name) + ']');
        emitter.skipTo(node.end);
        emitter.emitThisForNextIdent = true;
        return;
    }
    emitter.namespaces.checkIdentifier(node, hasFunctionLocal(emitter, node.text));
    if (node.text == "getDefinitionByName" && !nativeLookupName) {
        let pathToRoot = classlist_1.default.getLastPathToRoot();
        emitter.ensureImportIdentifier(config_1.AS3_UTIL, `${pathToRoot}${config_1.AS3_UTIL}`);
    }
    emitter.catchup(node.start);
    let staticRef;
    if (classlist_1.default.isScanning == false) {
        staticRef = classlist_1.default.checkIsStaticParentMamber(node.text);
        if (staticRef && (config_1.VERBOSE_MASK & 16384 /* EXT_AST_SHOW_PARENT_STATIC */) == 16384 /* EXT_AST_SHOW_PARENT_STATIC */) {
            console.log(">>> Static in parent: " + node.text + "  " + staticRef.getFullPath());
        }
        if ((config_1.VERBOSE_MASK & 8192 /* EXT_AST_SHOW_ALL_STATIC */) == 8192 /* EXT_AST_SHOW_ALL_STATIC */) {
            let allStatic = classlist_1.default.checkIsStatic(node.text);
            if (allStatic)
                console.log(">>> Static ref: " + node.text + "  " + allStatic.getFullPath());
        }
        if ((config_1.VERBOSE_MASK & 65536 /* EXT_AST_SHOW_STATIC_VARIABLES */) == 65536 /* EXT_AST_SHOW_STATIC_VARIABLES */) {
            let staticVariable = classlist_1.default.checkIsStaticVariable(node.text);
            if (staticVariable)
                console.log(">>> Static variable: " + node.text + "  " + staticVariable.getFullPath());
        }
    }
    if (node.parent && node.parent.kind === nodeKind_1.default.DOT) {
        //in case of dot just check the first
        if (node.parent.children[0] !== node) {
            return;
        }
    }
    if (Keywords.isKeyWord(node.text) && !emitter.findDefInScope(node.text)) {
        emitter.insert(node.text);
        emitter.skipTo(node.end);
        return;
    }
    let def = emitter.findDefInScope(node.text);
    if (emitter.options.nativeTweenModule !== undefined && def && !def.bound
        && !Object.prototype.hasOwnProperty.call(def, 'as3Type')
        && (def.sourceImport === 'com.greensock.TweenMax' || def.sourceImport === 'com.greensock.TweenLite'))
        throw new Error('AS3_TWEEN_UNSUPPORTED: imported tween Class operation is not qualified');
    const interfaceValue = emitter.generated && emitter.references && emitter.references.sourceInterface(node.text);
    if (interfaceValue && (!def || !def.bound && !Object.prototype.hasOwnProperty.call(def, 'as3Type'))) {
        let method = node.parent;
        while (method && [nodeKind_1.default.FUNCTION, nodeKind_1.default.GET, nodeKind_1.default.SET].indexOf(method.kind) < 0)
            method = method.parent;
        const expression = node_1.outerEncapsulatedExpression(node), parent = expression.parent;
        if (!method || parent && (parent.kind === nodeKind_1.default.DOT && parent.children[0] === expression
            || parent.kind === nodeKind_1.default.ARRAY_ACCESSOR && parent.children[0] === expression
            || parent.kind === nodeKind_1.default.CALL && parent.children[0] === expression
            || parent.kind === nodeKind_1.default.ASSIGN && parent.children[0] === expression
            || [nodeKind_1.default.PRE_INC, nodeKind_1.default.PRE_DEC, nodeKind_1.default.POST_INC, nodeKind_1.default.POST_DEC, nodeKind_1.default.DELETE].indexOf(parent.kind) >= 0))
            throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: interface Class value requires a method value expression');
        let token = '__as3_interface_value_' + interfaceValue;
        while (emitter.source.indexOf(token) >= 0)
            token += '_';
        emitter.ensureImportIdentifier(interfaceValue + ' as ' + token, emitter.references.options.module, false);
        emitter.nativeSourceHelpers.add(token);
        emitter.insert(token);
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.references && !emitter.classInitializers.enabled
        && (!def || !def.bound && !Object.prototype.hasOwnProperty.call(def, 'as3Type'))
        && emitter.references.sourceClass(node.text)) {
        const expression = node_1.outerEncapsulatedExpression(node), parent = expression.parent;
        const member = parent && parent.kind === nodeKind_1.default.DOT && parent.children[0] === expression && parent.children[1];
        const callee = member && node_1.outerEncapsulatedExpression(parent), call = callee && callee.parent;
        const staticCall = member && member.kind === nodeKind_1.default.LITERAL && call && call.kind === nodeKind_1.default.CALL
            && call.children[0] === callee && (!call.parent || call.parent.kind !== nodeKind_1.default.NEW)
            && emitter.references.publicStaticMethod(node.text, member.text);
        if (!staticCall && (!parent || parent.kind !== nodeKind_1.default.CALL || !parent.parent || parent.parent.kind !== nodeKind_1.default.NEW))
            throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: consumer class value requires direct construction or an own public static call');
        let read = '__as3_reference_readClass';
        while (emitter.source.indexOf(read) >= 0)
            read += '_';
        emitter.ensureImportIdentifier(node.text);
        emitter.ensureImportIdentifier('readNativeClass as ' + read, emitter.options.nativeClassHelperModules.nativeClass, false);
        emitter.insert('(' + read + '(' + node.text + ',' + JSON.stringify(staticCall ? 'read' : 'unsupported') + '))');
        emitter.skipTo(node.end);
        return;
    }
    if (emitter.classInitializers.enabled && def && (def.bound || Object.prototype.hasOwnProperty.call(def, 'as3Type')))
        staticRef = null; // An own source binding shadows an inherited static name.
    if (emitter.classInitializers.enabled && !staticRef && (!def || !def.bound && !Object.prototype.hasOwnProperty.call(def, 'as3Type'))) {
        if (node.text.indexOf('.') >= 0)
            throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: qualified class-value syntax requires separate lowering');
        const own = emitter.classFactory && emitter.classFactory.node.findChild(nodeKind_1.default.NAME).text;
        const identity = emitter.classInitializers.resolve(node, node.text);
        const receiver = node_1.outerEncapsulatedExpression(node);
        if ((identity === 'lazy' || node.text === own) && receiver.parent
            && receiver.parent.kind === nodeKind_1.default.ARRAY_ACCESSOR && receiver.parent.children[0] === receiver)
            throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: indexed lazy-class receivers require key-order and publication authority');
        if (node.text === own && node.kind !== nodeKind_1.default.EXTENDS) {
            // AIR lowers the own-Class value in a static initializer callback to
            // the callback receiver (including escaped callbacks after failed cinit).
            let callback = node.parent;
            while (callback && callback.kind !== nodeKind_1.default.LAMBDA && callback.kind !== nodeKind_1.default.FUNCTION)
                callback = callback.parent;
            const initializerCallback = callback && emitter.generated && emitter.generated.lexical.anonymousFunctions
                .some(f => f.staticInitializer && f.start === callback.start && f.end === callback.end);
            emitter.insert(initializerCallback ? 'this' : emitter.classFactory.value);
            emitter.skipTo(node.end);
            return;
        }
        if (identity === 'lazy') {
            emitter.ensureImportIdentifier(node.text);
            emitter.ensureImportIdentifier('readNativeClass as ' + emitter.classInitializers.readName, (classlist_1.default.getLastPathToRoot() || './') + 'nativeClass', false);
            let context = 'value';
            let expression = node_1.outerEncapsulatedExpression(node);
            if (expression.parent && expression.parent.kind === nodeKind_1.default.DOT && expression.parent.children[0] === expression) {
                context = 'read';
                const member = node_1.outerEncapsulatedExpression(expression.parent), operation = member.parent;
                if (operation && (operation.kind === nodeKind_1.default.ASSIGN && operation.children[0] === member
                    || [nodeKind_1.default.PRE_INC, nodeKind_1.default.PRE_DEC, nodeKind_1.default.POST_INC, nodeKind_1.default.POST_DEC, nodeKind_1.default.DELETE].indexOf(operation.kind) >= 0))
                    context = 'unsupported';
            }
            else if (node.kind === nodeKind_1.default.EXTENDS || expression.parent
                && [nodeKind_1.default.CALL, nodeKind_1.default.NEW, nodeKind_1.default.RELATION].indexOf(expression.parent.kind) >= 0)
                context = 'unsupported';
            emitter.insert('(' + emitter.classInitializers.readName + '(' + node.text + ', ' + JSON.stringify(context) + '))');
            emitter.skipTo(node.end);
            return;
        }
        if (!identity && /^[A-Z]/.test(node.text) && GLOBAL_NAMES.indexOf(node.text) < 0)
            throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: unresolved class-value identity: ' + node.text);
    }
    if (def && def.bound) {
        const factory = emitter.classFactory;
        emitter.insert((factory && def.bound === factory.node.findChild(nodeKind_1.default.NAME).text ? factory.value : def.bound === 'this' && emitter.generated ? emitter.generated.lexical.implicitReceiver(node) : def.bound) + '.');
    }
    if (staticRef) {
        emitter.ensureImportIdentifier(staticRef.className);
        if (emitter.classInitializers.enabled) {
            const identity = emitter.classInitializers.resolveQualified(staticRef.getFullPath());
            if (!identity)
                throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: unresolved inherited static class: ' + staticRef.getFullPath());
            emitter.insert(identity === 'lazy' ? '(' + emitter.classInitializers.readName + '(' + staticRef.className + ', "unsupported")).'
                : staticRef.className + '.');
        }
        else
            emitter.insert(staticRef.className + ".");
    }
    else {
        let isClassMember = classlist_1.default.checkIsClassMember(node.text);
        let IsSuperClassName = classlist_1.default.checkIdentIsSuperClassName(node.text);
        /*		if (isClassMember)
                {
                    if (ClassList.checkIsParentIdent(node.text) == false) {
                        if (emitter.emitThisForNextIdent) emitter.insert('this.');
        
                    }
        
                }*/
        if (!def &&
            emitter.currentClassName &&
            GLOBAL_NAMES.indexOf(node.text) === -1 &&
            TYPE_REMAP[node.text] === undefined &&
            node.text !== emitter.currentClassName) {
            if (emitter.generated && emitter.generated.projection.metadata.isDynamic)
                throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: unqualified dynamic member lookup held');
            if (node.text.match(/^[A-Z]/)) {
                // Import missing identifier from this namespace
                if (!emitter.options.useNamespaces) {
                    if (staticRef == undefined) {
                        emitter.ensureImportIdentifier(node.text);
                    }
                }
            }
            else if (emitter.emitThisForNextIdent) {
                // Unknown dynamic names need lexical resolution, never a raw JS property.
                // Identifier belongs to `this.` scope.
                emitter.insert('this.');
            }
        }
    }
    // emitter.ensureImportIdentifier(node.text);
    const canonicalDictionary = node.text === 'Dictionary' && def && def.sourceImport === 'flash.utils.Dictionary'
        && emitter.options.importModules && emitter.options.importModules['flash.utils.Dictionary'];
    node.text = preservedTypeOfName || (canonicalDictionary || nativeLookupName ? node.text : emitter.getIdentifierRemap(node.text)) || node.text;
    emitter.insert(node.text);
    emitter.skipTo(node.end);
    emitter.emitThisForNextIdent = true;
}
exports.emitIdent = emitIdent;
function emitConsumerLiteralConstant(emitter, node) {
    if (!emitter.references || emitter.classInitializers.enabled && !emitter.generated)
        return false;
    const receiver = node_1.unwrapEncapsulatedExpression(node.children[0]), member = node.children[1];
    if (!receiver || receiver.kind !== nodeKind_1.default.IDENTIFIER || !member || member.kind !== nodeKind_1.default.LITERAL)
        return false;
    const def = emitter.findDefInScope(receiver.text);
    if (def && (def.bound || Object.prototype.hasOwnProperty.call(def, 'as3Type')))
        return false;
    const constant = emitter.references.literalStaticConstant(receiver.text, member.text);
    if (!constant)
        return false;
    const expression = node_1.outerEncapsulatedExpression(node), operation = expression.parent;
    if (operation && operation.children[0] === expression && [nodeKind_1.default.ASSIGN, nodeKind_1.default.PRE_INC, nodeKind_1.default.PRE_DEC, nodeKind_1.default.POST_INC, nodeKind_1.default.POST_DEC, nodeKind_1.default.DELETE].indexOf(operation.kind) >= 0)
        throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: consumer constant mutation');
    // Reference constants require actual class initialization and storage reads.
    // The generated lazy-class path also preserves same-class cinit identity.
    if (constant.literal === null)
        return false;
    const module = emitter.options.nativeSignaturePropertyModule;
    native_generated_emission_1.generatedModule(module);
    const coerce = propertyHelper(emitter, 'coerceAS3PropertyValue', module);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + coerce + '(' + constant.literal + ',' + JSON.stringify(constant.type) + '))');
    emitter.skipTo(node.end);
    return true;
}
/** currentDomain belongs to the defining script, independently of receiver/caller. */
function lexicalApplicationDomainModule(emitter, node) {
    if (!emitter.generated || !node.children[1] || node.children[1].text !== 'currentDomain')
        return null;
    const receiver = node_1.unwrapEncapsulatedExpression(node.children[0]);
    const parts = (value) => {
        value = node_1.unwrapEncapsulatedExpression(value);
        if (value.kind === nodeKind_1.default.IDENTIFIER || value.kind === nodeKind_1.default.LITERAL)
            return [value.text];
        if (value.kind === nodeKind_1.default.DOT && value.children.length === 2) {
            const left = parts(value.children[0]), right = value.children[1];
            if (left && right.kind === nodeKind_1.default.LITERAL)
                return left.concat([right.text]);
        }
        return null;
    };
    const names = parts(receiver);
    if (!names)
        return null;
    const spelling = names.join('.'), qualified = names.length > 1;
    if (qualified ? spelling !== 'flash.system.ApplicationDomain'
        : emitter.generated.lexical.resolveTypeName(spelling) !== 'flash.system.ApplicationDomain')
        return null;
    let root = receiver;
    while (root.kind === nodeKind_1.default.DOT)
        root = node_1.unwrapEncapsulatedExpression(root.children[0]);
    const input = native_generated_declarations_2.nativeGeneratedDeclarationInputs(emitter.generated.options.plan, emitter.generated.options.plan.scope);
    const binding = emitter.findDefInScope(names[0]);
    const sourceBinding = native_typeof_1.typeOfBinding(root, emitter.source, Object.keys(input.sources).concat(Object.keys(input.providers || {})));
    if (binding && (qualified || binding.bound || Object.prototype.hasOwnProperty.call(binding, 'as3Type'))
        || sourceBinding === 'lexical' || qualified && sourceBinding === 'class')
        return null;
    const provider = input.providers && input.providers['flash.system.ApplicationDomain'];
    const fail = (reason) => { throw new Error('AS3_APPLICATION_DOMAIN_UNSUPPORTED: ' + reason); };
    if (!provider || provider.exportName !== 'ApplicationDomain' || provider.nativeBase || provider.nativeInterface || provider.nativeVector
        || !emitter.options.importModules || emitter.options.importModules['flash.system.ApplicationDomain'] !== native_xml_1.xmlGlobalProviderModule(provider.module, emitter.generated.options.module))
        fail('exact native ApplicationDomain provider required');
    if (!input.scriptDomainProvider || !input.scriptGlobalProviderModule || !emitter.generated.projection.binding.scriptGlobalExport)
        fail('defining script requires an explicit cohort domain');
    const expression = node_1.outerEncapsulatedExpression(node), operation = expression.parent;
    if (operation && operation.children[0] === expression && [nodeKind_1.default.ASSIGN, nodeKind_1.default.PRE_INC, nodeKind_1.default.PRE_DEC, nodeKind_1.default.POST_INC, nodeKind_1.default.POST_DEC, nodeKind_1.default.DELETE, nodeKind_1.default.CALL, nodeKind_1.default.NEW].indexOf(operation.kind) >= 0)
        fail('currentDomain mutation or invocation requires separate authority');
    return native_generated_emission_1.generatedModule(native_xml_1.xmlGlobalProviderModule(input.scriptGlobalProviderModule, emitter.generated.options.module));
}
function emitLexicalApplicationDomain(emitter, node) {
    const module = lexicalApplicationDomainModule(emitter, node);
    if (!module)
        return false;
    const helper = propertyHelper(emitter, 'getAS3ScriptApplicationDomain', module);
    emitter.catchup(node.start);
    emitter.insert(helper + '(' + emitter.generated.lexical.scriptGlobal + ')');
    emitter.skipTo(node.end);
    return true;
}
/** Read an authenticated public Array field through the source property provider.
 * Direct JS indexing/length leaks host TypeErrors when the field is null. */
function emitGeneratedArrayFieldRead(emitter, node) {
    if (!emitter.generated || !node || node.children.length !== 2)
        return false;
    const receiver = node_1.unwrapEncapsulatedExpression(node.children[0]), key = node.children[1];
    if (!receiver || receiver.kind !== nodeKind_1.default.DOT || receiver.children.length !== 2
        || receiver.children[0].kind !== nodeKind_1.default.IDENTIFIER || receiver.children[0].text !== 'this'
        || receiver.children[1].kind !== nodeKind_1.default.LITERAL)
        return false;
    const field = emitter.generated.projection.instanceTraits.find(t => t.name === receiver.children[1].text);
    if (!field || field.kind !== 'variable' || field.type !== 'Array')
        return false;
    if (node.kind === nodeKind_1.default.DOT && (key.kind !== nodeKind_1.default.LITERAL || key.text !== 'length'))
        return false;
    const outer = node_1.outerEncapsulatedExpression(node), parent = outer && outer.parent;
    // Writes, updates and calls retain their existing separate lowering paths.
    if (parent && (parent.children[0] === outer && [nodeKind_1.default.ASSIGN, nodeKind_1.default.CALL].indexOf(parent.kind) >= 0
        || [nodeKind_1.default.DELETE, nodeKind_1.default.PRE_INC, nodeKind_1.default.PRE_DEC, nodeKind_1.default.POST_INC, nodeKind_1.default.POST_DEC].indexOf(parent.kind) >= 0))
        return false;
    const helper = propertyHelper(emitter, 'as3GetProperty', emitter.generated.propertyModule);
    emitter.catchup(node.start);
    emitter.insert('(<any>' + helper + '(');
    emitPropertyKey(emitter, node.kind === nodeKind_1.default.DOT ? { receiver: node.children[0], key, literalKey: key.text } : { receiver: node.children[0], key });
    emitter.insert('))');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}
/** A qualified native receiver is a lexical package name, never a JS object path. */
function qualifiedNativeStaticRead(emitter, node) {
    if (!emitter.generated || !node || node.kind !== nodeKind_1.default.DOT || node.children.length !== 2
        || node.children[1].kind !== nodeKind_1.default.LITERAL)
        return null;
    let root = node_1.unwrapEncapsulatedExpression(node.children[0]);
    const parts = [];
    while (root && root.kind === nodeKind_1.default.DOT && root.children.length === 2 && root.children[1].kind === nodeKind_1.default.LITERAL) {
        parts.unshift(root.children[1].text);
        root = node_1.unwrapEncapsulatedExpression(root.children[0]);
    }
    if (!root || root.kind !== nodeKind_1.default.IDENTIFIER || !parts.length)
        return null;
    parts.unshift(root.text);
    const name = parts.join('.'), input = native_generated_declarations_2.nativeGeneratedDeclarationInputs(emitter.generated.options.plan, emitter.generated.options.plan.scope);
    const binding = input.providers && input.providers[name];
    if (!binding)
        return null;
    const fail = (reason) => { throw new Error('AS3_QUALIFIED_NATIVE_READ_UNSUPPORTED: ' + reason); };
    if (emitter.findDefInScope(parts[0]) || native_typeof_1.typeOfBinding(root, emitter.source, Object.keys(input.sources).concat(Object.keys(input.providers || {}))) !== null)
        return null;
    if (binding.nativeInterface || binding.nativeVector || !emitter.options.nativeClassInitialization
        || emitter.options.nativeClassInitialization.classes[name] !== 'ready')
        fail('exact ready native class provider required: ' + name);
    const module = native_xml_1.xmlGlobalProviderModule(binding.module, emitter.generated.options.module);
    if (!emitter.options.importModules || emitter.options.importModules[name] !== module)
        fail('exact native import binding required: ' + name);
    const expression = node_1.outerEncapsulatedExpression(node), operation = expression.parent;
    if (operation && operation.children[0] === expression && [nodeKind_1.default.ASSIGN, nodeKind_1.default.PRE_INC, nodeKind_1.default.PRE_DEC,
        nodeKind_1.default.POST_INC, nodeKind_1.default.POST_DEC, nodeKind_1.default.DELETE, nodeKind_1.default.CALL, nodeKind_1.default.NEW].indexOf(operation.kind) >= 0)
        fail('native static mutation or invocation requires separate lowering: ' + name);
    return { module: native_generated_emission_1.generatedModule(module), exportName: binding.exportName };
}
function emitDot(emitter, node) {
    if (emitCapabilitiesStaticRead(emitter, node) || emitDataEventData(emitter, node) || emitErrorEventSubtypeText(emitter, node))
        return;
    if (emitGeneratedArraySortRead(emitter, node))
        return;
    if (emitGeneratedArrayFieldRead(emitter, node))
        return;
    if (emitLexicalApplicationDomain(emitter, node))
        return;
    const nativeRead = qualifiedNativeStaticRead(emitter, node);
    if (nativeRead) {
        const alias = propertyHelper(emitter, nativeRead.exportName, nativeRead.module);
        emitter.catchup(node.start);
        emitter.insert(alias + '.' + node.children[1].text);
        emitter.skipTo(getEffectiveNodeEnd(node));
        return;
    }
    const lookupModule = emitter.options.importModules && emitter.options.importModules['flash.utils.getDefinitionByName'];
    const lookupReceiver = node_1.unwrapEncapsulatedExpression(node.children[0]), member = node.children[1];
    if (lookupModule && member && member.text === 'getDefinitionByName' && lookupReceiver && lookupReceiver.kind === nodeKind_1.default.DOT) {
        const namespace = node_1.unwrapEncapsulatedExpression(lookupReceiver.children[0]), utils = lookupReceiver.children[1];
        if (namespace && namespace.kind === nodeKind_1.default.IDENTIFIER && namespace.text === 'flash'
            && utils && utils.text === 'utils' && !emitter.findDefInScope('flash')
            && native_typeof_1.typeOfBinding(namespace, emitter.source, []) !== 'lexical')
            throw new Error('AS3_DEFINITION_LOOKUP_UNSUPPORTED: qualified package value requires source binding authority');
    }
    if (emitDynamicPropertyRead(emitter, node))
        return;
    if (emitObjectPropertyRead(emitter, node))
        return;
    if (emitConsumerLiteralConstant(emitter, node))
        return;
    if (emitArraySortConstant(emitter, node))
        return;
    if (emitDictionaryProperty(emitter, node, 'as3GetProperty'))
        return;
    const receiver = node.children[0];
    const receiverDefinition = receiver && receiver.kind === nodeKind_1.default.IDENTIFIER
        ? emitter.findDefInScope(receiver.text) : null;
    let receiverType = receiverDefinition && receiverDefinition.type
        || emitter.namespaces.receiverType(node);
    if (!receiverType && movieClipCastTarget(emitter, node_1.unwrapEncapsulatedExpression(receiver)))
        receiverType = 'flash.display.MovieClip';
    if (emitter.namespaces.lowerOpenedAccess(node, receiverType)) {
        emitNamespaceAccess(emitter, node);
        return;
    }
    emitter.namespaces.checkDot(node, receiverType);
    let dotSibling = node.nextSibling;
    let isConditionalCompilation = (dotSibling && dotSibling.kind === nodeKind_1.default.BLOCK);
    let template = "if ($1)";
    if (!isConditionalCompilation && node.parent.kind === nodeKind_1.default.CONDITION) {
        let separator = emitter.sourceBetween(node.children[0].end, node.children[0].end + 2);
        isConditionalCompilation = (separator === "::");
        template = "$1";
    }
    // wrap conditional compilation into Node.js conditional for
    // `process.env.VARIABLE`
    //
    // More info about Flex conditional compilation:
    // http://help.adobe.com/en_US/flex/using/WS2db454920e96a9e51e63e3d11c0bf69084-7abd.html
    if (isConditionalCompilation) {
        emitter.catchup(node.start);
        emitter.insert(template.replace("$1", `process.env.${node.children[1].text.toUpperCase()}`));
        emitter.skipTo(node.end);
        return;
    }
    else {
        // TODO: allow conditional compilation for function/class definitions
    }
    visitNodes(emitter, node.children);
}
function emitArraySortConstant(emitter, node) {
    const module = emitter.options.nativeArraySortModule;
    if (module === undefined || !node || node.kind !== nodeKind_1.default.DOT || node.children.length !== 2)
        return false;
    const receiver = node.children[0], name = node.children[1];
    const constants = ['CASEINSENSITIVE', 'DESCENDING', 'UNIQUESORT', 'RETURNINDEXEDARRAY', 'NUMERIC'];
    if (!receiver || receiver.kind !== nodeKind_1.default.IDENTIFIER || receiver.text !== 'Array'
        || emitter.findDefInScope('Array') || !name || name.kind !== nodeKind_1.default.LITERAL || constants.indexOf(name.text) < 0)
        return false;
    let helper = '__as3_AS3ArraySortOptions';
    while (emitter.source.indexOf(helper) >= 0)
        helper += '_';
    emitter.ensureImportIdentifier('AS3ArraySortOptions as ' + helper, module, false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);
    emitter.insert(helper + '.' + name.text);
    emitter.skipTo(node.end);
    return true;
}
function emitArrayAccessor(emitter, node) {
    if (emitCapabilitiesStaticRead(emitter, node) || emitDataEventData(emitter, node) || emitErrorEventSubtypeText(emitter, node))
        return;
    if (emitGeneratedArrayFieldRead(emitter, node))
        return;
    if (emitDictionaryProperty(emitter, node, 'as3GetProperty'))
        return;
    if (emitDynamicPropertyRead(emitter, node))
        return;
    if (emitObjectPropertyRead(emitter, node))
        return;
    emitter.catchup(node.start);
    visitNodes(emitter, node.children);
}
function emitXMLLiteral(emitter, node) {
    emitter.catchup(node.start);
    emitter.insert(JSON.stringify(node.text));
    emitter.skipTo(node.end);
}
function emitUnsupportedE4X(emitter, node) {
    throw new Error('AS3_E4X_UNSUPPORTED: descendant selectors require an authenticated native XML lowering');
}
function emitLiteral(emitter, node) {
    if (emitter.generated && node.text && node.text.charAt(0) === '/') {
        const plan = emitter.generated.options.plan, binding = plan.nativeBindings.find(b => b.qname === 'RegExp' && !b.nativeInterface);
        if (binding) {
            const match = /^\/([\s\S]*)\/([a-z]*)$/.exec(node.text);
            if (!match || emitter.source.slice(node.start, node.start + node.text.length) !== node.text)
                throw new Error('AS3_REGEXP_LITERAL_UNSUPPORTED: exact source token required');
            // Literals always denote the builtin, independently of local names.
            const token = propertyHelper(emitter, binding.referenceExport, emitter.generated.options.module);
            const construct = propertyHelper(emitter, 'as3ConstructClass', native_generated_emission_1.generatedModule(emitter.options.nativeObjectCreationModule));
            emitter.catchup(node.start);
            emitter.insert('(<any>' + construct + '(' + token + ',[' + JSON.stringify(match[1]) + ',' + JSON.stringify(match[2]) + ']))');
            emitter.skipTo(Math.max(node.end, node.start + node.text.length));
            return;
        }
    }
    emitter.catchup(node.start);
    // ECMAScript treats raw U+2028/U+2029 as source line terminators even
    // inside legacy string literals. AS3 permits those characters in strings,
    // so preserve the value while making the generated TypeScript parseable.
    const quote = node.text && node.text.charAt(0);
    const text = (quote === '"' || quote === "'") && node.text.charAt(node.text.length - 1) === quote
        ? node.text.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
        : node.text;
    emitter.insert(text);
    // The legacy parser's RegExp span ends at the closing slash, while its
    // literal text already includes flags. Consume the authenticated token
    // completely so the following catchup does not append the flags twice.
    const tokenEnd = quote === '/' && typeof node.text === 'string'
        && emitter.source.slice(node.start, node.start + node.text.length) === node.text
        ? Math.max(node.end, node.start + node.text.length) : node.end;
    emitter.skipTo(tokenEnd);
}
function emitArray(emitter, node) {
    emitter.catchup(node.start);
    // The Vector parser also uses ARRAY for its element list. That list is transport,
    // while any nested ARRAY expression is still a genuine source Array literal.
    const allocate = emitter.options.nativeArrayCreationModule !== undefined
        && (!node.parent || node.parent.kind !== nodeKind_1.default.SHORT_VECTOR);
    if (allocate) {
        let helper = '__as3_source_arrayLiteral';
        while (emitter.source.indexOf(helper) >= 0)
            helper += '_';
        emitter.ensureImportIdentifier('as3CreateArrayLiteral as ' + helper, emitter.options.nativeArrayCreationModule, false);
        emitter.nativeSourceHelpers.add(helper);
        // Keep the replacement an expression even when '[' touched return/throw/typeof.
        emitter.insert('(' + helper + '(');
    }
    emitter.insert('[');
    if (node.children.length > 0) {
        emitter.skip(1);
        // Preserve trivia; searching for whitespace can advance inside a comment.
        visitNodes(emitter, node.children);
        emitter.catchup(node.lastChild.end);
    }
    emitter.insert(']');
    if (allocate)
        emitter.insert('))');
    emitter.skipTo(node.end);
}
function emit(ast, source, options) {
    let emitter = new Emitter(source, options);
    return emitter.emit(ast);
}
exports.emit = emit;
//# sourceMappingURL=emitter.js.map