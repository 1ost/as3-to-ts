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
}

export interface LoadedCapabilityAuthority {
    sourceCensusSha256: string;
    targetCapabilitiesSha256: string;
    mappingSha256: string;
    typeMappingsBySource: { [qualifiedName: string]: CapabilityMapping };
    memberMappingsByKey: { [memberKey: string]: CapabilityMapping };
}

export interface SemanticIdentity {
    sourceNodeId: string;
    sourceSpan: SourceSpan | null;
}

export interface SemanticType extends SemanticIdentity {
    sourceName: string;
    emittedName: string;
    typeArguments: SemanticType[];
}

export type SemanticModifier = "public" | "private" | "protected" | "static";

export interface SemanticImport extends SemanticIdentity {
    authorityKind: "flash" | "local";
    localNodeId: string | null;
    runtimeConstructible: boolean;
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

export interface IdentifierExpression extends SemanticIdentity {
    kind: "identifier";
    name: string;
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
    arguments: SemanticExpression[];
    capabilitySource: string | null;
    capabilityMember: string | null;
    resultType: SemanticType | null;
}

export interface ArrayExpression extends SemanticIdentity {
    kind: "array";
    elements: SemanticExpression[];
}

export interface IndexExpression extends SemanticIdentity {
    kind: "index";
    target: SemanticExpression;
    index: SemanticExpression;
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
    targetKind: "primitive" | "class" | "vector";
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
    importable: boolean;
    module: LocalTypeModule;
    nodeId: string;
    prerequisites: string[];
    qname: string;
    sourcePath: string;
    sourceSha256: string;
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
        "+" | "-" | "*" | "/" | "%";
    left: SemanticExpression;
    right: SemanticExpression;
    resultType: SemanticType;
}

export interface UnaryExpression extends SemanticIdentity {
    kind: "unary";
    operator: "+" | "-" | "!";
    operand: SemanticExpression;
    resultType: SemanticType;
}

export interface ParenthesizedExpression extends SemanticIdentity {
    kind: "parenthesized";
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

export type SemanticExpression = LiteralExpression | IdentifierExpression | ThisExpression |
    SuperExpression | MemberExpression | MethodClosureExpression | CallExpression | AssignmentExpression |
    NewExpression | BinaryExpression | UnaryExpression | ParenthesizedExpression |
    ConditionalExpression | UpdateExpression | ArrayExpression | IndexExpression | VectorConversionExpression |
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
}

export type SemanticStatement = ExpressionStatement | ReturnStatement | IfStatement |
    WhileStatement | LocalDeclarationStatement | LoopControlStatement;

export interface SemanticParameter extends SemanticIdentity {
    name: string;
    type: SemanticType;
}

export interface SemanticField extends SemanticIdentity {
    kind: "field";
    sharedDeclarationNodeId: string;
    name: string;
    modifiers: SemanticModifier[];
    readonly: boolean;
    type: SemanticType;
    initializer: SemanticExpression | null;
}

export interface SemanticMethod extends SemanticIdentity {
    kind: "method";
    name: string;
    modifiers: SemanticModifier[];
    parameters: SemanticParameter[];
    returnType: SemanticType;
    body: SemanticStatement[];
}

export interface SemanticGetter extends SemanticIdentity {
    kind: "getter";
    name: string;
    modifiers: SemanticModifier[];
    returnType: SemanticType;
    body: SemanticStatement[];
}

export interface SemanticSetter extends SemanticIdentity {
    kind: "setter";
    name: string;
    modifiers: SemanticModifier[];
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
    name: string;
    modifiers: SemanticModifier[];
    extendsType: SemanticType | null;
    members: SemanticMember[];
}

export interface SemanticProgram extends SemanticIdentity {
    schema: "as3-semantic-ir@1";
    sourceSha256: string;
    fingerprintSha256: string;
    packageName: string;
    outputModulePath: string;
    imports: SemanticImport[];
    declaration: SemanticClass;
    sourceCapabilitySha256: string;
    targetCapabilitySha256: string;
    capabilityMappingSha256: string;
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
