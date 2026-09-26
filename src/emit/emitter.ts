import {intrinsicStringAs} from './native-string-casts';
import {nativeLoaderReferenceNames,nativeSpriteOwnerReferenceNames,nativeSpriteValueReferenceNames} from './native-reference-coercion';
import {emitNativeXML, xmlGlobalProviderModule} from './native-xml';
import {NativeClassMetadataOptions} from './native-class-metadata';
import {nativeGeneratedDeclarationInputs} from './native-generated-declarations';
import {nativeSourceTypeIdentity} from './native-source-type';
import {insideTypeOf, sourceIdentifier, typeOfBinding} from './native-typeof';
import NodeKind, {nodeKindName} from '../syntax/nodeKind';
import * as Keywords from '../syntax/keywords';
import Node, {createNode, outerEncapsulatedExpression, unwrapEncapsulatedExpression} from '../syntax/node';
import assign = require('object-assign')
import {CustomVisitor} from "../custom-visitors"
import {VERBOSE_MASK, AS3_UTIL, INTERFACE_METHOD, INTERFACE_INF, WARNINGS, FOR_IN_KEY, FOR_IN_OBJ, INDENT} from '../config';
import ClassList, {ClassKind, ClassMember, ClassMemberKind, ClassRecord, ModifierKind, MODIFIERS} from "./classlist";
import {ReportFlags} from '../reports/report-flags';
import {NativeNamespaces} from './native-namespaces';
import {logicalAssignmentType} from './logical-assignment';
import {NativeClassInitializers, NativeClassInitializationOptions} from './native-class-initializers';
import {NativeCallableClasses, NativeCallableClassOptions} from './native-callable-classes';
import {NativeLexicalMembers} from './native-lexical-members';
import {NativeGlobalModules} from './native-global-modules';
import {NativeSourceAncestryPlan} from './native-source-ancestry';
import {NativeGeneratedClassTraits} from './native-generated-traits';
import {NativeGeneratedEmission, NativeGeneratedEmissionOptions, NativeClassHelperModules, generatedModule} from './native-generated-emission';
import {NativeReferenceCoercion, NativeReferenceCoercionOptions, ReferenceLocal} from './native-reference-coercion';

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

const TYPE_REMAP:{ [id:string]:string } = {
	'Class': 'any', // 80pro: was mapped to 'Object' before
	'Object': 'any',
	'String': 'string',
	'Boolean': 'boolean',
	'Number': 'number',
	'int': 'number',
	'uint': 'number',
	'*': 'any',
	'Array': 'any[]',
	'Dictionary': 'Object',// 80pro: was mapped to 'Map<any, any>' before

	// Inexistent errors
	'ArgumentError': 'Error',
	'DefinitionError': 'Error',
	'SecurityError': 'Error',
	'VerifyError': 'Error'
}

// TODO: improve me (used only on emitType())
const TYPE_REMAP_VALUES = ['void'];
for (var k in TYPE_REMAP) {
	TYPE_REMAP_VALUES.push(TYPE_REMAP[k]);
}

const IDENTIFIER_REMAP:{ [id:string]:string } = {
	'Dictionary': 'Map<any, any>',

	// Inexistent errors
	'ArgumentError': 'Error',
	'DefinitionError': 'Error',
	'SecurityError': 'Error',
	'VerifyError': 'Error',
	'getDefinitionByName': 'AS3Utils.getDefinitionByName'
}

interface Scope {
	parent:Scope;
	declarations:Declaration[];
	className?:string;
}

/*class Scope {
	public parent:Scope;
	public declarations:Declaration[];
	public className:string;
}

class Declaration {
	public name:string;
	public type:string;
	public bound:string;
}*/


interface Declaration {
	name:string;
	type?:string;
	/** The source AS3 type before TypeScript remapping (for example int/uint). */
	as3Type?:string;
	bound?:string;
	/** Exact AS3 import that introduced this binding, when it is an import. */
	sourceImport?:string;
}



export interface EmitterOptions {
	lineSeparator:string;
	useNamespaces:boolean;
	customVisitors:CustomVisitor[];
	/** Authenticated AS3 QName -> generated module path bindings for bulk emission. */
	importModules?:{[qname:string]:string};
	/** Explicit generated helper modules, independent of the legacy CLI scan table. */
	decoratorModules?: {bound: string; classBound: string};
	definitionsByNamespace?:{[ns:string]:string[]};
	/** Expand SDK wildcard imports only for names referenced by this source file. */
	nativeReferencedWildcardImports?: boolean;
	/** Exact imported AS3 namespace QName -> URI identities, supplied by source discovery. */
	namespaceUris?:{[qname:string]:string};
	nativeClassInitialization?: NativeClassInitializationOptions;
	nativeCallableClasses?: NativeCallableClassOptions;
	/** Common Laya AS3MethodBinding module; required by callable source emission. */
	nativeCallableMethodBindingModule?: string;
	/** Common Laya AS3Coercion module; required for callable numeric constructor parameters. */
	nativeCallableCoercionModule?: string;
	/** Common Laya AS3String module; required for callable String constructor parameters. */
	nativeCallableStringModule?: string;
	nativeCallableMetadata?: NativeClassMetadataOptions;
    /** Common source-generated registrar; paired with an exact declaration plan. */
    nativeClassTraitsModule?: string;
    nativeGeneratedDeclarations?: NativeGeneratedEmissionOptions;
    /** Exact declaration plan for native Vector annotations, including interfaces. */
    nativeVectorTypes?: NativeGeneratedEmissionOptions;
    nativeReferenceCoercion?: NativeReferenceCoercionOptions;
    /** Common AS3Property scalar coercion for mixed reference method signatures. */
    nativeSignaturePropertyModule?: string;
    /** Common AS3String typed local storage; requires an exact reference consumer plan. */
    nativeStringLocalCoercionModule?: string;
    /** Common String intrinsic provider for source-bound local String calls. */
    nativeStringIntrinsicsModule?: string;
    /** Explicit distributed helper modules for generated lazy native classes. */
    nativeClassHelperModules?: NativeClassHelperModules;
    /** Common AS3Property coercion for generated method signatures. */
    nativeGeneratedPropertyModule?: string;
    nativeLexicalMembersModule?: string;
    nativeTypedLocals?: boolean;
    /** Explicit common AS3Type provider for generated typed Array locals. */
    nativeTypedLocalReferenceModule?: string;
    nativeTypedLocalAdditionModule?: string;
    /** Explicit common AS3Relational module for authenticated source comparisons. */
    nativeRelationalModule?: string;
	/** Explicit common AS3ArrayCreation module for source Array literals only. */
	nativeArrayCreationModule?: string;
	/** Common reflection query module for literal describeType E4X counts. */
	nativeReflectionQueryModule?: string;
	/** Common XML reflection module for authenticated describeType XML access. */
	nativeReflectionXMLModule?: string;
    nativeXMLModule?: string;
    /** Canonical Point reference provider for generated typed returns only. */
    nativePointReferenceModule?: string;
    /** Canonical TextField reference provider for generated typed returns. */
    nativeTextFieldReferenceModule?: string;
    nativeDisplayObjectReferenceModule?: string;
    nativeMovieClipReferenceModule?: string;
    nativeTextFormatReferenceModule?: string;
    nativeInteractiveObjectReferenceModule?: string;
    nativeByteArrayReferenceModule?: string;
    /** Closed AccessibilityImplementation nominal reference provider; no subclass admission. */
    nativeAccessibilityReferenceModule?: string;
    /** Closed Transform, SoundTransform, AccessibilityProperties and TextSnapshot references. */
    nativeSpriteValueReferenceModule?: string;
    nativeSpriteOwnerReferenceModule?: string;
    /** Closed Loader, Bitmap, URLLoader and Sound references; no native Class ancestry. */
    nativeLoaderReferenceModule?: string;
	/** Builtin AS3 global names and their authenticated common modules. */
	nativeGlobalModules?:{[name:string]:string};
	/** Authenticated common flash.utils.Proxy module. */
	nativeProxyModule?:string;
	/** Authenticated common source Error construction module. */
	nativeSourceErrorModule?:string;
	/** Authenticated common numeric parameter coercion module. */
	nativeNumericMethodParametersModule?:string;
	/** Authenticated common AS3Type module for expression-valued `is` targets. */
	nativeComputedTypeTestModule?:string;
	/** Exact common Class is/as operations, independent of callable class emission. */
	nativeClassTypeOperationsModule?:string;
    /** Common construction of source Object/Function values. */
    nativeDynamicConstructionModule?:string;
	/** Authenticated common AS3String module for direct no-argument toString calls. */
	nativeDirectToStringModule?:string;
	/** Authenticated common AS3String module for explicit builtin String(value). */
	nativeStringCoercionModule?:string;
	/** Authenticated common AS3Class module for Object creation and generated Class storage/construction. */
	nativeObjectCreationModule?:string;
	/** Authenticated common AS3Property module for SDK Dictionary property access. */
	nativeDictionaryPropertyModule?:string;
	/** Authenticated common AS3Property module for typed dynamic indexed writes. */
	nativeDynamicPropertyWritesModule?:string;
    /** Common AS3Property module for source Object/wildcard indexed reads. */
    nativeDynamicPropertyReadsModule?:string;
    /** Common AS3Property module for public paths rooted in Object/wildcard locals. */
    nativeObjectPropertyModule?:string;
    /** Common source JSON text parser; JSON Class identity is separate. */
    nativeJSONModule?:string;
	/** Authenticated common AS3ArraySort module for source Array.sortOn calls. */
	nativeArraySortModule?:string;
	/** Authenticated source enumeration providers; currently Dictionary-only. */
	nativeEnumeration?:{dictionaryModule?:string; coercionModule?:string; stringModule?:string};
	/** Authenticated modern GSAP migration runtime module. */
	nativeTweenModule?:string;
	/** Source-authenticated tween call spans for migration-specific plans. */
	nativeTweenSourcePlans?:{source:string; calls:ReadonlyArray<{start:number; end:number; callSha256?:string}>};
	/** Complete source-backed class ancestry for scoped multi-file emission. */
	nativeSourceAncestry?: NativeSourceAncestryPlan;
}


interface NodeVisitor {
	(emitter:Emitter, node:Node):void;
}


const VISITORS:{[kind:number]:NodeVisitor} = {
    [NodeKind.REST]: (emitter,node)=>{
        emitter.catchup(node.start);emitter.insert('...'+node.text+': any[]');emitter.skipTo(node.end);
    },
	[NodeKind.RETURN]: emitReferenceReturn,
    [NodeKind.TYPEOF]: emitLocalTypeOf,
	[NodeKind.PACKAGE]: emitPackage,
	[NodeKind.META]: emitMeta,
	[NodeKind.IMPORT]: emitImport,
	[NodeKind.EMBED]: emitEmbed,
	[NodeKind.USE]: emitUse,
	[NodeKind.NAMESPACE_DECLARATION]: emitNamespaceDeclaration,
	[NodeKind.NAMESPACE_ACCESS]: emitNamespaceAccess,
	[NodeKind.NAME]: emitName,
	[NodeKind.FUNCTION]: emitFunction,
	[NodeKind.LAMBDA]: emitFunction,
	[NodeKind.FOREACH]: emitForEach,
	[NodeKind.FORIN]: emitForIn,
	[NodeKind.INTERFACE]: emitInterface,
	[NodeKind.CLASS]: emitClass,
	[NodeKind.CLASS_INITIALIZER]: emitClassInitializer,
	[NodeKind.VECTOR]: emitVector,
	[NodeKind.SHORT_VECTOR]: emitShortVector,
	[NodeKind.TYPE]: emitType,
	[NodeKind.CALL]: emitCall,
	[NodeKind.LABEL]: emitStatementLabel,
	[NodeKind.BREAK]: emitStatementJump,
	[NodeKind.CONTINUE]: emitStatementJump,
	[NodeKind.CATCH]: emitCatch,
	[NodeKind.NEW]: emitNew,
	[NodeKind.RELATION]: emitRelation,
	[NodeKind.ASSIGN]: emitAssign,
	[NodeKind.PRE_INC]: emitNamespaceUpdate,
	[NodeKind.POST_INC]: emitNamespaceUpdate,
	[NodeKind.PRE_DEC]: emitNamespaceUpdate,
	[NodeKind.POST_DEC]: emitNamespaceUpdate,
	[NodeKind.DELETE]: emitDelete,
    [NodeKind.ADD]: emitAdd,
	[NodeKind.INIT]: emitInit,
	[NodeKind.OP]: emitOp,
	[NodeKind.OR]: emitOr,
	[NodeKind.IDENTIFIER]: emitIdent,
	[NodeKind.XML_LITERAL]: emitXMLLiteral,
	[NodeKind.E4X_DESCENDANT]: emitUnsupportedE4X,
	[NodeKind.CONST_LIST]: emitConstList,
	[NodeKind.NAME_TYPE_INIT]: emitNameTypeInit,
	[NodeKind.VALUE]: emitObjectValue,
	[NodeKind.OBJECT]: emitObjectLiteral,
	[NodeKind.DOT]: emitDot,
	[NodeKind.ARRAY_ACCESSOR]: emitArrayAccessor,
	[NodeKind.LITERAL]: emitLiteral,
	[NodeKind.ARRAY]: emitArray,
	[NodeKind.BLOCK]: emitBlock,
	[NodeKind.MINUS]: emitMinus,
	//[NodeKind.PARAMETER_LIST]: emitParametersList
};


export function visitNodes(emitter:Emitter, nodes:Node[]):void {
	if (nodes) {
		nodes.forEach(node => visitNode(emitter, node));
	}
}


export function visitNode(emitter:Emitter, node:Node):void {

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

	if (emitNativeXML(emitter,node,visitNode)) return;
	if (emitter.lexical && emitter.lexical.emit(emitter, node, visitNode)) return;
    if (emitter.generated && emitter.generated.lexical.emit(emitter,node,visitNode)) return;

	let visitor = VISITORS[node.kind] || function (emitter:Emitter, node:Node):void {
			emitter.catchup(node.start);
			visitNodes(emitter, node.children);
		};

	//if(VERBOSE >= 2 && VISITORS[node.kind]) {
	if ((VERBOSE_MASK & ReportFlags.NODES_TREE) == ReportFlags.NODES_TREE && VISITORS[node.kind]) {
		console.log("visit:" + VISITORS[node.kind].name + "() <=====================================");
		console.log("node: " + node.toString());
	}

	visitor(emitter, node);

}

function filterAST(node:Node):Node {

	function isInteresting(child:Node):boolean {
		// we don't care about comment
		return !!child && child.kind !== NodeKind.AS_DOC && child.kind !== NodeKind.MULTI_LINE_COMMENT;
	}

	let newNode = createNode(
		node.kind,
		node,
		... node.children.filter(isInteresting).map(filterAST));

	newNode.children.forEach(child => child.parent = newNode);

	return newNode;
}


export default class Emitter {
    sourcePackage: string = '';
    generated: NativeGeneratedEmission;
    generatedReceiverTraits = new Map<string,NativeGeneratedClassTraits>();
    references: NativeReferenceCoercion;
    nativeGlobals:NativeGlobalModules;
    lexical: NativeLexicalMembers;
    get typedLocalPlan() {return this.generated ? this.generated.lexical.typedLocals : this.lexical && this.lexical.typedLocals;}
    /** Exact compiler-created callable imports; authored imports grant no exemption. */
    public nativeSourceHelpers = new Set<string>();
	public isNew:boolean = false;
	public isExtended:boolean = false;
	public skipNewLines:boolean = false;
	public loopObjectCounter:number = 0;
	/** Label held while a lowering inserts a wrapper around the labelled loop. */
	public pendingStatementLabel:string = null;

	private _emitThisForNextIdent:boolean = true;
	get emitThisForNextIdent():boolean {
		return this._emitThisForNextIdent;
	}

	set emitThisForNextIdent(val:boolean) {
		this._emitThisForNextIdent = val;
	}

	public source:string;
	public namespaces:NativeNamespaces;
	public options:EmitterOptions;

	public headOutput:string = "";

	public output:string = '';
	public logicalAssignmentTemps = new Map<Node, string[]>();
	public classInitializers: NativeClassInitializers;
	public classFactory: {node: Node; value: string; fields: string[]; statements: string[]} = null;
	public proxyClass = false;
	public index:number = 0;

/*	public rootScope:Scope = null;
	public scope:Scope = null;*/

	get scope(): Scope {
		return this._scope;
	}

	set scope(value: Scope) {
		this._scope = value;
	}
	private _scope:Scope;

	get rootScope(): Scope {
		return this._rootScope;
	}

	set rootScope(value: Scope) {
		this._rootScope = value;
	}

	private _rootScope:Scope;


	constructor(source:string, options?:EmitterOptions) {
		this.source = source;
		this.options = assign({
			includePath: "",
			lineSeparator: '\n',
			useNamespaces: false,
			customVisitors: []
		}, options || {});
	}

	emit(ast:Node):string {

        if (this.options.nativeGeneratedDeclarations !== undefined || this.options.nativeClassTraitsModule !== undefined) {
            if (this.options.useNamespaces || this.options.customVisitors.length || this.options.nativeCallableMetadata
                || this.options.nativeCallableClasses || this.options.nativeClassInitialization)
                throw new Error('AS3_GENERATED_EMISSION_UNSUPPORTED: generated declarations own the exact callable/initialization plan');
            this.generated = new NativeGeneratedEmission(this.source,this.options.nativeGeneratedDeclarations,
                this.options.nativeClassTraitsModule,this.options.nativeClassHelperModules,
                this.options.nativeLexicalMembersModule,this.options.nativeGeneratedPropertyModule,this.options.nativeTypedLocals === true);
            if(this.generated.projection.metadata.isDynamic) {
                generatedModule(this.options.nativeDynamicPropertyReadsModule);
                generatedModule(this.options.nativeDynamicPropertyWritesModule);
            }
            if(this.options.nativeTypedLocals)generatedModule(this.options.nativeTypedLocalReferenceModule);
            generatedModule(this.options.nativeCallableMethodBindingModule);
            this.options.nativeCallableClasses = this.generated.sources;
            this.options.nativeClassInitialization = {classes:this.generated.classes};
            // A caller-supplied/mutated AST must not override the authenticated bytes.
            ast = require('../parse')(this.generated.projection.binding.qname + '.as',this.source);
        }

        for (const [qname, moduleOption] of [['flash.display.DisplayObject',this.options.nativeDisplayObjectReferenceModule],['flash.display.MovieClip',this.options.nativeMovieClipReferenceModule],['flash.text.TextFormat',this.options.nativeTextFormatReferenceModule],['flash.display.InteractiveObject',this.options.nativeInteractiveObjectReferenceModule]]) if (moduleOption !== undefined) {
            const name=qname.split('.').pop();
            const module=generatedModule(moduleOption);
            const reference=this.options.nativeReferenceCoercion;
            if(!reference)
                throw new Error('AS3_DISPLAY_REFERENCE_UNSUPPORTED: authenticated reference plan required');
            const inputs=nativeGeneratedDeclarationInputs(reference.plan,reference.plan.scope);
            const provider=inputs.providers&&inputs.providers[qname];
            if(!provider||provider.exportName!==name
                ||xmlGlobalProviderModule(provider.module,reference.module)!==module
                ||!this.options.importModules||this.options.importModules[qname]!==module)
                throw new Error('AS3_DISPLAY_REFERENCE_UNSUPPORTED: exact native display provider binding required');
        }
        if (this.options.nativePointReferenceModule !== undefined) {
            const module=generatedModule(this.options.nativePointReferenceModule),reference=this.options.nativeReferenceCoercion;
            if(!this.generated||!reference)throw new Error('AS3_POINT_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs=nativeGeneratedDeclarationInputs(reference.plan,reference.plan.scope);
            const provider=inputs.providers&&inputs.providers['flash.geom.Point'];
            if(!provider||provider.exportName!=='Point'||provider.nativeBase||provider.nativeInterface
                ||xmlGlobalProviderModule(provider.module,reference.module)!==module
                ||!this.options.importModules||this.options.importModules['flash.geom.Point']!==module)
                throw new Error('AS3_POINT_REFERENCE_UNSUPPORTED: exact native Point provider binding required');
        }
        if (this.options.nativeTextFieldReferenceModule !== undefined) {
            const module=generatedModule(this.options.nativeTextFieldReferenceModule),reference=this.options.nativeReferenceCoercion;
            if(!this.generated||!reference)throw new Error('AS3_TEXTFIELD_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs=nativeGeneratedDeclarationInputs(reference.plan,reference.plan.scope);
            const provider=inputs.providers&&inputs.providers['flash.text.TextField'];
            if(!provider||provider.exportName!=='TextField'||provider.nativeBase||provider.nativeInterface
                ||xmlGlobalProviderModule(provider.module,reference.module)!==module
                ||!this.options.importModules||this.options.importModules['flash.text.TextField']!==module)
                throw new Error('AS3_TEXTFIELD_REFERENCE_UNSUPPORTED: exact native TextField provider binding required');
        }
        if (this.options.nativeSpriteValueReferenceModule !== undefined) {
            const module=generatedModule(this.options.nativeSpriteValueReferenceModule),reference=this.options.nativeReferenceCoercion;
            if(!this.generated||!reference)throw new Error('AS3_SPRITE_VALUE_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs=nativeGeneratedDeclarationInputs(reference.plan,reference.plan.scope);
            const names=nativeSpriteValueReferenceNames.filter(name=>inputs.providers&&inputs.providers[name]);
            if(!names.length)throw new Error('AS3_SPRITE_VALUE_REFERENCE_UNSUPPORTED: native value provider required');
            for(const name of names){
                const provider=inputs.providers[name];
                if(provider.exportName!==name.split('.').pop()||provider.nativeBase||provider.nativeInterface
                    ||xmlGlobalProviderModule(provider.module,reference.module)!==module
                    ||!this.options.importModules||this.options.importModules[name]!==module)
                    throw new Error('AS3_SPRITE_VALUE_REFERENCE_UNSUPPORTED: exact native provider binding required');
            }
        }
        if (this.options.nativeSpriteOwnerReferenceModule !== undefined) {
            const module=generatedModule(this.options.nativeSpriteOwnerReferenceModule),reference=this.options.nativeReferenceCoercion;
            if(!this.generated||!reference)throw new Error('AS3_SPRITE_OWNER_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs=nativeGeneratedDeclarationInputs(reference.plan,reference.plan.scope);
            const names=nativeSpriteOwnerReferenceNames.filter(name=>inputs.providers&&inputs.providers[name]);
            if(!names.length)throw new Error('AS3_SPRITE_OWNER_REFERENCE_UNSUPPORTED: native value provider required');
            for(const name of names){
                const provider=inputs.providers[name];
                if(provider.exportName!==name.split('.').pop()||provider.nativeBase||provider.nativeInterface
                    ||xmlGlobalProviderModule(provider.module,reference.module)!==module
                    ||!this.options.importModules||this.options.importModules[name]!==module)
                    throw new Error('AS3_SPRITE_OWNER_REFERENCE_UNSUPPORTED: exact native provider binding required');
            }
        }
        if (this.options.nativeLoaderReferenceModule !== undefined) {
            const module=generatedModule(this.options.nativeLoaderReferenceModule),reference=this.options.nativeReferenceCoercion;
            if(!this.generated||!reference||!this.options.nativeComputedTypeTestModule)throw new Error('AS3_LOADER_REFERENCE_UNSUPPORTED: generated declaration/reference plan and type-test module required');
            const inputs=nativeGeneratedDeclarationInputs(reference.plan,reference.plan.scope);
            const names=nativeLoaderReferenceNames.filter(name=>inputs.providers&&inputs.providers[name]);
            if(!names.length)throw new Error('AS3_LOADER_REFERENCE_UNSUPPORTED: native value provider required');
            for(const name of names){
                const provider=inputs.providers[name];
                if(provider.exportName!==name.split('.').pop()||provider.nativeBase||provider.nativeInterface
                    ||xmlGlobalProviderModule(provider.module,reference.module)!==module
                    ||!this.options.importModules||this.options.importModules[name]!==module)
                    throw new Error('AS3_LOADER_REFERENCE_UNSUPPORTED: exact native provider binding required');
            }
        }
        if (this.options.nativeAccessibilityReferenceModule !== undefined) {
            const module=generatedModule(this.options.nativeAccessibilityReferenceModule),reference=this.options.nativeReferenceCoercion;
            if(!this.generated||!reference)throw new Error('AS3_ACCESSIBILITY_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs=nativeGeneratedDeclarationInputs(reference.plan,reference.plan.scope);
            const provider=inputs.providers&&inputs.providers['flash.accessibility.AccessibilityImplementation'];
            if(!provider||provider.exportName!=='AccessibilityImplementation'||provider.nativeBase||provider.nativeInterface
                ||xmlGlobalProviderModule(provider.module,reference.module)!==module
                ||!this.options.importModules||this.options.importModules['flash.accessibility.AccessibilityImplementation']!==module)
                throw new Error('AS3_ACCESSIBILITY_REFERENCE_UNSUPPORTED: exact native provider binding required');
        }
        if (this.options.nativeByteArrayReferenceModule !== undefined) {
            const module=generatedModule(this.options.nativeByteArrayReferenceModule);
            if(!this.generated||!this.options.nativeReferenceCoercion)
                throw new Error('AS3_BYTEARRAY_REFERENCE_UNSUPPORTED: generated declaration/reference plan required');
            const inputs=nativeGeneratedDeclarationInputs(this.generated.options.plan,this.generated.options.plan.scope);
            const provider=inputs.providers&&inputs.providers['flash.utils.ByteArray'];
            if(!provider||provider.exportName!=='ByteArray'||provider.nativeBase||provider.nativeInterface
                ||xmlGlobalProviderModule(provider.module,this.generated.options.module)!==module
                ||!this.options.importModules||this.options.importModules['flash.utils.ByteArray']!==module)
                throw new Error('AS3_BYTEARRAY_REFERENCE_UNSUPPORTED: exact ByteArray provider binding required');
        }
        if (this.options.nativeXMLModule !== undefined) {
            generatedModule(this.options.nativeXMLModule);
            if (!this.generated || !this.options.nativeReferenceCoercion)
                throw new Error('AS3_XML_UNSUPPORTED: generated declaration/reference plan required');
            const inputs=nativeGeneratedDeclarationInputs(this.generated.options.plan,this.generated.options.plan.scope);
            for (const name of ['XML','XMLList']) {
                const provider=inputs.providers && inputs.providers[name];
                if (!provider || provider.exportName!==name || !this.options.nativeGlobalModules
                    || this.options.nativeGlobalModules[name]!==xmlGlobalProviderModule(provider.module,this.generated.options.module))
                    throw new Error('AS3_XML_UNSUPPORTED: exact XML/XMLList provider bindings required');
            }
        }
        if (this.options.nativeReferenceCoercion !== undefined) {
            if (this.options.useNamespaces || this.options.customVisitors.length || this.options.nativeTypedLocals && !this.generated)
                throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: exact source without conflicting transforms required');
            if (this.generated && (this.options.nativeReferenceCoercion.plan !== this.generated.options.plan
                || this.options.nativeReferenceCoercion.module !== this.generated.options.module))
                throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: generated and consumer domain must agree');
            this.references = new NativeReferenceCoercion(this.source,this.options.nativeReferenceCoercion,!!this.generated,
                !!(this.options.nativeGlobalModules && this.options.nativeGlobalModules.Date),
                this.options.nativeStringLocalCoercionModule !== undefined,!!(this.generated && this.generated.nativeBase && this.generated.nativeBase.qname==='flash.events.Event'),
                this.options.nativeXMLModule ? ['XML','XMLList'].filter(name => this.options.nativeGlobalModules && this.options.nativeGlobalModules[name]) : [],
                this.options.nativeDisplayObjectReferenceModule!==undefined,this.options.nativeByteArrayReferenceModule!==undefined,this.options.nativeMovieClipReferenceModule!==undefined,this.options.nativeTextFormatReferenceModule!==undefined,this.options.nativeInteractiveObjectReferenceModule!==undefined,this.options.nativeAccessibilityReferenceModule!==undefined,this.options.nativeSpriteValueReferenceModule!==undefined,this.options.nativeSpriteOwnerReferenceModule!==undefined,this.options.nativeLoaderReferenceModule!==undefined);
            generatedModule(this.options.nativeClassHelperModules && this.options.nativeClassHelperModules.nativeClass);
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
		if ((VERBOSE_MASK & ReportFlags.KEY_POINTS) == ReportFlags.KEY_POINTS) {
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
            generatedModule(this.options.nativeStringLocalCoercionModule);
            if (!this.references) throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: String locals require exact reference consumer plan');
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
            const module = generatedModule(this.options.nativeDynamicConstructionModule);
            if (this.options.useNamespaces || !this.options.importModules
                || this.options.importModules['compiler.AS3Invocation'] !== module)
                throw new Error('AS3_DYNAMIC_CONSTRUCTION_UNSUPPORTED: exact invocation module binding required');
        }
        if (this.options.nativeClassTypeOperationsModule !== undefined) {
            const module = generatedModule(this.options.nativeClassTypeOperationsModule);
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
            generatedModule(this.options.nativeJSONModule);
            if(this.options.importModules && this.options.importModules['compiler.AS3JSON']
                && this.options.importModules['compiler.AS3JSON']!==this.options.nativeJSONModule)
                throw new Error('AS3_JSON_UNSUPPORTED: common JSON provider binding disagrees');
        }
        if (this.options.nativeObjectPropertyModule !== undefined) {
            generatedModule(this.options.nativeObjectPropertyModule);
            if(this.options.useNamespaces || !this.options.importModules
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
		if (this.options.nativeTweenModule !== undefined) {
			const module = this.options.nativeTweenModule;
			if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
				throw new Error('AS3_TWEEN_UNSUPPORTED: explicit FlashTweenRuntime module required');
			if (this.options.importModules && this.options.importModules['migration.FlashTweenRuntime']
				&& this.options.importModules['migration.FlashTweenRuntime'] !== module)
				throw new Error('AS3_TWEEN_UNSUPPORTED: FlashTweenRuntime import binding disagrees with nativeTweenModule');
			if (this.options.nativeTweenSourcePlans !== undefined) {
				const plan = this.options.nativeTweenSourcePlans;
				if (!plan || typeof plan.source !== 'string' || !Array.isArray(plan.calls))
					throw new Error('AS3_TWEEN_UNSUPPORTED: invalid authenticated source plan');
				for (const call of plan.calls)
					if (!call || !Number.isSafeInteger(call.start) || !Number.isSafeInteger(call.end) || call.start < 0 || call.end <= call.start)
						throw new Error('AS3_TWEEN_UNSUPPORTED: invalid authenticated call span');
			}
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
		const filtered = filterAST(ast);
        this.nativeGlobals = new NativeGlobalModules(this.source, this.options.nativeGlobalModules,
            this.options.definitionsByNamespace, this.options.useNamespaces);
        if (this.options.nativeTypedLocals && !this.options.nativeLexicalMembersModule)
            throw new Error('AS3_TYPED_LOCAL_UNSUPPORTED: authenticated lexical source required');
        if (this.options.nativeTypedLocals && [this.options.nativeCallableCoercionModule,this.options.nativeCallableStringModule,this.options.nativeTypedLocalAdditionModule]
            .some(module => typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module)))
            throw new Error('AS3_TYPED_LOCAL_UNSUPPORTED: explicit common coercion, String and addition modules required');
        if (this.options.nativeLexicalMembersModule !== undefined && !this.generated) {
            if (!this.options.nativeCallableClasses || !this.options.nativeClassInitialization || this.options.useNamespaces)
                throw new Error('AS3_LEXICAL_COMPILER_UNSUPPORTED: authenticated lazy callable source required');
            this.lexical = new NativeLexicalMembers(this.source, filtered, this.options.nativeLexicalMembersModule, this.options.nativeCallableMetadata, this.options.nativeTypedLocals === true);
        }
		this.namespaces = new NativeNamespaces(filtered, this.source, this.options.namespaceUris,
			this.options.nativeProxyModule !== undefined, this.options.nativeSourceAncestry);
		this.classInitializers = new NativeClassInitializers(filtered, this.source, this.options.nativeClassInitialization,
            node=>{
                const value=outerEncapsulatedExpression(node),parent=value.parent;
                return !!(parent&&parent.kind===NodeKind.DOT&&parent.children[0]===value
                    &&(lexicalApplicationDomainModule(this,parent)||qualifiedNativeStaticRead(this,parent)));
            });
		this.withScope([], (rootScope) => {
			this.rootScope = rootScope;
			visitNode(this, filtered);
			this.catchup(this.source.length);
		});
		this.output = this.output.replace(/\s([^\n])\s*?=>/gm, " =>");//TODO hotfix. To remove new lines between arrow operator nad {
		if (this.logicalAssignmentTemps.size)
			throw new Error('AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED: receiver capture scope was not emitted');
		return new NativeCallableClasses(this.source, this.options.nativeCallableClasses,
			this.options.nativeClassInitialization && this.options.nativeClassInitialization.classes,
			this.options.nativeCallableMethodBindingModule, this.options.nativeCallableCoercionModule, this.options.nativeCallableMetadata, this.nativeSourceHelpers, this.options.nativeCallableStringModule, this.lexical, this.options.nativeTypedLocalAdditionModule, this.generated, this.options.nativeTypedLocalReferenceModule, this.options.nativeObjectCreationModule, this.options.nativeSourceErrorModule, this.options.nativeDisplayObjectReferenceModule!==undefined, !!(this.options.nativeGlobalModules&&this.options.nativeGlobalModules.Date), this.options.nativeByteArrayReferenceModule!==undefined,this.options.nativeMovieClipReferenceModule!==undefined,this.options.nativeTextFormatReferenceModule!==undefined,this.options.nativeInteractiveObjectReferenceModule!==undefined,this.options.nativeAccessibilityReferenceModule!==undefined,this.options.nativeSpriteValueReferenceModule!==undefined,this.options.nativeSpriteOwnerReferenceModule!==undefined,this.options.nativeLoaderReferenceModule!==undefined,this.options.nativeXMLModule!==undefined,this.options.nativePointReferenceModule!==undefined,this.options.nativeTextFieldReferenceModule!==undefined)
			.lower(this.headOutput + this.namespaces.keyDeclarations() + this.output);
	}

	enterScope(declarations:Declaration[]):Scope {
		return this.scope = {parent: this.scope, declarations};
	}

	exitScope(checkScope:Scope = null):void {
		if (checkScope && this.scope !== checkScope) {
			throw new Error('Mismatched enterScope() / exitScope().');
		}
		if (!this.scope) {
			throw new Error('Unmatched exitScope().');
		}
		this.scope = this.scope.parent;
	}

	withScope(declarations:Declaration[], body:(scope:Scope) => void):void {
		let scope = this.enterScope(declarations);
		try {
			body(scope);
		} finally {
			this.exitScope(scope);
		}
	}

	get currentClassName():string {
		for (var scope = this.scope; scope; scope = scope.parent) {
			if (scope.className) {
				return scope.className;
			}
		}
		return null;
	}

	declareInScope(declaration:Declaration):void {
		let previousDeclaration:Declaration = null;
		for (var i = 0, len = this.scope.declarations.length; i < len; i++) {
			if (this.scope.declarations[i].name === declaration.name) {
				previousDeclaration = this.scope.declarations[i];
			}
		}

		if (previousDeclaration) {
			if (declaration.type !== undefined) previousDeclaration.type = declaration.type;
			if (declaration.as3Type !== undefined) previousDeclaration.as3Type = declaration.as3Type;
			if (declaration.bound !== undefined) previousDeclaration.bound = declaration.bound;
		} else {
			this.scope.declarations.push(declaration);
		}
	}


	findDefInScope(text:string):Declaration {
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

	commentNode(node:Node, catchSemi:boolean):void {
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

	catchup(index:number):void {
		if (this.index >= index) {
			return;
		}
		let text = this.sourceBetween(this.index, index);
		this.index = index;
		this.insert(text);
	}
	setIndexPos(index:number):void {
		this.index = index;

	}

	sourceBetween(start:number, end:number) {
		return this.source.substring(start, end);
	}

	skipTo(index:number):void {
		this.index = index;
	}

	getIndex():number {
		return this.index;
	}

	skip(number:number):void {
		this.index += number;
	}

	insert(str:string):void {
		this.output += str;

		// Debug util (comment out on production).
		// let split = this.output.split(" ");
		// let lastWord = split[split.length - 1];
		// console.log("    emitter.ts - output += " + lastWord);
		// process.stdout.write(" " + lastWord);
		// console.log("+++++++++ " + (string.indexOf("for(") !== -1));
		//if(VERBOSE >= 2 ) {
		if ((VERBOSE_MASK & ReportFlags.TRANSPILED_CODE) == ReportFlags.TRANSPILED_CODE) {
			console.log("output (all): " + this.output);
			// let a = 1; // insert breakpoint here
		}
	}

	consume(string:string, limit:number):void {
		let index = this.source.indexOf(string, this.index) + string.length;
		if (index > limit || index < this.index) {
			throw new Error('invalid consume');
		}
		this.index = index;
	}
	consumeRegExp(reg:RegExp, limit:number):void {
		let matches = this.source.slice(this.index).match(reg);
		if (!matches || matches.length < 1) return;
		let matchStr = matches[0];
		let index = this.source.indexOf(matchStr, this.index) + matchStr.length;
		if (index > limit || index < this.index) return
		this.index = index;
	}

	/**
	 * Utilities
	 */
	ensureImportIdentifier(identifier:string, from = `./${identifier}`, checkGlobals:boolean = true):void {
		// The enclosing source declaration is local even when its name is followed
		// by a newline/comment instead of the legacy textual space match below.
		if (identifier === this.currentClassName) return;
		if (identifier == "number" || identifier == "number[]"
			|| identifier == "any" || identifier == "any[]"
			|| identifier == "boolean" || identifier == "boolean[]"
			|| identifier == "string" || identifier == "string[]"
			|| identifier == "Array")
			return;

		// warning if this is a as3-path, not a plain name (like shared.Node should error)
		if (WARNINGS >= 1 && identifier.split(".").length > 1) {
			console.log(`emitter.ts: *** MAJOR WARNING *** ensureImportIdentifier() => : invalid object name identifier: ${ identifier })`)
		}

		let isGloballyAvailable = checkGlobals
			? GLOBAL_NAMES.indexOf(identifier) >= 0
			: false;

		// change to root scope temporarily
		let previousScope = this.scope;
		this.scope = this.rootScope;

		// Ensure this file is not declaring this class
		if (
			this.source.indexOf(`class ${ identifier } `) === -1 && !isGloballyAvailable && !this.findDefInScope(identifier)
		) {
			// Same-package implicit imports must use the authenticated QName mapping too.
			if (checkGlobals && from === `./${identifier}` && this.options.importModules) {
				const qname = this.generated ? this.generated.lexical.resolveTypeName(identifier)
                    : (this.sourcePackage ? this.sourcePackage + '.' : '') + identifier;
				if (this.options.importModules[qname]) from = generatedModule(this.options.importModules[qname]);
			}
			this.headOutput += `import { ${ identifier } } from "${ from }";\n`;
			this.declareInScope({name: identifier});
		}

		// change back to previous scope
		this.scope = previousScope;
	}

	getTypeRemap(text:string):string {
		for (let i = 0, l = this.options.customVisitors.length; i < l; i++) {
			let customVisitor = this.options.customVisitors[i];
			if (customVisitor.typeMap && customVisitor.typeMap[text]) {
				return customVisitor.typeMap[text];
			}
		}
		return TYPE_REMAP[text];
	}

	getIdentifierRemap(text:string):string {
		for (let i = 0, l = this.options.customVisitors.length; i < l; i++) {
			let customVisitor = this.options.customVisitors[i];
			if (customVisitor.identifierMap && customVisitor.identifierMap[text]) {
				return customVisitor.identifierMap[text];
			}
		}
		return IDENTIFIER_REMAP[text];
	}

}


function emitPackage(emitter:Emitter, node:Node):void {
	let packageName = node.findChild(NodeKind.NAME);
    emitter.sourcePackage = packageName ? packageName.text : '';
	let content = node.findChild(NodeKind.CONTENT);

	if (content){
		let classNode = content.findChild(NodeKind.CLASS);
		let classRecord:ClassRecord;
		if (classNode)
		{
			let className = classNode.findChild(NodeKind.NAME);
			let classList = ClassList.classList;
			classRecord = new ClassRecord(packageName.text, className.text);
			classRecord.classKind = ClassKind.CLASS;
		}
		let interfaceNode = content.findChild(NodeKind.INTERFACE);
		if (interfaceNode)
		{
			let interfaceName = interfaceNode.findChild(NodeKind.NAME);
			let interfaceList = ClassList.classList;
			classRecord = new ClassRecord(packageName.text, interfaceName.text);
			classRecord.classKind = ClassKind.INTERFACE;

		}
		if (classRecord)
		{
			if (ClassList.isScanning)
			{
				ClassList.addClass(classRecord);
			}
			else
			{
				ClassList.setCurrentClassRecord(classRecord);
			}

		}
	}

	if (emitter.options.useNamespaces) {
		emitter.catchup(node.start);
		emitter.skip(Keywords.PACKAGE.length);
		emitter.insert('namespace');
		visitNodes(emitter, node.children);

	} else {
		emitter.catchup(node.start);
		emitter.skip(Keywords.PACKAGE.length + node.children[0].text.length + 4);

		visitNodes(emitter, node.children);
		emitter.catchup(node.end - 1);
		emitter.skip(1);
	}
}


function emitMeta(emitter:Emitter, node:Node):void {
	emitter.catchup(node.start);
	emitter.commentNode(node, false);
}


function emitUse(emitter:Emitter, node:Node):void {
	emitter.catchup(node.start);
	emitter.commentNode(node, false);
}

function emitNamespaceDeclaration(emitter:Emitter, node:Node):void {
    const uri = emitter.namespaces.declarationUri(node, []);
    emitter.catchup(node.start);
    emitter.insert('export const ' + node.findChild(NodeKind.NAME).text
        + ' = globalThis.Symbol.for(' + JSON.stringify('as3.namespace.uri@1:' + uri) + ');');
    emitter.skipTo(node.end);
}

function emitName(emitter:Emitter, node:Node):void {
    const member = emitter.namespaces.member(node);
    emitter.catchup(node.start);
    if (!member) return;
    if (emitter.options.nativeProxyModule !== undefined
        && member.uri === 'http://www.adobe.com/2006/actionscript/flash/proxy') {
        emitter.insert(node.text);
        emitter.skipTo(node.end);
        return;
    }
    emitter.insert('[' + emitter.namespaces.key(member.uri, member.name) + ']');
    emitter.skipTo(node.end);
}

function resolveNamespaceAccess(emitter:Emitter, node:Node) {
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
    return {access, target};
}

function emitNamespaceAccess(emitter:Emitter, node:Node):void {
    const {access, target} = resolveNamespaceAccess(emitter, node);
    const reference = outerEncapsulatedExpression(node);
    if (reference.parent && reference.parent.kind === NodeKind.ASSIGN && reference.parent.children[0] === reference
        && target && target.declaration.kind === NodeKind.CONST_LIST)
        emitter.namespaces.fail('namespace const writes require write protection');
    if (reference.parent && reference.parent.kind === NodeKind.ASSIGN && reference.parent.children[0] === reference
        && target && target.declaration.kind === NodeKind.FUNCTION)
        emitter.namespaces.fail('namespace method writes require separate lowering');
    emitter.catchup(node.start);
    if (access.receiver && access.receiver.text === 'super' && target
        && (target.declaration.kind === NodeKind.VAR_LIST || target.declaration.kind === NodeKind.CONST_LIST)) {
        // AS3 super slots live on the instance, not the JavaScript prototype.
        emitter.insert('this');
        emitter.skipTo(getEffectiveNodeEnd(access.receiver));
    } else if (access.receiver) {
        visitNode(emitter, access.receiver);
        emitter.catchup(getEffectiveNodeEnd(access.receiver));
    } else {
        const member = access.implicitMember;
        emitter.insert(member.static ? member.owner.findChild(NodeKind.NAME).text : 'this');
    }
    emitter.insert('[' + emitter.namespaces.key(access.uri, access.name) + ']');
    emitter.skipTo(node.end);
}

function emitNamespaceUpdate(emitter:Emitter, node:Node):void {
    const operand = node.children.length === 1 && unwrapEncapsulatedExpression(node.children[0]);
    if (operand && operand.kind === NodeKind.DOT)
        emitter.namespaces.lowerOpenedAccess(operand, emitter.namespaces.receiverType(operand));
    if (!operand || operand.kind !== NodeKind.NAMESPACE_ACCESS) {
        // Do not silently emit uncoerced updates for open namespace identifiers.
        if (operand && operand.kind === NodeKind.IDENTIFIER
            && emitter.namespaces.openedIdentifier(operand, hasFunctionLocal(emitter, operand.text)))
            emitter.namespaces.fail('implicit open namespace update requires separate lowering');
        emitter.catchup(node.start);
        visitNodes(emitter, node.children);
        return;
    }
    const {access, target} = resolveNamespaceAccess(emitter, operand);
    const type = emitter.namespaces.integerUpdateType(operand, target);
    if (!access.receiver || access.receiver.text === 'super')
        emitter.namespaces.fail('implicit/super namespace update requires separate lowering');
    let temporary = '__as3_namespace_update';
    while (emitter.source.indexOf(temporary) >= 0) temporary += '_';
    const receiver = temporary + '_receiver', old = temporary + '_old', next = temporary + '_next';
    const key = emitter.namespaces.key(access.uri, access.name);
    const increment = node.kind === NodeKind.PRE_INC || node.kind === NodeKind.POST_INC;
    const prefix = node.kind === NodeKind.PRE_INC || node.kind === NodeKind.PRE_DEC;
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

function emitEmbed(emitter:Emitter, node:Node):void {
	emitter.catchup(node.start);
	emitter.commentNode(node, false);
}

/**
 * Resolve a wildcard import against the authenticated platform catalog without
 * importing the entire SDK namespace.  The source graph has already decided
 * that the wildcard is legal; this pass only applies lexical precedence and
 * keeps the generated module surface to names actually used by the file.
 */
function referencedWildcardDefinitions(node:Node, namespace:string, definitions:string[]):string[] {
	if (!node.parent || !definitions || definitions.length === 0) return [];
	const candidates = new Set<string>(definitions);
	const references = new Set<string>();
	const shadowed = new Set<string>();
	const walk = (current:Node, parent:Node = null):void => {
		if (!current) return;
		if (current !== node && current.kind === NodeKind.IMPORT) {
			const imported = current.text.split('.').pop();
			if (imported && imported !== '*') shadowed.add(imported);
			return;
		}
		if (current.kind === NodeKind.NAME && parent
			&& parent.kind !== NodeKind.PACKAGE && parent.kind !== NodeKind.IMPORT) {
			shadowed.add(current.text);
		}
		if ((current.kind === NodeKind.IDENTIFIER || current.kind === NodeKind.TYPE)
			&& candidates.has(current.text)) {
			// A DOT's right-hand literal is a member name, not a lexical binding.
			if (!(parent && parent.kind === NodeKind.DOT && parent.children[1] === current))
				references.add(current.text);
		}
		if ((current.kind === NodeKind.EXTENDS || current.kind === NodeKind.IMPLEMENTS)
			&& candidates.has(current.text)) references.add(current.text);
		if (current.children) current.children.forEach(child => walk(child, current));
	};
	walk(node.parent);
	return definitions.filter(definition => references.has(definition) && !shadowed.has(definition));
}

function emitImport(emitter:Emitter, node:Node, inline:boolean = false):void {
    const importStart = node.importKeywordStart === undefined ? node.start : node.importKeywordStart;
    const importNameEnd = node.importKeywordStart === undefined ? node.end + Keywords.IMPORT.length + 1 : node.end;
    const importStatementEnd = emitter.source[importNameEnd] === ';' ? importNameEnd + 1 : importNameEnd;
	// A same-file source Class owns its name ahead of an imported declaration.
	// AS3 imports are lexical declarations, not eager JavaScript module effects.
	const importedName = node.text.split('.').pop();
	if (emitter.options.nativeCallableClasses && importedName !== '*'
		&& node.parent && node.parent.findChildren(NodeKind.CLASS)
			.some(declaration => declaration.findChild(NodeKind.NAME).text === importedName)) {
		emitter.catchup(importStart);
		emitter.skipTo(importNameEnd);
		return;
	}
	let statement = Keywords.IMPORT + " ";
/*	let split = node.text.split('.');
	let name = split[split.length - 1];
	split.pop();
	let ns = split.join(".");*/
	ClassList.addImportToLast(node.text.concat());
	// This explicit migration routes calls to the runtime, not a replacement
	// TweenMax Class. Preserve the import's identity for shadowing checks.
	if (emitter.options.nativeTweenModule !== undefined
		&& (node.text === 'com.greensock.TweenMax' || node.text === 'com.greensock.TweenLite')) {
		if (!inline) emitter.catchup(node.start);
		emitter.declareInScope({name: importedName, sourceImport: node.text});
		if (!inline) emitter.skipTo(node.end + Keywords.IMPORT.length + 1);
		return;
	}

	// emit one import statement for each definition found in that namespace
	if (node.text.indexOf("*") !== -1) {
		let ns = node.text.substring(0, node.text.length - 2);
		let definitions = emitter.options.definitionsByNamespace[ns];
		// Flush the source prefix (including the preceding import's semicolon)
		// before inserting bindings for this wildcard.
		emitter.catchup(importStart);

		let skipTo = importStatementEnd;

		if (definitions && definitions.length > 0) {
			if (emitter.options.nativeReferencedWildcardImports)
				definitions = referencedWildcardDefinitions(node, ns, definitions);
			if (definitions.length > 0) {
			definitions.forEach(definition => {
				let importNode = createNode(node.kind, node);
				importNode.text = `${ ns }.${ definition }`;
				importNode.parent = node.parent;
				emitImport(emitter, importNode, true);
				emitter.insert(";\n");
			})

			skipTo = importStatementEnd;
			}

		} else {
			if (WARNINGS >= 1) {
				console.log(`emitter.ts: *** MINOR WARNING *** emitImport() => : nothing found to import on namespace ${ ns }. (import ${ node.text })`)
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
		if (!inline) emitter.catchup(importStart);
		emitter.insert(statement);

		let split = node.text.split('.');
		let name = split[split.length - 1];
		emitter.insert(name + ' = ');

		// apply custom visitor translation
		if (hasCustomVisitor) {
			let diff = node.text.length - text.length;

			emitter.insert(text);
			emitter.skip(text.length + diff + statement.length);

		} else {
			if (!inline) emitter.catchup(importNameEnd);
		}

		emitter.declareInScope({name, sourceImport: node.text});

	} else {

		if (!inline) emitter.catchup(importStart);
		emitter.insert(Keywords.IMPORT + " ");

		let split = text.split(".");
		let name = split.pop();
		if (mappedModule) {
			if (typeof mappedModule !== 'string' || !mappedModule.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(mappedModule))
				throw new Error('AS3_IMPORT_MODULE_UNSUPPORTED: invalid authenticated module for ' + node.text);
			emitter.insert(`{ ${ name } } from "${ mappedModule }"`);
			if (!inline) emitter.skipTo(importNameEnd);
			emitter.declareInScope({name, sourceImport: node.text});
			return;
		}

		// Find current module name to output relative import
		let currentModule = "";
		let parentNode = node.parent;
		while (parentNode) {
			if (parentNode.kind === NodeKind.PACKAGE) {
				currentModule = parentNode.children[0].text;
				break;
			}
			parentNode = parentNode.parent;
		}

		text = `{ ${ name } } from "${ getRelativePath(currentModule.split("."), text.split(".")) }"`;
		emitter.insert(text);
		if (!inline) emitter.skipTo(importNameEnd);
		emitter.declareInScope({name, sourceImport: node.text});
	}
}

function getRelativePath(currentPath:string[], targetPath:string[]) {
	while (currentPath.length > 0 && targetPath[0] === currentPath[0]) {
		currentPath.shift();
		targetPath.shift();
	}

	let relative = (currentPath.length === 0)
		? "."
		: currentPath.map(() => "..").join("/")

	return `${ relative }/${ targetPath.join("/") }`;
}

function getDeclarationType(emitter:Emitter, node:Node):string {
	let declarationType:string = null;
	let typeNode = node && node.findChild(NodeKind.TYPE);

	if (typeNode) {
		declarationType = typeNode.qualifiedName ? typeNode.text : emitter.getTypeRemap(typeNode.text) || typeNode.text;
	}

	return declarationType;
}

function getAS3DeclarationType(node:Node):string {
	let typeNode = node && node.findChild(NodeKind.TYPE);
	return typeNode && (typeNode.qualifiedName || typeNode.text) || null;
}

function emitInterface(emitter:Emitter, node:Node):void {
	emitDeclaration(emitter, node);

	//we'll catchup the other part
	emitter.declareInScope({
		name: node.findChild(NodeKind.NAME).text
	});

	// ensure extends identifier is being imported
	node.findChildren(NodeKind.EXTENDS).forEach(base => emitter.ensureImportIdentifier(base.text));

	let content = node.findChild(NodeKind.CONTENT);
	let contentsNode = content && content.children;
	let foundVariables:{ [name:string]:boolean } = {};
	if (contentsNode) {
		contentsNode.forEach(node => {
			visitNode(emitter, node.findChild(NodeKind.META_LIST));
			emitter.catchup(node.start);
			let type = node.findChild(NodeKind.TYPE) || node.children[2];
			if (node.kind === NodeKind.FUNCTION
				|| node.kind === NodeKind.TYPE && node.text === "function") {
				emitter.skip(Keywords.FUNCTION.length + 1);
				//visitNode(emitter, node.findChild(NodeKind.PARAMETER_LIST));
				let parametersListNode = node.findChild(NodeKind.PARAMETER_LIST);
				if (parametersListNode)
				{
					let params = parametersListNode.children;
					for (var i = 0; i < params.length; i++) {
						let parameterNode = params[i];
                        if (parameterNode.kind == NodeKind.PARAMETER)
                        {
                            const rest=parameterNode.findChild(NodeKind.REST);
                            if(rest) {
                                emitter.catchup(rest.start);emitter.insert('...'+rest.text+': any[]');emitter.skipTo(rest.end);
                                continue;
                            }
                            let nameTypeInitNode = parameterNode.findChild(NodeKind.NAME_TYPE_INIT);
							if (nameTypeInitNode)
							{
								let nameNode = nameTypeInitNode.findChild(NodeKind.NAME);
							let typeParamNode = nameTypeInitNode.findChild(NodeKind.VECTOR)||nameTypeInitNode.findChild(NodeKind.TYPE);
							let initNode = nameTypeInitNode.findChild(NodeKind.INIT);
							// Interface signatures are emitted through this specialized path
							// instead of the ordinary NAME_TYPE_INIT visitor.  Reuse the
							// numeric declaration guard here so parser spans for unary
							// defaults (for example `int = -1`) cannot leak `-1` into the
							// generated TypeScript type.
							if (emitNumericParameterDeclaration(emitter, nameTypeInitNode)) {
								continue;
							}
							if (initNode)
								{
									//visitNode(emitter, nameNode);
									//emitter.skipTo(nameNode.start);
									//emitter.insert(nameNode.text);
									if (typeParamNode)
									{
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
									else
									{
										emitter.insert("?");
									}


									//emitter.skipTo(nameTypeInitNode.end);
								}
								else
								{
									visitNode(emitter, nameNode);
									if (typeParamNode) visitNode(emitter, typeParamNode);
									//emitter.catchup(nameTypeInitNode.end);
								}

							}
						}
						else
						{
							console.log(`emitter.ts: *** WARNING *** there is unexpected node "${parameterNode}" in PARAMETER_LIST`);
						}
					}

				}


				visitNode(emitter, type);

			} else if (node.kind === NodeKind.GET || node.kind === NodeKind.SET) {
				let name = node.findChild(NodeKind.NAME);
				let parameterList = node.findChild(NodeKind.PARAMETER_LIST);
				if (!foundVariables[name.text]) {
					emitter.skipTo(name.start);
					emitter.catchup(name.end);
					foundVariables[name.text] = true;

					if (node.kind === NodeKind.GET) {
						emitter.skipTo(parameterList.end);
						if (type) {
							emitType(emitter, type);
						}

					} else if (node.kind === NodeKind.SET) {
						let parameterNode = parameterList.findChild(NodeKind.PARAMETER);
						let nameTypeInit = parameterNode.findChild(NodeKind.NAME_TYPE_INIT);
						emitter.skipTo(nameTypeInit.findChild(NodeKind.NAME).end);
						type = nameTypeInit.findChild(NodeKind.TYPE);
						if (type) {
							emitType(emitter, type);
						}
						emitter.skipTo(node.end);
					}

				} else {
					emitter.commentNode(node, true);
				}

			} else {
				//include or import in interface content not supported
				emitter.commentNode(node, true);
			}
		});
	}
}


function getFunctionDeclarations(emitter:Emitter, node:Node):Declaration[] {
	let decls:Declaration[] = [];
	let params = node.findChild(NodeKind.PARAMETER_LIST);
	if (params && params.children.length) {
		decls = params.children.map(param => {
			let nameTypeInit = param.findChild(NodeKind.NAME_TYPE_INIT);
			if (nameTypeInit) {
				return {
					name: nameTypeInit.findChild(NodeKind.NAME).text,
					type: getDeclarationType(emitter, nameTypeInit),
					as3Type: getAS3DeclarationType(nameTypeInit)
				};
			}
			let rest = param.findChild(NodeKind.REST);
			return {name: rest.text, as3Type: 'Array'};
		});
	}
	let block = node.findChild(NodeKind.BLOCK);
	if (block) {
		function traverse(node:Node):Declaration[] {
			let result:Declaration[] = [];
			const nested=emitter.generated&&emitter.generated.lexical.nestedFunctions.find(fn=>fn.start===node.start&&fn.end===node.end);
			if(nested)return [{name:nested.name,type:'Function',as3Type:'Function'}];
			if(emitter.generated&&node.kind===NodeKind.LAMBDA)return [];
			if (node.kind === NodeKind.VAR_LIST || node.kind === NodeKind.CONST_LIST ||
				node.kind === NodeKind.VAR || node.kind === NodeKind.CONST) {
				result = result.concat(
					node
						.findChildren(NodeKind.NAME_TYPE_INIT)
						.map(node => ({
							name: node.findChild(NodeKind.NAME).text,
							type: getDeclarationType(emitter, node),
							as3Type: getAS3DeclarationType(node)
						}))
				);
			}
			if (node.kind !== NodeKind.FUNCTION && node.children && node.children.length) {
				result = Array.prototype.concat.apply(result, node.children.map(traverse));
			}
			return result.filter(decl => !!decl);
		}

		decls = decls.concat(traverse(block));
	}
	return decls;
}


function emitFunction(emitter:Emitter, node:Node):void {
 const anonymous=emitter.generated&&emitter.generated.lexical.anonymousFunctions.find(fn=>fn.start===node.start&&fn.end===node.end);
 if(anonymous){
  const module=generatedModule(emitter.options.importModules&&emitter.options.importModules['compiler.AS3Invocation']);
  let helper='__as3_registerAnonymous';while(emitter.source.indexOf(helper)>=0)helper+='_';
  emitter.ensureImportIdentifier('registerAS3Function as '+helper,module,false);emitter.nativeSourceHelpers.add(helper);
  emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(function '+anonymous.name+'(this:any'+(anonymous.parameters.length?',':''));
  const parameters=node.findChild(NodeKind.PARAMETER_LIST),body=node.findChild(NodeKind.BLOCK);
  emitter.withScope(getFunctionDeclarations(emitter,node),()=>{
   parameters.children.forEach((p,index)=>{if(index)emitter.insert(',');emitter.skipTo(p.start);visitNode(emitter,p);emitter.catchup(p.end);});
   emitter.insert('):any ');emitter.skipTo(body.start);visitNode(emitter,body);
   if(anonymous.returned==='Object'){
    // AIR coerces an implicit undefined completion to null for Object returns.
    emitter.catchup(body.end-1);emitter.insert('\nreturn null;\n');
   }
   emitter.catchup(body.end);
  });
  emitter.insert(','+emitter.generated.lexical.scriptGlobal+','+anonymous.parameters.length+'))');emitter.skipTo(node.end);return;
 }

	const nested=emitter.generated&&emitter.generated.lexical.nestedFunctions.find(fn=>fn.start===node.start&&fn.end===node.end);
	if(nested){
		emitter.catchup(node.start);
		emitter.withScope(getFunctionDeclarations(emitter,node),()=>{
			visitNode(emitter,node.findChild(NodeKind.PARAMETER_LIST));
			visitNode(emitter,node.findChild(NodeKind.TYPE));
			visitNode(emitter,node.findChild(NodeKind.BLOCK));
			emitter.catchup(node.end);
		});return;
	}
	emitDeclaration(emitter, node);
	emitter.withScope(getFunctionDeclarations(emitter, node), () => {
		let rest = node.getChildFrom(NodeKind.MOD_LIST);
		let blockNode = node.findChild(NodeKind.BLOCK);
		emitter.skipNewLines = true;
		for (var i = 0; i < rest.length; i++) {
			var childNode:Node = rest[i];

			if (childNode.kind == NodeKind.PARAMETER_LIST) {
				let params = childNode.children;
				emitter.consume(Keywords.FUNCTION, childNode.end);


			}

			if (childNode.kind == NodeKind.TYPE) {

				let blockChildren = childNode.children;


			}
			for (var j = childNode.start; j < childNode.end; j++) {
				let char:string = emitter.source.substr(j, 1);
				//emitter.insert("\n" + NodeKind[childNode.kind] + ")" + j + ")" + char.charCodeAt(0) + ":" + char);

			}

			visitNode(emitter, childNode);


			if (childNode.kind == NodeKind.TYPE) {
				emitter.insert(" => ");
			}


		}
		emitter.skipNewLines = true;

	});
}

function emitParametersList(emitter:Emitter, node:Node):void {

}

function emitForIn(emitter:Emitter, node:Node):void {
 if(emitter.generated){
  const target=node.children[0].children[0],receiver=node.children[1].children[0],body=node.children[2];
  const binding=target&&target.kind===NodeKind.IDENTIFIER&&emitter.findDefInScope(target.text);
  if(!binding||binding.bound||['*','String','Object'].indexOf(binding.as3Type)<0)throw new Error('AS3_ENUMERATION_UNSUPPORTED: generated for-in requires a declared wildcard, String or Object target');
  for(let scope=node.parent;scope&&[NodeKind.FUNCTION,NodeKind.LAMBDA,NodeKind.GET,NodeKind.SET].indexOf(scope.kind)<0;scope=scope.parent)
   if(scope.kind===NodeKind.CATCH&&scope.findChild(NodeKind.NAME).text===target.text)throw new Error('AS3_ENUMERATION_UNSUPPORTED: catch-shadow loop target held');
  if(!emitter.options.nativeEnumeration)throw new Error('AS3_ENUMERATION_UNSUPPORTED: explicit common enumeration providers required');
  const helper=dictionaryEnumerationHelper(emitter,'as3EnumerableKeys');
  const keyCoercion=binding.as3Type==='String'?propertyHelper(emitter,'as3String',emitter.options.nativeEnumeration.stringModule)
   :binding.as3Type==='Object'?propertyHelper(emitter,'as3CoerceObject',generatedModule(emitter.options.nativeEnumeration.coercionModule)):null;
  let cursor:string,step:string;
  do {emitter.loopObjectCounter++;cursor='__as3_keys_'+emitter.loopObjectCounter;step='__as3_keyStep_'+emitter.loopObjectCounter;}
  while(emitter.source.indexOf(cursor)>=0||emitter.source.indexOf(step)>=0);
  emitter.catchup(node.start);emitter.insert('{ const '+cursor+'='+helper+'(');
  emitter.skipTo(receiver.start);visitNode(emitter,receiver);emitter.catchup(receiver.end);
  emitter.insert(');let '+step+':any;try{');
  if(emitter.pendingStatementLabel){emitter.insert(emitter.pendingStatementLabel+':');emitter.pendingStatementLabel=null;}
  emitter.insert('for(;!('+step+'='+cursor+'.next()).done;){'+(emitter.getIdentifierRemap(target.text)||target.text)+'='+(keyCoercion?keyCoercion+'('+step+'.value)':step+'.value')+';');
  emitter.skipTo(body.start);visitNode(emitter,body);finishEnumerationBody(emitter,body,false);
  emitter.insert('}}finally{if('+step+'&&!'+step+'.done&&'+cursor+'.return)'+cursor+'.return();}}');return;
 }

	emitter.catchup(node.start);
	emitter.insert('{ ');
	let initNode = node.children[0];
	let varNode = initNode.children[0];
	let inNode = node.children[1];
	let blockNode = node.children[2];
	const dictionaryReceiver = nativeDictionaryEnumerationReceiver(emitter, inNode && inNode.children[0]);
	let nameTypeInitNode = varNode.findChild(NodeKind.NAME_TYPE_INIT);
    const reference = emitter.references && (nameTypeInitNode ? emitter.references.declaration(nameTypeInitNode)
        : varNode.kind === NodeKind.IDENTIFIER && emitter.references.local(varNode,varNode.text));
    let referenceKey: string;
    if (reference) {
        referenceKey = '__as3_reference_key_' + (++emitter.loopObjectCounter);
        while (emitter.source.indexOf(referenceKey) >= 0) referenceKey += '_';
    }
	let typeStr = "";
	if (nameTypeInitNode) {
		// emit variable type on for..of statements, but outside of the loop header.
		let nameNode = nameTypeInitNode.findChild(NodeKind.NAME);
		let typeNode = nameTypeInitNode.findChild(NodeKind.TYPE);
		if (typeNode) {
			emitter.catchup(node.start);
			/*            let typeRemapped = emitter.getTypeRemap(typeNode.text) || typeNode.text;
			 emitter.insert(`let ${ nameNode.text }:${ typeRemapped };\n`);*/

			let typeRemapped = emitter.getTypeRemap(typeNode.text) || typeNode.text;
			typeStr = typeRemapped == undefined ? '' : ':' + typeRemapped;
		}
		else {
			let vecNode = nameTypeInitNode.findChild(NodeKind.VECTOR);
			if (vecNode) {
				if (WARNINGS >= 1) {
					console.log("emitter.ts: *** WARNING *** for iterators of type vector not supported. Please declare iterator outside of the for's header");
				}
			}
		}
		emitter.insert(`var ${ nameNode.text }${ typeStr };\n`);
		if (emitter.pendingStatementLabel) {
			emitter.insert(emitter.pendingStatementLabel + ': ');
			emitter.pendingStatementLabel = null;
		}
		emitter.catchup(node.start + Keywords.FOR.length + 1);
		emitter.catchup(varNode.start);
		emitter.insert(reference ? 'var ' + referenceKey : nameNode.text);
		emitter.skipTo(varNode.end);
	} else {
		if (emitter.pendingStatementLabel) {
			emitter.insert(emitter.pendingStatementLabel + ': ');
			emitter.pendingStatementLabel = null;
		}
		emitter.catchup(node.start + Keywords.FOR.length + 1);
		if (reference) {emitter.insert('var ' + referenceKey); emitter.skipTo(varNode.end);}
        else visitNode(emitter, initNode);
	}

	if (dictionaryReceiver) {
		emitter.skipTo(inNode.start);
		emitter.insert(' of ');
		emitDictionaryEnumerationKeys(emitter, inNode.children[0]);
		emitReferenceForInBody(emitter,blockNode,reference,referenceKey);
		emitter.insert('}');
		return;
	}
	emitter.catchup(inNode.start);
	emitter.insert(' ');
	/*    emitter.skip(Keywords.IN.length + 1); // replace "in " with "of "
	 emitter.insert('of ');*/

	visitNodes(emitter, inNode.children);
	emitReferenceForInBody(emitter,blockNode,reference,referenceKey);
	emitter.insert('}');
}

function emitReferenceForInBody(emitter:Emitter, body:Node, reference:ReferenceLocal, key:string):void {
    if (reference) {
        emitter.catchup(body.start + (body.kind === NodeKind.BLOCK ? 1 : 0));
        if (body.kind !== NodeKind.BLOCK) emitter.insert('{');
        const parts = referenceCoercionParts(emitter,reference);
        emitter.insert(reference.name + ' = ' + parts[0] + key + parts[1] + ';');
    }
    visitNode(emitter,body);
    finishEnumerationBody(emitter,body,!!reference && body.kind !== NodeKind.BLOCK);
}

function emitForEach(emitter:Emitter, node:Node):void {
	let varNode = node.children[0];
	let inNode = node.children[1];
	let objNode = inNode.children[0];
	let blockNode = node.children[2];
    const localTarget=varNode.kind===NodeKind.NAME&&emitter.findDefInScope(varNode.text);
    if(emitter.generated&&localTarget&&!localTarget.bound&&['*','String','Object','Class'].indexOf(localTarget.as3Type)>=0){
        // The legacy parser represents a member target as a NAME plus a malformed
        // IN span. Require the original simple-target separator before lowering.
        const separator=emitter.source.slice(varNode.end,objNode.start).replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,'').trim();
        if(separator!=='in')throw new Error('AS3_ENUMERATION_UNSUPPORTED: for-each requires a simple local target');
        if(!emitter.options.nativeEnumeration)throw new Error('AS3_ENUMERATION_UNSUPPORTED: explicit common enumeration providers required');
        const values=dictionaryEnumerationHelper(emitter,'as3EnumerableValues');
        let receiver:string,cursor:string,step:string;
        do {emitter.loopObjectCounter++;receiver='__as3_eachReceiver_'+emitter.loopObjectCounter;cursor='__as3_eachKeys_'+emitter.loopObjectCounter;step='__as3_eachStep_'+emitter.loopObjectCounter;}
        while([receiver,cursor,step].some(name=>emitter.source.indexOf(name)>=0));
        emitter.catchup(node.start);emitter.insert('{ const '+receiver+'=');
        emitter.skipTo(objNode.start);visitNode(emitter,objNode);emitter.catchup(objNode.end);
        emitter.insert(';const '+cursor+'='+values+'('+receiver+');let '+step+':any;try{');
        if(emitter.pendingStatementLabel){emitter.insert(emitter.pendingStatementLabel+':');emitter.pendingStatementLabel=null;}
        emitter.insert('for(;!('+step+'='+cursor+'.next()).done;){'+(emitter.getIdentifierRemap(varNode.text)||varNode.text)+'='+step+'.value;');
        emitter.skipTo(blockNode.start);visitNode(emitter,blockNode);finishEnumerationBody(emitter,blockNode,false);
        emitter.insert('}}finally{if('+step+'&&!'+step+'.done&&'+cursor+'.return)'+cursor+'.return();}}');return;
    }
	const dictionaryReceiver = nativeDictionaryEnumerationReceiver(emitter, objNode);
	const enumerationKeys = dictionaryReceiver ? dictionaryEnumerationHelper(emitter, 'as3EnumerableKeys') : null;

	// Keep the source receiver stable throughout enumeration, including after
	// body assignments. The surrounding block also preserves an unbraced if/else.
	let receiverName: string, keyName: string;
	do {
		emitter.loopObjectCounter++;
		receiverName = FOR_IN_OBJ + emitter.loopObjectCounter;
		keyName = FOR_IN_KEY + emitter.loopObjectCounter;
	} while (emitter.source.indexOf(receiverName) >= 0 || emitter.source.indexOf(keyName) >= 0);
	emitter.catchup(node.start);
	emitter.insert('{ var ' + receiverName + '; ');
	if (emitter.pendingStatementLabel) {
		emitter.insert(emitter.pendingStatementLabel + ': ');
		emitter.pendingStatementLabel = null;
	}

	let nameTypeInitNode = varNode.findChild(NodeKind.NAME_TYPE_INIT);
	let nameNode:Node;
	let typeNode:Node;
	let typeStr:string = "";
	let castStr:string = "";
	let variableContNode = nameTypeInitNode ? nameTypeInitNode : node;
	nameNode = variableContNode.findChild(NodeKind.NAME);
	typeNode = variableContNode.findChild(NodeKind.TYPE);
	if (typeNode && typeNode.text) {
		emitter.catchup(node.start);
		let typeRemapped = emitter.getTypeRemap(typeNode.text) || typeNode.text;
		emitter.ensureImportIdentifier(typeRemapped);
		typeStr = typeRemapped == undefined ? '' : ':' + typeRemapped;
		castStr = typeRemapped == undefined ? '' : '<' + typeRemapped + '>';
	}
	else {
		if (nameTypeInitNode) {
			let vecNode = nameTypeInitNode.findChild(NodeKind.VECTOR);
			if (vecNode) {
				if (WARNINGS >= 1) {
					console.log("emitter.ts: *** WARNING *** for iterators of type vector not supported. Please declare iterator outside of the for's header");
				}
			}
		}
	}
	emitter.catchup(node.start + Keywords.FOR.length + 1);
	emitter.skip(4); // "each"
	emitter.catchup(varNode.start);
	emitter.insert(`var ${keyName}`);
	emitter.declareInScope({name:keyName});
	emitter.skipTo(varNode.end);

	if (dictionaryReceiver) {
		emitter.skipTo(inNode.start);
		emitter.insert(' of ');
	} else {
		emitter.catchup(inNode.start);
		emitter.insert(' ');
	}

	if (dictionaryReceiver) emitter.skipTo(objNode.start);
	else emitter.catchup(objNode.start);
	if (dictionaryReceiver) emitter.insert(enumerationKeys + '(' + receiverName + ' = ');
	else emitter.insert('(' + receiverName + ' = ');
	visitNodes(emitter, inNode.children);
	emitter.catchup(objNode.end);
	if (dictionaryReceiver) emitter.insert(')');
	else emitter.insert(')');
	const hasBlock = blockNode.kind === NodeKind.BLOCK;
	emitter.catchup(blockNode.start + (hasBlock ? 1 : 0));
	if (!hasBlock) emitter.insert('{');

	let def = emitter.findDefInScope(nameNode.text);
	if (!def && !nameTypeInitNode)
		throw new Error('AS3_FOREACH_UNSUPPORTED: unresolved iterator binding: ' + nameNode.text);
	if (def && def.type && castStr == "" ){
		castStr = `<${def.type.toString()}>`;
	}
	let declarationWord:string = "";
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
        : emitter.references.local(node,nameNode.text));
    const value = dictionaryReceiver ? dictionaryEnumerationHelper(emitter,'as3GetProperty') + '(' + receiverName + ', ' + keyName + ')'
        : receiverName + '[' + keyName + ']';
    const parts = reference ? referenceCoercionParts(emitter,reference) : [castStr,''];
    emitter.insert('\n' + declarationWord + nameNode.text + typeStr + ' = ' + parts[0] + value + parts[1] + ';\n');
	visitNode(emitter, blockNode);
	finishEnumerationBody(emitter, blockNode, !hasBlock);
	emitter.insert('}');
}

/** Keep the authored statement terminator inside an enclosing generated block. */
function finishEnumerationBody(emitter:Emitter, blockNode:Node, closeBody:boolean):void {
	// Legacy compound loop nodes can have end=-1; their last child still owns
	// the complete final expression (including closing call parentheses).
	const lastSourceEnd = (current:Node):number => current.children.reduce(
		(end, child) => Math.max(end, lastSourceEnd(child)), current.end);
	const statementEnd = lastSourceEnd(blockNode);
	emitter.catchup(statementEnd);
	if (blockNode.kind !== NodeKind.BLOCK) {
		// The AS3 expression node excludes its optional terminator and trivia.
		// Keep an explicit terminator inside the generated loop/if body so it
		// cannot become a separate statement between the source if and else.
		let end = statementEnd;
		while (end < emitter.source.length) {
			if (/\s/.test(emitter.source.charAt(end))) { end++; continue; }
			if (emitter.source.substr(end, 2) === "/*") {
				const close = emitter.source.indexOf("*/", end + 2);
				if (close < 0) break;
				end = close + 2; continue;
			}
			if (emitter.source.substr(end, 2) === "//") {
				end += 2;
				while (end < emitter.source.length && !/[\r\n]/.test(emitter.source.charAt(end))) end++;
				continue;
			}
			break;
		}
		if (emitter.source.charAt(end) === ';') emitter.catchup(end + 1);
	}
	if (closeBody) emitter.insert('}');
}

function getNodeNameRecursive(objNode:Node):string{
	var obj_name = objNode.text;
	if(obj_name != undefined)
		return obj_name;
	obj_name = "";
	if (objNode.children.length > 0) {
		if(objNode.kind==NodeKind.CALL) {
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
		else if(objNode.kind==NodeKind.ARRAY_ACCESSOR) {
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
		else  {
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

function emitBlock(emitter:Emitter, node:Node):void {
 const marker=emitter.generated&&emitter.generated.lexical.finallyMarkers.find(m=>m.start===node.start&&m.end===node.end);
 if(marker){emitter.catchup(node.start+1);emitter.insert('/*'+marker.name+'*/');}

	// Logical assignments capture effectful receivers in ordinary function-local
	// variables. Do not introduce an IIFE: that would change lexical arguments.
	emitter.catchup(node.start + 1);
	if (!emitReferenceMethodEntry(emitter, node)) emitNumericMethodParameterCoercion(emitter, node);
	if (emitter.references) emitter.references.defaults(node).forEach(local => {
		const global = emitter.nativeGlobals.resolve(local.node.findChild(NodeKind.TYPE),true);
		const type = global ? global.alias : getDeclarationType(emitter,local.node);
		if (global) emitter.ensureImportIdentifier(global.name + ' as ' + global.alias,global.module,false);
		else emitter.ensureImportIdentifier(type);
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

function emitStatementLabel(emitter:Emitter, node:Node):void {
	const name = node.children[0];
	const statement = node.children[1];
	if (!name || !statement) throw new Error('AS3_LABEL_UNSUPPORTED: malformed statement label');
	emitter.catchup(node.start);
	if (statement.kind === NodeKind.FOREACH || statement.kind === NodeKind.FORIN) {
		// Enumeration lowering introduces a block before the actual loop;
		// hold the label until that loop is emitted so `continue label` remains
		// legal and targets the AS3 loop rather than the implementation block.
		emitter.pendingStatementLabel = name.text;
		emitter.skipTo(name.end + 1);
	} else {
		emitter.insert(name.text + ':');
		emitter.skipTo(name.end + 1);
	}
	visitNode(emitter, statement);
}

function emitStatementJump(emitter:Emitter, node:Node):void {
	// The legacy generic visitor treats a labelled target as an instance
	// identifier (`this.loop0`). Preserve AS3's raw `break label` / `continue
	// label` spelling; TypeScript uses the same statement-label grammar.
	emitter.catchup(node.start);
	emitter.catchup(node.end);
}

function nativeDictionaryEnumerationReceiver(emitter:Emitter, node:Node):boolean {
	return !!(emitter.options.nativeEnumeration && isDictionaryReceiver(emitter, node));
}

function dictionaryEnumerationHelper(emitter:Emitter, exported:string):string {
	return propertyHelper(emitter, exported, emitter.options.nativeDictionaryPropertyModule);
}

function emitDictionaryEnumerationKeys(emitter:Emitter, node:Node):void {
	const helper = dictionaryEnumerationHelper(emitter, 'as3EnumerableKeys');
	emitter.insert(helper + '(');
	emitter.skipTo(node.start);
	visitNode(emitter, node);
	emitter.catchup(node.end);
	emitter.insert(')');
	emitter.skipTo(node.end);
}

function emitDictionaryEnumerationBlock(emitter:Emitter, node:Node):void {
	visitNode(emitter, node);
}

interface NumericParameterPlan {
	name:string;
	type:string;
	index:number;
	init:Node;
}

function generatedCallableOwnsParameters(emitter:Emitter, member:Node):boolean {
    return !!emitter.generated && !!member && [NodeKind.FUNCTION,NodeKind.GET,NodeKind.SET].indexOf(member.kind)>=0
        && !!member.findChild(NodeKind.NAME)
        && !!member.parent && member.parent.kind === NodeKind.CONTENT;
}

function numericParameterPlans(emitter:Emitter, block:Node):NumericParameterPlan[] {
    // Generated callable entry owns defaults and parameter conversion once.
    if (generatedCallableOwnsParameters(emitter,block.parent)) return [];
	if (emitter.options.nativeNumericMethodParametersModule === undefined || !block.parent)
		return [];
	if ([NodeKind.FUNCTION, NodeKind.SET].indexOf(block.parent.kind) < 0) return [];
	const parameters = block.parent.findChild(NodeKind.PARAMETER_LIST);
	if (!parameters) return [];
	const result:NumericParameterPlan[] = [];
	parameters.children.forEach((parameter, index) => {
		const value = parameter && parameter.findChild(NodeKind.NAME_TYPE_INIT);
		const type = value && value.findChild(NodeKind.TYPE);
		const name = value && value.findChild(NodeKind.NAME);
		if (!value || !type || !name || ['Number', 'int', 'uint'].indexOf(type.text) < 0) return;
		result.push({name:name.text, type:type.text, index, init:value.findChild(NodeKind.INIT)});
	});
	return result;
}

function numericCoercionExport(type:string):string {
	return type === 'Number' ? 'as3CoerceNumber' : type === 'int' ? 'as3CoerceInt' : 'as3CoerceUint';
}

function numericDefaultSource(emitter:Emitter, plan:NumericParameterPlan):string {
	if (!plan.init) return null;
	let value = emitter.sourceBetween(plan.init.start, plan.init.end).trim();
	if (!value && plan.init.children.length === 1
		&& [NodeKind.MINUS, NodeKind.PLUS].indexOf(plan.init.children[0].kind) >= 0) {
		const unary = plan.init.children[0], literal = unary.children.length === 1 && unary.children[0];
		if (literal && literal.kind === NodeKind.LITERAL)
			value = (unary.kind === NodeKind.MINUS ? '-' : '+') + emitter.sourceBetween(literal.start, literal.end).trim();
	}
	const as3NumberNaN = plan.type === 'Number' && value === 'NaN';
	if (!as3NumberNaN && !/^[+-]?(?:0[xX][0-9a-fA-F]+|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)$/.test(value)
		|| /^[+-]?0[0-9]/.test(value))
		throw new Error('AS3_NUMERIC_PARAMETERS_UNSUPPORTED: default must be an exact numeric literal: ' + plan.name);
	return value;
}

function emitNumericMethodParameterCoercion(emitter:Emitter, block:Node):void {
	const plans = numericParameterPlans(emitter, block);
	if (!plans.length) return;
	const module = emitter.options.nativeNumericMethodParametersModule;
	const helpers:{[type:string]:string} = {};
	plans.forEach(plan => {
		const exported = numericCoercionExport(plan.type);
		if (!helpers[exported]) {
			let local = '__as3_' + exported;
			while (emitter.source.indexOf(local) >= 0 || Object.keys(helpers).some(key => helpers[key] === local)) local += '_';
			emitter.ensureImportIdentifier(exported + ' as ' + local, module, false);
			emitter.nativeSourceHelpers.add(local);
			helpers[exported] = local;
		}
	});
	const lines = plans.map(plan => {
		const helper = helpers[numericCoercionExport(plan.type)];
		const converted = helper + '(' + plan.name + ')';
		if (!plan.init) return plan.name + ' = ' + converted + ';';
		const fallback = helper + '(' + numericDefaultSource(emitter, plan) + ')';
		return plan.name + ' = arguments.length <= ' + plan.index + ' ? ' + fallback + ' : ' + converted + ';';
	});
	emitter.insert('\n' + lines.join('\n') + '\n');
}

function emitNumericParameterDeclaration(emitter:Emitter, node:Node):boolean {
    if (node.parent && node.parent.parent && generatedCallableOwnsParameters(emitter,node.parent.parent.parent)) return false;
	if (emitter.options.nativeNumericMethodParametersModule === undefined
		|| !node.parent || node.parent.kind !== NodeKind.PARAMETER) return false;
	const value = node, type = value.findChild(NodeKind.TYPE), name = value.findChild(NodeKind.NAME);
	if (!type || !name || ['Number', 'int', 'uint'].indexOf(type.text) < 0) return false;
	const init = value.findChild(NodeKind.INIT);
	emitter.catchup(value.start);
	emitter.insert(name.text + (init ? '?:' : ':'));
	emitter.skipTo(type.start);
	visitNode(emitter, type);
	// The parser represents a unary default such as `=-1` with an empty INIT
	// span and keeps the sign/literal in its children.  Using value.end here
	// would therefore leave the `-1` source text behind after the rewritten
	// declaration (`value?:number-1`).  Consume the full effective subtree
	// extent so both ordinary and unary numeric defaults are removed.
	if (init) emitter.skipTo(getEffectiveNodeEnd(value));
	else emitter.skipTo(type.end);
	return true;
}

function emitMinus(emitter:Emitter, node:Node):void {
	//emitter.insert("-");
	visitNodes(emitter, node.children);
}

function getClassDeclarations(emitter:Emitter, className:string, contentsNode:Node[]):Declaration[] {
	let found:{ [name:string]:boolean } = {};

	let resultDeclarations:Declaration[] = [];
	contentsNode.forEach(node => {
		if (emitter.namespaces.memberDeclaration(node)) return;

		//let nameNode:Node;
		let nameNodeList:Node[];

		switch (node.kind) {
			case NodeKind.SET:
			case NodeKind.GET:
			case NodeKind.FUNCTION:
				//nameNode = node.findChild(NodeKind.NAME);
				nameNodeList = node.findChildren(NodeKind.NAME);
				break;
			case NodeKind.VAR_LIST:
			case NodeKind.CONST_LIST:
				//nameNode = node.findChild(NodeKind.NAME_TYPE_INIT).findChild(NodeKind.NAME);
				nameNodeList = node.findChildren(NodeKind.NAME_TYPE_INIT)
				break;
			default:
				break;
		}
		if (!nameNodeList || nameNodeList.length == 0)
		{
			return null;
		}
		let modList = node.findChild(NodeKind.MOD_LIST);
		let isStatic = modList && modList.children.some(mod => mod.text === 'static');

		nameNodeList.forEach(nodeInit =>{
				let nameNode:Node = nodeInit.kind == NodeKind.NAME_TYPE_INIT ? nodeInit.findChild(NodeKind.NAME) : nodeInit;
				let typeNode:Node = nodeInit.kind == NodeKind.NAME_TYPE_INIT ? nodeInit : node.findChild(NodeKind.NAME_TYPE_INIT);
				if (!nameNode || found[nameNode.text]) {
					return null;
				}
				found[nameNode.text] = true;
				if (nameNode.text === className) {
					return;
				}

				let declaration = <Declaration>{
					name: nameNode.text,
					type: getDeclarationType(emitter, typeNode),
					as3Type: getAS3DeclarationType(typeNode),
					bound: isStatic ? className : 'this'
				};
				resultDeclarations.push(declaration);
			}

		)



	})
	resultDeclarations = resultDeclarations.filter(el => !!el);
    if (emitter.generated) emitter.generated.projection.instanceTraits.forEach(trait => {
        if (found[trait.name]) return;
        const sourceType = typeof trait.type === 'string' ? trait.type : trait.type ? trait.type.name.replace('::','.') : '*';
        resultDeclarations.push({name:trait.name,as3Type:sourceType,type:TYPE_REMAP[sourceType] || sourceType,bound:'this'});
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


function emitClass(emitter:Emitter, node:Node):void {
	emitter.catchup(node.start);
	const previousFactory = emitter.classFactory;
	const lazy = emitter.classInitializers.enabled;
	const sourceName = node.findChild(NodeKind.NAME).text;
	if (lazy) {
		const value = emitter.classInitializers.ownNames.get(node);
		emitter.classFactory = {node, value, fields: [], statements: []};
		const helperPath = emitter.generated ? emitter.generated.helpers.nativeClass : (ClassList.getLastPathToRoot() || './') + 'nativeClass';
		emitter.ensureImportIdentifier('declareNativeClass as ' + emitter.classInitializers.declareName, helperPath, false);
		emitter.ensureImportIdentifier('readNativeClass as ' + emitter.classInitializers.readName, helperPath, false);
		emitter.insert('export const ' + sourceName + ' = ' + emitter.classInitializers.declareName
			+ '((' + value + '_finalize) => {\nlet ' + value + ': any;\n');
	}
	visitNode(emitter, node.findChild(NodeKind.META_LIST));
	let mods = node.findChild(NodeKind.MOD_LIST);
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
	let name = node.findChild(NodeKind.NAME);
	let content = node.findChild(NodeKind.CONTENT);
	let contentsNode = content && content.children;
	if (!contentsNode) {
		return;
	}


	// ensure extends identifier is being imported
	let extendsNode = node.findChild(NodeKind.EXTENDS);
	if (extendsNode) {
		emitIdent(emitter, extendsNode);
		emitter.isExtended = true;
		ClassList.addExtendToLast(extendsNode.text);
		emitter.ensureImportIdentifier(extendsNode.text);

	} else {
		emitter.isExtended = false;
	}

	// ensure implements identifiers are being imported
	let implementsNode = node.findChild(NodeKind.IMPLEMENTS_LIST);
	if (implementsNode) {
		implementsNode.children.forEach((node) => {
			emitter.ensureImportIdentifier(node.text);
			ClassList.addInterfaceToLast(node.text);
		})
	}

	const previousProxyClass = emitter.proxyClass;
	emitter.proxyClass = emitter.options.nativeProxyModule !== undefined
		&& !!extendsNode && extendsNode.text === 'Proxy';
	emitter.withScope(getClassDeclarations(emitter, name.text, contentsNode), scope => {
		scope.className = name.text;
		if (emitter.proxyClass) {
			const fields:string[] = [];
			contentsNode.forEach(member => {
				if (member.kind !== NodeKind.VAR_LIST && member.kind !== NodeKind.CONST_LIST) return;
				member.findChildren(NodeKind.NAME_TYPE_INIT).forEach(field => {
					const fieldName = field.findChild(NodeKind.NAME);
					if (fieldName) fields.push(fieldName.text);
				});
			});
			if (fields.length) {
				let helper = '__as3_declareFlashProxyProperties';
				while (emitter.source.indexOf(helper) >= 0) helper += '_';
				emitter.ensureImportIdentifier('declareFlashProxyProperties as ' + helper, emitter.options.nativeProxyModule, false);
				emitter.catchup(content.start);
				emitter.insert('\nstatic readonly flashProxyDeclaredProperties = ' + helper + '(' + fields.map(field => JSON.stringify(field)).join(', ') + ');\n');
			}
		}
		let isInterfaceLinkPrinted:boolean = false;
		contentsNode.forEach(node => {
			visitNode(emitter, node.findChild(NodeKind.META_LIST));
			emitter.catchup(node.start);
			if (isInterfaceLinkPrinted == false) {
				//if (implementsNode) emitter.insert(`static ${INTERFACE_INF};\n`);
				if (implementsNode && !emitter.generated) {
					let classesList = ""
					implementsNode.children.forEach((node) => {

						classesList += `"${node.text}", `;
					});
					classesList = classesList.substring(0, classesList.length - 2);
					//emitter.insert(`\n${name.text}.${INTERFACE_INF} = [${classesList}];`);
					emitter.insert(`static ${INTERFACE_INF} = [${classesList}];\n`);
				}
				isInterfaceLinkPrinted = true;
			}
			// console.log(node)
			if (!emitter.namespaces.memberDeclaration(node)) storeClassMember(node);
			switch (node.kind) {
				case NodeKind.SET:
					emitSet(emitter, node);
					break;
				case NodeKind.GET:
					emitGet(emitter, node);
					break;
				case NodeKind.FUNCTION:
					emitMethod(emitter, node);
					break;
				case NodeKind.VAR_LIST:
					emitPropertyDecl(emitter, node);
					break;
				case NodeKind.CONST_LIST:
					emitPropertyDecl(emitter, node, true);
					break;
				default:
					visitNode(emitter, node);
			}
		});

		let pathToRoot = ClassList.getLastPathToRoot();
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

function emitClassInitializer(emitter: Emitter, node: Node): void {
	if (!emitter.classFactory) throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: no native class factory');
	emitter.catchup(node.start);
	const start = emitter.output.length;
	emitter.withScope([], () => visitNodes(emitter, node.children));
	emitter.catchup(node.end);
	emitter.classFactory.statements.push(emitter.output.slice(start));
	emitter.output = emitter.output.slice(0, start);
}

function storeClassMember(node:Node):void
{
	let modeListNode = node.findChild(NodeKind.MOD_LIST);
	let isStatic:boolean = false;
	let isOverridden:boolean = false;
	let nsModifier:number = 0;
	if (modeListNode)
	{
		let modifiers = modeListNode.findChildren(NodeKind.MODIFIER);
		modifiers.forEach((mode) => {

			if (mode.text == Keywords.STATIC) isStatic = true;
			if (mode.text == Keywords.OVERRIDE) isOverridden = true;
			nsModifier = MODIFIERS[mode.text] ;
			//if (mode.text == Keywords.PUBLIC || )
		});
	}
	let nameNode:Node;
	let typeNode:Node;

	let namesInitList:Node[];

	switch (node.kind) {
		case NodeKind.SET:
		case NodeKind.GET:
		case NodeKind.FUNCTION:
			nameNode = node.findChild(NodeKind.NAME);
			typeNode = node.findChild(NodeKind.TYPE);
			break;
		case NodeKind.VAR_LIST:
		case NodeKind.CONST_LIST:
			let nameInitNode = node.findChild(NodeKind.NAME_TYPE_INIT);
			namesInitList = node.findChildren(NodeKind.NAME_TYPE_INIT);
			if (nameInitNode)
			{
				nameNode = nameInitNode.findChild(NodeKind.NAME);
				typeNode = nameInitNode.findChild(NodeKind.TYPE);
			}
			break;
		default:
			return;
	}
	if (namesInitList && namesInitList.length > 1)
	{

		for (var i = 0; i < namesInitList.length; i++) {
			let nameInitNode = namesInitList[i]
			if (nameInitNode)
			{
				nameNode = nameInitNode.findChild(NodeKind.NAME);
				typeNode = nameInitNode.findChild(NodeKind.TYPE);
				processClassMember(node, nameNode, typeNode, nsModifier, isStatic, isOverridden);
			}
		}
	}
	else
	{
		processClassMember(node, nameNode, typeNode, nsModifier, isStatic, isOverridden);
	}


}

function processClassMember(node:Node, nameNode:Node, typeNode:Node, nsModifier:number, isStatic:boolean, isOverridden:boolean):void
{
	let classMemberKind:number = 0;
	switch (node.kind) {
		case NodeKind.SET:
			classMemberKind = ClassMemberKind.SET;
			break;
		case NodeKind.GET:
			classMemberKind = ClassMemberKind.GET;
			break;
		case NodeKind.FUNCTION:
			classMemberKind = ClassMemberKind.METHOD;
			break;
		case NodeKind.VAR_LIST:
			classMemberKind = ClassMemberKind.VARIABLE;
			break;
		case NodeKind.CONST_LIST:
			classMemberKind = ClassMemberKind.CONST;
			break;
	}

	if (nameNode)
	{
		let typeStr = typeNode && typeNode.text ? typeNode.text : "";
		let classMember:ClassMember = new ClassMember(nameNode.text, ClassMemberKind.VARIABLE, typeStr);
		classMember.nsModifier = nsModifier ? nsModifier : ModifierKind.PROTECTED;
		classMember.isStatic = isStatic;
		classMember.isOverridden = isOverridden;
		classMember.kind = classMemberKind;
		if (isStatic)
		{
			ClassList.addStaticMemberToLast(classMember);
		}
		else
		{
			ClassList.addClassMemberToLast(classMember);
		}
		//console.log("***<" + nameNode.text +  ":" + typeStr + "/" + classMember.nsModifier  + "/isStatic:" + isStatic + "/isOverride:" + isOverride + ">***");


	}

}


function emitSet(emitter:Emitter, node:Node):void {
	emitClassField(emitter, node);

	let name = node.findChild(NodeKind.NAME);
	emitter.consume('function', name.start);
	if (emitter.namespaces.member(name)) emitName(emitter, name);

	let params = node.findChild(NodeKind.PARAMETER_LIST);
	visitNode(emitter, params);
	emitter.catchup(params.end);

	let type = node.findChild(NodeKind.TYPE);
	if (type) {
		emitter.skipTo(type.end);
	}

	emitter.withScope(getFunctionDeclarations(emitter, node), () => {
		visitNodes(emitter, node.getChildFrom(NodeKind.TYPE));
	});
}


function emitConstList(emitter:Emitter, node:Node):void {
	emitter.catchup(node.start);
	let nameTypeInit = node.findChild(NodeKind.NAME_TYPE_INIT);
	emitter.skipTo(nameTypeInit.start);
	emitter.insert('const ');
	visitNode(emitter, nameTypeInit);
}

function emitObjectValue(emitter:Emitter, node:Node):void {
	visitNodes(emitter, node.children);
}

function emitObjectLiteral(emitter:Emitter, node:Node):void {
    if (emitter.options.nativeObjectCreationModule === undefined) {visitNodes(emitter,node.children);return;}
    let helper='__as3_source_objectLiteral';
    while(emitter.source.indexOf(helper)>=0)helper+='_';
    emitter.ensureImportIdentifier('as3CreateObjectLiteral as '+helper,emitter.options.nativeObjectCreationModule,false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);emitter.insert('('+helper+'([');
    node.children.forEach((property,index)=>{
        const key=property.findChild(NodeKind.NAME),value=property.findChild(NodeKind.VALUE);
        if(!key||!value||value.children.length!==1)throw new Error('AS3_OBJECT_CREATION_UNSUPPORTED: literal property shape');
        const text=key.text;
        if(index)emitter.insert(',');
        // Keys are static source tokens, never host object-literal syntax (__proto__).
        const token=/^["'0-9]/.test(text)?text:JSON.stringify(text);
        emitter.insert('['+token.replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+',');
        const expression=value.children[0];emitter.skipTo(expression.start);visitNode(emitter,expression);
        emitter.catchup(expression.end);emitter.insert(']');
    });
    emitter.insert(']))');emitter.skipTo(node.end);
}

function emitNameTypeInit(emitter:Emitter, node:Node):void {
    const pattern=emitter.generated&&emitter.generated.options.plan.patternLocals.find(p=>p.owner===emitter.generated.lexical.owner&&p.declarationStart===node.start);
    if(pattern){
        const module=nativePatternModule(emitter),compile=propertyHelper(emitter,'compileSourceStringPattern',module);
        emitter.declareInScope({name:pattern.name,type:'any',as3Type:'RegExp'});
        emitter.catchup(node.start);emitter.insert(pattern.name+': any = '+compile+'('+JSON.stringify(pattern.source)+','+JSON.stringify(pattern.flags)+')');
        emitter.skipTo(Math.max(getEffectiveNodeEnd(node),pattern.declarationEnd));return;
    }
	if (emitReferenceStringParameter(emitter, node)) return;
	if (emitNumericParameterDeclaration(emitter, node)) return;
	const namespaceMember = emitter.namespaces.member(node.findChild(NodeKind.NAME));
	if (!namespaceMember) emitter.declareInScope({
		name: node.findChild(NodeKind.NAME).text,
		type: getDeclarationType(emitter, node),
		as3Type: getAS3DeclarationType(node)
	});
	emitter.catchup(node.start);
	const declaration = node.parent;
	const mods = declaration && declaration.findChild(NodeKind.MOD_LIST);
	if (emitter.classFactory && declaration && declaration.parent === emitter.classFactory.node.findChild(NodeKind.CONTENT)
		&& mods && mods.children.some(mod => mod.text === 'static')) {
        const deferred=emitter.generated && declaration.kind===NodeKind.CONST_LIST
            && emitter.generated.deferredConstants[node.findChild(NodeKind.NAME).text];
        if (emitter.generated && declaration.kind === NodeKind.CONST_LIST && !deferred) {
            // Literal constants are installed before publication by the common
            // generated-class provider, not rewritten as later mutable stores.
            visitNodes(emitter,node.children);
            return;
        }
		const init = node.findChild(NodeKind.INIT);
		if(emitter.generated&&emitter.generated.uintOrInitializers.variables[node.findChild(NodeKind.NAME).text]!==undefined){
			visitNodes(emitter,node.children.filter(child=>child&&child!==init));
			if(init)emitter.skipTo(getEffectiveNodeEnd(init));
			return;
		}
		const generatedLexical=emitter.generated&&emitter.generated.lexical.trait(node.findChild(NodeKind.NAME).text,true);
		visitNodes(emitter, node.children.filter(child => child && child !== init));
		const type = getAS3DeclarationType(node);
		const last = node.findChild(NodeKind.TYPE) || node.findChild(NodeKind.NAME);
		emitter.catchup(last.end);
		if (init) {
			emitter.skipTo(init.start);
			const start = emitter.output.length;
			visitNode(emitter, init);
			emitter.catchup(getEffectiveNodeEnd(init));
			const lexical = emitter.lexical && emitter.lexical.trait(node.findChild(NodeKind.NAME).text, true);
            if(generatedLexical){
                if(generatedLexical.kind!=='constant'&&emitter.generated.lexical.earlyStaticValue(generatedLexical)===undefined)
                    emitter.classFactory.fields.push(emitter.generated.lexical.provider+'.as3SetLexicalMember('+emitter.classFactory.value+','+generatedLexical.access+','+emitter.output.slice(start)+');');
            } else emitter.classFactory.fields.push(deferred ? deferred+'('+emitter.output.slice(start)+');'
                : emitter.classFactory.value + '[' + (lexical ? lexical.key : JSON.stringify(node.findChild(NodeKind.NAME).text))
                    + '] = ' + emitter.output.slice(start) + ';');
			emitter.output = emitter.output.slice(0, start);
		}
		const initial = type === 'int' || type === 'uint' ? '0' : type === 'Number' ? '(0 / 0)'
			: type === 'Boolean' ? 'false' : !type || type === '*' ? 'void 0' : 'null';
		emitter.insert(' = ' + initial);
		return;
	}
	visitNodes(emitter, node.children);
	if (namespaceMember && !node.findChild(NodeKind.INIT)) {
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

function emitMethod(emitter:Emitter, node:Node):void {
	var isConstructor:boolean = false;
	let name = node.findChild(NodeKind.NAME);
	if (node.kind !== NodeKind.FUNCTION || name.text !== emitter.currentClassName) {
		let pathToRoot = ClassList.getLastPathToRoot();
		emitter.ensureImportIdentifier("bound", emitter.options.decoratorModules
			? emitter.options.decoratorModules.bound : `${emitter.classInitializers.enabled ? pathToRoot || './' : pathToRoot}bound`);
		let mods = node.findChild(NodeKind.MOD_LIST);
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

	} else {
		let mods = node.findChild(NodeKind.MOD_LIST);
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
				var children = node.getChildFrom(NodeKind.NAME);
				for (var i:number = 0; i < children.length; i++) {
					var child = children[i];
					if (child.kind !== NodeKind.BLOCK) { // visit all other nodes normally
						visitNode(emitter, child);
						// emitter.skipTo(child.end);
					}
					else { // treat block node differently
						// Find super()
						for (var j:number = 0; j < child.children.length; j++) {
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
		let children = node.getChildFrom(NodeKind.NAME);
		let nameNode = children[0];
		for (var i = 0; i < children.length; i++) {
			let childNode = children[i];
			//var implemented = emitter.scope.parent.parent.declarations[0].name; //can not use because it icludes also imports
			if (childNode.kind == NodeKind.BLOCK) {
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

function emitGet(emitter:Emitter, node:Node):void {
	let name = node.findChild(NodeKind.NAME);
	if (node.kind !== NodeKind.FUNCTION || name.text !== emitter.currentClassName) {
		emitClassField(emitter, node);
		emitter.consume('function', name.start);
		if (emitter.namespaces.member(name)) emitName(emitter, name);
		else emitter.catchup(name.end);
	} else {
		let mods = node.findChild(NodeKind.MOD_LIST);
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
				var children = node.getChildFrom(NodeKind.NAME);
				for (var i:number = 0; i < children.length; i++) {
					var child = children[i];
					if (child.kind !== NodeKind.BLOCK) { // visit all other nodes normally
						visitNode(emitter, child);
						// emitter.skipTo(child.end);
					}
					else { // treat block node differently
						// Find super()
						for (var j:number = 0; j < child.children.length; j++) {
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
		visitNodes(emitter, node.getChildFrom(NodeKind.NAME));
	});
}

function containsSuperCall(node:Node):boolean {
    if (node.kind === NodeKind.CALL && node.children[0].kind === NodeKind.IDENTIFIER
        && node.children[0].text === 'super') return true;
    return node.children.some(child => child && child.kind !== NodeKind.FUNCTION
        && child.kind !== NodeKind.LAMBDA && containsSuperCall(child));
}


function emitPropertyDecl(emitter:Emitter, node:Node, isConst = false):void {

	let names = node.findChildren(NodeKind.NAME_TYPE_INIT);
	if (names.length > 1)
	{
		//emitter.insert("<prop:>");
		let typeNode:Node;
		let typeStr:string;
		let lastNameNode = names[names.length -1];
		let type = lastNameNode.findChild(NodeKind.TYPE);
		if (type.text != "") typeNode = type;
		typeStr = typeNode ? `:${typeNode.text}` : "";

		let mods = node.findChild(NodeKind.MOD_LIST);
		let start = node.start;
		names.forEach((nameTypeInit, i) => {
			emitClassField(emitter, node, isConst);
			emitter.consume(isConst ? Keywords.CONST : Keywords.VAR, nameTypeInit.start);
			//visitNode(emitter, name);


			emitter.declareInScope({
				name: nameTypeInit.findChild(NodeKind.NAME).text,
				type: getDeclarationType(emitter, nameTypeInit),
				as3Type: getAS3DeclarationType(nameTypeInit)
			});
			//emitter.catchup(nameTypeInit.start);
			let nameNode:Node = nameTypeInit.children[0];
			//let typeNode:Node = nameTypeInit.children[1];
			//visitNodes(emitter, nameTypeInit.children);
			//emitter.index

			emitter.insert(` ${nameNode.text}`);
			if (typeNode)
			{
				emitter.insert(":");
				emitter.skipTo(typeNode.start);
				visitNode(emitter, typeNode);
				emitter.insert(";\n\t");
			}

			//emitter.insert(`${typeStr};\n\t`);
			emitter.setIndexPos(start);
		})
		//emitter.insert("</prop:>");
		emitter.skipTo(node.nextSibling.start);
	}
	else
	{
		emitClassField(emitter, node, isConst);
		names.forEach((nameTypeInit, i) => {
			if (i === 0) {
				emitter.consume(isConst ? Keywords.CONST : Keywords.VAR, nameTypeInit.start);
			}
			visitNode(emitter, nameTypeInit);
		})
	}


}


function emitClassField(emitter:Emitter, node:Node, isConst = false):void {
	let mods = node.findChild(NodeKind.MOD_LIST);
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
		const name = node.findChild(NodeKind.NAME)
			|| (node.findChild(NodeKind.NAME_TYPE_INIT) && node.findChild(NodeKind.NAME_TYPE_INIT).findChild(NodeKind.NAME));
		const member = name && emitter.namespaces.member(name);
		if (isConst && member) emitter.insert(' readonly ');
		if (member && emitter.options.nativeProxyModule !== undefined
			&& member.uri === 'http://www.adobe.com/2006/actionscript/flash/proxy'
			&& node.kind === NodeKind.FUNCTION)
			emitter.insert('protected ');
	}
}


function emitDeclaration(emitter:Emitter, node:Node):void {
	emitter.catchup(node.start);
	visitNode(emitter, node.findChild(NodeKind.META_LIST));
	let mods = node.findChild(NodeKind.MOD_LIST);
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


function emitType(emitter:Emitter, node:Node):void {
	const tweenLocal = emitter.generated && emitter.generated.options.plan.references.some(r =>
		r.owner === emitter.generated.lexical.owner && r.start === node.start && r.end === node.end && r.kind === 'tween-handle-local');
	if (tweenLocal) {
		const input = nativeGeneratedDeclarationInputs(emitter.generated.options.plan, emitter.generated.options.plan.scope);
		if (!emitter.options.nativeTypedLocals || !emitter.options.nativeTweenModule
			|| emitter.options.nativeTweenModule !== xmlGlobalProviderModule(input.tweenHandleProviderModule, emitter.generated.options.module))
			throw new Error('AS3_TWEEN_UNSUPPORTED: exact planned migration provider and typed locals required');
		emitter.catchup(node.start);emitter.insert('any');emitter.skipTo(node.end);return;
	}
	// Don't emit type on 'constructor' functions.
	if (node.parent.kind === NodeKind.FUNCTION) {
		let name = node.parent.findChild(NodeKind.NAME);
		if (name && name.text === emitter.currentClassName) {
			emitter.catchup(node.previousSibling.end);
			emitter.skipTo(node.end);
			return;
		}
	}

	emitter.catchup(node.start);

	if (!node.text) {
		if (node.kind === NodeKind.VECTOR) {
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
	let sourceClassType = !!node.qualifiedName;
	if (emitter.options.nativeCallableMetadata) {
		let declaration = node.parent;
		while (declaration && declaration.kind !== NodeKind.CLASS) declaration = declaration.parent;
		let pkg = declaration && declaration.parent;
		while (pkg && pkg.kind !== NodeKind.PACKAGE) pkg = pkg.parent;
		if (declaration && pkg) {
			const name = declaration.findChild(NodeKind.NAME).text;
			const namespace = pkg.findChild(NodeKind.NAME).text;
			const identity = nativeSourceTypeIdentity(node, namespace + '.' + name,
				pkg.findChild(NodeKind.CONTENT).findChildren(NodeKind.IMPORT).map(value => value.text));
			if (identity === namespace + '.' + name) sourceClassType = true;
		}
	}

	// ensure type is imported
	if (
		sourceClassType || GLOBAL_NAMES.indexOf(node.text) === -1 && !emitter.getTypeRemap(node.text) &&
		TYPE_REMAP_VALUES.indexOf(node.text) === -1
	) {
		emitter.ensureImportIdentifier(node.text);
	}

	let typeName = sourceClassType ? node.text : emitter.getTypeRemap(node.text) || node.text;

	emitter.insert(typeName);
}


/** Vector provider bindings are relative to the plan's declaration module. */
function vectorProviderModule(module:string,domain:string):string {
    generatedModule(module);generatedModule(domain);
    if(module.charAt(0)!=='.')return module;
    const path=require('path').posix;
    const result=path.normalize(path.join(path.dirname(domain),module));
    return result.charAt(0)==='.'?result:'./'+result;
}

function emitVector(emitter:Emitter, node:Node):void {
    const options=emitter.options.nativeVectorTypes||emitter.options.nativeGeneratedDeclarations;
    if(options){
        const input=nativeGeneratedDeclarationInputs(options.plan,options.plan.scope);
        if(input.vectorProviderModule){
            const owners=Object.keys(input.sources).filter(owner=>input.sources[owner].source===emitter.source);
            const vector=owners.length===1&&options.plan.vectors.find(v=>v.owner===owners[0]&&v.start===node.start&&v.end===node.end);
            if(!vector)throw new Error('AS3_VECTOR_EMISSION_UNSUPPORTED: exact source specialization required');
            if(emitter.isNew)throw new Error('AS3_VECTOR_EMISSION_UNSUPPORTED: construction requires separate qualification');
            let alias='__as3_Vector';while(emitter.source.indexOf(alias)>=0)alias+='_';
            emitter.ensureImportIdentifier('AS3Vector as '+alias,vectorProviderModule(input.vectorProviderModule,options.module),false);
            emitter.catchup(node.start);emitter.insert(alias+'<');
            const element=node.findChild(NodeKind.TYPE);emitter.skipTo(element.start);emitType(emitter,element);
            emitter.insert('>');emitter.skipTo(node.end);return;
        }
    }
	if (!emitter.isNew) {
		emitter.catchup(node.start);
	}

	let type = node.findChild(NodeKind.TYPE);
	if (!type) {
		type = createNode(NodeKind.TYPE, {
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


function emitShortVector(emitter:Emitter, node:Node):void {
	emitter.catchup(node.start);
	let vector = node.findChild(NodeKind.VECTOR);
	emitter.insert('Array');
	let type = vector.findChild(NodeKind.TYPE);
	if (type) {
		emitType(emitter, type);
	} else {
		emitter.insert('any');
	}
	emitter.catchup(vector.end);
	emitter.insert('(');
	let arrayLiteral = node.findChild(NodeKind.ARRAY);
	emitArray(emitter, arrayLiteral);
	emitter.insert(')');
	emitter.skipTo(node.end);
}


function emitDynamicConstruction(emitter:Emitter,node:Node):boolean {
    if ((!emitter.references && !emitter.generated) || node.children.length !== 1) return false;
    const call=node.children[0];
    const callee=call.kind===NodeKind.CALL?call.children[0]:call;
    const args=call.kind===NodeKind.CALL?call.findChild(NodeKind.ARGUMENTS):undefined;
    const target=unwrapEncapsulatedExpression(callee);
    const binding=target.kind===NodeKind.IDENTIFIER&&emitter.findDefInScope(target.text);
    if (!emitter.references) {
        if (binding && !binding.bound && ['Object','Function','*'].indexOf(binding.as3Type)>=0)
            throw new Error('AS3_DYNAMIC_CONSTRUCTION_UNSUPPORTED: explicit reference authority required');
        return false;
    }
    const classCast=target.kind===NodeKind.RELATION && target.children.length===3
        && target.children[1].text==='as' && target.lastChild.kind===NodeKind.IDENTIFIER
        && target.lastChild.text==='Class' && emitter.references.resolve('Class')==='Class'
        && !emitter.references.sourceClass('Class') && !emitter.references.sourceInterface('Class');
    if (!classCast && (!binding || binding.bound || ['Object','Function','*'].indexOf(binding.as3Type)<0)) return false;
    const module=emitter.options.nativeDynamicConstructionModule;
    if (!module || !args) throw new Error('AS3_DYNAMIC_CONSTRUCTION_UNSUPPORTED: explicit invocation module and argument list required');
    let helper='__as3_constructValue';while(emitter.source.indexOf(helper)>=0)helper+='_';
    emitter.ensureImportIdentifier('as3ConstructValue as '+helper,module,false);emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(');emitter.skipTo(callee.start);
    visitNode(emitter,callee);emitter.catchup(callee.end);emitter.insert(',()=>[');
    args.children.forEach((arg,index)=>{if(index)emitter.insert(',');emitter.skipTo(arg.start);visitNode(emitter,arg);emitter.catchup(arg.end);});
    const scriptGlobal=emitter.generated&&emitter.generated.projection.binding.scriptGlobalExport?emitter.generated.lexical.scriptGlobal:null;
    emitter.insert(']'+(scriptGlobal?','+scriptGlobal:'')+'))');emitter.skipTo(node.end);return true;
}

function emitNew(emitter:Emitter, node:Node):void {
 if(emitLexicalSpriteConstruction(emitter,node))return;
 if(emitDynamicConstruction(emitter,node))return;
 if(emitGeneratedVectorLiteral(emitter,node))return;
 if(emitGeneratedVectorConstruction(emitter,node))return;
 if(emitter.generated&&node.children.length===1&&node.children[0].kind===NodeKind.CALL){
  const call=node.children[0],callee=call.children[0],args=call.findChild(NodeKind.ARGUMENTS);
  const binding=callee&&callee.kind===NodeKind.IDENTIFIER&&emitter.findDefInScope(callee.text);
  if(binding&&!binding.bound&&binding.as3Type==='Class'&&args){
   const module=generatedModule(emitter.options.nativeObjectCreationModule);
   let helper='__as3_constructCapturedClass';while(emitter.source.indexOf(helper)>=0)helper+='_';
   emitter.ensureImportIdentifier('as3ConstructClass as '+helper,module,false);emitter.nativeSourceHelpers.add(helper);
   emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(');emitter.skipTo(callee.start);visitNode(emitter,callee);emitter.catchup(callee.end);
   emitter.insert(',[');args.children.forEach((arg,index)=>{if(index)emitter.insert(',');emitter.skipTo(arg.start);visitNode(emitter,arg);emitter.catchup(arg.end);});
   const scriptGlobal=emitter.generated.projection.binding.scriptGlobalExport?emitter.generated.lexical.scriptGlobal:null;
   emitter.insert(']'+(scriptGlobal?','+scriptGlobal:'')+'))');emitter.skipTo(node.end);return;
  }
 }

	if (emitSourceErrorConstruction(emitter, node)) return;
	if (emitBuiltinObjectCreation(emitter, node)) return;
	if (emitBuiltinEmptyStringConstruction(emitter, node)) return;
	emitter.catchup(node.start);
	emitter.isNew = true;
	emitter.emitThisForNextIdent = false;
	visitNodes(emitter, node.children);
	emitter.isNew = false;
	emitter.emitThisForNextIdent = true;
}

function emitGeneratedVectorLiteral(emitter:Emitter,node:Node):boolean {
 const options=emitter.options.nativeVectorTypes||emitter.options.nativeGeneratedDeclarations;
 const literal=node.children.length===1&&node.children[0];
 if(!options||!literal||literal.kind!==NodeKind.SHORT_VECTOR)return false;
 const input=nativeGeneratedDeclarationInputs(options.plan,options.plan.scope);
 const fail=(reason:string):never=>{throw new Error('AS3_VECTOR_EMISSION_UNSUPPORTED: '+reason);};
 if(!input.vectorProviderModule||!emitter.generated)fail('literal requires generated class and Vector provider authority');
 const owner=emitter.generated.projection.binding.qname,vector=literal.findChild(NodeKind.VECTOR),values=literal.findChild(NodeKind.ARRAY);
 const spec=vector&&options.plan.vectors.find(v=>v.owner===owner&&v.start===vector.start&&v.end===vector.end);
 if(!spec||spec.identity!=='Vector.<Class>'||input.sources[owner].source!==emitter.source||!values)
  fail('exact Class literal specialization required');
 let helper='__as3_literalVector',specialization='__as3_vectorSpec_'+spec.specExport,value='__as3_literalResult';
 while(emitter.source.indexOf(helper)>=0)helper+='_';while(emitter.source.indexOf(specialization)>=0)specialization+='_';while(emitter.source.indexOf(value)>=0)value+='_';
 emitter.ensureImportIdentifier('as3VectorCreate as '+helper,vectorProviderModule(input.vectorProviderModule,options.module),false);
 emitter.ensureImportIdentifier(spec.specExport+' as '+specialization,generatedModule(options.module),false);emitter.nativeSourceHelpers.add(helper);
 // AIR converts each element before evaluating the following expression. An
 // eager temporary array would execute effects after a failed Class coercion.
 emitter.catchup(node.start);emitter.insert('(()=>{const '+value+'='+helper+'('+specialization+');');
 values.children.forEach(element=>{emitter.insert(value+'.push(');emitter.skipTo(element.start);visitNode(emitter,element);emitter.catchup(element.end);emitter.insert(');');});
 emitter.insert('return '+value+';})()');emitter.skipTo(node.end);return true;
}

function emitGeneratedVectorConstruction(emitter:Emitter,node:Node):boolean {
 const options=emitter.options.nativeVectorTypes||emitter.options.nativeGeneratedDeclarations;
 if(!options||node.children.length!==1)return false;
 const call=node.children[0],vector=call&&call.kind===NodeKind.CALL&&call.children[0];
 if(!vector||vector.kind!==NodeKind.VECTOR)return false;
 const input=nativeGeneratedDeclarationInputs(options.plan,options.plan.scope);
 const fail=(reason:string):never=>{throw new Error('AS3_VECTOR_EMISSION_UNSUPPORTED: '+reason);};
 if(!input.vectorProviderModule){if(emitter.generated)fail('explicit Vector provider required');return false;}
 if(!emitter.generated)fail('construction requires generated class authority');
 const owner=emitter.generated.projection.binding.qname;
 const spec=options.plan.vectors.find(v=>v.owner===owner&&v.start===vector.start&&v.end===vector.end);
 if(!spec||input.sources[owner].source!==emitter.source)fail('exact construction specialization required');
 const args=call.findChild(NodeKind.ARGUMENTS);
 if(!args||args.children.length>2)fail('constructor argument count requires qualification');
 args.children.forEach((arg,index)=>{
  const value=unwrapEncapsulatedExpression(arg),binding=value.kind===NodeKind.IDENTIFIER&&emitter.findDefInScope(value.text);
  const typed=binding&&!binding.bound&&binding.as3Type===(index===0?'uint':'Boolean');
  const literal=index===0?value.kind===NodeKind.LITERAL&&/^\d+$/.test(value.text)&&Number(value.text)<=1048576
   :value.kind===NodeKind.IDENTIFIER&&/^(true|false)$/.test(value.text);
  if(!typed&&!literal)fail('constructor requires uint length and Boolean fixed values; argument coercion held');
 });
 let helper='__as3_createVector',specialization='__as3_vectorSpec_'+spec.specExport;
 // Each specialization needs a distinct binding even when a class constructs several types.
 while(emitter.source.indexOf(helper)>=0)helper+='_';while(emitter.source.indexOf(specialization)>=0)specialization+='_';
 emitter.ensureImportIdentifier('as3VectorCreate as '+helper,vectorProviderModule(input.vectorProviderModule,options.module),false);
 emitter.ensureImportIdentifier(spec.specExport+' as '+specialization,generatedModule(options.module),false);
 emitter.nativeSourceHelpers.add(helper);
 if(spec.elementNative){
  const element=vector.findChild(NodeKind.TYPE),name=element.text,shadow=emitter.findDefInScope(name);
  if(shadow&&(shadow.bound||Object.prototype.hasOwnProperty.call(shadow,'as3Type')))fail('shadowed native element construction');
  if(!/^[A-Za-z_$][\w$]*$/.test(name)||emitter.references.resolve(name)!==spec.elementNative
     ||!emitter.options.importModules||emitter.options.importModules[spec.elementNative]!==input.providers[spec.elementNative].module)
   fail('native element construction requires the exact provider binding');
 }
 emitter.catchup(node.start);
 if(spec.elementClass){
  const element=vector.findChild(NodeKind.TYPE),name=element.text,shadow=emitter.findDefInScope(name);
  if(shadow&&(shadow.bound||Object.prototype.hasOwnProperty.call(shadow,'as3Type')))fail('shadowed class element construction');
  if(!/^[A-Za-z_$][\w$]*$/.test(name)||emitter.references.resolve(name)!==spec.elementClass)
   fail('class element construction requires an exact imported identifier');
  const own=emitter.classFactory&&emitter.currentClassName===name;
  if(own)emitter.insert('('+emitter.classFactory.value+',');
  else {
   emitter.ensureImportIdentifier(name);
   const read=propertyHelper(emitter,'readNativeClass',generatedModule(emitter.options.nativeClassHelperModules&&emitter.options.nativeClassHelperModules.nativeClass));
   emitter.insert('('+read+'('+name+'),');
  }
 }
 emitter.insert(helper+'('+specialization);
 args.children.forEach(arg=>{emitter.insert(',');emitter.skipTo(arg.start);visitNode(emitter,arg);emitter.catchup(arg.end);});
 emitter.insert(spec.elementClass?'))':')');emitter.skipTo(node.end);return true;
}

function emitBuiltinEmptyStringConstruction(emitter:Emitter, node:Node):boolean {
	const module = emitter.options.nativeStringCoercionModule;
	if (module === undefined || !node || node.kind !== NodeKind.NEW || node.children.length !== 1)
		return false;
	const call = node.children[0];
	if (!call || call.kind !== NodeKind.CALL || call.children.length < 2)
		return false;
	const callee = call.children[0], args = call.findChild(NodeKind.ARGUMENTS);
	if (!callee || callee.kind !== NodeKind.IDENTIFIER || callee.text !== 'String'
		|| emitter.findDefInScope('String') || !args || args.children.length !== 0)
		return false;
	emitter.catchup(node.start);
	emitter.skipTo(node.end);
	emitter.insert('""');
	return true;
}

function emitSourceErrorConstruction(emitter:Emitter, node:Node):boolean {
	const module = emitter.options.nativeSourceErrorModule;
	if (module === undefined || !node || node.kind !== NodeKind.NEW && node.kind !== NodeKind.CALL)
		return false;
	const call = node.kind === NodeKind.NEW ? node.children[0] : node;
	if (!call || call.kind !== NodeKind.CALL || call.children.length < 2)
		return false;
	const callee = call.children[0];
	if (!callee || callee.kind !== NodeKind.IDENTIFIER || emitter.findDefInScope(callee.text))
		return false;
	const exports:{[name:string]:string} = {
		Error: 'as3CreateError',
		ArgumentError: 'as3CreateArgumentError',
		ReferenceError: 'as3CreateReferenceError'
	};
	const exported = exports[callee.text];
	if (!exported) return false;
	const args = call.findChild(NodeKind.ARGUMENTS);
	if (!args) return false;
	if (node.kind === NodeKind.CALL && args.children.length !== 1)
		throw new Error('AS3_SOURCE_ERROR_UNSUPPORTED: direct Error call requires one message');
	let helper = '__as3_' + exported;
	while (emitter.source.indexOf(helper) >= 0) helper += '_';
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
	} else {
		emitter.skipTo(args.end);
	}
	emitter.insert(')');
	emitter.skipTo(node.end);
	return true;
}

interface ReflectionQueryStep {
	kind:'child'|'filter';
	name?:string;
	attribute?:string;
	value?:string;
}

interface ReflectionQueryPlan {
	root:Node;
	argument:Node;
	steps:ReflectionQueryStep[];
}

function reflectionStringLiteral(emitter:Emitter, node:Node):string {
	if (!node || node.kind !== NodeKind.LITERAL) return null;
	const raw = emitter.sourceBetween(node.start, node.end).trim();
	if (raw.length < 2 || (raw.charAt(0) !== '"' && raw.charAt(0) !== "'")
		|| raw.charAt(raw.length - 1) !== raw.charAt(0)) return null;
	if (raw.charAt(0) === '"') {
		try { return JSON.parse(raw); } catch (_) { return null; }
	}
	// The admitted query corpus uses literal attribute values. Decode only the
	// AS3 escapes needed for those literals; reject everything else instead of
	// silently changing a predicate.
	let value = raw.substring(1, raw.length - 1);
	if (/\\(?![\\'"nrtbfu0-9x])/.test(value)) return null;
	return value.replace(/\\([\\'"nrt])/g, (_match, escaped) => {
		return escaped === 'n' ? '\n' : escaped === 'r' ? '\r' : escaped === 't' ? '\t' : escaped === 'b' ? '\b' : escaped;
	});
}

function reflectionFilterStep(emitter:Emitter, node:Node):ReflectionQueryStep {
	if (!node || node.kind !== NodeKind.EQUALITY || node.children.length !== 3) return null;
	const attribute = node.children[0];
	const operator = node.children[1];
	const value = reflectionStringLiteral(emitter, node.children[2]);
	if (!attribute || attribute.kind !== NodeKind.IDENTIFIER || !attribute.text
		|| attribute.text.charAt(0) !== '@' || !operator || operator.kind !== NodeKind.OP
		|| operator.text !== '==' || value === null) return null;
	return {kind:'filter', attribute:attribute.text.substring(1), value};
}

function reflectionQueryPlan(emitter:Emitter, node:Node):ReflectionQueryPlan {
	if (!node || node.kind !== NodeKind.CALL || node.children.length < 2) return null;
	const finalCallee = node.children[0];
	const finalArgs = node.findChild(NodeKind.ARGUMENTS);
	if (!finalCallee || finalCallee.kind !== NodeKind.DOT || !finalArgs || finalArgs.children.length)
		return null;
	const finalName = finalCallee.children[1];
	if (!finalName || finalName.kind !== NodeKind.LITERAL || finalName.text !== 'length') return null;

	const steps:ReflectionQueryStep[] = [];
	function consume(current:Node):Node {
		if (!current) return null;
		if (current.kind === NodeKind.DOT) {
			if (current.children.length !== 2 || !current.children[1]
				|| current.children[1].kind !== NodeKind.LITERAL
				|| !current.children[1].text || current.children[1].text === 'length') return null;
			const root = consume(current.children[0]);
			if (!root) return null;
			steps.push({kind:'child', name:current.children[1].text});
			return root;
		}
		if (current.kind === NodeKind.E4X_FILTER) {
			if (current.children.length !== 2) return null;
			const root = consume(current.children[0]);
			const filter = reflectionFilterStep(emitter, current.children[1]);
			if (!root || !filter) return null;
			steps.push(filter);
			return root;
		}
		if (current.kind === NodeKind.CALL && current.children.length >= 2
			&& current.children[0].kind === NodeKind.IDENTIFIER
			&& current.children[0].text === 'describeType') {
			const args = current.findChild(NodeKind.ARGUMENTS);
			if (!args || args.children.length !== 1) return null;
			return current;
		}
		return null;
	}
	const root = consume(finalCallee.children[0]);
	if (!root) return null;
	const rootArgs = root.findChild(NodeKind.ARGUMENTS);
	return {root, argument:rootArgs && rootArgs.children[0], steps};
}

function reflectionImportedDescribeType(emitter:Emitter):boolean {
	const declaration = emitter.findDefInScope('describeType');
	return !!declaration && declaration.sourceImport === 'flash.utils.describeType';
}

function hasReflectionFilter(node:Node):boolean {
	if (!node) return false;
	if (node.kind === NodeKind.E4X_FILTER) return true;
	return !!node.children && node.children.some(hasReflectionFilter);
}

function emitReflectionQuery(emitter:Emitter, node:Node):boolean {
	if (emitter.options.nativeReflectionQueryModule === undefined) return false;
	const plan = reflectionQueryPlan(emitter, node);
	if (!plan) {
		if (hasReflectionFilter(node) && reflectionImportedDescribeType(emitter))
			throw new Error('AS3_REFLECTION_QUERY_UNSUPPORTED: filter requires a qualified describeType child/count query');
		return false;
	}
	if (!reflectionImportedDescribeType(emitter)) return false;
	if (!plan.argument) throw new Error('AS3_REFLECTION_QUERY_UNSUPPORTED: describeType query receiver is missing');
	const module = emitter.options.nativeReflectionQueryModule;
	if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
		throw new Error('AS3_REFLECTION_QUERY_UNSUPPORTED: explicit common reflection query module required');
	let helper = '__as3_describeTypeQueryLength';
	while (emitter.source.indexOf(helper) >= 0) helper += '_';
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

function reflectionXMLRoot(node:Node):Node {
	if (!node || node.kind !== NodeKind.CALL || node.children.length < 2
		|| node.children[0].kind !== NodeKind.IDENTIFIER
		|| node.children[0].text !== 'describeType') return null;
	const args = node.findChild(NodeKind.ARGUMENTS);
	return args && args.children.length === 1 ? node : null;
}

function reflectionXMLArgument(node:Node):Node {
	const root = reflectionXMLRoot(node);
	return root && root.findChild(NodeKind.ARGUMENTS).children[0];
}

function emitReflectionXMLRoot(emitter:Emitter, node:Node, helper:string):void {
	const argument = reflectionXMLArgument(node);
	emitter.catchup(node.start);
	emitter.insert(helper + '(');
	emitter.skipTo(argument.start);
	visitNode(emitter, argument);
	emitter.catchup(argument.end);
	emitter.insert(')');
	emitter.skipTo(node.end);
}

function emitReflectionXML(emitter:Emitter, node:Node):boolean {
	if (emitter.options.nativeReflectionXMLModule === undefined) return false;
	if (!reflectionImportedDescribeType(emitter)) return false;
	const module = emitter.options.nativeReflectionXMLModule;
	if (typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
		throw new Error('AS3_REFLECTION_XML_UNSUPPORTED: explicit common reflection XML module required');

	// A literal attribute followed by toString() is the scalar form used by
	// the maintained JSON encoder. Missing attributes stringify to the empty
	// string in Flash; the provider's nominal reader returns undefined.
	if (node.kind === NodeKind.CALL && node.children.length >= 2
		&& node.children[0].kind === NodeKind.DOT) {
		const toStringName = node.children[0].children[1];
		const attributeDot = node.children[0].children[0];
		const attribute = attributeDot && attributeDot.kind === NodeKind.DOT
			? attributeDot.children[1] : null;
		const root = attributeDot && attributeDot.children[0];
		const args = node.findChild(NodeKind.ARGUMENTS);
		if (toStringName && toStringName.kind === NodeKind.LITERAL && toStringName.text === 'toString'
			&& args && args.children.length === 0 && attribute && attribute.kind === NodeKind.LITERAL
			&& /^@[A-Za-z_$][A-Za-z0-9_$]*$/.test(attribute.text) && reflectionXMLRoot(root)) {
			let xmlHelper = '__as3_describeTypeXML';
			while (emitter.source.indexOf(xmlHelper) >= 0) xmlHelper += '_';
			emitter.ensureImportIdentifier('as3DescribeTypeXML as ' + xmlHelper, module, false);
			emitter.nativeSourceHelpers.add(xmlHelper);
			let attributeHelper = '__as3_xmlAttributeValue';
			while (emitter.source.indexOf(attributeHelper) >= 0) attributeHelper += '_';
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
		const descendantName = descendant && descendant.kind === NodeKind.E4X_DESCENDANT
			? descendant.children[1] : null;
		const descendantRoot = descendant && descendant.kind === NodeKind.E4X_DESCENDANT
			? descendant.children[0] : null;
		if (lengthName && lengthName.kind === NodeKind.LITERAL && lengthName.text === 'length'
			&& args && args.children.length === 0 && descendantName && descendantName.kind === NodeKind.LITERAL
			&& descendantName.text !== '*' && reflectionXMLRoot(descendantRoot)) {
			let xmlHelper = '__as3_describeTypeXML';
			while (emitter.source.indexOf(xmlHelper) >= 0) xmlHelper += '_';
			emitter.ensureImportIdentifier('as3DescribeTypeXML as ' + xmlHelper, module, false);
			emitter.nativeSourceHelpers.add(xmlHelper);
			let descendantsHelper = '__as3_xmlDescendantsByName';
			while (emitter.source.indexOf(descendantsHelper) >= 0) descendantsHelper += '_';
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
		while (emitter.source.indexOf(helper) >= 0) helper += '_';
		emitter.ensureImportIdentifier('as3DescribeTypeXML as ' + helper, module, false);
		emitter.nativeSourceHelpers.add(helper);
		emitReflectionXMLRoot(emitter, node, helper);
		return true;
	}
	if (hasReflectionFilter(node) || node.kind === NodeKind.E4X_DESCENDANT)
		throw new Error('AS3_REFLECTION_XML_UNSUPPORTED: only literal XML attributes and named descendant counts are admitted');
	return false;
}

function isInterfaceCast(emitter:Emitter,receiver:Node):boolean {
    const value=unwrapEncapsulatedExpression(receiver);
    return !!emitter.references&&!!value&&value.kind===NodeKind.RELATION&&value.children.length===3
        &&value.children[1].kind===NodeKind.AS&&value.lastChild.kind===NodeKind.IDENTIFIER
        &&!!emitter.references.sourceInterface(value.lastChild.text);
}

function emitInterfaceReceiverCall(emitter:Emitter,node:Node):boolean {
    if(!emitter.references)return false;
    const callee=node.children[0],args=node.findChild(NodeKind.ARGUMENTS);
    if(!callee||callee.kind!==NodeKind.DOT||callee.children.length!==2||!args)return false;
    const receiver=callee.children[0],value=unwrapEncapsulatedExpression(receiver),member=callee.children[1];
    if(!value||member.kind!==NodeKind.LITERAL)return false;
    const cast=isInterfaceCast(emitter,receiver);
    const field=emitter.generated&&value.kind===NodeKind.DOT&&value.children[0].kind===NodeKind.IDENTIFIER
        &&value.children[0].text==='this'&&value.children[1].kind===NodeKind.LITERAL
        &&emitter.generated.lexical.own.find(t=>t.name===value.children[1].text
            &&!t.static&&t.kind==='variable'&&t.visibility==='private'&&!!t.type);
    const interfaceField=field&&emitter.generated.options.plan.references.some(r=>r.owner===field.owner
        &&r.start===field.type.start&&r.end===field.type.end&&r.kind==='interface');
    if(!cast&&!interfaceField)return false;
    if(emitter.isNew)throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: interface-cast method construction requires separate authority');
    const module=generatedModule(emitter.options.nativeDynamicPropertyReadsModule);
    const helper=propertyHelper(emitter,'as3CallProperty',module);
    // AIR evaluates the receiver and every argument before resolving the method.
    // An argument throw precedes a null error from a cast or typed interface field.
    emitter.catchup(node.start);
    emitter.insert('(<any>(function(target:any,values:any[]){return '+helper+'(target,'+JSON.stringify(member.text)+',()=>values);})(');
    emitter.skipTo(receiver.start);visitNode(emitter,receiver);emitter.catchup(receiver.end);
    emitter.insert(',[');
    args.children.forEach((arg:Node,index:number)=>{
        if(index)emitter.insert(',');emitter.skipTo(getExpressionStart(arg));visitNode(emitter,arg);emitter.catchup(getEffectiveNodeEnd(arg));
    });
    emitter.insert(']))');emitter.skipTo(node.end);return true;
}

/** Recognize declared method values without granting Function authority to an
 * arbitrary property or a shadowed class/method spelling. Normal member emission
 * still selects the authenticated class or lexical method closure. */
function generatedMethodValue(emitter:Emitter,node:Node):boolean {
    const generated=emitter.generated;if(!generated||!node)return false;
    const method=(traits:ReadonlyArray<{name:string;kind:string}>,name:string)=>traits.some(t=>t.name===name&&t.kind==='method');
    if(node.kind===NodeKind.IDENTIFIER){
        if(hasFunctionLocal(emitter,node.text))return false;
        return method(generated.lexical.traits,node.text)||method(generated.projection.instanceTraits,node.text)||method(generated.projection.staticTraits,node.text);
    }
    if(node.kind!==NodeKind.DOT||node.children.length!==2||node.children[1].kind!==NodeKind.LITERAL)return false;
    const receiver=unwrapEncapsulatedExpression(node.children[0]),name=node.children[1].text;
    if(!receiver||receiver.kind!==NodeKind.IDENTIFIER)return false;
    const projection=generatedReceiver(emitter,receiver);
    if(projection)return method(projection.instanceTraits,name)||receiver.text==='this'&&generated.lexical.traits.some(t=>!t.static&&t.kind==='method'&&t.name===name);
    const definition=emitter.findDefInScope(receiver.text);
    if(definition&&(definition.bound||Object.prototype.hasOwnProperty.call(definition,'as3Type')))return false;
    const qname=generated.lexical.resolveTypeName(receiver.text),plan=generated.options.plan;
    if(!plan.bindings.some(b=>b.qname===qname)||!generated.sources[qname])return false;
    let traits=emitter.generatedReceiverTraits.get(qname);
    if(!traits){traits=new NativeGeneratedClassTraits(plan,plan.scope,qname,generated.sources[qname]);emitter.generatedReceiverTraits.set(qname,traits);}
    return method(traits.staticTraits,name)||qname===generated.lexical.owner&&generated.lexical.traits.some(t=>t.static&&t.kind==='method'&&t.name===name);
}

function emitLocalFunctionIntrinsic(emitter:Emitter,node:Node):boolean {
    const callee=node.children[0],args=node.findChild(NodeKind.ARGUMENTS);
    if(!emitter.generated||!emitter.typedLocalPlan||!callee||callee.kind!==NodeKind.DOT||!args)return false;
    const receiver=unwrapEncapsulatedExpression(callee.children[0]),member=callee.children[1];
    if(!member||['call','apply'].indexOf(member.text)<0||!emitter.typedLocalPlan.functionLocal(receiver,emitter)&&!generatedMethodValue(emitter,receiver))return false;
    if(emitter.isNew)throw new Error('AS3_TYPED_LOCAL_UNSUPPORTED: Function intrinsic construction');
    // Capture the Function before argument effects; resolve its intrinsic only
    // afterwards, preserving AIR null errors and declaration-global receivers.
    const helper=propertyHelper(emitter,'as3CallNamedProperty',emitter.generated.propertyModule);
    emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(');
    emitter.skipTo(receiver.start);visitNode(emitter,receiver);emitter.catchup(receiver.end);
    emitter.insert(','+JSON.stringify(member.text)+',()=>[');
    args.children.forEach((arg,index)=>{if(index)emitter.insert(',');emitter.skipTo(getExpressionStart(arg));visitNode(emitter,arg);emitter.catchup(getEffectiveNodeEnd(arg));});
    emitter.insert(']))');emitter.skipTo(getEffectiveNodeEnd(node));return true;
}

/** Native Sprite allocations retain the defining script's movie, including
 * callbacks invoked by another movie. Zero-argument construction is the
 * qualified canonical form; other display constructors remain separate work. */
function emitLexicalSpriteConstruction(emitter:Emitter,node:Node):boolean {
 if(!emitter.generated||node.children.length!==1)return false;
 const call=node.children[0],callee=call.kind===NodeKind.CALL&&call.children[0];
 if(!callee||callee.kind!==NodeKind.IDENTIFIER)return false;
 const binding=emitter.findDefInScope(callee.text);
 if(binding&&(binding.bound||Object.prototype.hasOwnProperty.call(binding,'as3Type')))return false;
 if(emitter.generated.lexical.resolveTypeName(callee.text)!=='flash.display.Sprite')return false;
 const input=nativeGeneratedDeclarationInputs(emitter.generated.options.plan,emitter.generated.options.plan.scope);
 const provider=input.providers&&input.providers['flash.display.Sprite'];
 const fail=(reason:string):never=>{throw new Error('AS3_SPRITE_ALLOCATION_UNSUPPORTED: '+reason);};
 if(!provider||provider.exportName!=='Sprite'||!emitter.options.importModules
     ||emitter.options.importModules['flash.display.Sprite']!==xmlGlobalProviderModule(provider.module,emitter.generated.options.module))
  fail('exact native Sprite provider required');
 const args=call.findChild(NodeKind.ARGUMENTS);
 if(!args||args.children.length)fail('only canonical zero-argument construction is qualified');
 if(!input.scriptDomainProvider||!input.scriptGlobalProviderModule||!emitter.generated.projection.binding.scriptGlobalExport)
  fail('defining script requires an explicit cohort domain');
 const module=generatedModule(xmlGlobalProviderModule(input.scriptGlobalProviderModule,emitter.generated.options.module));
 const helper=propertyHelper(emitter,'withAS3ScriptAllocationContext',module);
 emitter.catchup(node.start);emitter.insert(helper+'('+emitter.generated.lexical.scriptGlobal+',()=>');
 const wasNew=emitter.isNew,wasThis=emitter.emitThisForNextIdent;
 emitter.isNew=true;emitter.emitThisForNextIdent=false;
 visitNodes(emitter,node.children);emitter.catchup(node.end);emitter.insert(')');
 emitter.isNew=wasNew;emitter.emitThisForNextIdent=wasThis;
 return true;
}

function emitCall(emitter:Emitter, node:Node):void {
    if(emitLocalFunctionIntrinsic(emitter,node))return;
    const pattern=emitter.generated&&emitter.generated.options.plan.patternLocals.find(p=>p.owner===emitter.generated.lexical.owner&&p.calls.indexOf(node.start)>=0);
    if(pattern){
        const helper=propertyHelper(emitter,'sourcePatternTest',nativePatternModule(emitter));
        emitter.catchup(node.start);emitter.insert(helper+'('+pattern.name);
        node.findChild(NodeKind.ARGUMENTS).children.forEach(argument=>{
            emitter.insert(',');emitter.skipTo(getExpressionStart(argument));visitNode(emitter,argument);emitter.catchup(getEffectiveNodeEnd(argument));
        });
        emitter.insert(')');emitter.skipTo(getEffectiveNodeEnd(node));return;
    }
    if (emitInterfaceReceiverCall(emitter,node)) return;
    if (emitSourceErrorConstruction(emitter,node)) return;
    if (emitNativeTrace(emitter,node)) return;
    if (emitJSONParse(emitter,node)) return;
	if (emitStringPatternCall(emitter, node)) return;
	if (emitReflectionQuery(emitter, node)) return;
	if (emitReflectionXML(emitter, node)) return;
	if (emitDirectToString(emitter, node)) return;
	if (emitBuiltinStringCoercion(emitter, node)) return;
    if (emitBuiltinIntCoercion(emitter, node)) return;
    if (emitBuiltinBooleanCoercion(emitter, node)) return;
	if (emitBuiltinObjectCreation(emitter, node)) return;
	if (emitArraySortOn(emitter, node)) return;
	if (emitTweenMigrationCall(emitter, node)) return;
	if (emitDictionaryPropertyCall(emitter, node)) return;
    if (emitInternalDynamicCall(emitter, node)) return;
    if (emitObjectPropertyCall(emitter, node)) return;
    const callee = node.children[0];
    if(callee.kind===NodeKind.IDENTIFIER&&callee.text==='parseInt') {
        const binding=emitter.nativeGlobals.resolve(callee),args=node.findChild(NodeKind.ARGUMENTS);
        if(binding) {
            if(emitter.isNew||!args||args.children.length>2)
                throw new Error('AS3_GLOBAL_MODULE_UNSUPPORTED: parseInt requires a direct zero-to-two argument call');
            emitter.nativeSourceHelpers.add(binding.alias);
            emitter.catchup(node.start);visitNodes(emitter,node.children);emitter.catchup(node.end);return;
        }
    }
    if (!emitter.isNew && callee.kind === NodeKind.IDENTIFIER && emitter.nativeGlobals.resolve(callee))
        throw new Error('AS3_GLOBAL_MODULE_UNSUPPORTED: callable builtin conversion requires native lowering: ' + callee.text);
    if (callee.kind === NodeKind.IDENTIFIER && callee.text === 'super') {
        let owner = node.parent;
        while (owner && owner.kind !== NodeKind.FUNCTION) owner = owner.parent;
        let classNode = owner && owner.parent;
        while (classNode && classNode.kind !== NodeKind.CLASS) classNode = classNode.parent;
        if (owner && classNode && owner.findChild(NodeKind.NAME).text === classNode.findChild(NodeKind.NAME).text
            && !classNode.findChild(NodeKind.EXTENDS)) {
            const argumentsNode = node.findChild(NodeKind.ARGUMENTS);
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
	let args = node.findChild(NodeKind.ARGUMENTS);
	if (args){
		let arrayDotNode = args.findChild(NodeKind.DOT);
		if (arrayDotNode) {
			let arrayCNode = arrayDotNode.children[0] as Node;
			let literalNode = arrayDotNode.children[1] as Node;
			if (arrayCNode && arrayCNode && literalNode.text == 'RETURNINDEXEDARRAY') {
				let callDot = node.findChild(NodeKind.DOT);
				if (callDot){
					let identifierNode = callDot.findChild(NodeKind.IDENTIFIER);
					let literalSortNode = callDot.findChild(NodeKind.LITERAL);
					if (identifierNode && literalSortNode && literalSortNode.text == 'sort'){
						//emitter.consume(")", 1);
						emitter.catchup(node.start);
						emitter.skipTo(node.end);
						emitter.insert(`AS3Utils.sortRETURNINDEXEDARRAY(${identifierNode.text})`);
						let pathToRoot = ClassList.getLastPathToRoot();
						emitter.ensureImportIdentifier(AS3_UTIL, `${pathToRoot}${AS3_UTIL}`);
						//emitter.insert("*|*");

						isRETURNINDEXEDARRAY = true;

					}
				}

			}
		}
	}

	if (node.children[0].kind === NodeKind.VECTOR) {
		if (isNew) {
			let vector = node.children[0];
			let args = node.children[1];
			emitter.insert('[');
			if (WARNINGS >= 2 && args.children.length > 0) {
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
				const vec:Node = node.findChild(NodeKind.VECTOR);
				visitNodes(emitter, [vec]);
				emitter.insert('>');
				const args:Node = node.findChild(NodeKind.ARGUMENTS);
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
			const type:Node = node.findChild(NodeKind.IDENTIFIER);
			const args:Node = node.findChild(NodeKind.ARGUMENTS);
			const rtype:string = emitter.getTypeRemap(type.text) || type.text;
			emitter.catchup(node.start);
			if (rtype === "string" || rtype === "number") {
				emitter.catchup(node.start);
			}
			else {
				const lazyCast = emitter.classInitializers.resolve(type, type.text) === 'lazy'
					&& (!emitter.classFactory || type.text !== emitter.classFactory.node.findChild(NodeKind.NAME).text);
				if (lazyCast) emitter.insert('(' + emitter.classInitializers.readName + '(' + type.text + ', "unsupported"), ');
				emitter.insert('(<');
				emitter.insert(rtype);
				emitter.insert('>');
				emitter.skipTo(args.start);
				visitNodes(emitter, [args]);
				emitter.catchup(args.end);
				emitter.insert(')');
				if (lazyCast) emitter.insert(')');
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
		const chainedConstructor = isNew && callee && callee.kind === NodeKind.DOT
			&& callee.children[0] && callee.children[0].kind === NodeKind.CALL;
		if (chainedConstructor) emitter.isNew = true;
		visitNodes(emitter, node.children);
		if (chainedConstructor) emitter.isNew = false;
	 }

}

/** The qualified trace surface is a direct call with one String expression. */
function emitNativeTrace(emitter:Emitter, node:Node):boolean {
    const callee = node.children[0];
    if (!callee || callee.kind !== NodeKind.IDENTIFIER || callee.text !== 'trace') return false;
    const binding = emitter.nativeGlobals.resolve(callee);
    if (!binding) return false;
    const stringExpression = (value:Node):boolean => {
        if (value.kind === NodeKind.ENCAPSULATED && value.children.length === 1) return stringExpression(value.children[0]);
        if (value.kind === NodeKind.LITERAL && /^["']/.test(value.text)) return true;
        if (value.kind === NodeKind.IDENTIFIER) {
            const definition = emitter.findDefInScope(value.text);
            return !!definition && !definition.bound && definition.as3Type === 'String';
        }
        return value.kind === NodeKind.ADD && value.children.length >= 3 && value.children.length % 2 === 1
            && value.children.every((child,index) => index % 2 ? child.text === '+' : stringExpression(child));
    };
    const args = node.findChild(NodeKind.ARGUMENTS);
    if (emitter.isNew || !args || args.children.length !== 1 || !stringExpression(args.children[0]))
        throw new Error('AS3_GLOBAL_MODULE_UNSUPPORTED: trace requires a direct single String expression');
    emitter.ensureImportIdentifier('trace as ' + binding.alias,binding.module,false);
    emitter.nativeSourceHelpers.add(binding.alias);
    emitter.catchup(node.start);emitter.insert(binding.alias + '(');
    const value = args.children[0];emitter.skipTo(value.start);visitNode(emitter,value);emitter.catchup(value.end);
    emitter.insert(')');emitter.skipTo(node.end);
    return true;
}

function emitBuiltinObjectCreation(emitter:Emitter, node:Node):boolean {
	const module = emitter.options.nativeObjectCreationModule;
	if (module === undefined || !node) return false;
	let call:Node = node;
	let construct = false;
	if (node.kind === NodeKind.NEW) {
		if (node.children.length !== 1 || !node.children[0] || node.children[0].kind !== NodeKind.CALL) return false;
		call = node.children[0];
		construct = true;
	} else if (node.kind !== NodeKind.CALL) return false;
	const callee = call.children[0], args = call.findChild(NodeKind.ARGUMENTS);
	if (!callee || callee.kind !== NodeKind.IDENTIFIER || callee.text !== 'Object'
		|| emitter.findDefInScope('Object') || !args) return false;
	let helper = construct ? '__as3_as3ConstructClass' : '__as3_as3CallClass';
	while (emitter.source.indexOf(helper) >= 0) helper += '_';
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
	} else {
		emitter.skipTo(args.end);
	}
	emitter.insert('])');
	emitter.skipTo(node.end);
	return true;
}

function emitJSONParse(emitter:Emitter,node:Node):boolean {
    const module=emitter.options.nativeJSONModule,callee=node.children[0];
    if(module===undefined||emitter.isNew||!callee||callee.kind!==NodeKind.DOT||callee.children.length!==2)return false;
    const receiver=callee.children[0],method=callee.children[1];
    if(receiver.kind!==NodeKind.IDENTIFIER||receiver.text!=='JSON'||method.text!=='parse')return false;
    const classes=Object.keys(emitter.options.definitionsByNamespace||{}).reduce((all,ns)=>all.concat(
        emitter.options.definitionsByNamespace[ns].map(name=>(ns?ns+'.':'')+name)),[] as string[]);
    if(emitter.findDefInScope('JSON')||typeOfBinding(receiver,emitter.source,classes))return false;
    const args=node.findChild(NodeKind.ARGUMENTS);
    if(!args||args.children.length<1||args.children.length>2)
        throw new Error('AS3_JSON_UNSUPPORTED: source text parse requires one or two arguments');
    const text=unwrapEncapsulatedExpression(args.children[0]);
    const def=text.kind===NodeKind.IDENTIFIER&&emitter.findDefInScope(text.text);
    if(!(def&&def.as3Type==='String')&&!(text.kind===NodeKind.LITERAL&&/^["']/.test(text.text))&&text.text!=='null'&&!intrinsicStringAs(emitter,text))
        throw new Error('AS3_JSON_UNSUPPORTED: text must have source String binding or literal');
    if(args.children.length===2){
        const reviver=unwrapEncapsulatedExpression(args.children[1]);
        const binding=reviver.kind===NodeKind.IDENTIFIER&&emitter.findDefInScope(reviver.text);
        if(reviver.text!=='null'&&!(binding&&binding.as3Type==='Function')
            &&reviver.kind!==NodeKind.LAMBDA&&reviver.kind!==NodeKind.FUNCTION)
            throw new Error('AS3_JSON_UNSUPPORTED: reviver must have source Function binding, literal function or null');
    }
    const helper=propertyHelper(emitter,'parseSourceJSON',module);
    emitter.catchup(node.start);emitter.insert(helper+'(');emitter.skipTo(getExpressionStart(args.children[0]));
    visitNodes(emitter,args.children);
    const close=args.end>args.start&&emitter.source.charAt(args.end-1)===')'?args.end-1:args.end;
    emitter.catchup(close);emitter.insert(')');emitter.skipTo(node.end);return true;
}

function nativePatternModule(emitter:Emitter):string {
    const input=nativeGeneratedDeclarationInputs(emitter.generated.options.plan,emitter.generated.options.plan.scope);
    const module=emitter.options.nativeStringIntrinsicsModule;
    if(!module||!input.patternProviderModule||!emitter.options.nativeTypedLocals
        ||module!==xmlGlobalProviderModule(input.patternProviderModule,emitter.generated.options.module))
        throw new Error('AS3_PATTERN_LOCAL_UNSUPPORTED: exact generated pattern provider and typed locals required');
    return generatedModule(module);
}

function emitStringPatternCall(emitter:Emitter, node:Node):boolean {
    const module = emitter.options.nativeStringIntrinsicsModule;
    if (module === undefined || emitter.isNew) return false;
    const callee = node.children[0];
    if (!callee || callee.kind !== NodeKind.DOT || ['replace','match','split'].indexOf(callee.children[1].text)<0) return false;
    const method=callee.children[1].text, replacing=method==='replace', splitting=method==='split';
    const args = node.findChild(NodeKind.ARGUMENTS);
    // Ordinary String delimiters retain their separate dispatch path. This
    // source-pattern provider admits literal RegExp delimiters without limits.
    if(splitting&&(!args||!args.children[0]||args.children[0].kind!==NodeKind.LITERAL||!/^\/[\s\S]+\/[a-z]*$/.test(args.children[0].text)))return false;
    const receiver = unwrapEncapsulatedExpression(callee.children[0]);
    if (receiver.kind !== NodeKind.IDENTIFIER) return false;
    const binding = emitter.findDefInScope(receiver.text);
    if (!binding || binding.bound || binding.as3Type !== 'String') return false;
    if (!emitter.references || emitter.references.resolve('String') !== 'String')
        throw new Error('AS3_STRING_INTRINSIC_UNSUPPORTED: exact builtin String source binding required');
    if(splitting)nativePatternModule(emitter);else generatedModule(module);
    if (!args || args.children.length !== (replacing?2:1))
        throw new Error('AS3_STRING_INTRINSIC_UNSUPPORTED: '+method+' requires exactly '+(replacing?'two':'one')+' authored arguments');
    // The legacy regex token end excludes flags; its exact text includes them.
    const pattern = args.children[0], raw = pattern.text;
    let construction:Node = null, match:RegExpExecArray = null;
    if (pattern.kind === NodeKind.NEW) {
        if(!replacing)throw new Error('AS3_STRING_INTRINSIC_UNSUPPORTED: match requires a qualified literal');
        const call=pattern.children[0], target=call&&call.children[0];
        const shadow=target&&emitter.findDefInScope(target.text);
        if (!call || call.kind!==NodeKind.CALL || !target || target.kind!==NodeKind.IDENTIFIER
            || target.text!=='RegExp' || emitter.references.resolve('RegExp')!=='RegExp'
            || shadow&&(shadow.bound||Object.prototype.hasOwnProperty.call(shadow,'as3Type')||shadow.sourceImport))
            throw new Error('AS3_STRING_INTRINSIC_UNSUPPORTED: exact builtin RegExp construction required');
        construction=call.findChild(NodeKind.ARGUMENTS);
        if (!construction || construction.children.length!==2)
            throw new Error('AS3_STRING_INTRINSIC_UNSUPPORTED: pattern construction requires two authored arguments');
    } else {
        if (typeof raw !== 'string' || emitter.source.slice(pattern.start,pattern.start + raw.length) !== raw)
            throw new Error('AS3_STRING_INTRINSIC_UNSUPPORTED: exact source regex token required');
        match = pattern.kind === NodeKind.LITERAL && /^\/([\s\S]+)\/([a-z]*)$/.exec(raw);
        if (!match) throw new Error('AS3_STRING_INTRINSIC_UNSUPPORTED: replace pattern requires a qualified literal');
    }
    const replace = propertyHelper(emitter,replacing?'sourceStringReplace':splitting?'sourceStringSplit':'sourceStringMatch',module);
    const compile = propertyHelper(emitter,construction?'constructSourceStringReplacePattern':'compileSourceStringPattern',module);
    emitter.catchup(node.start); emitter.insert(replace + '(');
    emitter.skipTo(callee.children[0].start); visitNode(emitter,callee.children[0]);
    emitter.catchup(getEffectiveNodeEnd(callee.children[0]));
    emitter.insert(',' + compile + '(');
    if (construction) {
        construction.children.forEach((argument,index)=>{
            if(index)emitter.insert(',');
            emitter.skipTo(getExpressionStart(argument));visitNode(emitter,argument);
            emitter.catchup(getEffectiveNodeEnd(argument));
        });
    } else emitter.insert(JSON.stringify(match[1]) + ',' + JSON.stringify(match[2]));
    emitter.insert(')');
    if(replacing) {
        emitter.insert(',');
        emitter.skipTo(getExpressionStart(args.children[1])); visitNode(emitter,args.children[1]);
        emitter.catchup(getEffectiveNodeEnd(args.children[1]));
    }
    emitter.insert(')');
    emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}

interface DictionaryAccess { receiver:Node; key:Node; literalKey?:string; lexical?:boolean; ownStatic?:boolean; }

function isDictionaryReceiver(emitter:Emitter, node:Node):boolean {
	// Resolve field identity in its declaring class, including protected ancestors.
	// A local with the same spelling continues to own an unqualified identifier.
	const lexicalDictionary = (name:string):boolean => {
		if (!emitter.generated) return false;
		const trait=emitter.generated.lexical.traits.find(t=>t.name===name&&!t.static&&t.kind==='variable');
		const ref=trait&&trait.type&&emitter.generated.options.plan.references.find(r=>
			r.owner===trait.owner&&r.start===trait.type.start&&r.end===trait.type.end);
		return !!ref&&ref.kind==='native'&&ref.identity==='flash.utils.Dictionary';
	};
	if (node && node.kind === NodeKind.DOT && emitter.generated
		&& node.children[0].kind === NodeKind.IDENTIFIER && node.children[0].text === 'this'
		&& node.children[1].kind === NodeKind.LITERAL) {
		const trait = emitter.generated.projection.instanceTraits.find(t => t.name === node.children[1].text);
		const binding = emitter.generated.options.plan.nativeBindings.find(b => b.qname === 'flash.utils.Dictionary');
		return lexicalDictionary(node.children[1].text) || !!binding && !!trait
			&& (trait.kind === 'accessor' || trait.kind === 'variable') && typeof trait.type === 'object'
			&& trait.type.referenceExport === binding.referenceExport;
	}
	if (!node || node.kind !== NodeKind.IDENTIFIER) return false;
	const definition = emitter.findDefInScope(node.text);
	if ((!definition || definition.bound) && lexicalDictionary(node.text)) return true;
	const dictionary = emitter.findDefInScope('Dictionary');
	return !!definition && (definition.as3Type === 'Dictionary' || definition.as3Type === 'flash.utils.Dictionary')
		&& !!dictionary && dictionary.sourceImport === 'flash.utils.Dictionary';
}

function propertyHelper(emitter:Emitter, exported:string, module:string):string {
	let helper = '__as3_' + exported;
	while (emitter.source.indexOf(helper) >= 0) helper += '_';
	emitter.ensureImportIdentifier(exported + ' as ' + helper, module, false);
	emitter.nativeSourceHelpers.add(helper);
	return helper;
}

function dictionaryAccess(emitter:Emitter, node:Node):DictionaryAccess {
	const module = emitter.options.nativeDictionaryPropertyModule;
	if (module === undefined || !node || (node.kind !== NodeKind.DOT && node.kind !== NodeKind.ARRAY_ACCESSOR)
		|| node.children.length !== 2) return null;
	const receiver = node.children[0], key = node.children[1];
	if (!receiver || !key) return null;
	if (!isDictionaryReceiver(emitter, receiver)) return null;
	return node.kind === NodeKind.DOT && key.kind === NodeKind.LITERAL
		? {receiver, key, literalKey:key.text} : {receiver, key};
}

function dictionaryHelper(emitter:Emitter, exported:string):string {
	return propertyHelper(emitter, exported, emitter.options.nativeDictionaryPropertyModule);
}

function emitDictionaryKey(emitter:Emitter, access:DictionaryAccess):void {
	visitNode(emitter, access.receiver);
	emitter.catchup(access.receiver.end);
	emitter.insert(', ');
	if (access.literalKey !== undefined) {
		emitter.insert(JSON.stringify(access.literalKey));
	} else {
		emitter.skipTo(access.key.start);
		visitNode(emitter, access.key);
		emitter.catchup(access.key.end);
	}
}

function emitPropertyKey(emitter:Emitter, access:DictionaryAccess):void {
	emitDictionaryKey(emitter, access);
}

function emitDictionaryProperty(emitter:Emitter, node:Node, exported:string):boolean {
	const access = dictionaryAccess(emitter, node);
	if (!access) return false;
	const target=outerEncapsulatedExpression(node),parent=target&&target.parent;
	if (parent && parent.children[0]===target
		&& [NodeKind.ASSIGN,NodeKind.PRE_INC,NodeKind.PRE_DEC,NodeKind.POST_INC,NodeKind.POST_DEC].indexOf(parent.kind)>=0)
		throw new Error('AS3_DICTIONARY_PROPERTY_UNSUPPORTED: indexed read cannot substitute compound/update dispatch');
	const helper = dictionaryHelper(emitter, exported);
	emitter.catchup(node.start);
	emitter.insert('(<any>' + helper + '(');
	emitDictionaryKey(emitter, access);
	emitter.insert('))');
	emitter.skipTo(node.end);
	return true;
}

function emitDictionaryPropertyAssignment(emitter:Emitter, target:Node, value:Node):boolean {
	const access = dictionaryAccess(emitter, target);
	if (!access) return false;
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

function generatedReceiver(emitter:Emitter,receiver:Node):NativeGeneratedClassTraits {
    if(!emitter.generated||receiver.kind!==NodeKind.IDENTIFIER)return null;
    if(receiver.text==='this')return emitter.generated.projection;
    const definition=emitter.findDefInScope(receiver.text);
    const token=definition&&emitter.references&&emitter.references.type(definition.as3Type);
    const plan=emitter.generated.options.plan,binding=token&&plan.bindings.find(b=>b.tokenExport===token);
    if(!binding)return null;
    let projection=emitter.generatedReceiverTraits.get(binding.qname);
    if(!projection){projection=new NativeGeneratedClassTraits(plan,plan.scope,binding.qname,emitter.generated.sources[binding.qname]);emitter.generatedReceiverTraits.set(binding.qname,projection);}
    return projection;
}
function dynamicAccess(emitter:Emitter,node:Node):DictionaryAccess {
    if(!node||[NodeKind.ARRAY_ACCESSOR,NodeKind.DOT].indexOf(node.kind)<0||node.children.length!==2)return null;
    const receiver=node.children[0],key=node.children[1];
    if(!receiver||!key)return null;
    if(isInterfaceCast(emitter,receiver)){
        if(node.kind!==NodeKind.DOT||key.kind!==NodeKind.LITERAL)
            throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: computed interface-cast properties require separate authority');
        return {receiver,key,literalKey:key.text};
    }
    const internal=emitter.generated&&nativeGeneratedDeclarationInputs(emitter.generated.options.plan,emitter.generated.options.plan.scope).lexicalProviderModule;
    if(internal&&node.kind===NodeKind.ARRAY_ACCESSOR&&receiver.kind===NodeKind.CALL
        &&receiver.children[0].kind===NodeKind.IDENTIFIER&&receiver.children[0].text==='Object'
        &&!emitter.findDefInScope('Object')&&typeOfBinding(receiver.children[0],emitter.source,Object.keys(emitter.generated.classes))==='builtin'
        &&receiver.children[1].children.length===1){
        const argument=receiver.children[1].children[0];
        const definition=argument.kind===NodeKind.IDENTIFIER&&emitter.findDefInScope(argument.text);
        if(argument.kind===NodeKind.IDENTIFIER&&(!definition||!Object.prototype.hasOwnProperty.call(definition,'as3Type'))
            &&emitter.generated.options.plan.bindings.some(b=>b.qname.split('.').pop()===argument.text))
            return {receiver,key,lexical:true};
    }
    if(receiver.kind!==NodeKind.IDENTIFIER){
        if(emitter.generated&&emitter.generated.projection.metadata.isDynamic)
            throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: computed receiver in dynamic class held');
        return null;
    }
    const generated=generatedReceiver(emitter,receiver),definition=emitter.findDefInScope(receiver.text);
    if(internal&&!generated&&node.kind===NodeKind.DOT&&key.kind===NodeKind.LITERAL
        &&definition&&!definition.bound&&['Object','*','Class'].indexOf(definition.as3Type)>=0)
        return {receiver,key,literalKey:key.text,lexical:true};
    if(node.kind===NodeKind.ARRAY_ACCESSOR&&emitter.generated&&emitter.classFactory
        &&receiver.text===emitter.generated.lexical.owner.split('.').pop()
        &&(!definition||!Object.prototype.hasOwnProperty.call(definition,'as3Type'))
        &&emitter.generated.lexical.own.some(t=>t.static&&(t.kind==='constant'
            ||t.kind==='variable'&&t.visibility==='protected'&&t.type&&t.type.text==='String'))){
        let member=node;while(member.parent&&member.parent.kind!==NodeKind.CONTENT)member=member.parent;
        const mods=member.findChild(NodeKind.MOD_LIST),keyDefinition=key.kind===NodeKind.IDENTIFIER&&emitter.findDefInScope(key.text);
        const privateStatic=emitter.generated.lexical.own.some(t=>t.static&&t.kind==='constant'&&t.visibility==='private');
        if(member.kind!==NodeKind.FUNCTION||!privateStatic&&(!mods||!mods.children.some(mod=>mod.text==='static'))
            ||!keyDefinition||keyDefinition.bound||keyDefinition.as3Type!=='String')
            throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: own static constant lookup requires a method String key');
        return {receiver,key,lexical:true,ownStatic:true};
    }
    if(!generated&&(!definition||['Object','*'].indexOf(definition.as3Type)<0))return null;
    const lexical=!!generated&&receiver.text==='this'||!!internal&&node.kind===NodeKind.ARRAY_ACCESSOR;
    if(lexical&&receiver.text==='this'){
        let member=node;while(member.parent&&member.parent.kind!==NodeKind.CONTENT)member=member.parent;
        const mods=member.findChild(NodeKind.MOD_LIST);
        if(mods&&mods.children.some(mod=>mod.text==='static'))throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: static this dispatch held');
    }
    if(node.kind===NodeKind.DOT){
        if(!generated||!generated.metadata.isDynamic||key.kind!==NodeKind.LITERAL
            ||generated.instanceTraits.some(t=>t.name===key.text))return null;
        return {receiver,key,literalKey:key.text,lexical};
    }
    return {receiver,key,lexical};
}
/** Public paths rooted in Object/wildcard locals or an intrinsic Object(value)
 * conversion. Other computed roots need their own source type/visibility proof;
 * do not infer it from TypeScript's any type. */
function objectPropertyAccess(emitter:Emitter,node:Node):DictionaryAccess {
    if(!emitter.options.nativeObjectPropertyModule||!emitter.references||!node
        ||[NodeKind.DOT,NodeKind.ARRAY_ACCESSOR].indexOf(node.kind)<0||node.children.length!==2)return null;
    const receiver=node.children[0],key=node.children[1],root=unwrapEncapsulatedExpression(receiver);
    if(!root||!key||node.kind===NodeKind.DOT&&key.kind!==NodeKind.LITERAL)return null;
    if(root.kind===NodeKind.IDENTIFIER){
        const definition=emitter.findDefInScope(root.text);
        // Event exposes these getters as AS3 Object, even though the shared
        // native API deliberately returns unknown. Preserve source dispatch on
        // their values without granting arbitrary native properties that type.
        if(emitter.generated&&definition&&!definition.bound&&definition.as3Type
            &&node.kind===NodeKind.DOT&&['target','currentTarget'].indexOf(key.text)>=0
            &&emitter.generated.lexical.resolveTypeName(definition.as3Type)==='flash.events.Event'
            &&emitter.generated.options.plan.nativeBindings.some(b=>b.qname==='flash.events.Event'&&!!b.nativeBaseExport))
            return {receiver,key,literalKey:key.text};
        if(!definition||definition.bound||['Object','*'].indexOf(definition.as3Type)<0
            ||definition.as3Type==='Object'&&(emitter.references.sourceClass('Object')||emitter.references.sourceInterface('Object')))return null;
    }else if(root.kind===NodeKind.CALL&&root.children[0]
        &&root.children[0].kind===NodeKind.IDENTIFIER&&root.children[0].text==='Object'){
        const classes=Object.keys(emitter.options.definitionsByNamespace||{}).reduce((all,ns)=>all.concat(
            emitter.options.definitionsByNamespace[ns].map(name=>(ns?ns+'.':'')+name)),[] as string[]);
        if(emitter.findDefInScope('Object')||typeOfBinding(root.children[0],emitter.source,classes)!=='builtin')return null;
        const args=root.findChild(NodeKind.ARGUMENTS);
        if(!emitter.options.nativeObjectCreationModule||!args||args.children.length!==1)
            throw new Error('AS3_OBJECT_PROPERTY_UNSUPPORTED: intrinsic Object receiver requires one argument and source Object conversion provider');
        // Retain the conversion expression: Object(null/undefined) allocates a
        // fresh object, while primitive and genuine instance values keep identity.
    }else if(!objectPropertyAccess(emitter,root))return null;
    return node.kind===NodeKind.DOT?{receiver,key,literalKey:key.text}:{receiver,key};
}
function emitObjectPropertyCall(emitter:Emitter,node:Node):boolean {
    const access=objectPropertyAccess(emitter,node.children[0]),args=node.findChild(NodeKind.ARGUMENTS);
    if(!access||!args)return false;
    if(emitter.isNew)throw new Error('AS3_OBJECT_PROPERTY_UNSUPPORTED: property constructor requires separate construction lowering');
    const helper=propertyHelper(emitter,access.literalKey===undefined?'as3CallProperty':'as3CallNamedProperty',emitter.options.nativeObjectPropertyModule);
    emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(');emitPropertyKey(emitter,access);
    emitter.insert(',()=>[');
    args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(getExpressionStart(arg));visitNode(emitter,arg);emitter.catchup(getEffectiveNodeEnd(arg));});
    emitter.insert(']))');emitter.skipTo(getEffectiveNodeEnd(node));return true;
}
function emitObjectPropertyAssignment(emitter:Emitter,node:Node):boolean {
    const access=objectPropertyAccess(emitter,unwrapEncapsulatedExpression(node.children[0]));
    if(!access)return false;
    const value=node.children[2],helper=propertyHelper(emitter,'as3SetProperty',emitter.options.nativeObjectPropertyModule);
    emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(');emitPropertyKey(emitter,access);
    // Receiver and key are captured before RHS effects. The provider validates
    // after evaluation, stores typed coercion and returns the original RHS.
    emitter.insert(',(');emitter.skipTo(getExpressionStart(value));visitNode(emitter,value);
    emitter.catchup(getEffectiveNodeEnd(value));emitter.insert(')))');
    emitter.skipTo(getEffectiveNodeEnd(node));return true;
}
function emitObjectPropertyAddition(emitter:Emitter,node:Node):boolean {
    const access=objectPropertyAccess(emitter,unwrapEncapsulatedExpression(node.children[0]));
    if(!access||access.literalKey===undefined)return false;
    const value=node.children[2],helper=propertyHelper(emitter,'as3AddAssignProperty',emitter.options.nativeObjectPropertyModule);
    emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(');
    const start=emitter.output.length;
    visitNode(emitter,access.receiver);emitter.catchup(getEffectiveNodeEnd(access.receiver));
    const receiver=emitter.output.slice(start);
    emitter.insert(', '+JSON.stringify(access.literalKey)+',()=>(');
    emitter.skipTo(getExpressionStart(value));visitNode(emitter,value);emitter.catchup(getEffectiveNodeEnd(value));
    // Flash repeats the receiver path for storage, after RHS addition/coercion.
    // Capturing just the first receiver would lose reassignment/getter effects.
    emitter.insert('),()=>('+receiver+')))');emitter.skipTo(getEffectiveNodeEnd(node));return true;
}
function emitObjectPropertyRead(emitter:Emitter,node:Node):boolean {
    const access=objectPropertyAccess(emitter,node);if(!access)return false;
    const outer=outerEncapsulatedExpression(node),parent=outer&&outer.parent;
    if(parent&&(parent.children[0]===outer&&[NodeKind.ASSIGN,NodeKind.CALL].indexOf(parent.kind)>=0
        ||[NodeKind.DELETE,NodeKind.PRE_INC,NodeKind.PRE_DEC,NodeKind.POST_INC,NodeKind.POST_DEC].indexOf(parent.kind)>=0))
        throw new Error('AS3_OBJECT_PROPERTY_UNSUPPORTED: path read cannot substitute write, update, delete or unqualified call');
    const helper=propertyHelper(emitter,'as3GetProperty',emitter.options.nativeObjectPropertyModule);
    emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(');emitPropertyKey(emitter,access);
    emitter.insert('))');emitter.skipTo(getEffectiveNodeEnd(node));return true;
}
function dynamicWriteAccess(emitter:Emitter,node:Node):DictionaryAccess {
    const access=dynamicAccess(emitter,node);
    if(access&&emitter.options.nativeDynamicPropertyWritesModule===undefined){
        if(isInterfaceCast(emitter,access.receiver))generatedModule(emitter.options.nativeDynamicPropertyWritesModule);
        if(generatedReceiver(emitter,access.receiver))throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: generated property writes require provider');
        return null;
    }
    return access;
}
function dynamicHelper(emitter:Emitter,access:DictionaryAccess,operation:string,module:string):string {
    return propertyHelper(emitter,'as3'+operation+(access.lexical?'LexicalProperty':'Property'),
        access.lexical?emitter.generated.lexicalModule:module);
}
function emitDynamicKey(emitter:Emitter,access:DictionaryAccess):void {
    if(access.lexical)emitter.insert(emitter.generated.lexical.scope+', ');
    if(access.ownStatic){
        emitter.insert(emitter.classFactory.value+', ');emitter.skipTo(access.key.start);
        visitNode(emitter,access.key);emitter.catchup(access.key.end);return;
    }
    emitPropertyKey(emitter,access);
}
function emitDynamicPropertyRead(emitter:Emitter,node:Node):boolean {
    const module=emitter.options.nativeDynamicPropertyReadsModule;
    const found=dynamicAccess(emitter,node)||sourceInterfaceGetterAccess(emitter,node);if(!found)return false;
    if(module===undefined){
        if(isInterfaceCast(emitter,found.receiver))generatedModule(module);
        if(generatedReceiver(emitter,found.receiver))throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: generated property reads require provider');
        return false;
    }
    let access=node,parent=node.parent;
    while(parent&&parent.kind===NodeKind.ENCAPSULATED){access=parent;parent=parent.parent;}
    if(parent&&((parent.kind===NodeKind.ASSIGN||parent.kind===NodeKind.CALL)&&parent.children[0]===access
        ||[NodeKind.DELETE,NodeKind.PRE_INC,NodeKind.POST_INC,NodeKind.PRE_DEC,NodeKind.POST_DEC].indexOf(parent.kind)>=0))
        throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: indexed read cannot substitute call, write, update or delete dispatch');
    const helper=dynamicHelper(emitter,found,'Get',module);
    emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(');
    emitDynamicKey(emitter,found);emitter.insert('))');emitter.skipTo(node.end);
    return true;
}

/** Source interface getter reads must preserve source null errors as well as
 * dispatch. A host property read would instead leak a JavaScript TypeError. */
function sourceInterfaceGetterAccess(emitter:Emitter,node:Node):DictionaryAccess {
    if(!emitter.generated||!emitter.references||!node||node.kind!==NodeKind.DOT||node.children.length!==2)return null;
    const receiver=node.children[0],key=node.children[1];
    if(receiver.kind!==NodeKind.IDENTIFIER||key.kind!==NodeKind.LITERAL)return null;
    const definition=emitter.findDefInScope(receiver.text);
    if(!definition||definition.bound||typeof definition.as3Type!=='string')return null;
    const token=emitter.references.sourceInterface(definition.as3Type),plan=emitter.generated.options.plan;
    const contract=plan.interfaces.find(binding=>binding.tokenExport===token);
    if(!contract)return null;
    const owners=new Set<string>();
    const visit=(name:string):void=>{if(owners.has(name))return;owners.add(name);
        const binding=plan.interfaces.find(value=>value.qname===name);if(binding)binding.bases.forEach(visit);};
    visit(contract.qname);
    return plan.interfaceContracts.members.some(member=>owners.has(member.owner)&&member.name===key.text&&member.kind==='get')
        ?{receiver,key,literalKey:key.text}:null;
}

function emitDynamicPropertyAddition(emitter:Emitter, target:Node, value:Node):boolean {
    const dictionary=dictionaryAccess(emitter,target);
    const access=dictionary||dynamicWriteAccess(emitter,target);
    if(!access)return false;
    if(access.ownStatic||!access.lexical&&access.literalKey!==undefined)throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: own-static/nonlexical dot compound assignment held');
    const helper=dynamicHelper(emitter,access,'AddAssign',dictionary
        ? emitter.options.nativeDictionaryPropertyModule : emitter.options.nativeDynamicPropertyWritesModule);
    emitter.catchup(target.parent.start);emitter.insert('(<any>'+helper+'(');
    if(access.lexical)emitter.insert(emitter.generated.lexical.scope+', ');
    const start=emitter.output.length;
    visitNode(emitter,access.receiver);emitter.catchup(access.receiver.end);
    const receiver=emitter.output.slice(start);
    emitter.insert(', ');emitter.skipTo(access.key.start);
    if(access.literalKey!==undefined){emitter.insert(JSON.stringify(access.literalKey));emitter.skipTo(access.key.end);}
    else {visitNode(emitter,access.key);emitter.catchup(access.key.end);}
    emitter.insert(', () => (');emitter.skipTo(getExpressionStart(value));
    visitNode(emitter,value);emitter.catchup(getEffectiveNodeEnd(value));
    emitter.insert('), () => '+receiver+'))');emitter.skipTo(getEffectiveNodeEnd(target.parent));
    return true;
}

function emitDynamicPropertyAssignment(emitter:Emitter, target:Node, value:Node):boolean {
	const access = dynamicWriteAccess(emitter, target);
	if (!access) return false;
	const helper = dynamicHelper(emitter,access,'Set',emitter.options.nativeDynamicPropertyWritesModule);
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

function emitInternalDynamicCall(emitter:Emitter,node:Node):boolean {
    if(!emitter.generated||!nativeGeneratedDeclarationInputs(emitter.generated.options.plan,emitter.generated.options.plan.scope).lexicalProviderModule
        ||[NodeKind.ARRAY_ACCESSOR,NodeKind.DOT].indexOf(node.children[0].kind)<0)return false;
    const access=dynamicAccess(emitter,node.children[0]),args=node.findChild(NodeKind.ARGUMENTS);
    if(!access||!access.lexical||access.ownStatic||!args)return false;
    const helper=dynamicHelper(emitter,access,'Call',emitter.options.nativeDynamicPropertyReadsModule);
    emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(');emitDynamicKey(emitter,access);
    emitter.insert(',()=>[');
    args.children.forEach((arg:Node,index:number)=>{if(index)emitter.insert(',');emitter.skipTo(arg.start);visitNode(emitter,arg);emitter.catchup(arg.end);});
    emitter.insert(']))');emitter.skipTo(node.end);return true;
}

function emitDictionaryPropertyCall(emitter:Emitter, node:Node):boolean {
	if (!node || node.kind !== NodeKind.CALL || node.children.length < 2) return false;
	const access = dictionaryAccess(emitter, node.children[0]);
	const args = node.findChild(NodeKind.ARGUMENTS);
	if (!access || !args) return false;
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
	} else {
		emitter.skipTo(args.end);
	}
	emitter.insert('])');
	emitter.skipTo(node.end);
	return true;
}

function emitDelete(emitter:Emitter, node:Node):void {
    const dynamic=node.children.length===1 && dynamicWriteAccess(emitter,node.children[0]);
    if(dynamic){
        const helper=dynamicHelper(emitter,dynamic,'Delete',emitter.options.nativeDynamicPropertyWritesModule);
        emitter.catchup(node.start);emitter.insert(helper+'(');emitter.skipTo(dynamic.receiver.start);
        emitDynamicKey(emitter,dynamic);emitter.insert(')');emitter.skipTo(node.end);return;
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

function emitArraySortOn(emitter:Emitter, node:Node):boolean {
	const module = emitter.options.nativeArraySortModule;
	if (module === undefined || !node || node.kind !== NodeKind.CALL || node.children.length < 2) return false;
	const callee = node.children[0], args = node.findChild(NodeKind.ARGUMENTS);
	if (!callee || callee.kind !== NodeKind.DOT || callee.children.length !== 2 || !args) return false;
	const receiver = callee.children[0], name = callee.children[1];
	if (!receiver || receiver.kind !== NodeKind.IDENTIFIER || !name || name.kind !== NodeKind.LITERAL
		|| name.text !== 'sortOn') return false;
	const definition = emitter.findDefInScope(receiver.text);
	if (!definition || definition.as3Type !== 'Array') return false;
	let helper = '__as3_as3ArraySortOn';
	while (emitter.source.indexOf(helper) >= 0) helper += '_';
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

function emitTweenMigrationCall(emitter:Emitter, node:Node):boolean {
	const module = emitter.options.nativeTweenModule;
	if (module === undefined || !node || node.kind !== NodeKind.CALL || node.children.length < 2) return false;
	const callee = node.children[0], args = node.findChild(NodeKind.ARGUMENTS);
	if (!callee || callee.kind !== NodeKind.DOT || callee.children.length !== 2 || !args) return false;
	const receiver = callee.children[0], name = callee.children[1];
	if (!receiver || receiver.kind !== NodeKind.IDENTIFIER || (receiver.text !== 'TweenMax' && receiver.text !== 'TweenLite')
		|| !name || name.kind !== NodeKind.LITERAL) return false;
	const query = receiver.text === 'TweenMax' && name.text === 'getTweensOf';
	if (name.text !== 'to' && !query) return false;
	const binding = emitter.findDefInScope(receiver.text);
	if (binding && (binding.bound || Object.prototype.hasOwnProperty.call(binding, 'as3Type')
		|| binding.sourceImport !== 'com.greensock.' + receiver.text)) return false;
	// Query authority comes from the exact legacy import. Unlike the older to()
	// migration, an unbound namesake is not sufficient. The optional legacy
	// onlyActive overload has no corresponding runtime contract.
	if (query && !binding) return false;
	if (query && emitter.isNew)
		throw new Error('AS3_TWEEN_UNSUPPORTED: tween query construction is not qualified');
	if (query && args.children.length !== 1)
		throw new Error('AS3_TWEEN_UNSUPPORTED: getTweensOf requires exactly one target argument');
	let helper = '__as3_FlashTweenRuntime';
	while (emitter.source.indexOf(helper) >= 0) helper += '_';
	emitter.ensureImportIdentifier('FlashTweenRuntime as ' + helper, module, false);
	emitter.nativeSourceHelpers.add(helper);
	emitter.catchup(node.start);
	const method = receiver.text === 'TweenLite' && name.text === 'to' ? 'toLite' : name.text;
	emitter.insert(helper + '.current().' + method + '(');
	if (args.children.length) {
		emitter.skipTo(args.children[0].start);
		visitNodes(emitter, args.children);
		const close = args.end > args.start && emitter.source.charAt(args.end - 1) === ')' ? args.end - 1 : args.end;
		emitter.catchup(close);
	} else {
		emitter.skipTo(args.end);
	}
	emitter.insert(')');
	emitter.skipTo(node.end);
	return true;
}

function emitDirectToString(emitter:Emitter, node:Node):boolean {
	const module = emitter.options.nativeDirectToStringModule;
	if (module === undefined || !node || node.kind !== NodeKind.CALL || node.children.length < 2)
		return false;
	const callee = node.children[0], args = node.findChild(NodeKind.ARGUMENTS);
	if (!callee || callee.kind !== NodeKind.DOT || !args || args.children.length
		|| callee.children.length !== 2) return false;
	const receiver = callee.children[0], name = callee.children[1];
	if (!receiver || !name || name.kind !== NodeKind.LITERAL || name.text !== 'toString') return false;
	let helper = '__as3_as3InvokeToString';
	while (emitter.source.indexOf(helper) >= 0) helper += '_';
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
function emitBuiltinIntCoercion(emitter:Emitter, node:Node):boolean {
    const module=emitter.options.nativeCallableCoercionModule;
    if(module===undefined||!emitter.generated||!node||node.kind!==NodeKind.CALL)return false;
    const callee=node.children[0],args=node.findChild(NodeKind.ARGUMENTS);
    if(!callee||callee.kind!==NodeKind.IDENTIFIER||sourceIdentifier(callee,emitter.source)!=='int'
        ||typeOfBinding(callee,emitter.source,Object.keys(emitter.options.nativeClassInitialization.classes))!=='builtin'
        ||emitter.findDefInScope('int')||!args)return false;
    if(args.children.length!==1)throw new Error('AS3_NUMERIC_CALL_UNSUPPORTED: int requires exactly one source argument');
    let helper='__as3_int';while(emitter.source.indexOf(helper)>=0)helper+='_';
    emitter.ensureImportIdentifier('as3CoerceInt as '+helper,module,false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);emitter.insert(helper+'(');
    emitter.skipTo(args.children[0].start);visitNode(emitter,args.children[0]);
    emitter.catchup(args.children[0].end);emitter.insert(')');emitter.skipTo(node.end);return true;
}

/** A source Boolean call is a runtime conversion, never a TS type assertion. */
function emitBuiltinBooleanCoercion(emitter:Emitter, node:Node):boolean {
    if(!emitter.generated||emitter.isNew||!node||node.kind!==NodeKind.CALL)return false;
    const callee=node.children[0],args=node.findChild(NodeKind.ARGUMENTS);
    if(!callee||callee.kind!==NodeKind.IDENTIFIER||sourceIdentifier(callee,emitter.source)!=='Boolean'
        ||typeOfBinding(callee,emitter.source,Object.keys(emitter.options.nativeClassInitialization.classes))!=='builtin'
        ||emitter.findDefInScope('Boolean')||!args)return false;
    if(args.children.length!==1)throw new Error('AS3_BOOLEAN_CALL_UNSUPPORTED: Boolean requires exactly one source argument');
    const module=generatedModule(emitter.options.nativeObjectCreationModule);
    let helper='__as3_booleanCall';while(emitter.source.indexOf(helper)>=0)helper+='_';
    emitter.ensureImportIdentifier('as3CallClass as '+helper,module,false);
    emitter.nativeSourceHelpers.add(helper);
    emitter.catchup(node.start);emitter.insert(helper+'(Boolean,[');
    emitter.skipTo(args.children[0].start);visitNode(emitter,args.children[0]);
    emitter.catchup(args.children[0].end);emitter.insert('])');emitter.skipTo(node.end);return true;
}

function emitBuiltinStringCoercion(emitter:Emitter, node:Node):boolean {
	const module = emitter.options.nativeStringCoercionModule;
	if (module === undefined || !node || node.kind !== NodeKind.CALL || node.children.length < 2)
		return false;
	const callee = node.children[0], args = node.findChild(NodeKind.ARGUMENTS);
	if (!callee || callee.kind !== NodeKind.IDENTIFIER || callee.text !== 'String'
		|| emitter.findDefInScope('String') || !args) return false;
	if (args.children.length !== 1)
		throw new Error('AS3_STRING_COERCION_UNSUPPORTED: builtin String requires exactly one source argument');
	let helper = '__as3_as3String';
	while (emitter.source.indexOf(helper) >= 0) helper += '_';
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

function isCast(emitter:Emitter, node:Node):boolean {

	if (node.children.length == 0) {
		return false;
	}
	const isVector = node.children[0].kind === NodeKind.VECTOR;
	if (isVector && !emitter.isNew) {
		return true;
	}

	const type:Node = node.findChild(NodeKind.IDENTIFIER);
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


function emitCatch(emitter:Emitter, node:Node):void {
	const name = node.findChild(NodeKind.NAME), type = node.findChild(NodeKind.TYPE);
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
                && !Object.prototype.hasOwnProperty.call(definition,'as3Type'))
            && emitter.references.options.plan.nativeBindings.some(binding => binding.qname === identity)
            && emitter.references.options.plan.references.some(reference => reference.owner === emitter.references.owner
                && reference.start === type.start && reference.end === type.end
                && reference.kind === 'native' && reference.identity === identity);
        if ((!builtinError && !builtinSecurityError && !ioError)
            || node.previousSibling && node.previousSibling.kind === NodeKind.CATCH
            || node.nextSibling && node.nextSibling.kind === NodeKind.CATCH)
            throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: only a single builtin Error/SecurityError or bound native IOError catch is qualified');
        generatedModule(emitter.options.nativeSourceErrorModule);
        let helper = '__as3_reference_catch' + (ioError ? 'IOError' : builtinSecurityError ? 'SecurityError' : 'Error');
        while (emitter.source.indexOf(helper) >= 0) helper += '_';
        emitter.ensureImportIdentifier((ioError ? 'as3IsSourceIOErrorInstance' : builtinSecurityError ? 'as3IsSourceSecurityErrorInstance' : 'as3IsSourceErrorInstance') + ' as ' + helper,emitter.options.nativeSourceErrorModule,false);
        const scope = emitter.enterScope([{name:name.text,as3Type:'*'}]);
        emitter.catchup(name.end); emitter.skipTo(type.end);
        const body = node.findChild(NodeKind.BLOCK);
        emitter.catchup(body.start + 1);
        emitter.insert('if (!' + helper + '(' + name.text + ')) throw ' + name.text + ';');
        visitNode(emitter,body); emitter.catchup(body.end); emitter.exitScope(scope);
        return;
    }
	if (emitter.options.nativeCallableClasses) {
		if (type && type.text !== '*')
			throw new Error('AS3_CALLABLE_CLASS_UNSUPPORTED: typed catch requires AS3 exception dispatch');
		if (node.previousSibling && node.previousSibling.kind === NodeKind.CATCH
			|| node.nextSibling && node.nextSibling.kind === NodeKind.CATCH)
			throw new Error('AS3_CALLABLE_CLASS_UNSUPPORTED: multiple catch clauses require AS3 exception dispatch');
	}
	const catchScope = (emitter.lexical || emitter.references) && emitter.enterScope([]);
    emitter.declareInScope({name: name.text, as3Type: '*'})
	emitter.catchup(node.start);
	if (type && type.text === '*') {
		// Preserve AS3 wildcard typing in modern strict TS. Legacy non-generated
        // output keeps its historical unannotated catch for old TS consumers.
		emitter.catchup(name.end);
		emitter.skipTo(type.end);
        if(emitter.generated)emitter.insert(': any');
		visitNodes(emitter, node.children.slice(node.children.indexOf(type) + 1));
        if (catchScope) emitter.exitScope(catchScope);
		return;
	}
	visitNodes(emitter, node.children);
    if (catchScope) emitter.exitScope(catchScope);
}


function emitRelation(emitter:Emitter, node:Node):void {
    if(intrinsicStringAs(emitter,node)) {
        const helper=propertyHelper(emitter,'as3As',generatedModule(emitter.options.nativeComputedTypeTestModule));
        emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(');
        visitNode(emitter,node.children[0]);emitter.catchup(node.children[0].end);
        emitter.insert(',String))');emitter.skipTo(node.end);return;
    }
    if (emitter.references && node.children.length === 3
        && ['is','as'].indexOf(node.children[1].text) >= 0 && node.lastChild.kind === NodeKind.IDENTIFIER
        && node.lastChild.text === 'Class' && emitter.references.resolve('Class') === 'Class'
        && !emitter.references.sourceClass('Class') && !emitter.references.sourceInterface('Class')) {
        const target = node.lastChild, definition = emitter.findDefInScope('Class');
        if (definition || typeOfBinding(target,emitter.source,[]) !== 'builtin'
            || emitter.references.options.plan.nativeBindings.some(binding => binding.qname === 'Class'))
            throw new Error('AS3_CLASS_TYPE_OPERATION_UNSUPPORTED: shadowed Class target requires separate authority');
        const module = emitter.options.nativeClassTypeOperationsModule;
        if (module === undefined)
            throw new Error('AS3_CLASS_TYPE_OPERATION_UNSUPPORTED: explicit common Class module required');
        let helper = '__as3_class_as';
        while (emitter.source.indexOf(helper) >= 0) helper += '_';
        emitter.ensureImportIdentifier('as3AsClass as ' + helper,module,false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);emitter.insert('(' + helper + '(');
        visitNode(emitter,node.children[0]);emitter.catchup(node.children[0].end);
        emitter.insert(node.children[1].text === 'is' ? ') !== null)' : '))');
        emitter.skipTo(node.end);return;
    }
    if(emitter.options.nativeByteArrayReferenceModule!==undefined&&emitter.references&&node.children.length===3
        &&['is','as'].indexOf(node.children[1].text)>=0&&node.lastChild.kind===NodeKind.IDENTIFIER
        &&emitter.references.resolve(node.lastChild.text)==='flash.utils.ByteArray') {
        const target=node.lastChild,definition=emitter.findDefInScope(target.text);
        if(definition&&(definition.bound||Object.prototype.hasOwnProperty.call(definition,'as3Type')))
            throw new Error('AS3_BYTEARRAY_REFERENCE_UNSUPPORTED: shadowed target requires separate Class authority');
        let method=node.parent;while(method&&[NodeKind.FUNCTION,NodeKind.GET,NodeKind.SET].indexOf(method.kind)<0)method=method.parent;
        if(!method)throw new Error('AS3_BYTEARRAY_REFERENCE_UNSUPPORTED: class initializer type operation held');
        const operation=node.children[1].text;
        let helper='__as3_bytearray_'+operation;while(emitter.source.indexOf(helper)>=0)helper+='_';
        emitter.ensureImportIdentifier((operation==='is'?'as3Is':'as3As')+' as '+helper,generatedModule(emitter.options.nativeComputedTypeTestModule),false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);emitter.insert(helper+'(');
        visitNode(emitter,node.children[0]);emitter.catchup(node.children[0].end);
        emitter.insert(',');emitter.skipTo(target.start);visitNode(emitter,target);
        emitter.catchup(target.end);emitter.insert(')');emitter.skipTo(node.end);return;
    }
    if(emitter.references&&node.children.length===3
        &&['is','as'].indexOf(node.children[1].text)>=0&&node.lastChild.kind===NodeKind.IDENTIFIER
        &&((emitter.options.nativeDisplayObjectReferenceModule!==undefined&&emitter.references.resolve(node.lastChild.text)==='flash.display.DisplayObject')
          ||(emitter.options.nativeMovieClipReferenceModule!==undefined&&emitter.references.resolve(node.lastChild.text)==='flash.display.MovieClip')
          ||(emitter.options.nativeTextFormatReferenceModule!==undefined&&emitter.references.resolve(node.lastChild.text)==='flash.text.TextFormat')
          ||(emitter.options.nativeAccessibilityReferenceModule!==undefined&&emitter.references.resolve(node.lastChild.text)==='flash.accessibility.AccessibilityImplementation')
          ||(emitter.options.nativeSpriteValueReferenceModule!==undefined&&nativeSpriteValueReferenceNames.indexOf(emitter.references.resolve(node.lastChild.text))>=0)
          ||(emitter.options.nativeLoaderReferenceModule!==undefined&&nativeLoaderReferenceNames.indexOf(emitter.references.resolve(node.lastChild.text))>=0)
          ||(emitter.options.nativeSpriteOwnerReferenceModule!==undefined&&nativeSpriteOwnerReferenceNames.indexOf(emitter.references.resolve(node.lastChild.text))>=0)
          ||(emitter.options.nativeInteractiveObjectReferenceModule!==undefined&&emitter.references.resolve(node.lastChild.text)==='flash.display.InteractiveObject'))) {
        const target=node.lastChild,definition=emitter.findDefInScope(target.text);
        if(definition&&(definition.bound||Object.prototype.hasOwnProperty.call(definition,'as3Type')))
            throw new Error('AS3_DISPLAY_REFERENCE_UNSUPPORTED: shadowed target requires separate Class authority');
        let method=node.parent;while(method&&[NodeKind.FUNCTION,NodeKind.GET,NodeKind.SET].indexOf(method.kind)<0)method=method.parent;
        if(!method)throw new Error('AS3_DISPLAY_REFERENCE_UNSUPPORTED: class initializer type operation held');
        const operation=node.children[1].text;
        let helper='__as3_display_'+operation;while(emitter.source.indexOf(helper)>=0)helper+='_';
        emitter.ensureImportIdentifier((operation==='is'?'as3Is':'as3As')+' as '+helper,generatedModule(emitter.options.nativeComputedTypeTestModule),false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);emitter.insert(helper+'(');
        visitNode(emitter,node.children[0]);emitter.catchup(node.children[0].end);
        emitter.insert(',');emitter.skipTo(target.start);visitNode(emitter,target);
        emitter.catchup(target.end);emitter.insert(')');emitter.skipTo(node.end);return;
    }
    if (emitter.options.nativeDictionaryPropertyModule !== undefined && node.children.length === 3
        && node.children[1].text === 'in' && isDictionaryReceiver(emitter,node.lastChild)) {
        const helper = dictionaryHelper(emitter,'as3HasProperty');
        emitter.catchup(node.start);emitter.insert(helper + '(');
        visitNode(emitter,node.children[0]);emitter.catchup(node.children[0].end);
        emitter.insert(',');emitter.skipTo(node.lastChild.start);visitNode(emitter,node.lastChild);
        emitter.catchup(node.lastChild.end);emitter.insert(')');emitter.skipTo(node.end);return;
    }
    const interfaceAs = emitter.references && node.children.length===3
        && (node.children[1].kind===NodeKind.AS || node.children[1].text==='is') && node.lastChild.kind===NodeKind.IDENTIFIER
        && emitter.references.sourceInterface(node.lastChild.text);
    const sourceIs = emitter.generated && emitter.references && node.children.length===3
        && node.children[1].text==='is' && node.lastChild.kind===NodeKind.IDENTIFIER
        && (emitter.references.sourceClass(node.lastChild.text) || !!emitter.references.nativeInterface(node.lastChild.text));
    if (interfaceAs || emitter.generated && node.children.length===3 && (node.children[1].kind===NodeKind.AS || sourceIs)
        && node.lastChild.kind===NodeKind.IDENTIFIER
        && (interfaceAs || emitter.classInitializers.resolve(node,node.lastChild.text)==='lazy'
            || node.lastChild.text===emitter.currentClassName)) {
        const target=node.lastChild,definition=emitter.findDefInScope(target.text);
        const operation=node.children[1].text==='is'?'is':'as';
        if(definition&&(definition.bound||Object.prototype.hasOwnProperty.call(definition,'as3Type')))
            throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: shadowed source '+operation+' target requires Class operand authority');
        let method=node.parent;
        while(method&&[NodeKind.FUNCTION,NodeKind.GET,NodeKind.SET].indexOf(method.kind)<0)method=method.parent;
        if(!method)throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: source '+operation+' during class initialization requires separate authority');
        const module=generatedModule(emitter.options.nativeComputedTypeTestModule);
        let helper='__as3_source_'+operation;while(emitter.source.indexOf(helper)>=0)helper+='_';
        emitter.ensureImportIdentifier((operation==='is'?'as3Is':'as3As')+' as '+helper,module,false);
        emitter.nativeSourceHelpers.add(helper);
        emitter.catchup(node.start);emitter.insert(helper+'(');
        visitNode(emitter,node.children[0]);emitter.catchup(node.children[0].end);
        emitter.insert(',');emitter.skipTo(target.start);
        if (interfaceAs) {
            // An interface token has no implementing-class initializer. Keep
            // operand evaluation in place and use the authenticated domain token.
            let token='__as3_interface_as_'+interfaceAs;
            while(emitter.source.indexOf(token)>=0)token+='_';
            emitter.ensureImportIdentifier(interfaceAs+' as '+token,emitter.references.options.module,false);
            emitter.nativeSourceHelpers.add(token);emitter.insert(token);emitter.skipTo(target.end);
        } else visitNode(emitter,target);
        emitter.catchup(target.end);emitter.insert(')');emitter.skipTo(node.end);return;
    }

    if (containsIsKeyword(node) && node.children.length === 3) {
        const target = node.lastChild, global = emitter.nativeGlobals.resolve(target);
        const targetBinding=target.kind===NodeKind.IDENTIFIER&&emitter.findDefInScope(target.text);
        const nativeEvent=emitter.generated&&emitter.generated.nativeBase&&emitter.generated.nativeBase.qname==='flash.events.Event'&&targetBinding
            &&targetBinding.sourceImport==='flash.events.Event';
        const nativeArray=emitter.generated&&target.kind===NodeKind.IDENTIFIER&&target.text==='Array'
            &&!targetBinding&&emitter.generated.projection.binding.qname.split('.').pop()!=='Array';
        if (global && (global.name === 'AS3Date' || emitter.options.nativeXMLModule && ['XML','XMLList'].indexOf(global.name)>=0) || nativeEvent || nativeArray) {
            const module = emitter.options.nativeComputedTypeTestModule;
            generatedModule(module);
            let helper = nativeArray ? '__as3_array_is' : nativeEvent ? '__as3_event_is' : global.name === 'AS3Date' ? '__as3_date_is' : '__as3_xml_is';
            while (emitter.source.indexOf(helper) >= 0) helper += '_';
            emitter.ensureImportIdentifier('as3Is as ' + helper,module,false);
            emitter.catchup(node.start); emitter.insert(helper + '(');
            visitNode(emitter,node.children[0]); emitter.catchup(node.children[0].end);
            emitter.insert(','); emitter.skipTo(target.start); visitNode(emitter,target);
            emitter.catchup(target.end); emitter.insert(')'); emitter.skipTo(node.end); return;
        }
    }
	if (emitComputedTypeTest(emitter, node)) return;

    if (emitter.options.nativeRelationalModule !== undefined) {
        const symbolic = ['<', '<=', '>', '>='];
        const aliases = ['lt', 'le', 'gt', 'ge'];
        const operators = node.children.filter((_, index) => index % 2 === 1);
        if (operators.some(operator => operator && symbolic.concat(aliases).indexOf(operator.text) >= 0)) {
            if (node.children.length < 3 || node.children.length % 2 !== 1
                || node.children.some(child => !child)
                || operators.some(operator => operator.kind !== NodeKind.OP || symbolic.indexOf(operator.text) < 0))
                throw new Error('AS3_RELATIONAL_COMPILER_UNSUPPORTED: mixed relation operators and AS2 aliases held');
            const exports = ['as3LessThan', 'as3LessThanOrEqual', 'as3GreaterThan', 'as3GreaterThanOrEqual'];
            const helper = (operator: string): string => {
                const exported = exports[symbolic.indexOf(operator)];
                let local = '__as3_source_' + exported;
                while (emitter.source.indexOf(local) >= 0) local += '_';
                emitter.ensureImportIdentifier(exported + ' as ' + local, emitter.options.nativeRelationalModule, false);
                emitter.nativeSourceHelpers.add(local);
                return local;
            };
            emitter.catchup(node.start);
            // Fold only original source comparisons. Both expressions evaluate
            // left-to-right; the common helper owns primitive conversion order.
            const through = (index: number): void => {
                if (index === 0) {
                    visitNode(emitter, node.children[0]);
                    emitter.catchup(getEffectiveNodeEnd(node.children[0]));
                    return;
                }
                const operator = node.children[index - 1], right = node.children[index];
                emitter.insert('(' + helper(operator.text) + '(');
                through(index - 2);
                emitter.catchup(operator.start);
                emitter.insert(','); emitter.skipTo(operator.end);
                emitter.catchup(getExpressionStart(right));
                visitNode(emitter, right); emitter.catchup(getEffectiveNodeEnd(right));
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
	let as = node.findChild(NodeKind.AS);
	if (as) {
        const global = emitter.nativeGlobals.resolve(node.lastChild);
        if (global && global.name === 'AS3Date')
            throw new Error('AS3_GLOBAL_MODULE_UNSUPPORTED: Date as conversion requires native lowering');
        if (emitter.options.nativeCallableMetadata) {
            let helper = node.lastChild.text === 'Class' ? '__as3_source_asClass' : '__as3_source_asType';
            while (emitter.source.indexOf(helper) >= 0) helper += '_';
            emitter.ensureImportIdentifier((node.lastChild.text === 'Class' ? 'as3AsClass' : 'as3As') + ' as ' + helper, emitter.options.nativeCallableMetadata.module, false);
            emitter.nativeSourceHelpers.add(helper);
            emitter.insert(helper + '(');
            visitNodes(emitter, node.getChildUntil(NodeKind.AS));
            emitter.catchup(as.start);
            if (node.lastChild.text !== 'Class') {
                emitter.insert(','); emitter.skipTo(node.lastChild.start);
                if (relationType === 'int' || relationType === 'uint') {
                    let operand = helper + '_operand_' + relationType;
                    while (emitter.source.indexOf(operand) >= 0) operand += '_';
                    emitter.ensureImportIdentifier((relationType === 'int' ? 'AS3Int' : 'AS3Uint') + ' as ' + operand, emitter.options.nativeCallableMetadata.module, false);
                    emitter.insert(operand);
                } else visitNode(emitter, node.lastChild);
            }
            emitter.insert(')');
            emitter.skipTo(node.end);
            return;
        }

		if (emitter.classInitializers.resolve(node, node.lastChild.text) === 'lazy')
			throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: lazy-class as coercion requires separate type authority');
		// TODO: implement relation with type cast to vectors
		//       e.g. (myVector as Vector.<Boolean>)
		if (node.lastChild.kind === NodeKind.IDENTIFIER) {
			emitter.insert('(<');
			let typeText = emitter.getTypeRemap(node.lastChild.text) || node.lastChild.text;

			emitter.insert(typeText);
			emitter.ensureImportIdentifier(typeText);
			emitter.insert('>');
			visitNodes(emitter, node.getChildUntil(NodeKind.AS));
			emitter.catchup(as.start);
			emitter.insert(')');
			emitter.skipTo(node.end);

		} else if (node.lastChild.kind === NodeKind.VECTOR) {
			visitNodes(emitter, node.children);
		} else {
			emitter.commentNode(node, false);
		}
		return;
	}

	// Check for 'is' in relation.
	let is = containsIsKeyword(node);
	if (is) {
        if (emitter.options.nativeCallableMetadata) {
            let helper = node.lastChild.text === 'Class' ? '__as3_source_isClass' : '__as3_source_isType';
            while (emitter.source.indexOf(helper) >= 0) helper += '_';
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
                    while (emitter.source.indexOf(operand) >= 0) operand += '_';
                    emitter.ensureImportIdentifier((relationType === 'int' ? 'AS3Int' : 'AS3Uint') + ' as ' + operand, emitter.options.nativeCallableMetadata.module, false);
                    emitter.insert(operand);
                } else visitNode(emitter, node.lastChild);
            }
            emitter.insert(classTest ? ') !== null' : ')');
            emitter.skipTo(node.end);
            return;
        }

		// Determine if the check is against a primitive or a custom type.
		// console.log(node.toString());
		var isPrimitiveCheck:boolean = containsPrimitiveIdentifier(node);
		var isClassCheck:boolean = containsClassIdentifier(node);
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
			if (varNode.kind == NodeKind.ARRAY_ACCESSOR) {
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
			if (isClassCheck) typeRemapped = "function";
			emitter.insert(`'${typeRemapped}'`);
			if (isClassCheck == false) emitter.ensureImportIdentifier(typeRemapped);

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
			let castedStr:string;
			let castedComplexNode:Node;
			let arrayAccessorNode:Node;
			if (leftIdent.kind == NodeKind.IDENTIFIER)
			{
				castedStr = leftIdent.text;
			} else
			{
				castedComplexNode = leftIdent;
			}

			let middleNode = children[1];
			let rightIdent = children[2];
			//visitNode(emitter, leftIdent);
			//visitNode(emitter, middleNode);
			let isInterface = ClassList.checkIsInterface(rightIdent.text);
			if (isInterface)
			{
				emitter.insert(`${AS3_UTIL}.${INTERFACE_METHOD}(`);
				if (castedStr){
					emitter.insert(castedStr);
				} else if (castedComplexNode){
					visitNode(emitter, castedComplexNode);
					emitter.catchup(castedComplexNode.end);
				}

				emitter.insert (`, "${rightIdent.text}")`);

				if ((VERBOSE_MASK & ReportFlags.EXT_AST_SHOW_CASTING_INTERFACE) == ReportFlags.EXT_AST_SHOW_CASTING_INTERFACE) {
					console.log(">>>Class: " + ClassList.currentClassRecord.getFullPath() + "; ident: " + castedStr + " casts "  + isInterface.getFullPath());
				}
			}
			else
			{
/*				if (castedStr){
					emitter.insert(castedStr);
				}else if (castedComplexNode){

					visitNode(emitter, castedComplexNode);
					emitter.catchup(castedComplexNode.end);
				}*/

				if (rightIdent.text === 'Class'){

				}
				else
				{

				}
				visitNode(emitter, leftIdent);
				emitter.catchup(leftIdent.end);
				emitter.insert(' instanceof ');
				if (emitter.classInitializers.enabled) {
					emitter.skipTo(rightIdent.start);
					visitNode(emitter, rightIdent);
				} else emitter.insert(rightIdent.text);
			}

			emitter.skipTo(node.end);
			if(isInterface) {
				let pathToRoot = ClassList.getLastPathToRoot();
				emitter.ensureImportIdentifier(AS3_UTIL, `${pathToRoot}${AS3_UTIL}`);
			}
			return
		}
	}

	visitNodes(emitter, node.children);
}

function emitComputedTypeTest(emitter:Emitter, node:Node):boolean {
	const module = emitter.options.nativeComputedTypeTestModule;
	if (module === undefined || !node || !containsIsKeyword(node) || node.children.length !== 3)
		return false;
	const left = node.children[0], operator = node.children[1], target = node.children[2];
	if (!left || !operator || operator.kind !== NodeKind.OP || operator.text !== 'is'
		|| !target || target.kind === NodeKind.IDENTIFIER)
		return false;
	let helper = '__as3_source_is';
	while (emitter.source.indexOf(helper) >= 0) helper += '_';
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

function containsIsKeyword(node:Node) {
	for (var i:number = 0; i < node.children.length; i++) {
		var child:Node = node.children[i];
		if (child.text == 'is') {
			return true;
		}
	}
	return false;
	;
}

function containsPrimitiveIdentifier(node:Node) {
	for (var i:number = 0; i < node.children.length; i++) {
		var child:Node = node.children[i];
		if (child.kind == NodeKind.IDENTIFIER) {
			if (child.text === 'Number' || child.text === 'String' || child.text === 'Boolean') {
				return true;
			}
		}
	}
	return false;
}
function containsClassIdentifier(node:Node) {
	for (var i:number = 0; i < node.children.length; i++) {
		var child:Node = node.children[i];
		if (child.kind == NodeKind.IDENTIFIER) {
			if (child.text === 'Class') {
				return true;
			}
		}
	}
	return false;
}

interface TypedAssignmentTarget {
    declaration: Declaration;
    repeatText: string;
}

function isIntegerAS3Type(type: string): boolean {
    return type === 'int' || type === 'uint';
}

function findBoundDeclaration(emitter: Emitter, name: string, bound: string): Declaration {
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
function getTypedAssignmentTarget(emitter: Emitter, node: Node): TypedAssignmentTarget {
    if (emitter.typedLocalPlan && emitter.typedLocalPlan.owns(node, emitter)) return null;
    node = unwrapEncapsulatedExpression(node);
    let declaration: Declaration = null;
    let repeatText: string = null;

    if (node.kind === NodeKind.NAMESPACE_ACCESS) {
        const access = emitter.namespaces.access(node);
        const receiver = access.receiver && emitter.findDefInScope(access.receiver.text);
        const member = emitter.namespaces.accessMember(node, receiver && receiver.type);
        if (member && member.declaration.kind === NodeKind.VAR_LIST) {
            const field = member.declaration.findChild(NodeKind.NAME_TYPE_INIT);
            declaration = { name: member.name, as3Type: getAS3DeclarationType(field) };
            const receiverText = access.receiver && access.receiver.text === 'super' ? 'this' : access.receiver
                ? (receiver && receiver.bound ? receiver.bound + '.' : '') + access.receiver.text
                : member.static ? member.owner.findChild(NodeKind.NAME).text : 'this';
            repeatText = receiverText
                + '[' + emitter.namespaces.key(member.uri, member.name) + ']';
        }
    } else if (node.kind === NodeKind.IDENTIFIER) {
        declaration = emitter.findDefInScope(node.text);
        if (declaration) {
            let identifier = emitter.getIdentifierRemap(node.text) || node.text;
            repeatText = declaration.bound
                ? declaration.bound + '.' + identifier
                : identifier;
        }
    } else if (node.kind === NodeKind.DOT && node.children.length === 2) {
        let receiver = node.children[0];
        let property = node.children[1];
        if (receiver.kind === NodeKind.IDENTIFIER && property.kind === NodeKind.LITERAL &&
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

function emitIntegerCoercionStart(emitter: Emitter): void {
    if (emitter.options.nativeCallableClasses) {
        let alias = '__as3_callable_integerIntrinsics';
        while (emitter.source.indexOf(alias) >= 0) alias += '_';
        emitter.ensureImportIdentifier('callableClassIntrinsics as ' + alias, emitter.generated
            ? emitter.generated.helpers.callableClass : (ClassList.getLastPathToRoot() || './') + 'callableClass', false);
        emitter.insert('(' + alias + '.number(');
    } else emitter.insert('(Number(');
}

function emitIntegerCoercionEnd(emitter: Emitter, as3Type: string): void {
    emitter.insert(as3Type === 'uint' ? ') >>> 0)' : ') | 0)');
}

function getEffectiveNodeEnd(node: Node): number {
    let end = Math.max(node.start, node.end);
    if (node.children) {
        node.children.forEach(child => {
            end = Math.max(end, getEffectiveNodeEnd(child));
        });
    }
    return end;
}

function getExpressionStart(node: Node): number {
    // The parser records unary +/- at node.end and the operand at node.start.
    // Preserve the prefix inside the destination coercion instead of emitting
    // it before the wrapper.
    if ((node.kind === NodeKind.MINUS || node.kind === NodeKind.PLUS) && node.end < node.start) {
        return node.end;
    }
    return node.start;
}

function emitIntegerCoercedNode(emitter: Emitter, node: Node, as3Type: string): void {
    emitIntegerCoercionStart(emitter);
    visitNode(emitter, node);
    emitter.catchup(getEffectiveNodeEnd(node));
    emitIntegerCoercionEnd(emitter, as3Type);
}

function referenceCoercionParts(emitter:Emitter, reference:{exported:string; stringLocal?:boolean; objectParameter?:boolean}):string[] {
    if (reference.objectParameter) return signatureBuiltinCoercionParts(emitter,'Object');
    if (reference.stringLocal) {
        const helper = propertyHelper(emitter,'as3CoerceString',emitter.options.nativeStringLocalCoercionModule);
        return [helper + '(', ')'];
    }
    let helper = '__as3_reference_coerce', token = '__as3_reference_' + reference.exported;
    while (emitter.source.indexOf(helper) >= 0) helper += '_';
    while (emitter.source.indexOf(token) >= 0) token += '_';
    emitter.ensureImportIdentifier('as3CoerceReference as ' + helper,emitter.references.options.coercionModule,false);
    emitter.ensureImportIdentifier(reference.exported + ' as ' + token,emitter.references.options.module,false);
    emitter.nativeSourceHelpers.add(helper); emitter.nativeSourceHelpers.add(token);
    return ['(<any>' + helper + '(',',' + token + '))'];
}

function emitReferenceMethodEntry(emitter:Emitter, block:Node):boolean {
    const signature = emitter.references && emitter.references.signature(block);
    if (!signature || !block.parent || signature.node.start !== block.parent.start) return false;
    const count = propertyHelper(emitter,'as3CheckArgumentCount',emitter.references.options.coercionModule);
    const required = signature.parameters.filter(p => !p.optional).length;
    const lines = [count + '(arguments.length,' + required + (signature.argumentsUsed ? '' : ',' + signature.parameters.length) + ');'];
    signature.parameters.forEach((p,index) => {
        let converted:string;
        if (p.exported) {
            const parts = referenceCoercionParts(emitter,p);
            converted = parts[0] + p.name + parts[1];
        } else if (p.type === 'Object') {
            const parts = signatureBuiltinCoercionParts(emitter,p.type);
            converted = parts[0] + p.name + parts[1];
        } else if (p.type === 'String') {
            const parts = signatureBuiltinCoercionParts(emitter,p.type);
            converted = parts[0] + p.name + parts[1];
            if (p.optional) converted = 'arguments.length <= ' + index + ' ? ' + parts[0] +
                referenceStringDefault(emitter,p.node) + parts[1] + ' : ' + converted;
        } else if (p.type !== '*') {
            if (!emitter.options.nativeNumericMethodParametersModule)
                throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: mixed numeric parameters require common coercion module');
            const helper = propertyHelper(emitter,numericCoercionExport(p.type),emitter.options.nativeNumericMethodParametersModule);
            converted = helper + '(' + p.name + ')';
            if (p.optional) converted = 'arguments.length <= ' + index + ' ? ' + helper + '(' +
                numericDefaultSource(emitter,{name:p.name,type:p.type,index,init:p.node.findChild(NodeKind.INIT)}) + ') : ' + converted;
        }
        if (converted) lines.push(p.name + ' = ' + converted + ';');
        // Emitted modules run in strict mode on both supported targets. Update
        // only supplied entries, after coercion, without aliasing later writes.
        if (signature.argumentsUsed) lines.push('if (arguments.length > ' + index + ') arguments[' + index + '] = ' + p.name + ';');
    });
    emitter.insert('\n' + lines.join('\n') + '\n');
    return true;
}

function emitLocalTypeOf(emitter:Emitter, node:Node):void {
    const operand = node.children.length === 1 && unwrapEncapsulatedExpression(node.children[0]);
    const local = operand && operand.kind === NodeKind.IDENTIFIER && emitter.references
        && emitter.references.local(operand,operand.text);
    const generatedString=operand&&emitter.generated&&emitter.typedLocalPlan&&emitter.typedLocalPlan.stringLocal(operand,emitter);
    if ((!local || !local.stringLocal)&&!generatedString) {visitNodes(emitter,node.children); return;}
    // Qualified String storage includes the source null String atom. The read
    // has no side effects; never fold property/call/assignment operands here.
    emitter.catchup(node.start); emitter.insert('("string")');
    emitter.skipTo(getEffectiveNodeEnd(node));
}

function emitReferenceReturn(emitter:Emitter, node:Node):void {
    const signature = emitter.references && emitter.references.signature(node);
    emitter.catchup(node.start);
    // The legacy parser also represents `throw expression` as RETURN.
    // A thrown value never passes through the method's return type coercion.
    if (emitter.source.slice(node.start,node.start + 6) !== 'return') {visitNodes(emitter,node.children); return;}
    let owner=node.parent;
    while(owner&&[NodeKind.FUNCTION,NodeKind.LAMBDA,NodeKind.GET,NodeKind.SET].indexOf(owner.kind)<0)owner=owner.parent;
    const anonymous=owner&&emitter.generated&&emitter.generated.lexical.anonymousFunctions.find(fn=>fn.start===owner.start&&fn.end===owner.end);
    if(anonymous&&anonymous.returned==='Object'){
        const expression=node.children[0],parts=signatureBuiltinCoercionParts(emitter,'Object');
        emitter.catchup(getExpressionStart(expression));emitter.insert(parts[0]);
        visitNode(emitter,expression);emitter.catchup(getEffectiveNodeEnd(expression));emitter.insert(parts[1]);return;
    }
    if (!signature || !signature.returned && !signature.builtinReturn) {visitNodes(emitter,node.children); return;}
    const expression = node.children[0], parts = signature.returned
        ? referenceCoercionParts(emitter,{exported:signature.returned}) : signatureBuiltinCoercionParts(emitter,signature.builtinReturn);
    emitter.catchup(getExpressionStart(expression));
    emitter.insert(parts[0]);
    visitNode(emitter,expression);
    emitter.catchup(getEffectiveNodeEnd(expression));
    emitter.insert(parts[1]);
}

function signatureBuiltinCoercionParts(emitter:Emitter, type:string):string[] {
    if (type === 'Array') {
        const helper = propertyHelper(emitter,'as3CoerceArray',emitter.references.options.coercionModule);
        return ['(<any>' + helper + '(', '))'];
    }
    if (!emitter.options.nativeSignaturePropertyModule)
        throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: scalar signature requires common property coercion module');
    const helper = propertyHelper(emitter,'coerceAS3PropertyValue',emitter.options.nativeSignaturePropertyModule);
    return ['(<any>' + helper + '(', ',' + JSON.stringify(type) + '))'];
}

function referenceStringDefault(emitter:Emitter, node:Node):string {
    const init = node.findChild(NodeKind.INIT), text = emitter.sourceBetween(init.start,init.end).trim();
    const value = init.children[0];
    if (text !== 'null' && (!value || value.kind !== NodeKind.LITERAL || !/^(["'])[\s\S]*\1$/.test(text)))
        throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: String parameter default must be a literal string or null');
    return text.replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
}

function emitReferenceStringParameter(emitter:Emitter, node:Node):boolean {
    const signature = emitter.references && emitter.references.signature(node);
    const parameter = signature && signature.parameters.find(p => p.node.start === node.start);
    if (!parameter || parameter.type !== 'String' || !parameter.optional) return false;
    referenceStringDefault(emitter,node);
    const type = node.findChild(NodeKind.TYPE), name = node.findChild(NodeKind.NAME);
    emitter.catchup(node.start); emitter.insert(name.text + '?:'); emitter.skipTo(type.start);
    visitNode(emitter,type); emitter.skipTo(getEffectiveNodeEnd(node));
    return true;
}

function emitInit(emitter: Emitter, node: Node): void {
    let declarationNode = node.parent;
    let as3Type = declarationNode && declarationNode.kind === NodeKind.NAME_TYPE_INIT
        ? getAS3DeclarationType(declarationNode)
        : null;

    emitter.catchup(node.start);
    const reference = emitter.references && emitter.references.declaration(declarationNode);
    if (reference) {
        const parts = referenceCoercionParts(emitter,reference);
        emitter.insert(parts[0]); visitNodes(emitter,node.children);
        emitter.catchup(getEffectiveNodeEnd(node)); emitter.insert(parts[1]);
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

function logicalAssignmentTemporary(emitter: Emitter, node: Node): string {
    let body: Node = null;
    for (let current = node; current && current.parent; current = current.parent) {
        if ([NodeKind.FUNCTION, NodeKind.LAMBDA, NodeKind.GET, NodeKind.SET].indexOf(current.parent.kind) >= 0) {
            if (current.kind === NodeKind.BLOCK) body = current;
            break;
        }
    }
    if (!body) throw new Error('AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED: receiver capture outside a function body');
    const allocated: string[] = [];
    emitter.logicalAssignmentTemps.forEach(names => allocated.push(...names));
    let index = allocated.length;
    let name: string;
    do { name = '__as3_logical_receiver_' + index++; }
    while (emitter.source.indexOf(name) >= 0 || allocated.indexOf(name) >= 0);
    emitter.logicalAssignmentTemps.set(body, (emitter.logicalAssignmentTemps.get(body) || []).concat(name));
    return name;
}

function emitLogicalAssignment(emitter: Emitter, node: Node): void {
    const left = unwrapEncapsulatedExpression(node.children[0]);
    const operator = node.children[1].text.slice(0, -1);
    const right = node.children[2];
    const type = logicalAssignmentType(left, name => emitter.findDefInScope(name));
    if (['*', 'int', 'uint', 'Boolean', 'Object'].indexOf(type) < 0)
        throw new Error('AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED: selected-result coercion requires provider authority for ' + type);
    emitter.catchup(node.start);
    emitter.insert('(');
    emitter.skipTo(left.start);
    let reference: string;
    if (left.kind === NodeKind.IDENTIFIER) {
        const start = emitter.output.length;
        visitNode(emitter, left);
        emitter.catchup(left.end);
        reference = emitter.output.slice(start);
    } else if (left.kind === NodeKind.DOT && left.children[1].kind === NodeKind.LITERAL
        && left.children[0].text !== 'super') {
        emitter.namespaces.checkDot(left, emitter.namespaces.receiverType(left));
        const temporary = logicalAssignmentTemporary(emitter, node);
        emitter.insert(temporary + ' = ');
        visitNode(emitter, left.children[0]);
        emitter.catchup(getEffectiveNodeEnd(left.children[0]));
        reference = temporary + '[' + JSON.stringify(left.children[1].text) + ']';
        emitter.insert(', ' + reference);
    } else {
        throw new Error('AS3_LOGICAL_ASSIGNMENT_UNSUPPORTED: only identifier and ordinary dot references are proven');
    }
    emitter.insert(' = ');
    const selected = type === 'Object' ? logicalAssignmentTemporary(emitter, node) : null;
    if (selected) emitter.insert('(' + selected + ' = ');
    if (type === 'int' || type === 'uint') emitIntegerCoercionStart(emitter);
    else if (type === 'Boolean') emitter.insert('!!');
    emitter.insert('(' + reference + ' ' + operator + ' (');
    emitter.skipTo(getExpressionStart(right));
    visitNode(emitter, right); emitter.catchup(getEffectiveNodeEnd(right));
    emitter.insert('))');
    if (type === 'int' || type === 'uint') emitIntegerCoercionEnd(emitter, type);
    if (selected) emitter.insert(', ' + selected + ' === void 0 ? null : ' + selected + ')');
    emitter.insert(')');
    emitter.skipTo(getEffectiveNodeEnd(node));
}

function emitAssign(emitter: Emitter, node: Node): void {
    if (node.children.length !== 3) {
        emitter.catchup(node.start);
        visitNodes(emitter, node.children);
        return;
    }

    let left = node.children[0];
    let operator = node.children[1];
    let right = node.children[2];
    const referenceTarget = unwrapEncapsulatedExpression(left);
    const reference = emitter.references && referenceTarget.kind === NodeKind.IDENTIFIER && emitter.references.local(referenceTarget,referenceTarget.text);
    if (reference) {
        const addition = reference.stringLocal && operator.text === '+=';
        if (operator.text !== '=' && !addition) throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: compound reference write');
        if (addition && !emitter.options.nativeTypedLocalAdditionModule)
            throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: String compound addition requires common addition module');
        if (addition) generatedModule(emitter.options.nativeTypedLocalAdditionModule);
        const temporary = logicalAssignmentTemporary(emitter,node);
        const parts = referenceCoercionParts(emitter,reference);
        emitter.catchup(node.start); emitter.insert('(' + temporary + ' = ');
        // Call arguments capture the old local before evaluating the RHS.
        // Coercion of the addition result happens only after both expressions.
        if (addition) emitter.insert(sourceAdditionHelper(emitter) + '(' + reference.name + ',(');
        emitter.skipTo(getExpressionStart(right));
        visitNode(emitter,right); emitter.catchup(getEffectiveNodeEnd(right));
        if (addition) emitter.insert('))');
        emitter.insert(', ' + reference.name + ' = ' + parts[0] + temporary + parts[1] + ', ' + temporary + ')');
        return;
    }
    if (operator.text === '=' && emitDictionaryPropertyAssignment(emitter, left, right)) return;
    if (operator.text === '=' && emitDynamicPropertyAssignment(emitter, left, right)) return;
    if (operator.text === '=' && emitObjectPropertyAssignment(emitter, node)) return;
    if (operator.text === '+=' && emitDynamicPropertyAddition(emitter, left, right)) return;
    if (operator.text === '+=' && emitObjectPropertyAddition(emitter, node)) return;
    if ((operator.text === '+=' || operator.text === '=') && emitter.typedLocalPlan) {
        const target = emitter.typedLocalPlan.wildcardReference(left, emitter);
        if (target && (operator.text === '+=' || target.write)) {
            emitter.catchup(node.start);
            emitter.insert(target.write ? target.write + '(' : '(' + target.reference + '=');
            emitter.skipTo(getEffectiveNodeEnd(left));
            emitter.catchup(operator.start);
            emitter.skipTo(operator.end);
            if (operator.text === '+=') emitter.insert('(<any>' + sourceAdditionHelper(emitter) + '(' + (target.read ? target.read + '()' : target.reference) + ',');
            emitter.catchup(getExpressionStart(right));
            visitNode(emitter, right);
            emitter.catchup(getEffectiveNodeEnd(right));
            emitter.insert(operator.text === '+=' ? ')))' : ')');
            emitter.skipTo(getEffectiveNodeEnd(node));
            return;
        }
    }
    if (operator.text === '||=' || operator.text === '&&=') {
        if (emitter.typedLocalPlan && emitter.typedLocalPlan.owns(left, emitter))
            throw new Error('AS3_TYPED_LOCAL_UNSUPPORTED: typed logical assignment held');
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
    } else {
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

function sourceAdditionHelper(emitter: Emitter): string {
    let helper = '__as3_source_add';
    while (emitter.source.indexOf(helper) >= 0) helper += '_';
    emitter.ensureImportIdentifier('as3Add as ' + helper, emitter.options.nativeTypedLocalAdditionModule, false);
    emitter.nativeSourceHelpers.add(helper);
    return helper;
}

/** Mark original source addition before any generated callable/local scaffolding. */
function emitAdd(emitter: Emitter, node: Node): void {
    if (!emitter.typedLocalPlan
        || !node.children.some(child => child.kind === NodeKind.OP && child.text === '+')) {
        emitter.catchup(node.start);
        visitNodes(emitter, node.children);
        return;
    }
    const helper = sourceAdditionHelper(emitter);
    emitter.catchup(node.start);
    // ADD contains a flat, left-associative sequence of + and - operands.
    // Nest the source operations without evaluating an operand more than once.
    const through = (index: number): void => {
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

function emitOp(emitter:Emitter, node:Node):void {
	emitter.catchup(node.start);
	if (node.text === Keywords.IS) {
		emitter.insert(Keywords.INSTANCE_OF);
		emitter.skipTo(node.end);
		return;
	}
	emitter.catchup(node.end);
}

function emitOr(emitter:Emitter, node:Node):void {
	// // TODO: support for `value ||= 10` expressions;
	// if (node.children.length === 3 && node.children[2].text === "=")
	// {
	//     node.children[2].text = node.children[0].text + " =";
	// }

	emitter.catchup(node.start);
	visitNodes(emitter, node.children);
}


function hasFunctionLocal(emitter:Emitter, name:string):boolean {
    for (let scope = emitter.scope; scope && scope !== emitter.rootScope; scope = scope.parent) {
        if (!scope.className && scope.declarations.some(declaration => declaration.name === name && !declaration.bound)) return true;
    }
    return false;
}

export function emitIdent(emitter:Emitter, node:Node):void {
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
        const lexical = typeOfBinding(node, emitter.source, []) === 'lexical';
        if (!lexical && declaration && declaration.sourceImport === 'flash.utils.getDefinitionByName') {
            const expression = outerEncapsulatedExpression(node), call = expression.parent;
            if (!call || call.kind !== NodeKind.CALL || call.children[0] !== expression
                || call.parent && call.parent.kind === NodeKind.NEW)
                throw new Error('AS3_DEFINITION_LOOKUP_UNSUPPORTED: package function requires direct call');
            generatedModule(nativeLookupName);
            let alias = '__as3_getDefinitionByName';
            while (emitter.source.indexOf(alias) >= 0) alias += '_';
            emitter.ensureImportIdentifier('getDefinitionByName as ' + alias, nativeLookupName, false);
            emitter.catchup(node.start); emitter.insert(alias); emitter.skipTo(node.end);
            emitter.emitThisForNextIdent = true; return;
        }
        if (!declaration && !lexical)
            throw new Error('AS3_DEFINITION_LOOKUP_UNSUPPORTED: exact package import or source binding required');
    }
	let preservedTypeOfName: string;
	if (emitter.options.nativeCallableMetadata && insideTypeOf(node)
		&& !(node.parent.kind === NodeKind.DOT && node.parent.children[0] !== node)) {
		const name = sourceIdentifier(node, emitter.source);
		const binding = typeOfBinding(node, emitter.source, Object.keys(emitter.options.nativeClassInitialization.classes));
		if (binding === 'builtin' && ['Class', 'int', 'uint'].indexOf(name) >= 0) {
			let alias = '__as3_typeof_builtin_' + name;
			while (emitter.source.indexOf(alias) >= 0) alias += '_';
			const exported = name === 'Class' ? 'AS3ClassType' : name === 'int' ? 'AS3Int' : 'AS3Uint';
			emitter.ensureImportIdentifier(exported + ' as ' + alias, emitter.options.nativeCallableMetadata.module, false);
			let classValue = '__as3_typeof_classValue';
			while (emitter.source.indexOf(classValue) >= 0) classValue += '_';
			emitter.ensureImportIdentifier('as3AsClass as ' + classValue, emitter.options.nativeCallableMetadata.module, false);
			emitter.nativeSourceHelpers.add(classValue);
			emitter.nativeSourceHelpers.add(alias);
			emitter.catchup(node.start); emitter.insert(classValue + '(' + alias + ')'); emitter.skipTo(node.end); return;
		}
		// Preserve source spelling when an authored declaration shadows int/uint.
		if ((name === 'int' || name === 'uint') && binding !== 'builtin') node.text = preservedTypeOfName = name;
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
		let pathToRoot = ClassList.getLastPathToRoot();
		emitter.ensureImportIdentifier(AS3_UTIL, `${pathToRoot}${AS3_UTIL}`);
	}
	emitter.catchup(node.start);
	let staticRef:ClassRecord;
	if (ClassList.isScanning == false)
	{
		staticRef = ClassList.checkIsStaticParentMamber(node.text);
		if (staticRef && (VERBOSE_MASK & ReportFlags.EXT_AST_SHOW_PARENT_STATIC) == ReportFlags.EXT_AST_SHOW_PARENT_STATIC) {
			console.log(">>> Static in parent: " + node.text + "  " + staticRef.getFullPath());
		}
		if ((VERBOSE_MASK & ReportFlags.EXT_AST_SHOW_ALL_STATIC) == ReportFlags.EXT_AST_SHOW_ALL_STATIC) {
			let allStatic = ClassList.checkIsStatic(node.text);
			if (allStatic) console.log(">>> Static ref: " + node.text + "  " + allStatic.getFullPath());

		}
		if ((VERBOSE_MASK & ReportFlags.EXT_AST_SHOW_STATIC_VARIABLES) == ReportFlags.EXT_AST_SHOW_STATIC_VARIABLES) {
			let staticVariable = ClassList.checkIsStaticVariable(node.text);
			if (staticVariable) console.log(">>> Static variable: " + node.text + "  " + staticVariable.getFullPath());

		}


	}

	if (node.parent && node.parent.kind === NodeKind.DOT) {
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
        while (method && [NodeKind.FUNCTION, NodeKind.GET, NodeKind.SET].indexOf(method.kind) < 0) method = method.parent;
        const expression = outerEncapsulatedExpression(node), parent = expression.parent;
        if (!method || parent && (parent.kind === NodeKind.DOT && parent.children[0] === expression
            || parent.kind === NodeKind.ARRAY_ACCESSOR && parent.children[0] === expression
            || parent.kind === NodeKind.CALL && parent.children[0] === expression
            || parent.kind === NodeKind.ASSIGN && parent.children[0] === expression
            || [NodeKind.PRE_INC,NodeKind.PRE_DEC,NodeKind.POST_INC,NodeKind.POST_DEC,NodeKind.DELETE].indexOf(parent.kind) >= 0))
            throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: interface Class value requires a method value expression');
        let token = '__as3_interface_value_' + interfaceValue;
        while (emitter.source.indexOf(token) >= 0) token += '_';
        emitter.ensureImportIdentifier(interfaceValue + ' as ' + token, emitter.references.options.module, false);
        emitter.nativeSourceHelpers.add(token);emitter.insert(token);emitter.skipTo(node.end);return;
    }
    if (emitter.references && !emitter.classInitializers.enabled
        && (!def || !def.bound && !Object.prototype.hasOwnProperty.call(def,'as3Type'))
        && emitter.references.sourceClass(node.text)) {
        const expression = outerEncapsulatedExpression(node), parent = expression.parent;
        const member=parent&&parent.kind===NodeKind.DOT&&parent.children[0]===expression&&parent.children[1];
        const callee=member&&outerEncapsulatedExpression(parent),call=callee&&callee.parent;
        const staticCall=member&&member.kind===NodeKind.LITERAL&&call&&call.kind===NodeKind.CALL
            &&call.children[0]===callee&&(!call.parent||call.parent.kind!==NodeKind.NEW)
            &&emitter.references.publicStaticMethod(node.text,member.text);
        if (!staticCall&&(!parent || parent.kind !== NodeKind.CALL || !parent.parent || parent.parent.kind !== NodeKind.NEW))
            throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: consumer class value requires direct construction or an own public static call');
        let read = '__as3_reference_readClass';
        while (emitter.source.indexOf(read) >= 0) read += '_';
        emitter.ensureImportIdentifier(node.text);
        emitter.ensureImportIdentifier('readNativeClass as ' + read,emitter.options.nativeClassHelperModules.nativeClass,false);
        emitter.insert('(' + read + '(' + node.text + ','+JSON.stringify(staticCall?'read':'unsupported')+'))');
        emitter.skipTo(node.end); return;
    }
	if (emitter.classInitializers.enabled && def && (def.bound || Object.prototype.hasOwnProperty.call(def, 'as3Type')))
		staticRef = null; // An own source binding shadows an inherited static name.
	if (emitter.classInitializers.enabled && !staticRef && (!def || !def.bound && !Object.prototype.hasOwnProperty.call(def, 'as3Type'))) {
		if (node.text.indexOf('.') >= 0) throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: qualified class-value syntax requires separate lowering');
		const own = emitter.classFactory && emitter.classFactory.node.findChild(NodeKind.NAME).text;
		const identity = emitter.classInitializers.resolve(node, node.text);
		const receiver = outerEncapsulatedExpression(node);
		if ((identity === 'lazy' || node.text === own) && receiver.parent
			&& receiver.parent.kind === NodeKind.ARRAY_ACCESSOR && receiver.parent.children[0] === receiver)
			throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: indexed lazy-class receivers require key-order and publication authority');
		if (node.text === own && node.kind !== NodeKind.EXTENDS) {
			emitter.insert(emitter.classFactory.value);
			emitter.skipTo(node.end);
			return;
		}
		if (identity === 'lazy') {
			emitter.ensureImportIdentifier(node.text);
			emitter.ensureImportIdentifier('readNativeClass as ' + emitter.classInitializers.readName,
				(ClassList.getLastPathToRoot() || './') + 'nativeClass', false);
			let context = 'value';
			let expression = outerEncapsulatedExpression(node);
			if (expression.parent && expression.parent.kind === NodeKind.DOT && expression.parent.children[0] === expression) {
				context = 'read';
				const member = outerEncapsulatedExpression(expression.parent), operation = member.parent;
				if (operation && (operation.kind === NodeKind.ASSIGN && operation.children[0] === member
					|| [NodeKind.PRE_INC, NodeKind.PRE_DEC, NodeKind.POST_INC, NodeKind.POST_DEC, NodeKind.DELETE].indexOf(operation.kind) >= 0))
					context = 'unsupported';
			} else if (node.kind === NodeKind.EXTENDS || expression.parent
				&& [NodeKind.CALL, NodeKind.NEW, NodeKind.RELATION].indexOf(expression.parent.kind) >= 0) context = 'unsupported';
			emitter.insert('(' + emitter.classInitializers.readName + '(' + node.text + ', ' + JSON.stringify(context) + '))');
			emitter.skipTo(node.end);
			return;
		}
		if (!identity && /^[A-Z]/.test(node.text) && GLOBAL_NAMES.indexOf(node.text) < 0)
			throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: unresolved class-value identity: ' + node.text);
	}
	if (def && def.bound) {
		const factory = emitter.classFactory;
		emitter.insert((factory && def.bound === factory.node.findChild(NodeKind.NAME).text ? factory.value : def.bound) + '.');
	}
	if (staticRef){
		emitter.ensureImportIdentifier(staticRef.className);
		if (emitter.classInitializers.enabled) {
			const identity = emitter.classInitializers.resolveQualified(staticRef.getFullPath());
			if (!identity) throw new Error('AS3_CLASS_INITIALIZER_UNSUPPORTED: unresolved inherited static class: ' + staticRef.getFullPath());
			emitter.insert(identity === 'lazy' ? '(' + emitter.classInitializers.readName + '(' + staticRef.className + ', "unsupported")).'
				: staticRef.className + '.');
		} else emitter.insert(staticRef.className + ".");
	} else {
		let isClassMember = ClassList.checkIsClassMember(node.text);
		let IsSuperClassName = ClassList.checkIdentIsSuperClassName(node.text);
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
			node.text !== emitter.currentClassName
		) {
            if(emitter.generated&&emitter.generated.projection.metadata.isDynamic)
                throw new Error('AS3_DYNAMIC_PROPERTY_UNSUPPORTED: unqualified dynamic member lookup held');
			if (node.text.match(/^[A-Z]/)) {
				// Import missing identifier from this namespace
				if (!emitter.options.useNamespaces) {
					if (staticRef == undefined)
					{
						emitter.ensureImportIdentifier(node.text);
					}

				}

			} else if (emitter.emitThisForNextIdent) {
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

function emitConsumerLiteralConstant(emitter:Emitter,node:Node):boolean {
    if(!emitter.references||emitter.classInitializers.enabled&&!emitter.generated)return false;
    const receiver=unwrapEncapsulatedExpression(node.children[0]),member=node.children[1];
    if(!receiver||receiver.kind!==NodeKind.IDENTIFIER||!member||member.kind!==NodeKind.LITERAL)return false;
    const def=emitter.findDefInScope(receiver.text);
    if(def&&(def.bound||Object.prototype.hasOwnProperty.call(def,'as3Type')))return false;
    const constant=emitter.references.literalStaticConstant(receiver.text,member.text);
    if(!constant)return false;
    const expression=outerEncapsulatedExpression(node),operation=expression.parent;
    if(operation&&operation.children[0]===expression&&[NodeKind.ASSIGN,NodeKind.PRE_INC,NodeKind.PRE_DEC,NodeKind.POST_INC,NodeKind.POST_DEC,NodeKind.DELETE].indexOf(operation.kind)>=0)
        throw new Error('AS3_REFERENCE_COERCION_UNSUPPORTED: consumer constant mutation');
    // Reference constants require actual class initialization and storage reads.
    // The generated lazy-class path also preserves same-class cinit identity.
    if(constant.literal===null)return false;
    const module=emitter.options.nativeSignaturePropertyModule;generatedModule(module);
    const coerce=propertyHelper(emitter,'coerceAS3PropertyValue',module);
    emitter.catchup(node.start);emitter.insert('(<any>'+coerce+'('+constant.literal+','+JSON.stringify(constant.type)+'))');emitter.skipTo(node.end);
    return true;
}

/** currentDomain belongs to the defining script, independently of receiver/caller. */
function lexicalApplicationDomainModule(emitter:Emitter,node:Node):string {
    if (!emitter.generated || !node.children[1] || node.children[1].text !== 'currentDomain') return null;
    const receiver=unwrapEncapsulatedExpression(node.children[0]);
    const parts=(value:Node):string[]=>{
        value=unwrapEncapsulatedExpression(value);
        if(value.kind===NodeKind.IDENTIFIER||value.kind===NodeKind.LITERAL)return [value.text];
        if(value.kind===NodeKind.DOT&&value.children.length===2){
            const left=parts(value.children[0]),right=value.children[1];
            if(left&&right.kind===NodeKind.LITERAL)return left.concat([right.text]);
        }
        return null;
    };
    const names=parts(receiver);
    if(!names)return null;
    const spelling=names.join('.'),qualified=names.length>1;
    if(qualified?spelling!=='flash.system.ApplicationDomain'
        :emitter.generated.lexical.resolveTypeName(spelling)!=='flash.system.ApplicationDomain')return null;
    let root=receiver;while(root.kind===NodeKind.DOT)root=unwrapEncapsulatedExpression(root.children[0]);
    const input=nativeGeneratedDeclarationInputs(emitter.generated.options.plan,emitter.generated.options.plan.scope);
    const binding=emitter.findDefInScope(names[0]);
    const sourceBinding=typeOfBinding(root,emitter.source,Object.keys(input.sources).concat(Object.keys(input.providers||{})));
    if(binding&&(qualified||binding.bound||Object.prototype.hasOwnProperty.call(binding,'as3Type'))
        ||sourceBinding==='lexical'||qualified&&sourceBinding==='class')return null;
    const provider=input.providers&&input.providers['flash.system.ApplicationDomain'];
    const fail=(reason:string):never=>{throw new Error('AS3_APPLICATION_DOMAIN_UNSUPPORTED: '+reason);};
    if(!provider||provider.exportName!=='ApplicationDomain'||provider.nativeBase||provider.nativeInterface||provider.nativeVector
        ||!emitter.options.importModules||emitter.options.importModules['flash.system.ApplicationDomain']!==xmlGlobalProviderModule(provider.module,emitter.generated.options.module))
        fail('exact native ApplicationDomain provider required');
    if(!input.scriptDomainProvider||!input.scriptGlobalProviderModule||!emitter.generated.projection.binding.scriptGlobalExport)
        fail('defining script requires an explicit cohort domain');
    const expression=outerEncapsulatedExpression(node),operation=expression.parent;
    if(operation&&operation.children[0]===expression&&[NodeKind.ASSIGN,NodeKind.PRE_INC,NodeKind.PRE_DEC,NodeKind.POST_INC,NodeKind.POST_DEC,NodeKind.DELETE,NodeKind.CALL,NodeKind.NEW].indexOf(operation.kind)>=0)
        fail('currentDomain mutation or invocation requires separate authority');
    return generatedModule(xmlGlobalProviderModule(input.scriptGlobalProviderModule,emitter.generated.options.module));
}
function emitLexicalApplicationDomain(emitter:Emitter,node:Node):boolean {
    const module=lexicalApplicationDomainModule(emitter,node);
    if(!module)return false;
    const helper=propertyHelper(emitter,'getAS3ScriptApplicationDomain',module);
    emitter.catchup(node.start);emitter.insert(helper+'('+emitter.generated.lexical.scriptGlobal+')');emitter.skipTo(node.end);
    return true;
}

/** Read an authenticated public Array field through the source property provider.
 * Direct JS indexing/length leaks host TypeErrors when the field is null. */
function emitGeneratedArrayFieldRead(emitter:Emitter, node:Node):boolean {
    if(!emitter.generated || !node || node.children.length!==2)return false;
    const receiver=unwrapEncapsulatedExpression(node.children[0]),key=node.children[1];
    if(!receiver || receiver.kind!==NodeKind.DOT || receiver.children.length!==2
        ||receiver.children[0].kind!==NodeKind.IDENTIFIER||receiver.children[0].text!=='this'
        ||receiver.children[1].kind!==NodeKind.LITERAL)return false;
    const field=emitter.generated.projection.instanceTraits.find(t=>t.name===receiver.children[1].text);
    if(!field||field.kind!=='variable'||field.type!=='Array')return false;
    if(node.kind===NodeKind.DOT&&(key.kind!==NodeKind.LITERAL||key.text!=='length'))return false;
    const outer=outerEncapsulatedExpression(node),parent=outer&&outer.parent;
    // Writes, updates and calls retain their existing separate lowering paths.
    if(parent&&(parent.children[0]===outer&&[NodeKind.ASSIGN,NodeKind.CALL].indexOf(parent.kind)>=0
        ||[NodeKind.DELETE,NodeKind.PRE_INC,NodeKind.PRE_DEC,NodeKind.POST_INC,NodeKind.POST_DEC].indexOf(parent.kind)>=0))return false;
    const helper=propertyHelper(emitter,'as3GetProperty',emitter.generated.propertyModule);
    emitter.catchup(node.start);emitter.insert('(<any>'+helper+'(');
    emitPropertyKey(emitter,node.kind===NodeKind.DOT?{receiver:node.children[0],key,literalKey:key.text}:{receiver:node.children[0],key});
    emitter.insert('))');emitter.skipTo(getEffectiveNodeEnd(node));return true;
}

/** A qualified native receiver is a lexical package name, never a JS object path. */
function qualifiedNativeStaticRead(emitter:Emitter,node:Node):{module:string;exportName:string} {
    if(!emitter.generated||!node||node.kind!==NodeKind.DOT||node.children.length!==2
        ||node.children[1].kind!==NodeKind.LITERAL)return null;
    let root=unwrapEncapsulatedExpression(node.children[0]);
    const parts:string[]=[];
    while(root&&root.kind===NodeKind.DOT&&root.children.length===2&&root.children[1].kind===NodeKind.LITERAL){
        parts.unshift(root.children[1].text);root=unwrapEncapsulatedExpression(root.children[0]);
    }
    if(!root||root.kind!==NodeKind.IDENTIFIER||!parts.length)return null;
    parts.unshift(root.text);
    const name=parts.join('.'),input=nativeGeneratedDeclarationInputs(emitter.generated.options.plan,emitter.generated.options.plan.scope);
    const binding=input.providers&&input.providers[name];
    if(!binding)return null;
    const fail=(reason:string):never=>{throw new Error('AS3_QUALIFIED_NATIVE_READ_UNSUPPORTED: '+reason);};
    if(emitter.findDefInScope(parts[0])||typeOfBinding(root,emitter.source,
        Object.keys(input.sources).concat(Object.keys(input.providers||{})))!==null)
        return null;
    if(binding.nativeInterface||binding.nativeVector||!emitter.options.nativeClassInitialization
        ||emitter.options.nativeClassInitialization.classes[name]!=='ready')
        fail('exact ready native class provider required: '+name);
    const module=xmlGlobalProviderModule(binding.module,emitter.generated.options.module);
    if(!emitter.options.importModules||emitter.options.importModules[name]!==module)
        fail('exact native import binding required: '+name);
    const expression=outerEncapsulatedExpression(node),operation=expression.parent;
    if(operation&&operation.children[0]===expression&&[NodeKind.ASSIGN,NodeKind.PRE_INC,NodeKind.PRE_DEC,
        NodeKind.POST_INC,NodeKind.POST_DEC,NodeKind.DELETE,NodeKind.CALL,NodeKind.NEW].indexOf(operation.kind)>=0)
        fail('native static mutation or invocation requires separate lowering: '+name);
    return {module:generatedModule(module),exportName:binding.exportName};
}

function emitDot(emitter:Emitter, node:Node) {
    if (emitGeneratedArrayFieldRead(emitter,node)) return;
    if (emitLexicalApplicationDomain(emitter,node)) return;
    const nativeRead=qualifiedNativeStaticRead(emitter,node);
    if(nativeRead){
        const alias=propertyHelper(emitter,nativeRead.exportName,nativeRead.module);
        emitter.catchup(node.start);emitter.insert(alias+'.'+node.children[1].text);
        emitter.skipTo(getEffectiveNodeEnd(node));return;
    }
    const lookupModule = emitter.options.importModules && emitter.options.importModules['flash.utils.getDefinitionByName'];
    const lookupReceiver = unwrapEncapsulatedExpression(node.children[0]), member = node.children[1];
    if (lookupModule && member && member.text === 'getDefinitionByName' && lookupReceiver && lookupReceiver.kind === NodeKind.DOT) {
        const namespace = unwrapEncapsulatedExpression(lookupReceiver.children[0]), utils = lookupReceiver.children[1];
        if (namespace && namespace.kind === NodeKind.IDENTIFIER && namespace.text === 'flash'
            && utils && utils.text === 'utils' && !emitter.findDefInScope('flash')
            && typeOfBinding(namespace, emitter.source, []) !== 'lexical')
            throw new Error('AS3_DEFINITION_LOOKUP_UNSUPPORTED: qualified package value requires source binding authority');
    }
    if (emitDynamicPropertyRead(emitter,node)) return;
    if (emitObjectPropertyRead(emitter,node)) return;
    if (emitConsumerLiteralConstant(emitter,node)) return;
	if (emitArraySortConstant(emitter, node)) return;
	if (emitDictionaryProperty(emitter, node, 'as3GetProperty')) return;
	const receiver = node.children[0];
    const receiverDefinition = receiver && receiver.kind === NodeKind.IDENTIFIER
        ? emitter.findDefInScope(receiver.text) : null;
    const receiverType = receiverDefinition && receiverDefinition.type
        || emitter.namespaces.receiverType(node);
    if (emitter.namespaces.lowerOpenedAccess(node, receiverType)) {
		emitNamespaceAccess(emitter, node);
		return;
	}
	emitter.namespaces.checkDot(node, receiverType);
	let dotSibling = node.nextSibling;
	let isConditionalCompilation = (dotSibling && dotSibling.kind === NodeKind.BLOCK);
	let template = "if ($1)";

	if (!isConditionalCompilation && node.parent.kind === NodeKind.CONDITION) {
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
		emitter.insert(template.replace("$1", `process.env.${ node.children[1].text.toUpperCase() }`));
		emitter.skipTo(node.end);
		return;

	} else {
		// TODO: allow conditional compilation for function/class definitions

	}

	visitNodes(emitter, node.children);
}

function emitArraySortConstant(emitter:Emitter, node:Node):boolean {
	const module = emitter.options.nativeArraySortModule;
	if (module === undefined || !node || node.kind !== NodeKind.DOT || node.children.length !== 2)
		return false;
	const receiver = node.children[0], name = node.children[1];
	const constants = ['CASEINSENSITIVE', 'DESCENDING', 'UNIQUESORT', 'RETURNINDEXEDARRAY', 'NUMERIC'];
	if (!receiver || receiver.kind !== NodeKind.IDENTIFIER || receiver.text !== 'Array'
		|| emitter.findDefInScope('Array') || !name || name.kind !== NodeKind.LITERAL || constants.indexOf(name.text) < 0)
		return false;
	let helper = '__as3_AS3ArraySortOptions';
	while (emitter.source.indexOf(helper) >= 0) helper += '_';
	emitter.ensureImportIdentifier('AS3ArraySortOptions as ' + helper, module, false);
	emitter.nativeSourceHelpers.add(helper);
	emitter.catchup(node.start);
	emitter.insert(helper + '.' + name.text);
	emitter.skipTo(node.end);
	return true;
}

function emitArrayAccessor(emitter:Emitter, node:Node):void {
	if (emitGeneratedArrayFieldRead(emitter,node)) return;
	if (emitDictionaryProperty(emitter, node, 'as3GetProperty')) return;
    if (emitDynamicPropertyRead(emitter,node)) return;
    if (emitObjectPropertyRead(emitter,node)) return;
	emitter.catchup(node.start);
	visitNodes(emitter, node.children);
}

function emitXMLLiteral(emitter:Emitter, node:Node):void {
	emitter.catchup(node.start);
	emitter.insert(JSON.stringify(node.text));
	emitter.skipTo(node.end);
}

function emitUnsupportedE4X(emitter:Emitter, node:Node):void {
	throw new Error('AS3_E4X_UNSUPPORTED: descendant selectors require an authenticated native XML lowering');
}

function emitLiteral(emitter:Emitter, node:Node):void {
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
		&& emitter.source.slice(node.start,node.start + node.text.length) === node.text
		? Math.max(node.end,node.start + node.text.length) : node.end;
	emitter.skipTo(tokenEnd);
}

function emitArray(emitter:Emitter, node:Node):void {
	emitter.catchup(node.start);
	// The Vector parser also uses ARRAY for its element list. That list is transport,
	// while any nested ARRAY expression is still a genuine source Array literal.
	const allocate = emitter.options.nativeArrayCreationModule !== undefined
		&& (!node.parent || node.parent.kind !== NodeKind.SHORT_VECTOR);
	if (allocate) {
		let helper = '__as3_source_arrayLiteral';
		while (emitter.source.indexOf(helper) >= 0) helper += '_';
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
	if (allocate) emitter.insert('))');
	emitter.skipTo(node.end);
}



export function emit(ast:Node, source:string, options?:EmitterOptions):string {
	let emitter = new Emitter(source, options);
	return emitter.emit(ast);
}
