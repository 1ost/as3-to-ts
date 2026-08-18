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
    schema: "authored-ui-as3-flat-ast@1";
    sourceSha256: string;
    fingerprintSha256: string;
    nodes: NormalizedParserNode[];
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

export interface CapabilityAuthorityInput {
    sourceCensusJson: string;
    sourceCensusSha256: string;
    targetCapabilitiesJson: string;
    targetCapabilitiesSha256: string;
    mappingJson: string;
    mappingSha256: string;
    nativeTimerAuthorityJson: string;
    nativeTimerAuthoritySha256: string;
}

export interface LoadedCapabilityAuthority {
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
    targetModule: "@bleach/as3-runtime/AS3Timer";
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

export type SemanticModifier = "public" | "private" | "protected" | "static" | "override";

export interface SemanticImport extends SemanticIdentity {
    authorityKind: "flash" | "local" | "intrinsic" | "native-timer-function";
    localNodeId: string | null;
    runtimeConstructible: boolean;
    runtimeInterface: boolean;
    localValueType: string | null;
    compileTimeNamespace: boolean;
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

export interface IntrinsicConstantExpression extends SemanticIdentity {
    kind: "intrinsicConstant";
    identity: "Array.NUMERIC";
    value: 16;
}

export interface IdentifierExpression extends SemanticIdentity {
    kind: "identifier";
    name: string;
    bindingKind: "import" | "local" | "parameter";
    bindingSourceQualifiedName: string | null;
}

export interface ThisExpression extends SemanticIdentity {
    kind: "this";
}

export interface SuperExpression extends SemanticIdentity {
    kind: "super";
}

export interface MemberExpression extends SemanticIdentity {
    kind: "member";
    target: SemanticExpression;
    targetNullable: boolean;
    name: string;
    capabilitySource: string | null;
}

export interface MethodClosureExpression extends SemanticIdentity {
    kind: "methodClosure";
    methodName: string;
}

export interface CallExpression extends SemanticIdentity {
    kind: "call";
    callee: SemanticExpression;
    calleeNullable: boolean;
    arguments: SemanticExpression[];
    capabilitySource: string | null;
    capabilityMember: string | null;
    resultType: SemanticType | null;
}

export interface LambdaExpression extends SemanticIdentity {
    kind: "lambda";
    parameters: SemanticParameter[];
    returnType: SemanticType;
    statements: SemanticStatement[];
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
    accessKind: "vector" | "dictionary" | "byteArray" | "array" | "ownRecord"
        | "bigTurnTableInnerRoot" | "bigTurnTableInnerCost";
    target: SemanticExpression;
    targetNullable: boolean;
    index: SemanticExpression;
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
    kind: "coercion";
    targetType: SemanticType;
    argument: SemanticExpression | null;
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
    kind: "constructor" | "method" | "getter" | "setter" | "field" | "namespace";
    name: string;
    modifiers: string[];
    namespaceName: string | null;
    parameters: LocalDeclarationParameter[];
    returnType: string | null;
    fieldType: string | null;
    readonly: boolean;
}

export interface LocalDeclarationExtract {
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
}

export interface LocalMemberDeclaration {
    baseQNames: string[];
    interfaceQNames: string[];
    members: LocalDeclarationMember[];
    packageInitializer: { kind: "new"; targetQName: string; argumentCount: 0 } | null;
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
    kind: "assignment";
    operator: "=";
    target: IdentifierExpression | MemberExpression | IndexExpression;
    value: SemanticExpression;
}

export interface NewExpression extends SemanticIdentity {
    kind: "new";
    sourceType: SemanticType;
    arguments: SemanticExpression[];
}

export interface BinaryExpression extends SemanticIdentity {
    kind: "binary";
    operator: "<" | "<=" | ">" | ">=" | "===" | "!==" | "&&" | "||" |
        "+" | "-" | "*" | "/" | "%" | "&" | "|" | "^" | "<<" | ">>" | ">>>";
    left: SemanticExpression;
    right: SemanticExpression;
    resultType: SemanticType;
}

export interface UnaryExpression extends SemanticIdentity {
    kind: "unary";
    operator: "+" | "-" | "!" | "~";
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
    kind: "update";
    operator: "++" | "--";
    prefix: boolean;
    target: IdentifierExpression | MemberExpression | IndexExpression;
    resultType: SemanticType;
}

export type SemanticExpression = LiteralExpression | IntrinsicConstantExpression | IdentifierExpression | ThisExpression |
    SuperExpression | MemberExpression | MethodClosureExpression | LambdaExpression | CallExpression | AssignmentExpression |
    NewExpression | BinaryExpression | UnaryExpression | ParenthesizedExpression | NonNullExpression |
    ConditionalExpression | UpdateExpression | DeleteExpression | ArrayExpression | ObjectExpression | OwnRecordExpression | IndexExpression | VectorConversionExpression |
    RuntimeTypeExpression | CoercionExpression;

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

export type SemanticStatement = ExpressionStatement | ReturnStatement | IfStatement |
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
    modifiers: SemanticModifier[];
    namespaceName: string | null;
    readonly: boolean;
    type: SemanticType;
    initializer: SemanticExpression | null;
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

export interface SemanticGetter extends SemanticIdentity {
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
    modifiers: SemanticModifier[];
    parameters: SemanticParameter[];
    body: SemanticStatement[];
}

export type SemanticMember = SemanticField | SemanticMethod | SemanticConstructor | SemanticGetter | SemanticSetter;

export interface SemanticClass extends SemanticIdentity {
    declarationKind: "class" | "interface";
    name: string;
    modifiers: SemanticModifier[];
    extendsType: SemanticType | null;
    interfaceExtendsTypes: SemanticType[];
    implementsTypes: Array<{ type: SemanticType; runtimeName: string }>;
    members: SemanticMember[];
}

export interface SemanticPackageField extends SemanticIdentity {
    declarationKind: "packageField";
    name: string;
    modifiers: SemanticModifier[];
    readonly: true;
    type: SemanticType;
    initializer: SemanticExpression;
}

export type SemanticDeclaration = SemanticClass | SemanticPackageField;

export interface SemanticProgram extends SemanticIdentity {
    schema: "as3-semantic-ir@1";
    sourceSha256: string;
    fingerprintSha256: string;
    packageName: string;
    outputModulePath: string;
    imports: SemanticImport[];
    declaration: SemanticDeclaration;
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
