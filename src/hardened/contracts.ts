import type { AS3FileLocalClassScope } from "../hardened-runtime/internal/AS3FileLocalIdentity";

export interface SourceSpan {
    start: number;
    end: number;
}

export interface NormalizedParserNode {
    id: string;
    parentId: string | null;
    order: number;
    kind: string;
    span: SourceSpan | null;
    text: string | null;
}

export interface NormalizedParserAst {
    compileDefinitionsSha256?: string;
    includeExpansion?: import("./source-includes").IncludeExpansion;
    schema: "authored-ui-as3-flat-ast@1";
    sourceSha256: string;
    fingerprintSha256: string;
    nodes: NormalizedParserNode[];
}

/** Independently authenticated application launch semantics carried by profile lock v2. */
export interface ApplicationStartContract {
    readonly schema: "as3-application-start-contract@1";
    readonly qname: string;
    readonly exportName: "startAS3Application";
    readonly constructorArguments: readonly [];
    readonly cancellation: "abort-signal-before-construction@1";
    readonly result: "constructed-instance";
}

export interface SourceMemberMapping {
    name: string;
    access: "call" | "read" | "write";
    minArgs: number;
    maxArgs: number;
    signature: string;
}

export interface TargetMemberMapping {
    name: string;
    kind: string;
    scope: "instance" | "static";
    signature: string;
}

export interface CapabilityMapping {
    sourceQName: string;
    sourceRoles: string[];
    sourceMember: SourceMemberMapping | null;
    targetCapabilityId: string;
    targetModule: string;
    targetExport: string;
    targetKind: string;
    targetSignature: string;
    targetMember: TargetMemberMapping | null;
}

export interface CapabilityMappingDocument {
    schema: "as3-source-to-laya-capability-map@1";
    mappings: CapabilityMapping[];
}

export interface ByteArrayNativeTarget {
    readonly targetModule: "src/layaAir/flash/utils/ByteArray.ts";
    readonly targetExport: "ByteArray";
    readonly sourceSignature: 'public function uncompress(algorithm:String = "zlib") : void';
}

export interface CapabilityAuthorityInput {
    byteArrayNative?: ByteArrayNativeTarget;
    stringRangeProvider?: import("./string-range-provider-authority").StringRangeProviderTarget;
    arraySortProvider?: import("./array-sort-provider-authority").ArraySortProviderTarget;
    arraySomeProvider?: import("./array-some-provider-authority").ArraySomeProviderTarget;
    errorStackProvider?: import("./error-stack-provider-authority").ErrorStackProviderTarget;
    mathFloorProvider?: import("./math-floor-provider-authority").MathFloorProviderTarget;
    objectConstructorProvider?: import("./object-constructor-provider-authority").ObjectConstructorProviderTarget;
    objectHasOwnPropertyProvider?: import("./object-has-own-provider-authority").ObjectHasOwnPropertyProviderTarget;
    typeErrorProvider?: import("./type-error-provider-authority").TypeErrorProviderTarget;
    jsonDefinitionProvider?: import("./json-definition-provider-authority").JSONDefinitionProviderTarget;
    byteArrayAMF3?: import("./bytearray-amf3-authority").ByteArrayAMF3Target;
    dateProvider?: import("./date-provider-authority").DateProviderTarget;
    stringPatternProvider?: import("./string-pattern-provider-authority").StringPatternProviderTarget;
    sourceCensusJson: string;
    sourceCensusSha256: string;
    targetCapabilitiesJson: string;
    targetCapabilitiesSha256: string;
    mappingJson: string;
    mappingSha256: string;
    nativeTimerAuthorityJson: string;
    nativeTimerAuthoritySha256: string;
    runtimePackage?: string;
    applicationProfile?: boolean;
}

export interface LoadedCapabilityAuthority {
    byteArrayNative?: ByteArrayNativeTarget;
    stringRangeProvider?: import("./string-range-provider-authority").StringRangeProviderTarget;
    arraySortProvider?: import("./array-sort-provider-authority").ArraySortProviderTarget;
    arraySomeProvider?: import("./array-some-provider-authority").ArraySomeProviderTarget;
    errorStackProvider?: import("./error-stack-provider-authority").ErrorStackProviderTarget;
    mathFloorProvider?: import("./math-floor-provider-authority").MathFloorProviderTarget;
    objectConstructorProvider?: import("./object-constructor-provider-authority").ObjectConstructorProviderTarget;
    objectHasOwnPropertyProvider?: import("./object-has-own-provider-authority").ObjectHasOwnPropertyProviderTarget;
    typeErrorProvider?: import("./type-error-provider-authority").TypeErrorProviderTarget;
    jsonDefinitionProvider?: import("./json-definition-provider-authority").JSONDefinitionProviderTarget;
    byteArrayAMF3?: import("./bytearray-amf3-authority").ByteArrayAMF3Target;
    dateProvider?: import("./date-provider-authority").DateProviderTarget;
    stringPatternProvider?: import("./string-pattern-provider-authority").StringPatternProviderTarget;
    sourceCensusSha256: string;
    targetCapabilitiesSha256: string;
    mappingSha256: string;
    nativeTimerAuthoritySha256: string;
    typeMappingsBySource: { [qualifiedName: string]: CapabilityMapping };
    memberMappingsByKey: { [memberKey: string]: CapabilityMapping };
    intrinsicTypesBySource: { [qualifiedName: string]: {
        sourceRoles: string[];
        targetModule: string;
        targetExport: string;
        targetKind: "class";
        targetSignature: string;
    } };
    intrinsicMembersByKey: { [memberKey: string]: {
        sourceQName: string;
        name: string;
        access: "call" | "read" | "write";
        minArgs: number;
        maxArgs: number;
        parameterTypes: string[];
        returnType: string;
        sourceSignature: string;
    } };
    nativeTimerFunctionsBySource: { [qualifiedName: string]: NativeTimerFunctionMapping };
}

export interface NativeTimerFunctionMapping {
    sourceQName: "flash.utils.clearInterval" | "flash.utils.clearTimeout" | "flash.utils.getTimer"
        | "flash.utils.setInterval" | "flash.utils.setTimeout";
    sourceRoles: string[];
    sourceSignature: string;
    minArgs: number;
    maxArgs: number | null;
    parameterTypes: string[];
    restType: string | null;
    returnType: string;
    targetModule: string;
    targetExport: "clearInterval" | "clearTimeout" | "getTimer" | "setInterval" | "setTimeout";
    targetSignature: string;
}

export interface SemanticIdentity {
    sourceNodeId: string;
    sourceSpan: SourceSpan | null;
}

export interface SemanticType extends SemanticIdentity {
    sourceName: string;
    emittedName: string;
    runtimeName: string | null;
    nullable: boolean;
    typeArguments: SemanticType[];
}

export type SemanticModifier = "internal" | "dynamic" | "final" | "public" | "private" | "protected" | "static" | "override";

export interface SemanticImport extends SemanticIdentity {
    authorityKind: "flash" | "local" | "intrinsic" | "native-timer-function" | "native-reflection-function";
    localNodeId: string | null;
    runtimeConstructible: boolean;
    runtimeInterface: boolean;
    localValueType: string | null;
    localFunction?: true;
    compileTimeNamespace: boolean;
    namespaceUri?: string;
    sourceQualifiedName: string;
    sourceLocalName: string;
    targetModule: string;
    targetExport: string;
}

export type SemanticLiteralValue = string | number | boolean | null;

export interface LiteralExpression extends SemanticIdentity {
    kind: "literal";
    value: SemanticLiteralValue;
}

export interface UndefinedExpression extends SemanticIdentity {
    kind: "undefined";
}

export interface IntrinsicConstantExpression extends SemanticIdentity {
    kind: "intrinsicConstant";
    identity: "Array.NUMERIC" | "Array.DESCENDING"
        | "int.MIN_VALUE" | "int.MAX_VALUE" | "uint.MIN_VALUE" | "uint.MAX_VALUE" | "Number.MAX_VALUE";
    value: -2147483648 | 2147483647 | 0 | 4294967295 | 16 | 2 | 1.7976931348623157e+308;
}

export interface ParseIntegerExpression extends SemanticIdentity {
    kind: "parseInteger";
    arguments: SemanticExpression[];
}

export interface NumericPredicateExpression extends SemanticIdentity {
    kind: "numericPredicate";
    name: "isNaN";
    arguments: SemanticExpression[];
}

export interface EncodeUriComponentExpression extends SemanticIdentity {
    kind: "encodeUriComponent";
    argument: SemanticExpression;
    authoritySha256: string;
}

export interface DecodeUriComponentExpression extends SemanticIdentity {
    kind: "decodeUriComponent";
    argument: SemanticExpression;
    authoritySha256: string;
}

export interface MathExpression extends SemanticIdentity {
    kind: "math";
    member: "PI" | "min" | "max" | "round" | "abs" | "ceil" | "floor" | "pow" | "random";
    arguments: SemanticExpression[] | null;
}

export interface RegExpCallExpression extends SemanticIdentity {
    sharedPatternModule?: string;
    callbackReplacement?: true;
    kind: "regexpCall";
    operation: "test" | "replace" | "replaceValue";
    pattern: string;
    arguments: SemanticExpression[];
    resultType: SemanticType;
}

export interface GlobalCallExpression extends SemanticIdentity {
    kind: "globalCall";
    name: "trace";
    targetModule: string;
    targetExport: string;
    arguments: SemanticExpression[];
}

export interface GlobalFunctionExpression extends SemanticIdentity {
    kind: "globalFunction";
    name: "trace";
    targetModule: string;
    targetExport: string;
}
export interface FunctionApplyExpression extends SemanticIdentity {
    kind: "functionApply";
    invocation?: "call" | "direct" | "field" | "class";
    callerQName?: string;
    target: SemanticExpression;
    receiver: SemanticExpression;
    argumentsArray: SemanticExpression;
    resultType: SemanticType;
}

export interface IdentifierExpression extends SemanticIdentity {
    kind: "identifier";
    name: string;
    bindingKind: "current-class" | "import" | "local" | "parameter" | "package-function" | "builtin-class" | "interface-class";
    bindingSourceQualifiedName: string | null;
}

export interface ThisExpression extends SemanticIdentity {
    kind: "this";
    lexicalName?: string;
}

export interface SuperExpression extends SemanticIdentity {
    kind: "super";
}

export interface MemberExpression extends SemanticIdentity {
    namespaceQName?: string;
    kind: "member";
    superField?: true;
    target: SemanticExpression;
    targetNullable: boolean;
    name: string;
    targetName?: string;
    capabilitySource: string | null;
}

export interface MethodClosureExpression extends SemanticIdentity {
    kind: "methodClosure";
    staticTarget?: SemanticExpression;
    inherited?: true;
    superMethod?: true;
    methodName: string;
}

export interface CallExpression extends SemanticIdentity {
    /** Exact authenticated EventDispatcher super(this): the canonical base selects itself for null. */
    nativeDispatcherSelfTarget?: true;
    immediateLambdaCall?: true;
    kind: "call";
    sharedStringRange?: true;
    sharedArraySort?: true;
    sharedArraySome?: true;
    sharedErrorStack?: true;
    callee: SemanticExpression;
    calleeNullable: boolean;
    packageFunctionCall?: true;
    arguments: SemanticExpression[];
    capabilitySource: string | null;
    capabilityMember: string | null;
    resultType: SemanticType | null;
}

export interface CallableSelfExpression extends SemanticIdentity {
    kind: "callableSelf";
    lambdaName: string | null;
    className: string | null;
    methodName: string | null;
}

export interface ArgumentReadExpression extends SemanticIdentity {
    kind: "argumentRead";
    index: number | null;
    resultType: SemanticType;
}
export interface LambdaExpression extends SemanticIdentity {
    sourceArguments?: true;
    kind: "lambda";
    parameters: SemanticParameter[];
    returnType: SemanticType;
    statements: SemanticStatement[];
    lexicalReceiver?: { name: string; outerName: string | null; className: string };
    selfName?: string;
}

export interface ArrayExpression extends SemanticIdentity {
    kind: "array";
    elements: SemanticExpression[];
}

export interface ObjectProperty extends SemanticIdentity {
    name: string;
    value: SemanticExpression;
}

export interface ObjectExpression extends SemanticIdentity {
    kind: "object";
    properties: ObjectProperty[];
}

export interface OwnRecordExpression extends SemanticIdentity {
    kind: "ownRecord";
    valueType: SemanticType;
}

export interface IndexExpression extends SemanticIdentity {
    kind: "index";
    accessKind: "object" | "vector" | "dictionary" | "byteArray" | "array" | "ownRecord"
        | "bigTurnTableInnerRoot" | "bigTurnTableInnerCost" | "localInterfaceLiteralPublicTrait"
        | "localInterfaceComputedPublicTrait"
        | "mappedNativeDynamicLiteralPublicTrait";
    target: SemanticExpression;
    targetNullable: boolean;
    callerQName?: string;
    localInterfaceLiteralRead?: import("./local-interface-literal-read-authority").LocalInterfaceLiteralReadProof;
    localInterfaceComputedRead?: import("./local-interface-computed-read-authority").LocalInterfaceComputedReadProof;
    mappedNativeDynamicLiteralRead?: import("./mapped-native-dynamic-literal-read-authority").MappedNativeDynamicLiteralReadProof;
    mappedNativeDynamicLiteralTarget?: import("./mapped-native-dynamic-literal-target-authority").MappedNativeDynamicLiteralTargetProof;
    index: SemanticExpression;
    resultType: SemanticType;
}

export interface DictionaryHasExpression extends SemanticIdentity {
    kind: "dictionaryHas";
    target: SemanticExpression;
    index: SemanticExpression;
    resultType: SemanticType;
}

export interface ArrayHasExpression extends SemanticIdentity {
    kind: "arrayHas";
    target: SemanticExpression;
    index: SemanticExpression;
    resultType: SemanticType;
}

export interface ObjectOperationExpression extends SemanticIdentity {
    kind: "objectOperation";
    operation: "has" | "call" | "preparedCall" | "functionAccessorCall";
    target: SemanticExpression;
    index: SemanticExpression;
    arguments: SemanticExpression[];
    callerQName: string;
    mappedNativeDynamicLiteralTarget?: import("./mapped-native-dynamic-literal-target-authority").MappedNativeDynamicLiteralTargetProof;
    resultType: SemanticType;
}

export interface NativeHasOwnPropertyExpression extends SemanticIdentity {
    kind: "nativeHasOwnProperty";
    target: SemanticExpression;
    key: SemanticExpression;
    resultType: SemanticType;
}

export interface DeleteExpression extends SemanticIdentity {
    kind: "delete";
    target: IndexExpression;
    resultType: SemanticType;
}

export interface VectorConversionExpression extends SemanticIdentity {
    kind: "vectorConversion";
    vectorType: SemanticType;
    source: SemanticExpression;
}

export interface RuntimeTypeExpression extends SemanticIdentity {
    kind: "runtimeType";
    operator: "as" | "is";
    value: SemanticExpression;
    targetType: SemanticType;
    targetKind: "primitive" | "class" | "interface" | "vector";
    runtimeName: string;
    resultType: SemanticType;
}

export interface CoercionExpression extends SemanticIdentity {
    objectCall?: true;
    kind: "coercion";
    slot?: true;
    reference?: ReferenceCoercion;
    targetType: SemanticType;
    argument: SemanticExpression | null;
}

export interface ReferenceCoercion {
    targetKind: "class" | "interface";
    runtimeName: string;
}

export type LocalTypeModule = "application" | "bootstrap";
export type LocalTypeKind = "class" | "interface" | "package";

export interface LocalTypeMapping {
    componentId: string;
    graphSourceSha256: string;
    importable: boolean;
    module: LocalTypeModule;
    nodeId: string;
    prerequisites: string[];
    qname: string;
    sourcePath: string;
    sourceContentSha256: string;
    targetPath: string;
    topologicalLevel: number;
    typeKind: LocalTypeKind;
}

export interface LoadedLocalTypeAuthority {
    dependencyGraphRawSha256: string;
    dependencyGraphSemanticSha256: string;
    sourceManifestSha256: string;
    sourceRoots: Readonly<Record<LocalTypeModule, string>>;
    targetRoots: Readonly<Record<LocalTypeModule, string>>;
    entriesByIdentity: { [identity: string]: LocalTypeMapping };
    entries: LocalTypeMapping[];
}

export interface LocalDeclarationParameter {
    name: string;
    type: string;
    optional: boolean;
    rest: boolean;
}

export interface LocalDeclarationMember {
    namespaceQName?: string;
    namespaceUri?: string;
    kind: "constructor" | "method" | "getter" | "setter" | "field" | "namespace";
    name: string;
    modifiers: string[];
    namespaceName: string | null;
    parameters: LocalDeclarationParameter[];
    returnType: string | null;
    fieldType: string | null;
    readonly: boolean;
}

/** A declaration owned by one source file, never a globally importable type. */
export interface FileLocalClassDeclaration {
    schema: "as3-file-local-class-declaration@1";
    ownerQualifiedName: string;
    namespaceUri: string;
    name: string;
    sourceNodeId: string;
    modifiers: string[];
    imports: string[];
    extendsNames: string[];
    implementsNames: string[];
    members: LocalDeclarationMember[];
}

export interface LocalDeclarationExtract {
    finalClass?: true;
    schema: "as3-local-declaration-extract@1";
    sourceSha256: string;
    packageName: string;
    qualifiedName: string;
    declarationKind: "class" | "interface" | "package";
    imports: string[];
    extendsNames: string[];
    implementsNames: string[];
    members: LocalDeclarationMember[];
    packageInitializer: { kind: "new"; typeName: string; argumentCount: 0 } | null;
    classInitializer?: { kind: "same-class-static-void-call"; ownerName: string; methodName: string; argumentCount: 0 };
    fileLocalClasses?: FileLocalClassDeclaration[];
}

export interface LocalMemberDeclaration {
    finalClass?: true;
    baseQNames: string[];
    interfaceQNames: string[];
    members: LocalDeclarationMember[];
    packageInitializer: { kind: "new"; targetQName: string; argumentCount: 0 } | null;
    classInitializer?: { kind: "same-class-static-void-call"; ownerQName: string; methodName: string; argumentCount: 0 };
    fileLocalClasses?: FileLocalClassDeclaration[];
}

export interface LocalMemberAuthorityEntry {
    module: LocalTypeModule;
    qname: string;
    nodeId: string;
    sourceContentSha256: string;
    typeKind: LocalTypeKind;
    status: "complete" | "held";
    holdCode: string | null;
    holdSha256: string | null;
    declaration: LocalMemberDeclaration | null;
}

export interface LoadedLocalMemberAuthority {
    localTypeMapSha256: string;
    declarationWorkerSha256: string;
    sourceCensusSha256: string;
    completeCount: number;
    heldCount: number;
    entries: LocalMemberAuthorityEntry[];
    entriesByIdentity: { [identity: string]: LocalMemberAuthorityEntry };
}

export interface AssignmentExpression extends SemanticIdentity {
    /** Array length coerces the stored uint only after checking the receiver. */
    arrayLengthStorage?: true;
    kind: "assignment";
    operator: "=";
    target: IdentifierExpression | MemberExpression | IndexExpression;
    value: SemanticExpression;
    /** A consumed AS3 assignment returns its input before storage coercion. */
    resultType?: SemanticType;
    storageCoercion?: { kind: "assignmentStorageCoercion"; targetType: SemanticType; slot?: true; reference?: ReferenceCoercion };
    shortCircuit?: "&&" | "||";
    /** AIR evaluates a compound member receiver again after computing its value. */
    deferCompoundStore?: true;
}

export interface NewExpression extends SemanticIdentity {
    nativeArray?: true;
    nativeObject?: true;
    nativeTypeError?: true;
    initializationSelf?: boolean;
    kind: "new";
    sourceType: SemanticType;
    arguments: SemanticExpression[];
    constructorValue?: SemanticExpression;
    dynamicClass?: true;
}

export interface BinaryExpression extends SemanticIdentity {
    /** Native identity is independent of the target classes structural overlap. */
    referenceIdentity?: true;
    kind: "binary";
    numericCoercion?: true;
    additionCoercion?: true;
    equalityCoercion?: true;
    relationCoercion?: true;
    dateRelation?: true;
    operator: "<" | "<=" | ">" | ">=" | "==" | "!=" | "===" | "!==" | "&&" | "||" |
        "+" | "-" | "*" | "/" | "%" | "&" | "|" | "^" | "<<" | ">>" | ">>>";
    left: SemanticExpression;
    right: SemanticExpression;
    resultType: SemanticType;
}

export interface UnaryExpression extends SemanticIdentity {
    kind: "unary";
    operator: "+" | "-" | "!" | "~" | "typeof";
    operand: SemanticExpression;
    resultType: SemanticType;
}

export interface ParenthesizedExpression extends SemanticIdentity {
    kind: "parenthesized";
    expression: SemanticExpression;
    resultType: SemanticType;
}

export interface NonNullExpression extends SemanticIdentity {
    kind: "nonNull";
    expression: SemanticExpression;
    resultType: SemanticType;
}

export interface ConditionalExpression extends SemanticIdentity {
    kind: "conditional";
    condition: SemanticExpression;
    whenTrue: SemanticExpression;
    whenFalse: SemanticExpression;
    resultType: SemanticType;
}

export interface UpdateExpression extends SemanticIdentity {
    numericLocal?: true;
    kind: "update";
    operator: "++" | "--";
    prefix: boolean;
    target: IdentifierExpression | MemberExpression | IndexExpression;
    resultType: SemanticType;
}

export interface ReflectionExpression extends SemanticIdentity {
    kind: "reflection";
    operation: "describe" | "variable" | "staticRead";
    arguments: SemanticExpression[];
    resultType: SemanticType;
}

export type SemanticExpression = ArgumentReadExpression | CallableSelfExpression | ReflectionExpression | RegExpCallExpression | NumericPredicateExpression | EncodeUriComponentExpression | DecodeUriComponentExpression | ParseIntegerExpression | GlobalFunctionExpression | FunctionApplyExpression | DictionaryHasExpression | ArrayHasExpression | ObjectOperationExpression | NativeHasOwnPropertyExpression | LiteralExpression | UndefinedExpression | IntrinsicConstantExpression | MathExpression | GlobalCallExpression | IdentifierExpression | ThisExpression |
    SuperExpression | MemberExpression | MethodClosureExpression | LambdaExpression | CallExpression | AssignmentExpression |
    NewExpression | BinaryExpression | UnaryExpression | ParenthesizedExpression | NonNullExpression |
    ConditionalExpression | UpdateExpression | DeleteExpression | ArrayExpression | ObjectExpression | OwnRecordExpression | IndexExpression | VectorConversionExpression |
    RuntimeTypeExpression | CoercionExpression;

export interface EmptyStatement extends SemanticIdentity {
    kind: "empty";
}

export interface ExpressionStatement extends SemanticIdentity {
    kind: "expression";
    expression: SemanticExpression;
}

export interface ReturnStatement extends SemanticIdentity {
    kind: "return";
    expression: SemanticExpression | null;
}

export interface IfStatement extends SemanticIdentity {
    kind: "if";
    condition: SemanticExpression;
    thenStatements: SemanticStatement[];
    elseStatements: SemanticStatement[] | null;
}

export interface WhileStatement extends SemanticIdentity {
    kind: "while";
    condition: SemanticExpression;
    statements: SemanticStatement[];
}

export interface DoWhileStatement extends SemanticIdentity {
    kind: "doWhile";
    condition: SemanticExpression;
    statements: SemanticStatement[];
}

export interface SemanticSwitchCase extends SemanticIdentity {
    test: SemanticExpression | null;
    statements: SemanticStatement[];
}

export interface SwitchStatement extends SemanticIdentity {
    kind: "switch";
    expression: SemanticExpression;
    cases: SemanticSwitchCase[];
}

export interface ThrowStatement extends SemanticIdentity {
    kind: "throw";
    expression: SemanticExpression;
}

export interface ForStatement extends SemanticIdentity {
    kind: "for";
    initializer: LocalDeclarationStatement | ExpressionStatement | null;
    condition: SemanticExpression | null;
    update: SemanticExpression | null;
    statements: SemanticStatement[];
}

export interface SemanticIterationBinding extends SemanticIdentity {
    name: string;
    type: SemanticType;
}

export interface ForEachStatement extends SemanticIdentity {
    kind: "forEach";
    binding: SemanticIterationBinding;
    bindingReference?: ReferenceCoercion;
    declaresBinding: boolean;
    iterable: SemanticExpression;
    iterableType: SemanticType;
    statements: SemanticStatement[];
}

export interface ForInStatement extends SemanticIdentity {
    kind: "forIn";
    target: SemanticExpression;
    declaresTarget: boolean;
    targetType: SemanticType;
    iterable: SemanticExpression;
    iterableType: SemanticType;
    statements: SemanticStatement[];
}

export interface SemanticCatchClause extends SemanticIdentity {
    name: string;
    temporaryName: string;
    type: SemanticType;
    statements: SemanticStatement[];
}

export interface TryStatement extends SemanticIdentity {
    kind: "try";
    tryStatements: SemanticStatement[];
    catchClause: SemanticCatchClause | null;
    finallyStatements: SemanticStatement[] | null;
}

export interface SemanticLocal extends SemanticIdentity {
    name: string;
    readonly: boolean;
    type: SemanticType;
    initializer: SemanticExpression;
}

export interface LocalDeclarationStatement extends SemanticIdentity {
    kind: "local";
    declarations: SemanticLocal[];
}

export interface LoopControlStatement extends SemanticIdentity {
    kind: "break" | "continue";
    label: string | null;
}

export interface LabelStatement extends SemanticIdentity {
    kind: "label";
    label: string;
    statement: SemanticStatement;
}

export type SemanticStatement = EmptyStatement | ExpressionStatement | ReturnStatement | IfStatement |
    WhileStatement | DoWhileStatement | SwitchStatement | ThrowStatement |
    ForStatement | ForEachStatement | ForInStatement | TryStatement | LocalDeclarationStatement | LoopControlStatement | LabelStatement;

export interface SemanticParameter extends SemanticIdentity {
    defaultValue: SemanticExpression | null;
    name: string;
    rest: boolean;
    type: SemanticType;
}

export interface SemanticField extends SemanticIdentity {
    kind: "field";
    sharedDeclarationNodeId: string;
    name: string;
    /** Owner-qualified storage identity for AS3 private instance namespaces. */
    storageName?: string;
    modifiers: SemanticModifier[];
    namespaceName: string | null;
    readonly: boolean;
    type: SemanticType;
    initializer: SemanticExpression | null;
    embeddedBitmap?: {
        source: string;
        resourceId: string;
        className: string;
        bitmapModule: string;
        bitmapExport: string;
    };
    implicitDefault: "zero" | "nan" | "false" | "null" | "undefined" | "constructor-owned" | null;
}

export interface SemanticMethod extends SemanticIdentity {
    kind: "method";
    name: string;
    modifiers: SemanticModifier[];
    namespaceName: string | null;
    parameters: SemanticParameter[];
    returnType: SemanticType;
    body: SemanticStatement[];
}

/** Original annotation provenance; not a synthesized runtime binding contract. */
export interface SourceBindableEvent extends SemanticIdentity {
    name: "Bindable";
    event: string;
}

export interface SemanticGetter extends SemanticIdentity {
    sourceBindableEvent?: SourceBindableEvent;
    kind: "getter";
    name: string;
    modifiers: SemanticModifier[];
    namespaceName: string | null;
    returnType: SemanticType;
    body: SemanticStatement[];
}

export interface SemanticSetter extends SemanticIdentity {
    kind: "setter";
    name: string;
    modifiers: SemanticModifier[];
    namespaceName: string | null;
    parameter: SemanticParameter;
    body: SemanticStatement[];
}

export interface SemanticConstructor extends SemanticIdentity {
    kind: "constructor";
    /** Non-escaping own slots evaluated before the authenticated Bitmap constructor. */
    preSuperFieldState?: true;
    modifiers: SemanticModifier[];
    parameters: SemanticParameter[];
    body: SemanticStatement[];
}

export type SemanticMember = SemanticField | SemanticMethod | SemanticConstructor | SemanticGetter | SemanticSetter;

export interface InheritedAccessorForward {
    kind: "getter" | "setter";
    name: string;
    ownerQName: string;
    type: SemanticType;
    modifiers: SemanticModifier[];
}

/** Source-only Event annotation; default AIR compilation does not synthesize dispatch or metadata. */
export interface SourceClassEvent extends SemanticIdentity {
    name: "Event";
    event: string;
    type: string;
}

export interface SemanticClass extends SemanticIdentity {
    declarationKind: "class" | "interface";
    name: string;
    modifiers: SemanticModifier[];
    extendsType: SemanticType | null;
    interfaceExtendsTypes: SemanticType[];
    implementsTypes: Array<{ type: SemanticType; runtimeName: string }>;
    members: SemanticMember[];
    classInitializer?: SameClassStaticVoidCall;
    inheritedAccessors?: InheritedAccessorForward[];
    sourceEvents?: SourceClassEvent[];
}

/** Authenticated narrow AS3 class-body cinit statement; not a general statement list. */
export interface SameClassStaticVoidCall extends SemanticIdentity {
    kind: "sameClassStaticVoidCall";
    ownerName: string;
    ownerQualifiedName: string;
    methodName: string;
    argumentCount: 0;
    evidenceRevision: "e04a2f051c188df8fc9396ff7c0b15f481062f7b";
}

export interface SemanticPackageField extends SemanticIdentity {
    declarationKind: "packageField";
    name: string;
    modifiers: SemanticModifier[];
    readonly: true;
    type: SemanticType;
    initializer: SemanticExpression;
}

export interface SemanticPackageFunction extends SemanticIdentity {
    declarationKind: "packageFunction";
    name: string;
    modifiers: SemanticModifier[];
    parameters: SemanticParameter[];
    returnType: SemanticType;
    body: SemanticStatement[];
}
export type SemanticDeclaration = SemanticClass | SemanticPackageField | SemanticPackageFunction;

export interface SemanticProgram extends SemanticIdentity {
    schema: "as3-semantic-ir@1";
    sourceSha256: string;
    fingerprintSha256: string;
    packageName: string;
    outputModulePath: string;
    imports: SemanticImport[];
    declaration: SemanticDeclaration;
    sharedStringRangeModule?: string;
    sharedArraySortModule?: string;
    sharedArraySomeModule?: string;
    sharedErrorStackModule?: string;
    sharedErrorTypeModule?: string;
    sharedMathFloorModule?: string;
    sharedObjectConstructorModule?: string;
    sharedObjectHasOwnPropertyModule?: string;
    sharedTypeErrorModule?: string;
    sharedDateModule?: string;
    fileLocalScope?: AS3FileLocalClassScope;
    fileLocalPrograms?: SemanticProgram[];
    sourceCapabilitySha256: string;
    targetCapabilitySha256: string;
    capabilityMappingSha256: string;
    nativeTimerAuthoritySha256: string;
}

export class HardenedSemanticError extends Error {
    public readonly code: string;
    public readonly sourceNodeId: string | null;

    public constructor(code: string, message: string, sourceNodeId: string | null = null) {
        super(message);
        this.name = "HardenedSemanticError";
        this.code = code;
        this.sourceNodeId = sourceNodeId;
    }
}
