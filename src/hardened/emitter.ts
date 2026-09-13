import { fileLocalClassIdentity } from "../hardened-runtime/internal/AS3FileLocalIdentity";
import {
    SemanticExpression,
    SemanticConstructor,
    SemanticField,
    SemanticMember,
    SemanticMethod,
    SemanticModifier,
    SemanticParameter,
    SemanticProgram,
    SemanticStatement,
    SemanticType,
    HardenedSemanticError,
} from "./contracts";
import { assertAdaptedSemanticProgram } from "./adapter";
import { staticConstant } from "./static-constants";

export interface TypeScriptCompilerApi {
    version: string;
    factory: any;
    SyntaxKind: any;
    ScriptTarget: any;
    ScriptKind: any;
    NodeFlags: any;
    NewLineKind: any;
    createPrinter(options: any): any;
    createSourceFile(fileName: string, sourceText: string, languageVersion: any, setParentNodes: boolean, scriptKind: any): any;
}

export interface EmitterOptions {
    compiler: TypeScriptCompilerApi;
    expectedTypeScriptVersion: string;
}

export interface EmittedTypeScript {
    schema: "as3-structural-typescript-output@1";
    modulePath: string;
    code: string;
    typeScriptVersion: string;
}

function modifierTokens(modifiers: SemanticModifier[], ts: TypeScriptCompilerApi): any[] {
    return modifiers.map((modifier) => {
        if (modifier === "public") {
            return ts.factory.createModifier(ts.SyntaxKind.PublicKeyword);
        }
        if (modifier === "private") {
            return ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword);
        }
        if (modifier === "protected") {
            return ts.factory.createModifier(ts.SyntaxKind.ProtectedKeyword);
        }
        if (modifier === "static") {
            return ts.factory.createModifier(ts.SyntaxKind.StaticKeyword);
        }
        if (modifier === "override") {
            return ts.factory.createModifier(ts.SyntaxKind.OverrideKeyword);
        }
        throw new HardenedSemanticError("HARDENED_EMIT_MODIFIER", "semantic IR contains an unsupported modifier");
    });
}

function baseTypeNode(type: SemanticType, ts: TypeScriptCompilerApi): any {
    if (type.emittedName === "AS3Vector") {
        if (type.typeArguments.length !== 1) {
            throw new HardenedSemanticError("HARDENED_EMIT_VECTOR_TYPE", "Vector semantic type requires one element type");
        }
        return ts.factory.createTypeReferenceNode(ts.factory.createIdentifier("__as3Vector"),
            [vectorElementTypeNode(type.typeArguments[0]!, ts)]);
    }
    if (type.emittedName === "AS3OwnRecord") {
        if (type.typeArguments.length !== 1) {
            throw new HardenedSemanticError("HARDENED_EMIT_OWN_RECORD_TYPE",
                "own-record semantic type requires one value type");
        }
        return ts.factory.createTypeReferenceNode(ts.factory.createIdentifier("__AS3OwnRecord"),
            [typeNode(type.typeArguments[0]!, ts)]);
    }
    if (type.emittedName === "boolean") {
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
    }
    if (type.emittedName === "number") {
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
    }
    if (type.emittedName === "string") {
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
    }
    if (type.emittedName === "unknown") {
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
    }
    if (type.emittedName === "void") {
        return ts.factory.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword);
    }
    if (type.emittedName === "null") {
        return ts.factory.createLiteralTypeNode(ts.factory.createNull());
    }
    if (type.emittedName === "Array") {
        return ts.factory.createArrayTypeNode(ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword));
    }
    return ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(type.emittedName),
        type.typeArguments.length === 0 ? undefined : type.typeArguments.map(argument => typeNode(argument, ts)));
}

function typeNode(type: SemanticType, ts: TypeScriptCompilerApi): any {
    const base = baseTypeNode(type, ts);
    return type.nullable && type.emittedName !== "unknown" && type.emittedName !== "null"
        ? ts.factory.createUnionTypeNode([base, ts.factory.createLiteralTypeNode(ts.factory.createNull())])
        : base;
}

function vectorElementTypeNode(element: SemanticType, ts: TypeScriptCompilerApi): any {
    return typeNode(element, ts);
}

function vectorPolicyNode(type: SemanticType, ts: TypeScriptCompilerApi): any {
    const element = type.typeArguments[0];
    if (type.emittedName !== "AS3Vector" || !element) {
        throw new HardenedSemanticError("HARDENED_EMIT_VECTOR_POLICY", "Vector runtime policy requires one element type");
    }
    const names: { [sourceName: string]: string } = {
        int: "int", uint: "uint", Number: "number", Boolean: "boolean", String: "string", Object: "object",
        Array: "array", Class: "class", Function: "function",
    };
    const policy = names[element.sourceName];
    if (policy) {
        return ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("__as3VectorPolicies"), policy);
    }
    if (element.emittedName === "AS3Vector") {
        return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3VectorNested"), undefined,
            [vectorPolicyNode(element, ts)]);
    }
    if (element.runtimeName === null) {
        throw new HardenedSemanticError("HARDENED_EMIT_VECTOR_IDENTITY",
            "Vector reference policy lacks an authenticated runtime identity");
    }
    return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3VectorReference"), undefined, [
        ts.factory.createStringLiteral(element.runtimeName),
        ts.factory.createCallExpression(ts.factory.createIdentifier("__as3NamedReferenceType"), undefined,
            [ts.factory.createStringLiteral(element.runtimeName)]),
    ]);
}

function runtimeTypeTokenNode(expression: Pick<Extract<SemanticExpression, { kind: "runtimeType" }>, "targetKind" | "runtimeName" | "targetType">,
    ts: TypeScriptCompilerApi): any {
    if (expression.targetKind === "primitive") {
        return ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("__as3Types"),
            expression.targetType.sourceName);
    }
    if (expression.targetKind === "vector") {
        return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3VectorType"), undefined,
            [vectorPolicyNode(expression.targetType, ts)]);
    }
    if (expression.targetKind === "interface") {
        return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3InterfaceType"), undefined,
            [ts.factory.createStringLiteral(expression.runtimeName)]);
    }
    return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3ClassType"), undefined, [
        ts.factory.createStringLiteral(expression.runtimeName),
        ts.factory.createIdentifier(expression.targetType.emittedName),
    ]);
}

function initializeClassNode(value: any, self: boolean, ts: TypeScriptCompilerApi): any {
    return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3InitializeClass"), undefined,
        [value, self ? ts.factory.createTrue() : ts.factory.createFalse()]);
}

function expressionNode(expression: SemanticExpression, ts: TypeScriptCompilerApi): any {
    if (expression.kind === "undefined") return ts.factory.createVoidExpression(ts.factory.createNumericLiteral(0));
    if (expression.kind === "numericPredicate") return ts.factory.createCallExpression(
        ts.factory.createIdentifier("__as3IsNaN"),undefined,expression.arguments.map(argument=>expressionNode(argument,ts)));
    if (expression.kind === "parseInteger") return ts.factory.createCallExpression(
        ts.factory.createIdentifier("__as3ParseInt"), undefined,
        expression.arguments.map(argument => expressionNode(argument, ts)));
    if (expression.kind === "globalCall") return ts.factory.createCallExpression(
        ts.factory.createIdentifier("__as3Global_" + expression.name), undefined,
        expression.arguments.map(argument => ts.factory.createCallExpression(
            ts.factory.createIdentifier("__as3TraceValue"),undefined,[expressionNode(argument,ts)])));
    if (expression.kind === "math") {
        const member = ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("Math"), expression.member);
        return expression.arguments === null ? member : ts.factory.createCallExpression(member, undefined,
            expression.arguments.map(argument => expressionNode(argument, ts)));
    }
    if (expression.kind === "intrinsicConstant") {
        return ts.factory.createNumericLiteral(String(expression.value));
    }
    if (expression.kind === "literal") {
        if (expression.value === null) {
            return ts.factory.createNull();
        }
        if (typeof expression.value === "string") {
            return ts.factory.createStringLiteral(expression.value);
        }
        if (typeof expression.value === "number") {
            return ts.factory.createNumericLiteral(String(expression.value));
        }
        return expression.value ? ts.factory.createTrue() : ts.factory.createFalse();
    }
    if (expression.kind === "identifier") {
        if (expression.bindingKind === "interface-class") return ts.factory.createCallExpression(
            ts.factory.createIdentifier("__as3InterfaceType"),undefined,[ts.factory.createStringLiteral(expression.bindingSourceQualifiedName!)]);
        const value = ts.factory.createIdentifier(expression.name);
        return ["current-class", "import"].includes(expression.bindingKind)
            ? initializeClassNode(value, expression.bindingKind === "current-class", ts) : value;
    }
    if (expression.kind === "this") {
        return expression.lexicalName ? ts.factory.createIdentifier(expression.lexicalName) : ts.factory.createThis();
    }
    if (expression.kind === "super") {
        return ts.factory.createSuper();
    }
    if (expression.kind === "member") {
        // AS3 super field references address the inherited instance slot. JS super
        // property reads search the prototype, which does not contain that field.
        const rawTarget = expression.superField ? ts.factory.createThis() : expressionNode(expression.target, ts);
        const target = expression.target.kind === "identifier" && ["current-class", "import"].includes(expression.target.bindingKind)
            ? ts.factory.createCallExpression(ts.factory.createIdentifier("__as3ClassMemberReceiver"), undefined, [rawTarget]) : rawTarget;
        if (expression.capabilitySource === "Error" && expression.name === "errorID")
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3ErrorID"),undefined,[target]);
        if (expression.capabilitySource === "Function" && expression.name === "length")
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3FunctionLength"),undefined,[target]);
        if (expression.capabilitySource === "String" && expression.name === "length")
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3StringLength"),undefined,[target]);
        return ts.factory.createPropertyAccessExpression(
            expression.targetNullable ? ts.factory.createNonNullExpression(target) : target,
            expression.targetName || expression.name,
        );
    }
    if (expression.kind === "methodClosure") {
        if (expression.staticTarget) return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3BindStaticMethod"),
            undefined, [expressionNode(expression.staticTarget,ts),ts.factory.createStringLiteral(expression.methodName)]);
        const method = ts.factory.createPropertyAccessExpression(ts.factory.createThis(), expression.methodName);
        // A base constructor can call a virtual method before the derived
        // constructor's binding prologue. The shared cache also covers that read.
        return expression.inherited ? ts.factory.createCallExpression(ts.factory.createIdentifier("__as3BindMethod"),
            undefined, [ts.factory.createThis(),method]) : method;
    }
    if (expression.kind === "call") {
        if (expression.capabilitySource === "flash.utils.getQualifiedClassName")
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3ResolveNativeClassName"), undefined,
                [expressionNode(expression.arguments[0]!, ts), ts.factory.createIdentifier("__as3ReflectionClassIdentity")]);
        if (expression.capabilitySource === "Number" && expression.capabilityMember === "toFixed" && expression.callee.kind === "member")
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3NumberToFixed"),undefined,[expressionNode(expression.callee.target,ts),...expression.arguments.map(argument=>expressionNode(argument,ts))]);
        if (expression.capabilitySource === "String" && expression.capabilityMember === "split" && expression.callee.kind === "member")
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3StringSplit"),undefined,
                [expressionNode(expression.callee.target,ts),ts.factory.createArrayLiteralExpression(expression.arguments.map(argument=>expressionNode(argument,ts)))]);
        if (expression.capabilitySource === "String" && expression.capabilityMember === "toLowerCase" && expression.callee.kind === "member")
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3StringToLowerCase"),undefined,[expressionNode(expression.callee.target,ts)]);
        if (expression.capabilitySource === "String" && expression.capabilityMember === "charAt" && expression.callee.kind === "member")
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3StringCharAt"),undefined,
                [expressionNode(expression.callee.target,ts),...expression.arguments.map(argument=>expressionNode(argument,ts))]);
        if (expression.capabilitySource === "Error" && expression.capabilityMember === "toString" && expression.callee.kind === "member")
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3ErrorToString"),undefined,[expressionNode(expression.callee.target,ts)]);
        if (expression.capabilitySource === "Array" && expression.callee.kind === "member")
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3ArrayCall"),undefined,[
                expressionNode(expression.callee.target,ts),ts.factory.createStringLiteral(expression.capabilityMember!),
                ts.factory.createArrayLiteralExpression(expression.arguments.map(argument => expressionNode(argument,ts)))]);
        const callee = expressionNode(expression.callee, ts);
        return ts.factory.createCallExpression(
            expression.calleeNullable ? ts.factory.createNonNullExpression(callee) : callee, undefined,
            expression.arguments.map((argument) => expression.packageFunctionCall || expression.immediateLambdaCall
                ? ts.factory.createAsExpression(expressionNode(argument, ts), ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword))
                : expressionNode(argument, ts)));
    }
    if (expression.kind === "array") {
        return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3ArrayLiteral"),undefined,
            [ts.factory.createArrayLiteralExpression(expression.elements.map(element => expressionNode(element, ts)), false)]);
    }
    if (expression.kind === "object") {
        return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3ObjectLiteral"), undefined,
            [ts.factory.createArrayLiteralExpression(expression.properties.map(property =>
                ts.factory.createArrayLiteralExpression([ts.factory.createStringLiteral(property.name),
                    expressionNode(property.value, ts)], false)), false)]);
    }
    if (expression.kind === "ownRecord") {
        return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3CreateOwnRecord"),
            [typeNode(expression.valueType, ts)], []);
    }
    if (expression.kind === "dictionaryHas") return ts.factory.createCallExpression(
        ts.factory.createIdentifier("__as3DictionaryIn"),undefined,
        [expressionNode(expression.index,ts),expressionNode(expression.target,ts)]);
    if (expression.kind === "objectOperation") {
        const key = expressionNode(expression.index,ts), target = expressionNode(expression.target,ts);
        return ts.factory.createCallExpression(ts.factory.createIdentifier(expression.operation === "has" ? "__as3ObjectIn" : "__as3ObjectCall"),undefined,
            expression.operation === "has" ? [key,target] : [target,key,
                ts.factory.createArrayLiteralExpression(expression.arguments.map(argument => expressionNode(argument,ts))),
                ts.factory.createStringLiteral(expression.callerQName)]);
    }
    if (expression.kind === "index") {
        if (expression.accessKind === "object") return ts.factory.createCallExpression(
            ts.factory.createIdentifier("__as3ObjectRead"),undefined,[expressionNode(expression.target,ts),
                expressionNode(expression.index,ts),ts.factory.createStringLiteral(expression.callerQName!)]);
        const target = expressionNode(expression.target, ts);
        const admittedTarget = expression.targetNullable ? ts.factory.createNonNullExpression(target) : target;
        if (expression.accessKind === "bigTurnTableInnerRoot") {
            return ts.factory.createCallExpression(
                ts.factory.createIdentifier("__as3BigTurnTableInnerEntry"), undefined,
                [target, expressionNode(expression.index, ts)],
            );
        }
        if (expression.accessKind === "dictionary") {
            return ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(admittedTarget, "get"), undefined,
                [expressionNode(expression.index, ts)],
            );
        }
        if (expression.accessKind === "ownRecord") {
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3OwnRecordGet"), undefined,
                [admittedTarget, expressionNode(expression.index, ts)]);
        }
        if (expression.accessKind === "array") return ts.factory.createCallExpression(
            ts.factory.createIdentifier("__as3ArrayRead"), undefined,
            [target, expressionNode(expression.index, ts)]);
        return ts.factory.createElementAccessExpression(admittedTarget, expressionNode(expression.index, ts));
    }
    if (expression.kind === "vectorConversion") {
        const element = expression.vectorType.typeArguments[0]!;
        return ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("__as3Vector"), "from"),
            [vectorElementTypeNode(element, ts)], [vectorPolicyNode(expression.vectorType, ts), expressionNode(expression.source, ts)],
        );
    }
    if (expression.kind === "runtimeType") {
        return ts.factory.createCallExpression(
            ts.factory.createIdentifier(expression.operator === "as" ? "__as3As" : "__as3Is"), undefined,
            [expressionNode(expression.value, ts), runtimeTypeTokenNode(expression, ts)],
        );
    }
    if (expression.kind === "globalFunction") return ts.factory.createCallExpression(
        ts.factory.createIdentifier("__as3TraceFunction"),undefined,[ts.factory.createIdentifier("__as3Global_"+expression.name)]);
    if (expression.kind === "functionApply" && expression.invocation === "direct") return ts.factory.createCallExpression(
        ts.factory.createIdentifier("__as3FunctionInvoke"),undefined,
        [expressionNode(expression.target,ts),expressionNode(expression.argumentsArray,ts)]);
    if (expression.kind === "functionApply" && expression.invocation === "field") {
        if (expression.target.kind !== "member") throw new HardenedSemanticError("HARDENED_EMIT_FUNCTION_FIELD", "Function field invocation requires a retained member");
        return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3FunctionFieldInvoke"),undefined,
            [expressionNode(expression.receiver,ts),ts.factory.createStringLiteral(expression.target.name),expressionNode(expression.argumentsArray,ts)]);
    }
    if (expression.kind === "functionApply") return ts.factory.createCallExpression(
        ts.factory.createIdentifier(expression.invocation === "call" ? "__as3FunctionCall" : "__as3FunctionApply"),undefined,[expressionNode(expression.target,ts),
            expressionNode(expression.receiver,ts),expressionNode(expression.argumentsArray,ts)]);
    if (expression.kind === "coercion") {
        if (expression.objectCall) return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3ObjectConversion"), undefined,
            [expressionNode(expression.argument!, ts)]);
        if (expression.reference) return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3Cast"), undefined,
            [expressionNode(expression.argument!, ts), runtimeTypeTokenNode({...expression.reference, targetType:expression.targetType}, ts)]);
        if (expression.slot && expression.targetType.sourceName === "Dictionary")
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3DictionarySlot"), undefined,
                [expressionNode(expression.argument!, ts)]);
        if (expression.slot) return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3FunctionArgument"),undefined,
            [expressionNode(expression.argument!,ts),ts.factory.createStringLiteral(expression.targetType.sourceName)]);
        const helper: { [sourceName: string]: string } = {
            int: "__as3Int", uint: "__as3Uint", Number: "__as3Number",
            Boolean: "__as3Boolean", String: "__as3String", Object: "__as3Object",
        };
        const name = helper[expression.targetType.sourceName];
        if (!name) throw new HardenedSemanticError("HARDENED_EMIT_COERCION", "unknown AS3 coercion helper");
        return ts.factory.createCallExpression(ts.factory.createIdentifier(name), undefined,
            expression.argument === null ? [] : [expressionNode(expression.argument, ts)]);
    }
    if (expression.kind === "assignment") {
        if (expression.arrayLengthStorage) {
            if (expression.target.kind !== "member" || expression.target.capabilitySource !== "Array" || expression.target.name !== "length")
                throw new HardenedSemanticError("HARDENED_EMIT_ARRAY_LENGTH", "Array length storage lacks its authenticated target");
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3ArrayLengthWrite"),undefined,
                [expressionNode(expression.target.target,ts),expressionNode(expression.value,ts)]);
        }
        if (expression.deferCompoundStore || expression.shortCircuit || (expression.resultType && (expression.storageCoercion
            || (expression.target.kind === "index" && expression.target.accessKind === "dictionary")))) {
            // AVM2 keeps the uncoerced assignment input on the expression stack.
            // Capture the lvalue before the RHS, store once, then return that input.
            const statements: any[] = [];
            const capture = (name: string, value: SemanticExpression): SemanticExpression => {
                statements.push(ts.factory.createVariableStatement(undefined, ts.factory.createVariableDeclarationList([
                    ts.factory.createVariableDeclaration(name, undefined, undefined, expressionNode(value, ts)),
                ], ts.NodeFlags.Const)));
                return {kind:"identifier", name, bindingKind:"local", bindingSourceQualifiedName:null,
                    sourceNodeId:expression.sourceNodeId, sourceSpan:expression.sourceSpan};
            };
            let target = expression.target;
            if (target.kind === "member" && target.target.kind !== "super" && !expression.deferCompoundStore)
                target = {...target, target:capture("__as3AssignmentReceiver", target.target)};
            else if (target.kind === "index" && expression.deferCompoundStore)
                target = {...target, index:capture("__as3AssignmentKey", target.index)};
            else if (target.kind === "index")
                target = {...target, target:capture("__as3AssignmentReceiver", target.target),
                    index:capture("__as3AssignmentKey", target.index)};
            let rhs = expression.value;
            if (target.kind === "index" && expression.deferCompoundStore) {
                if (rhs.kind !== "binary" || rhs.left.kind !== "index")
                    throw new HardenedSemanticError("HARDENED_EMIT_ASSIGNMENT", "indexed compound store lacks its source read");
                rhs = {...rhs,left:target};
            }
            // AIR retains the computed input, then reevaluates a compound
            // member receiver for the store. RHS callbacks can replace it.
            if (expression.shortCircuit) {
                if (rhs.kind !== "binary" || rhs.operator !== expression.shortCircuit)
                    throw new HardenedSemanticError("HARDENED_EMIT_ASSIGNMENT", "logical assignment lacks its proven operands");
                const prior = capture("__as3AssignmentPrior", rhs.left);
                statements.push(ts.factory.createIfStatement(expression.shortCircuit === "||"
                    ? expressionNode(prior, ts) : ts.factory.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken, expressionNode(prior, ts)),
                    ts.factory.createReturnStatement(expressionNode(prior, ts))));
                rhs = rhs.right;
            }
            const input = capture("__as3AssignmentValue", rhs);
            const value: SemanticExpression = expression.storageCoercion
                ? {...input, ...expression.storageCoercion, kind:"coercion", argument:input} : input;
            const {resultType, storageCoercion, shortCircuit, deferCompoundStore, ...store} = expression;
            statements.push(ts.factory.createExpressionStatement(expressionNode(
                {...store, target, value}, ts)));
            statements.push(ts.factory.createReturnStatement(expressionNode(input, ts)));
            return ts.factory.createCallExpression(ts.factory.createParenthesizedExpression(
                ts.factory.createArrowFunction(undefined, undefined, [], undefined,
                    ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                    ts.factory.createBlock(statements, true))), undefined, []);
        }
        if (expression.target.kind === "index" && expression.target.accessKind === "array")
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3ArrayWrite"),undefined,[
                expressionNode(expression.target.target,ts),expressionNode(expression.target.index,ts),expressionNode(expression.value,ts)]);
        if (expression.target.kind === "index" && expression.target.accessKind === "object")
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3ObjectWrite"),undefined,[
                expressionNode(expression.target.target,ts),expressionNode(expression.target.index,ts),
                expressionNode(expression.value,ts),ts.factory.createStringLiteral(expression.target.callerQName!)]);
        if (expression.target.kind === "index" && expression.target.accessKind === "dictionary") {
            const target = expressionNode(expression.target.target, ts);
            const admittedTarget = expression.target.targetNullable
                ? ts.factory.createNonNullExpression(target) : target;
            return ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(admittedTarget, "set"), undefined,
                [expressionNode(expression.target.index, ts), expressionNode(expression.value, ts)],
            );
        }
        if (expression.target.kind === "index" && expression.target.accessKind === "ownRecord") {
            const target = expressionNode(expression.target.target, ts);
            const admittedTarget = expression.target.targetNullable
                ? ts.factory.createNonNullExpression(target) : target;
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3OwnRecordSet"), undefined, [
                admittedTarget, expressionNode(expression.target.index, ts), expressionNode(expression.value, ts),
            ]);
        }
        return ts.factory.createBinaryExpression(
            expressionNode(expression.target, ts),
            ts.factory.createToken(ts.SyntaxKind.EqualsToken),
            expressionNode(expression.value, ts),
        );
    }
    if (expression.kind === "new") {
        if (expression.nativeArray)
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3NewArray"),undefined,
                [ts.factory.createArrayLiteralExpression(expression.arguments.map(argument=>expressionNode(argument,ts)))]);
        if (expression.sourceType.emittedName === "__AS3ArgumentError" && expression.sourceType.runtimeName === "ArgumentError")
            return ts.factory.createNewExpression(ts.factory.createIdentifier("__AS3ArgumentError"),undefined,
                expression.arguments.map(argument => expressionNode(argument,ts)));
        if (expression.dynamicClass && expression.constructorValue)
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3ConstructClass"),undefined,
                [expressionNode(expression.constructorValue,ts),ts.factory.createArrayLiteralExpression(expression.arguments.map(argument=>expressionNode(argument,ts)))]);
        if (expression.constructorValue) {
            return ts.factory.createNewExpression(ts.factory.createParenthesizedExpression(ts.factory.createAsExpression(
                expressionNode(expression.constructorValue, ts), ts.factory.createConstructorTypeNode(undefined, undefined, [],
                    typeNode(expression.sourceType, ts)))), undefined, expression.arguments.map(argument => expressionNode(argument, ts)));
        }
        if (expression.sourceType.emittedName === "AS3Vector") {
            return ts.factory.createNewExpression(ts.factory.createIdentifier("__as3Vector"),
                [vectorElementTypeNode(expression.sourceType.typeArguments[0]!, ts)],
                [vectorPolicyNode(expression.sourceType, ts)].concat(
                    expression.arguments.map((argument) => expressionNode(argument, ts))));
        }
        return ts.factory.createNewExpression(
            ts.factory.createParenthesizedExpression(initializeClassNode(ts.factory.createIdentifier(expression.sourceType.emittedName),
                expression.initializationSelf === true, ts)),
            undefined,
            expression.arguments.map((argument) => expressionNode(argument, ts)),
        );
    }
    if (expression.kind === "binary") {
        if (expression.relationCoercion) {
            if (!["<","<=",">",">="].includes(expression.operator))
                throw new HardenedSemanticError("HARDENED_EMIT_BINARY", "relation conversion requires an ordered operator");
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3Relation"),undefined,
                [expressionNode(expression.left,ts),expressionNode(expression.right,ts),ts.factory.createStringLiteral(expression.operator)]);
        }
        if (expression.equalityCoercion) {
            if (expression.operator !== "==" && expression.operator !== "!=")
                throw new HardenedSemanticError("HARDENED_EMIT_BINARY", "equality conversion requires an equality operator");
            const comparison = ts.factory.createCallExpression(ts.factory.createIdentifier("__as3Equals"),undefined,
                [expressionNode(expression.left,ts),expressionNode(expression.right,ts)]);
            return expression.operator === "==" ? comparison
                : ts.factory.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,comparison);
        }
        if (expression.additionCoercion) {
            if (expression.operator !== "+") throw new HardenedSemanticError("HARDENED_EMIT_BINARY", "addition conversion requires the plus operator");
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3Add"),undefined,
                [expressionNode(expression.left,ts),expressionNode(expression.right,ts)]);
        }
        if (expression.numericCoercion) {
            if (!["-","*","/","%"].includes(expression.operator))
                throw new HardenedSemanticError("HARDENED_EMIT_BINARY", "numeric conversion requires a numeric operator");
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3NumericBinary"),undefined,
                [ts.factory.createStringLiteral(expression.operator),expressionNode(expression.left,ts),expressionNode(expression.right,ts)]);
        }
        const tokens: { [operator: string]: any } = {
            "<": ts.SyntaxKind.LessThanToken,
            "<=": ts.SyntaxKind.LessThanEqualsToken,
            ">": ts.SyntaxKind.GreaterThanToken,
            ">=": ts.SyntaxKind.GreaterThanEqualsToken,
            "==": ts.SyntaxKind.EqualsEqualsToken,
            "!=": ts.SyntaxKind.ExclamationEqualsToken,
            "===": ts.SyntaxKind.EqualsEqualsEqualsToken,
            "!==": ts.SyntaxKind.ExclamationEqualsEqualsToken,
            "&&": ts.SyntaxKind.AmpersandAmpersandToken,
            "||": ts.SyntaxKind.BarBarToken,
            "+": ts.SyntaxKind.PlusToken,
            "-": ts.SyntaxKind.MinusToken,
            "*": ts.SyntaxKind.AsteriskToken,
            "/": ts.SyntaxKind.SlashToken,
            "%": ts.SyntaxKind.PercentToken,
            "&": ts.SyntaxKind.AmpersandToken,
            "|": ts.SyntaxKind.BarToken,
            "^": ts.SyntaxKind.CaretToken,
            "<<": ts.SyntaxKind.LessThanLessThanToken,
            ">>": ts.SyntaxKind.GreaterThanGreaterThanToken,
            ">>>": ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
        };
        const token = tokens[expression.operator];
        if (token === undefined) {
            throw new HardenedSemanticError("HARDENED_EMIT_BINARY", "semantic IR contains an unsupported binary operator");
        }
        if (expression.referenceIdentity && expression.operator !== "===" && expression.operator !== "!==")
            throw new HardenedSemanticError("HARDENED_EMIT_BINARY", "reference identity requires strict comparison");
        const left=expressionNode(expression.left,ts);
        return ts.factory.createBinaryExpression(
            expression.referenceIdentity ? ts.factory.createAsExpression(left,ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)) : left,
            ts.factory.createToken(token), expressionNode(expression.right, ts),
        );
    }
    if (expression.kind === "unary") {
        if (expression.operator === "typeof") {
            return ts.factory.createTypeOfExpression(expressionNode(expression.operand, ts));
        }
        const tokens: { [operator: string]: any } = {
            "+": ts.SyntaxKind.PlusToken,
            "-": ts.SyntaxKind.MinusToken,
            "!": ts.SyntaxKind.ExclamationToken,
            "~": ts.SyntaxKind.TildeToken,
        };
        const token = tokens[expression.operator];
        if (token === undefined) {
            throw new HardenedSemanticError("HARDENED_EMIT_UNARY", "semantic IR contains an unsupported unary operator");
        }
        return ts.factory.createPrefixUnaryExpression(token, expressionNode(expression.operand, ts));
    }
    if (expression.kind === "parenthesized") {
        return ts.factory.createParenthesizedExpression(expressionNode(expression.expression, ts));
    }
    if (expression.kind === "nonNull") {
        return ts.factory.createNonNullExpression(expressionNode(expression.expression, ts));
    }
    if (expression.kind === "conditional") {
        return ts.factory.createConditionalExpression(
            expressionNode(expression.condition, ts),
            ts.factory.createToken(ts.SyntaxKind.QuestionToken),
            expressionNode(expression.whenTrue, ts),
            ts.factory.createToken(ts.SyntaxKind.ColonToken),
            expressionNode(expression.whenFalse, ts),
        );
    }
    if (expression.kind === "update") {
        if (expression.numericLocal) {
            if (expression.target.kind !== "identifier" || !["local","parameter"].includes(expression.target.bindingKind))
                throw new HardenedSemanticError("HARDENED_EMIT_UPDATE", "numeric local update requires a writable lexical binding");
            const prior=ts.factory.createIdentifier("__as3UpdatePrior");
            const assignment=ts.factory.createBinaryExpression(expressionNode(expression.target,ts),
                ts.factory.createToken(ts.SyntaxKind.EqualsToken),ts.factory.createBinaryExpression(prior,
                    ts.factory.createToken(expression.operator === "++" ? ts.SyntaxKind.PlusToken : ts.SyntaxKind.MinusToken),
                    ts.factory.createNumericLiteral(1)));
            return ts.factory.createCallExpression(ts.factory.createParenthesizedExpression(
                ts.factory.createArrowFunction(undefined,undefined,[ts.factory.createParameterDeclaration(
                    undefined,undefined,prior,undefined,ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword))],undefined,
                    ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),ts.factory.createBlock(expression.prefix
                        ? [ts.factory.createReturnStatement(assignment)]
                        : [ts.factory.createExpressionStatement(assignment),ts.factory.createReturnStatement(prior)],true))),undefined,
                [ts.factory.createCallExpression(ts.factory.createIdentifier("__as3Number"),undefined,[expressionNode(expression.target,ts)])]);
        }

        if (expression.target.kind === "index" && expression.target.accessKind === "object")
            return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3ObjectUpdate"),undefined,[
                expressionNode(expression.target.target,ts),expressionNode(expression.target.index,ts),
                ts.factory.createNumericLiteral(expression.operator === "++" ? 1 : 0),
                expression.prefix ? ts.factory.createTrue() : ts.factory.createFalse(),
                ts.factory.createStringLiteral(expression.target.callerQName!)]);
        const token = expression.operator === "++" ? ts.SyntaxKind.PlusPlusToken : ts.SyntaxKind.MinusMinusToken;
        return expression.prefix
            ? ts.factory.createPrefixUnaryExpression(token, expressionNode(expression.target, ts))
            : ts.factory.createPostfixUnaryExpression(expressionNode(expression.target, ts), token);
    }
    if (expression.kind === "lambda") {
        if (expression.parameters.some(p=>p.name === "arguments") || constructorStatementsBindArguments(expression.statements))
            throw new HardenedSemanticError("HARDENED_EMIT_LAMBDA_ARITY", "anonymous function binding shadows the runtime arguments object", expression.sourceNodeId);
        const arity=ts.factory.createExpressionStatement(ts.factory.createCallExpression(
            ts.factory.createIdentifier("__as3CheckLambdaArity"),undefined,[
                ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("arguments"),"length"),
                ts.factory.createNumericLiteral(expression.parameters.filter(p=>!p.rest && p.defaultValue === null).length),
                expression.parameters.some(p=>p.rest) ? ts.factory.createNull() : ts.factory.createNumericLiteral(expression.parameters.length)]));
        const sourceFn = ts.factory.createFunctionExpression(undefined, undefined, undefined, undefined,
            expression.parameters.map(parameter => parameterNode(parameter, ts)),
            typeNode(expression.returnType, ts),
            ts.factory.createBlock([arity].concat(parameterSlotStatements(expression.parameters,ts),
                expression.statements.map(statement => statementNode(statement, ts))), true));
        const fn=ts.factory.createCallExpression(ts.factory.createIdentifier("__as3SourceLambda"),undefined,[sourceFn,
            ts.factory.createNumericLiteral(expression.parameters.filter(parameter=>!parameter.rest).length)]);
        if (!expression.lexicalReceiver) return fn;
        const capture = expression.lexicalReceiver;
        // Keep an ordinary Function and capture its lexical instance separately
        // from the dynamic receiver used when the function is called.
        return ts.factory.createCallExpression(ts.factory.createParenthesizedExpression(
            ts.factory.createArrowFunction(undefined, undefined, [
                ts.factory.createParameterDeclaration(undefined, undefined, capture.name, undefined,
                    ts.factory.createTypeReferenceNode(capture.className, undefined), undefined),
            ], undefined, ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), fn)), undefined,
            [capture.outerName ? ts.factory.createIdentifier(capture.outerName) : ts.factory.createThis()]);
    }
    if (expression.kind === "delete") {
        if (expression.target.accessKind === "object") return ts.factory.createCallExpression(
            ts.factory.createIdentifier("__as3ObjectDelete"),undefined,[expressionNode(expression.target.target,ts),
                expressionNode(expression.target.index,ts),ts.factory.createStringLiteral(expression.target.callerQName!)]);
        const target = expressionNode(expression.target.target, ts);
        const admittedTarget = expression.target.targetNullable
            ? ts.factory.createNonNullExpression(target) : target;
        return ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(admittedTarget, "delete"), undefined,
            [expressionNode(expression.target.index, ts)],
        );
    }
    throw new HardenedSemanticError("HARDENED_EMIT_EXPRESSION", "semantic IR contains an unsupported expression");
}

function statementNode(statement: SemanticStatement, ts: TypeScriptCompilerApi): any {
    if (statement.kind === "empty") return ts.factory.createEmptyStatement();
    if (statement.kind === "expression") {
        return ts.factory.createExpressionStatement(expressionNode(statement.expression, ts));
    }
    if (statement.kind === "return") {
        return ts.factory.createReturnStatement(statement.expression === null ? undefined : expressionNode(statement.expression, ts));
    }
    if (statement.kind === "if") {
        return ts.factory.createIfStatement(
            expressionNode(statement.condition, ts),
            ts.factory.createBlock(statement.thenStatements.map((item) => statementNode(item, ts)), true),
            statement.elseStatements === null ? undefined
                : ts.factory.createBlock(statement.elseStatements.map((item) => statementNode(item, ts)), true),
        );
    }
    if (statement.kind === "while") {
        return ts.factory.createWhileStatement(
            expressionNode(statement.condition, ts),
            ts.factory.createBlock(statement.statements.map((item) => statementNode(item, ts)), true),
        );
    }
    if (statement.kind === "doWhile") {
        return ts.factory.createDoStatement(
            ts.factory.createBlock(statement.statements.map((item) => statementNode(item, ts)), true),
            expressionNode(statement.condition, ts),
        );
    }
    if (statement.kind === "switch") {
        const clauses = statement.cases.map((item) => item.test === null
            ? ts.factory.createDefaultClause(item.statements.map((statement) => statementNode(statement, ts)))
            : ts.factory.createCaseClause(expressionNode(item.test, ts),
                item.statements.map((statement) => statementNode(statement, ts))));
        return ts.factory.createSwitchStatement(expressionNode(statement.expression, ts), ts.factory.createCaseBlock(clauses));
    }
    if (statement.kind === "throw") {
        return ts.factory.createThrowStatement(expressionNode(statement.expression, ts));
    }
    if (statement.kind === "for") {
        let initializer: any = undefined;
        if (statement.initializer !== null) {
            if (statement.initializer.kind === "local") {
                initializer = ts.factory.createVariableDeclarationList(statement.initializer.declarations.map(local =>
                    ts.factory.createVariableDeclaration(local.name, undefined, typeNode(local.type, ts),
                        local.initializer.kind === "undefined" ? undefined : expressionNode(local.initializer, ts))), ts.NodeFlags.None);
            } else {
                initializer = expressionNode(statement.initializer.expression, ts);
            }
        }
        return ts.factory.createForStatement(initializer,
            statement.condition === null ? undefined : expressionNode(statement.condition, ts),
            statement.update === null ? undefined : expressionNode(statement.update, ts),
            ts.factory.createBlock(statement.statements.map(item => statementNode(item, ts)), true));
    }
    if (statement.kind === "forEach") {
        const binding = statement.declaresBinding
            ? ts.factory.createVariableDeclarationList([
                ts.factory.createVariableDeclaration(statement.binding.name, undefined, undefined, undefined),
            ], ts.NodeFlags.None)
            : ts.factory.createIdentifier(statement.binding.name);
        const iterable = expressionNode(statement.iterable, ts);
        let values = ["Array","Dictionary","*","Object"].includes(statement.iterableType.sourceName) ? ts.factory.createCallExpression(
            ts.factory.createIdentifier(statement.iterableType.sourceName === "Dictionary" ? "__as3DictionaryValues"
                : statement.iterableType.sourceName === "Array" ? "__as3ArrayValues" : "__as3DynamicValues"),undefined,
            [iterable,ts.factory.createStringLiteral(statement.bindingReference ? "*" : statement.binding.type.sourceName)])
            : statement.iterableType.nullable ? ts.factory.createNonNullExpression(iterable) : iterable;
        if (statement.bindingReference) values = ts.factory.createCallExpression(ts.factory.createIdentifier("__as3ReferenceValues"),undefined,
            [values,runtimeTypeTokenNode({...statement.bindingReference,targetType:statement.binding.type},ts)]);
        return ts.factory.createForOfStatement(undefined, binding, values,
            ts.factory.createBlock(statement.statements.map(item => statementNode(item, ts)), true));
    }
    if (statement.kind === "forIn") {
        const initializer = statement.declaresTarget
            ? ts.factory.createVariableDeclarationList([
                ts.factory.createVariableDeclaration((statement.target as any).name, undefined, undefined, undefined),
            ], ts.NodeFlags.None)
            : expressionNode(statement.target, ts);
        let iterable = statement.iterableType.sourceName === "Dictionary"
            ? ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(
                statement.iterableType.nullable
                    ? ts.factory.createNonNullExpression(expressionNode(statement.iterable, ts))
                    : expressionNode(statement.iterable, ts), "keys"), undefined, [])
            : statement.iterableType.emittedName === "unknown"
            ? ts.factory.createAsExpression(expressionNode(statement.iterable, ts),
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.ObjectKeyword))
            : expressionNode(statement.iterable, ts);
        if (statement.iterableType.nullable && statement.iterableType.emittedName !== "unknown"
            && statement.iterableType.sourceName !== "Dictionary") {
            iterable = ts.factory.createNonNullExpression(iterable);
        }
        const body = ts.factory.createBlock(statement.statements.map(item => statementNode(item, ts)), true);
        return statement.iterableType.sourceName === "Dictionary"
            ? ts.factory.createForOfStatement(undefined, initializer, iterable, body)
            : ts.factory.createForInStatement(initializer, iterable, body);
    }
    if (statement.kind === "try") {
        let catchClause: any = undefined;
        if (statement.catchClause !== null) {
            const caught = ts.factory.createIdentifier(statement.catchClause.temporaryName);
            const binding = ts.factory.createVariableStatement(undefined,
                ts.factory.createVariableDeclarationList([
                    ts.factory.createVariableDeclaration(statement.catchClause.name, undefined,
                        typeNode(statement.catchClause.type, ts), caught),
                ], ts.NodeFlags.Const));
            const guard = ts.factory.createIfStatement(
                ts.factory.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,
                    ts.factory.createParenthesizedExpression(ts.factory.createBinaryExpression(
                        caught, ts.factory.createToken(ts.SyntaxKind.InstanceOfKeyword),
                        ts.factory.createIdentifier(statement.catchClause.type.emittedName)))),
                ts.factory.createBlock([ts.factory.createThrowStatement(caught)], true), undefined);
            catchClause = ts.factory.createCatchClause(
                ts.factory.createVariableDeclaration(statement.catchClause.temporaryName),
                ts.factory.createBlock((statement.catchClause.type.sourceName === "*" ? [binding] : [guard, binding]).concat(
                    statement.catchClause.statements.map(item => statementNode(item, ts))), true));
        }
        return ts.factory.createTryStatement(
            ts.factory.createBlock(statement.tryStatements.map(item => statementNode(item, ts)), true),
            catchClause,
            statement.finallyStatements === null ? undefined
                : ts.factory.createBlock(statement.finallyStatements.map(item => statementNode(item, ts)), true));
    }
    if (statement.kind === "local") {
        const declarations = statement.declarations.map((local) => ts.factory.createVariableDeclaration(
            local.name, undefined, typeNode(local.type, ts),
            // An uninitialized wildcard is a function-scoped var, not a reset at
            // the declaration site (which may execute repeatedly in a loop).
            local.initializer.kind === "undefined" ? undefined : expressionNode(local.initializer, ts),
        ));
        const readonly = statement.declarations.every((local) => local.readonly);
        return ts.factory.createVariableStatement(undefined,
            ts.factory.createVariableDeclarationList(declarations,
                readonly ? ts.NodeFlags.Const : ts.NodeFlags.None));
    }
    if (statement.kind === "label") {
        return ts.factory.createLabeledStatement(ts.factory.createIdentifier(statement.label), statementNode(statement.statement, ts));
    }
    if (statement.kind === "break") return ts.factory.createBreakStatement(
        statement.label === null ? undefined : ts.factory.createIdentifier(statement.label));
    if (statement.kind === "continue") return ts.factory.createContinueStatement(
        statement.label === null ? undefined : ts.factory.createIdentifier(statement.label));
    throw new HardenedSemanticError("HARDENED_EMIT_STATEMENT", "semantic IR contains an unsupported statement");
}

function parameterNode(parameter: any, ts: TypeScriptCompilerApi): any {
    const emittedType = parameter.rest
        ? ts.factory.createArrayTypeNode(typeNode(parameter.type, ts))
        : typeNode(parameter.type, ts);
    return ts.factory.createParameterDeclaration(undefined,
        parameter.rest ? ts.factory.createToken(ts.SyntaxKind.DotDotDotToken) : undefined,
        parameter.name, undefined, emittedType,
        parameter.defaultValue === null ? undefined : expressionNode(parameter.defaultValue, ts));
}

function boundMethodNames(program: SemanticProgram): string[] {
    if (program.declaration.declarationKind === "packageField" || program.declaration.declarationKind === "packageFunction") return [];
    const names: { [name: string]: true } = Object.create(null);
    const inspectExpression = (expression: SemanticExpression): void => {
        if (expression.kind === "functionApply") {
            inspectExpression(expression.target); inspectExpression(expression.receiver); inspectExpression(expression.argumentsArray);
        } else if (expression.kind === "methodClosure") {
            if (!expression.staticTarget) names[expression.methodName] = true;
        } else if (expression.kind === "member") {
            inspectExpression(expression.target);
        } else if (expression.kind === "math" || expression.kind === "globalCall" || expression.kind === "parseInteger" || expression.kind === "numericPredicate") {
            expression.arguments?.forEach(inspectExpression);
        } else if (expression.kind === "call") {
            inspectExpression(expression.callee);
            expression.arguments.forEach(inspectExpression);
        } else if (expression.kind === "assignment") {
            inspectExpression(expression.target);
            inspectExpression(expression.value);
        } else if (expression.kind === "new") {
            if (expression.constructorValue) inspectExpression(expression.constructorValue);
            expression.arguments.forEach(inspectExpression);
        } else if (expression.kind === "array") {
            expression.elements.forEach(inspectExpression);
        } else if (expression.kind === "object") {
            expression.properties.forEach(property => inspectExpression(property.value));
        } else if (expression.kind === "dictionaryHas") {
            inspectExpression(expression.index); inspectExpression(expression.target);
        } else if (expression.kind === "objectOperation") {
            inspectExpression(expression.target); inspectExpression(expression.index);
            expression.arguments.forEach(inspectExpression);
        } else if (expression.kind === "index") {
            inspectExpression(expression.target);
            inspectExpression(expression.index);
        } else if (expression.kind === "vectorConversion") {
            inspectExpression(expression.source);
        } else if (expression.kind === "runtimeType") {
            inspectExpression(expression.value);
        } else if (expression.kind === "coercion") {
            if (expression.argument !== null) inspectExpression(expression.argument);
        } else if (expression.kind === "binary") {
            inspectExpression(expression.left);
            inspectExpression(expression.right);
        } else if (expression.kind === "unary") {
            inspectExpression(expression.operand);
        } else if (expression.kind === "parenthesized" || expression.kind === "nonNull") {
            inspectExpression(expression.expression);
        } else if (expression.kind === "conditional") {
            inspectExpression(expression.condition);
            inspectExpression(expression.whenTrue);
            inspectExpression(expression.whenFalse);
        } else if (expression.kind === "update") {
            inspectExpression(expression.target);
        } else if (expression.kind === "lambda") {
            expression.statements.forEach(inspectStatement);
        } else if (expression.kind === "delete") {
            inspectExpression(expression.target);
        }
    };
    const inspectStatement = (statement: SemanticStatement): void => {
        if (statement.kind === "expression") {
            inspectExpression(statement.expression);
        } else if (statement.kind === "return") {
            if (statement.expression !== null) inspectExpression(statement.expression);
        } else if (statement.kind === "if") {
            inspectExpression(statement.condition);
            statement.thenStatements.forEach(inspectStatement);
            if (statement.elseStatements !== null) statement.elseStatements.forEach(inspectStatement);
        } else if (statement.kind === "while") {
            inspectExpression(statement.condition);
            statement.statements.forEach(inspectStatement);
        } else if (statement.kind === "doWhile") {
            inspectExpression(statement.condition);
            statement.statements.forEach(inspectStatement);
        } else if (statement.kind === "switch") {
            inspectExpression(statement.expression);
            statement.cases.forEach((item) => {
                if (item.test !== null) inspectExpression(item.test);
                item.statements.forEach(inspectStatement);
            });
        } else if (statement.kind === "throw") {
            inspectExpression(statement.expression);
        } else if (statement.kind === "for") {
            if (statement.initializer?.kind === "expression") inspectExpression(statement.initializer.expression);
            if (statement.initializer?.kind === "local") statement.initializer.declarations.forEach(local => inspectExpression(local.initializer));
            if (statement.condition !== null) inspectExpression(statement.condition);
            if (statement.update !== null) inspectExpression(statement.update);
            statement.statements.forEach(inspectStatement);
        } else if (statement.kind === "forEach") {
            inspectExpression(statement.iterable);
            statement.statements.forEach(inspectStatement);
        } else if (statement.kind === "forIn") {
            inspectExpression(statement.target);
            inspectExpression(statement.iterable);
            statement.statements.forEach(inspectStatement);
        } else if (statement.kind === "try") {
            statement.tryStatements.forEach(inspectStatement);
            statement.catchClause?.statements.forEach(inspectStatement);
            statement.finallyStatements?.forEach(inspectStatement);
        } else if (statement.kind === "label") {
            inspectStatement(statement.statement);
        } else if (statement.kind === "local") {
            statement.declarations.forEach((local) => inspectExpression(local.initializer));
        }
    };
    program.declaration.members.forEach((member) => {
        if (member.kind === "field" && member.initializer !== null) {
            inspectExpression(member.initializer);
        } else if (member.kind !== "field") {
            member.body.forEach(inspectStatement);
        }
    });
    return Object.keys(names).sort();
}

function bindMethodStatement(name: string, ts: TypeScriptCompilerApi): any {
    const method = ts.factory.createPropertyAccessExpression(ts.factory.createThis(), name);
    return ts.factory.createExpressionStatement(ts.factory.createBinaryExpression(
        method,
        ts.factory.createToken(ts.SyntaxKind.EqualsToken),
        ts.factory.createCallExpression(ts.factory.createIdentifier("__as3BindMethod"), undefined,
            [ts.factory.createThis(), method]),
    ));
}

function fieldDefaultExpression(member: SemanticField, ts: TypeScriptCompilerApi): any {
    if (member.implicitDefault === "zero") return ts.factory.createNumericLiteral(0);
    if (member.implicitDefault === "nan") return ts.factory.createBinaryExpression(
        ts.factory.createNumericLiteral(0), ts.factory.createToken(ts.SyntaxKind.SlashToken), ts.factory.createNumericLiteral(0));
    if (member.implicitDefault === "false") return ts.factory.createFalse();
    if (member.implicitDefault === "null") return ts.factory.createNull();
    if (member.implicitDefault === "undefined") return ts.factory.createVoidZero();
    throw new HardenedSemanticError("HARDENED_FIELD_DEFAULT", "field lacks one exact AS3 initialization policy", member.sourceNodeId);
}

function staticFieldDefault(field: SemanticField, fields: readonly SemanticField[], ts: TypeScriptCompilerApi): any {
    const constant=field.initializer && staticConstant(field.initializer,fields);
    if (!constant) return fieldDefaultExpression(field,ts);
    const value=constant.value;
    if (value === undefined) return ts.factory.createVoidZero();
    if (value === null) return ts.factory.createNull();
    if (typeof value === "string") return ts.factory.createStringLiteral(value);
    if (typeof value === "boolean") return value ? ts.factory.createTrue() : ts.factory.createFalse();
    if (Number.isNaN(value)) return ts.factory.createBinaryExpression(ts.factory.createNumericLiteral(0),
        ts.factory.createToken(ts.SyntaxKind.SlashToken),ts.factory.createNumericLiteral(0));
    if (!Number.isFinite(value)) return ts.factory.createBinaryExpression(
        value < 0 ? ts.factory.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken,ts.factory.createNumericLiteral(1)) : ts.factory.createNumericLiteral(1),
        ts.factory.createToken(ts.SyntaxKind.SlashToken),ts.factory.createNumericLiteral(0));
    return value < 0 || Object.is(value,-0) ? ts.factory.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken,
        ts.factory.createNumericLiteral(String(Math.abs(value)))) : ts.factory.createNumericLiteral(String(value));
}

function nativeParameterSlot(parameter:SemanticParameter):boolean {
    return !parameter.rest && ["String","Number","int","uint","Boolean","Object","Array","Function"].includes(parameter.type.sourceName);
}

function parameterSlotStatements(parameters:SemanticParameter[], ts:TypeScriptCompilerApi, preserveOptionalPresence=false):any[] {
    return parameters.filter(nativeParameterSlot).map(parameter => ts.factory.createExpressionStatement(
        ts.factory.createBinaryExpression(ts.factory.createIdentifier(parameter.name),ts.factory.createToken(ts.SyntaxKind.EqualsToken),
            ts.factory.createCallExpression(ts.factory.createIdentifier("__as3FunctionArgument"),undefined,
                [preserveOptionalPresence && parameter.defaultValue !== null ? ts.factory.createConditionalExpression(
                    ts.factory.createBinaryExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("arguments"),"length"),
                        ts.factory.createToken(ts.SyntaxKind.LessThanEqualsToken),ts.factory.createNumericLiteral(parameters.indexOf(parameter))),
                    ts.factory.createToken(ts.SyntaxKind.QuestionToken),expressionNode(parameter.defaultValue,ts),ts.factory.createToken(ts.SyntaxKind.ColonToken),
                    ts.factory.createElementAccessExpression(ts.factory.createIdentifier("arguments"),ts.factory.createNumericLiteral(parameters.indexOf(parameter))))
                    : ts.factory.createIdentifier(parameter.name),ts.factory.createStringLiteral(parameter.type.sourceName)]))));
}

function memberNode(member: SemanticMember, ts: TypeScriptCompilerApi, classQName: string, fields: readonly SemanticField[], className: string): any {
    if (member.kind === "field") {
        const modifiers = modifierTokens(member.modifiers, ts);
        if (member.readonly) modifiers.push(ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword));
        const isStatic = member.modifiers.includes("static");
        return ts.factory.createPropertyDeclaration(
            modifiers, member.name, undefined, typeNode(member.type, ts),
            member.embeddedBitmap ? ts.factory.createIdentifier(member.embeddedBitmap.className) : isStatic
                ? ts.factory.createAsExpression(ts.factory.createAsExpression(staticFieldDefault(member, fields, ts),
                    ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)), typeNode(member.type, ts)) : undefined,
        );
    }
    if (member.kind === "constructor") throw new HardenedSemanticError("HARDENED_EMIT_CONSTRUCTOR",
        "constructor emission requires its authenticated class context", member.sourceNodeId);
    if (member.kind === "method") {
        const minimum=member.parameters.filter(p=>!p.rest && p.defaultValue === null).length;
        const arity:any[]=member.modifiers.includes("static") ? [ts.factory.createExpressionStatement(
            initializeClassNode(ts.factory.createIdentifier(className), true, ts))] : [];
        {
            if (member.parameters.some(p=>p.name === "arguments") || constructorStatementsBindArguments(member.body))
                throw new HardenedSemanticError("HARDENED_EMIT_METHOD_ARITY", "method binding shadows the runtime arguments object", member.sourceNodeId);
            arity.push(ts.factory.createExpressionStatement(ts.factory.createCallExpression(
                ts.factory.createIdentifier("__as3CheckMethodArity"),undefined,[ts.factory.createStringLiteral(classQName+(member.modifiers.includes("static") ? "$" : "")),
                    ts.factory.createStringLiteral(member.name),ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("arguments"),"length"),
                    ts.factory.createNumericLiteral(minimum),member.parameters.some(p=>p.rest) ? ts.factory.createNull() : ts.factory.createNumericLiteral(member.parameters.length)])));
        }
        return ts.factory.createMethodDeclaration(
            modifierTokens(member.modifiers, ts), undefined, member.name, undefined, undefined,
            member.parameters.map((parameter) => parameterNode(parameter, ts)), typeNode(member.returnType, ts),
            ts.factory.createBlock(arity.concat(parameterSlotStatements(member.parameters,ts,true),member.body.map((statement) => statementNode(statement, ts))), true),
        );
    }
    if (member.kind === "getter") {
        return ts.factory.createGetAccessorDeclaration(
            modifierTokens(member.modifiers, ts), member.name, [], typeNode(member.returnType, ts),
            ts.factory.createBlock((member.modifiers.includes("static") ? [ts.factory.createExpressionStatement(
                initializeClassNode(ts.factory.createIdentifier(className), true, ts))] : [])
                .concat(member.body.map((statement) => statementNode(statement, ts))), true),
        );
    }
    if (member.kind === "setter") {
        return ts.factory.createSetAccessorDeclaration(
            modifierTokens(member.modifiers, ts), member.name, [parameterNode(member.parameter, ts)],
            ts.factory.createBlock((member.modifiers.includes("static") ? [ts.factory.createExpressionStatement(
                initializeClassNode(ts.factory.createIdentifier(className), true, ts))] : [])
                .concat(member.body.map((statement) => statementNode(statement, ts))), true),
        );
    }
    throw new HardenedSemanticError("HARDENED_EMIT_MEMBER", "semantic IR contains an unsupported member");
}

/** Keep the original static fields as data slots; run original initializers only on class access. */
function classInitializationNode(program: SemanticProgram, ts: TypeScriptCompilerApi): any {
    if (program.declaration.declarationKind !== "class") throw new HardenedSemanticError("HARDENED_EMIT_STATIC_INIT", "Static initialization requires a class");
    const fields = program.declaration.members.filter((member): member is SemanticField => member.kind === "field"
        && member.modifiers.includes("static"));
    const owner = ts.factory.createIdentifier(program.declaration.name);
    const proof = ts.factory.createIdentifier("__as3ConstructionProof");
    const slots = fields.map(field => ts.factory.createObjectLiteralExpression([
        ts.factory.createPropertyAssignment("name", ts.factory.createStringLiteral(field.name)),
        ts.factory.createPropertyAssignment("value", field.embeddedBitmap ? ts.factory.createIdentifier(field.embeddedBitmap.className)
            : staticFieldDefault(field, fields, ts)),
        ts.factory.createPropertyAssignment("readonly", field.readonly ? ts.factory.createTrue() : ts.factory.createFalse()),
    ]));
    const assignments = fields.filter(field => field.initializer !== null && !field.embeddedBitmap && !staticConstant(field.initializer,fields)).map(field =>
        ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createIdentifier("__as3InitializeStaticField"),
            undefined, [owner, proof, ts.factory.createStringLiteral(field.name), expressionNode(field.initializer!, ts)])));
    return ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createIdentifier("__as3DefineClassInitialization"),
        undefined, [owner, proof, ts.factory.createArrayLiteralExpression(slots), ts.factory.createArrowFunction(undefined, undefined, [],
            undefined, ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), ts.factory.createBlock(assignments, true))]));
}

function newTargetExpression(ts: TypeScriptCompilerApi): any {
    return ts.factory.createMetaProperty(ts.SyntaxKind.NewKeyword, ts.factory.createIdentifier("target"));
}

function constructorStatementsBindArguments(statements: SemanticStatement[]): boolean {
    return statements.some((statement) => {
        if (statement.kind === "local") return statement.declarations.some(local => local.name === "arguments");
        if (statement.kind === "if") return constructorStatementsBindArguments(statement.thenStatements)
            || (statement.elseStatements !== null && constructorStatementsBindArguments(statement.elseStatements));
        if (statement.kind === "while" || statement.kind === "doWhile") {
            return constructorStatementsBindArguments(statement.statements);
        }
        if (statement.kind === "switch") {
            return statement.cases.some(item => constructorStatementsBindArguments(item.statements));
        }
        if (statement.kind === "for") {
            return (statement.initializer?.kind === "local"
                && statement.initializer.declarations.some(local => local.name === "arguments"))
                || constructorStatementsBindArguments(statement.statements);
        }
        if (statement.kind === "forEach") {
            return (statement.declaresBinding && statement.binding.name === "arguments")
                || constructorStatementsBindArguments(statement.statements);
        }
        if (statement.kind === "forIn") {
            return (statement.declaresTarget && statement.target.kind === "identifier"
                && statement.target.name === "arguments") || constructorStatementsBindArguments(statement.statements);
        }
        if (statement.kind === "try") {
            return constructorStatementsBindArguments(statement.tryStatements)
                || (statement.catchClause !== null && (statement.catchClause.name === "arguments"
                    || constructorStatementsBindArguments(statement.catchClause.statements)))
                || (statement.finallyStatements !== null
                    && constructorStatementsBindArguments(statement.finallyStatements));
        }
        return statement.kind === "label" && constructorStatementsBindArguments([statement.statement]);
    });
}

function constructorArityGuard(className: string, member: SemanticConstructor | null,
    ts: TypeScriptCompilerApi): any {
    const parameters = member?.parameters ?? [];
    if (parameters.some(parameter => parameter.name === "arguments")
        || (member !== null && constructorStatementsBindArguments(member.body))) {
        throw new HardenedSemanticError("HARDENED_EMIT_CONSTRUCTOR_ARITY",
            "constructor binding cannot shadow the runtime arguments object", member?.sourceNodeId ?? null);
    }
    let minimum = 0;
    let unbounded = false;
    parameters.forEach((parameter, index) => {
        if (parameter.rest) unbounded = true;
        else if (parameter.defaultValue === null) minimum = index + 1;
    });
    const length = ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("arguments"), "length");
    const belowMinimum = ts.factory.createBinaryExpression(length,
        ts.factory.createToken(ts.SyntaxKind.LessThanToken), ts.factory.createNumericLiteral(minimum));
    const maximum = parameters.length;
    const invalid = unbounded ? belowMinimum : minimum === maximum
        ? ts.factory.createBinaryExpression(length, ts.factory.createToken(ts.SyntaxKind.ExclamationEqualsEqualsToken),
            ts.factory.createNumericLiteral(minimum))
        : ts.factory.createBinaryExpression(belowMinimum, ts.factory.createToken(ts.SyntaxKind.BarBarToken),
            ts.factory.createBinaryExpression(length, ts.factory.createToken(ts.SyntaxKind.GreaterThanToken),
                ts.factory.createNumericLiteral(maximum)));
    return ts.factory.createIfStatement(invalid, ts.factory.createExpressionStatement(ts.factory.createCallExpression(
        ts.factory.createIdentifier("__as3RejectConstructorArity"), undefined, [
            ts.factory.createStringLiteral(className), ts.factory.createNumericLiteral(minimum),
            unbounded ? ts.factory.createNull() : ts.factory.createNumericLiteral(maximum), length,
        ])));
}

function packageFunctionNode(program:SemanticProgram, ts:TypeScriptCompilerApi):any {
    const declaration=program.declaration;
    if (declaration.declarationKind !== "packageFunction") throw new Error("Expected package function");
    if (declaration.name === "arguments" || declaration.parameters.some(parameter => parameter.name === "arguments")
        || constructorStatementsBindArguments(declaration.body))
        throw new HardenedSemanticError("HARDENED_EMIT_FUNCTION_ARITY",
            "package function binding cannot shadow the runtime arguments object", declaration.sourceNodeId);
    const qname=program.packageName ? program.packageName+"."+declaration.name : declaration.name;
    const count=ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("arguments"),"length");
    const minimum=declaration.parameters.filter(p=>!p.rest && p.defaultValue === null).length;
    const maximum=declaration.parameters.some(p=>p.rest) ? null : declaration.parameters.length;
    const prologue=[ts.factory.createExpressionStatement(ts.factory.createCallExpression(
        ts.factory.createIdentifier("__as3CheckFunctionArity"),undefined,[ts.factory.createStringLiteral(qname),count,
            ts.factory.createNumericLiteral(minimum),maximum === null ? ts.factory.createNull() : ts.factory.createNumericLiteral(maximum)]))];
    const parameters=declaration.parameters.map((parameter,index)=>{
        const value=ts.factory.createIdentifier(parameter.name);
        if (parameter.rest) return parameterNode(parameter,ts);
        let initial:any=value;
        if (parameter.defaultValue !== null) initial=ts.factory.createConditionalExpression(
            ts.factory.createBinaryExpression(count,ts.factory.createToken(ts.SyntaxKind.LessThanEqualsToken),ts.factory.createNumericLiteral(index)),
            ts.factory.createToken(ts.SyntaxKind.QuestionToken),expressionNode(parameter.defaultValue,ts),ts.factory.createToken(ts.SyntaxKind.ColonToken),value);
        prologue.push(ts.factory.createExpressionStatement(ts.factory.createAssignment(value,ts.factory.createCallExpression(
            ts.factory.createIdentifier("__as3FunctionArgument"),undefined,[initial,ts.factory.createStringLiteral(parameter.type.sourceName)]))));
        return ts.factory.createParameterDeclaration(undefined,undefined,parameter.name,
            parameter.defaultValue === null ? undefined : ts.factory.createToken(ts.SyntaxKind.QuestionToken),
            typeNode(parameter.type,ts),undefined);
    });
    return ts.factory.createFunctionDeclaration([ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],undefined,
        declaration.name,undefined,parameters,typeNode(declaration.returnType,ts),
        ts.factory.createBlock(prologue.concat(declaration.body.map(statement=>statementNode(statement,ts))),true));
}

/** Replace only receiver references already proved to be non-escaping own-slot accesses. */
function stagedConstructorValue<T>(value:T):T {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(stagedConstructorValue) as T;
    const record=value as {[key:string]:unknown};
    if (record.kind === "this") return {...record,kind:"identifier",name:"__as3PreSuperFields",
        bindingKind:"local",bindingSourceQualifiedName:null} as T;
    return Object.fromEntries(Object.entries(record).map(([key,child])=>[key,stagedConstructorValue(child)])) as T;
}

function classConstructorNode(program: SemanticProgram, member: SemanticConstructor | null,
    boundMethods: string[], ts: TypeScriptCompilerApi): any {
    if (program.declaration.declarationKind === "packageField" || program.declaration.declarationKind === "packageFunction") {
        throw new HardenedSemanticError("HARDENED_EMIT_CONSTRUCTOR", "package field cannot own a class constructor", program.sourceNodeId);
    }
    const classDeclaration = program.declaration;
    const className = classDeclaration.name;
    const derived = classDeclaration.extendsType !== null;
    const superIndex = member?.body.findIndex(statement => statement.kind === "expression"
        && statement.expression.kind === "call" && statement.expression.callee.kind === "super") ?? -1;
    const staged=member?.preSuperFieldState === true;
    const instanceFields=classDeclaration.members.filter((item):item is SemanticField=>item.kind === "field"
        && !item.modifiers.includes("static"));
    const original = member === null ? [] : member.body.map((statement,index) => statementNode(
        staged && index <= superIndex ? stagedConstructorValue(statement) : statement, ts));
    const stagedFieldSetup:any[]=staged ? [ts.factory.createVariableStatement(undefined,
        ts.factory.createVariableDeclarationList([ts.factory.createVariableDeclaration("__as3PreSuperFields",undefined,
            ts.factory.createTypeLiteralNode(instanceFields.map(field=>ts.factory.createPropertySignature(undefined,
                field.name,undefined,typeNode(field.type,ts)))),
            ts.factory.createObjectLiteralExpression(instanceFields.map(field=>ts.factory.createPropertyAssignment(field.name,
                fieldDefaultExpression(field,ts)))))],ts.NodeFlags.Const)),
        ...instanceFields.filter(field=>field.initializer !== null).map(field=>ts.factory.createExpressionStatement(
            ts.factory.createAssignment(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("__as3PreSuperFields"),field.name),
                expressionNode(stagedConstructorValue(field.initializer!),ts))))] : [];
    // Keep local side effects and failures before preparing the base constructor call.
    const leadingLocals = superIndex < 0 ? [] : original.splice(0, superIndex);
    const originalSuperStatement = superIndex >= 0 ? original.shift()! : derived && member === null
        ? ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createSuper(), undefined, [])) : null;
    let prepareStatement: any = null;
    let superStatement: any = null;
    if (originalSuperStatement !== null) {
        const originalCall = originalSuperStatement.expression;
        prepareStatement = ts.factory.createVariableStatement(undefined, ts.factory.createVariableDeclarationList([
            ts.factory.createVariableDeclaration("__as3PreparedConstruction", undefined, undefined,
                ts.factory.createCallExpression(ts.factory.createIdentifier("__as3PrepareConstruction"), undefined,
                    [newTargetExpression(ts), ts.factory.createIdentifier(className),
                        ts.factory.createIdentifier("__as3ConstructionProof")]))], ts.NodeFlags.Const));
        const prepared = ts.factory.createSpreadElement(ts.factory.createIdentifier("__as3PreparedConstruction"));
        const authenticatedSuper = ts.factory.createExpressionStatement(ts.factory.createCallExpression(
            originalCall.expression, originalCall.typeArguments, [...(classDeclaration.extendsType?.runtimeName === "Array"
                ? [ts.factory.createSpreadElement(ts.factory.createCallExpression(ts.factory.createIdentifier("__as3ArrayConstructorArguments"),undefined,
                    [ts.factory.createArrayLiteralExpression([...originalCall.arguments])]))] : originalCall.arguments), prepared]));
        const cancel = ts.factory.createIfStatement(ts.factory.createBinaryExpression(newTargetExpression(ts),
            ts.factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken), ts.factory.createIdentifier(className)),
        ts.factory.createExpressionStatement(ts.factory.createCallExpression(
            ts.factory.createIdentifier("__as3CancelPreparedConstruction"), undefined,
            [newTargetExpression(ts), ts.factory.createIdentifier("__as3ConstructionProof"),
                ts.factory.createIdentifier("__as3PreparedConstruction")])));
        superStatement = ts.factory.createTryStatement(ts.factory.createBlock([authenticatedSuper], true),
            ts.factory.createCatchClause(ts.factory.createVariableDeclaration("__as3SuperError"), ts.factory.createBlock([
                cancel, ts.factory.createThrowStatement(ts.factory.createIdentifier("__as3SuperError"))], true)), undefined);
    }
    const prologue: any[] = [ts.factory.createExpressionStatement(ts.factory.createCallExpression(
        ts.factory.createIdentifier("__as3EnterConstruction"), undefined,
        [ts.factory.createThis(), newTargetExpression(ts), ts.factory.createIdentifier(className),
            ts.factory.createIdentifier("__as3ConstructionProof")])),
    ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier("__as3ConstructionTargets"), "set"), undefined,
    [ts.factory.createThis(), ts.factory.createAsExpression(newTargetExpression(ts),
        ts.factory.createTypeQueryNode(ts.factory.createIdentifier(className)))])),
    ts.factory.createVariableStatement(undefined, ts.factory.createVariableDeclarationList([
        ts.factory.createVariableDeclaration("__as3ConstructionFailed", undefined, undefined, ts.factory.createFalse()),
    ], ts.NodeFlags.Let))];
    const explicitFields = instanceFields.filter(field => staged || field.initializer !== null).map(field =>
        ts.factory.createExpressionStatement(ts.factory.createBinaryExpression(
            ts.factory.createPropertyAccessExpression(ts.factory.createThis(), field.name),
            ts.factory.createToken(ts.SyntaxKind.EqualsToken), staged
                ? ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("__as3PreSuperFields"),field.name)
                : expressionNode(field.initializer!, ts))));
    const tryBody = [ts.factory.createExpressionStatement(ts.factory.createCallExpression(
        ts.factory.createIdentifier("__as3InitializeInstanceFields"), undefined,
        [ts.factory.createThis(), newTargetExpression(ts)])),
    ...boundMethods.map(name => bindMethodStatement(name, ts)), ...explicitFields, ...original];
    const catchClause = ts.factory.createCatchClause(ts.factory.createVariableDeclaration("__as3ConstructionError"),
        ts.factory.createBlock([ts.factory.createExpressionStatement(ts.factory.createBinaryExpression(
            ts.factory.createIdentifier("__as3ConstructionFailed"), ts.factory.createToken(ts.SyntaxKind.EqualsToken),
            ts.factory.createTrue())), ts.factory.createExpressionStatement(ts.factory.createCallExpression(
            ts.factory.createIdentifier("__as3AbortConstruction"), undefined,
            [ts.factory.createThis(), newTargetExpression(ts), ts.factory.createIdentifier(className),
                ts.factory.createIdentifier("__as3ConstructionProof")])),
        ts.factory.createThrowStatement(ts.factory.createIdentifier("__as3ConstructionError"))], true));
    const exactTarget = ts.factory.createBinaryExpression(newTargetExpression(ts),
        ts.factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken), ts.factory.createIdentifier(className));
    const finallyClause = ts.factory.createBlock([ts.factory.createIfStatement(ts.factory.createBinaryExpression(
        ts.factory.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken,
            ts.factory.createIdentifier("__as3ConstructionFailed")), ts.factory.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
        exactTarget), ts.factory.createBlock([ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier("__as3ClassInstances"), "add"), undefined, [ts.factory.createThis()])),
        ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createIdentifier("__as3CompleteConstruction"), undefined,
            [ts.factory.createThis(), newTargetExpression(ts), ts.factory.createIdentifier(className),
                ts.factory.createIdentifier("__as3ConstructionProof")]))], true)),
    ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(
        ts.factory.createIdentifier("__as3ConstructionTargets"), "delete"), undefined, [ts.factory.createThis()]))], true);
    const constructorParameters=(member?.parameters ?? []).map(parameter=>{
        if (parameter.rest) return parameterNode(parameter,ts);
        return ts.factory.createParameterDeclaration(undefined,undefined,parameter.name,
            parameter.defaultValue === null ? undefined : ts.factory.createToken(ts.SyntaxKind.QuestionToken),
            typeNode(parameter.type,ts),undefined);
    });
    const constructorSlots=(member?.parameters ?? []).filter(parameter=>!parameter.rest).flatMap((parameter)=>{
        const value=ts.factory.createIdentifier(parameter.name),index=member!.parameters.indexOf(parameter);
        const initial=parameter.defaultValue === null ? value : ts.factory.createConditionalExpression(
            ts.factory.createBinaryExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("arguments"),"length"),
                ts.factory.createToken(ts.SyntaxKind.LessThanEqualsToken),ts.factory.createNumericLiteral(index)),
            ts.factory.createToken(ts.SyntaxKind.QuestionToken),expressionNode(parameter.defaultValue,ts),ts.factory.createToken(ts.SyntaxKind.ColonToken),value);
        const referenceParameter = parameter.type.runtimeName !== null
            && (parameter.type.sourceName === className || program.imports.some(item =>
                item.sourceQualifiedName === parameter.type.runtimeName && item.localValueType === null
                && (item.authorityKind === "local" || item.authorityKind === "flash")
                && (item.runtimeConstructible || item.runtimeInterface)));
        if (!nativeParameterSlot(parameter) && !referenceParameter && parameter.defaultValue === null) return [];
        const normalized = referenceParameter ? ts.factory.createCallExpression(
            ts.factory.createIdentifier("__as3Cast"), undefined, [initial,
                ts.factory.createCallExpression(ts.factory.createIdentifier("__as3NamedReferenceType"),
                    [typeNode({...parameter.type, nullable:false},ts)],
                    [ts.factory.createStringLiteral(parameter.type.runtimeName!)])])
            : nativeParameterSlot(parameter) ? ts.factory.createCallExpression(ts.factory.createIdentifier("__as3FunctionArgument"),undefined,
                [initial,ts.factory.createStringLiteral(parameter.type.sourceName)]) : initial;
        return [ts.factory.createExpressionStatement(ts.factory.createAssignment(value,normalized))];
    });
    const constructorQName=program.fileLocalScope ? fileLocalClassIdentity(program.fileLocalScope).reflectionName
        : program.packageName ? program.packageName+"."+className : className;
    const body = [ts.factory.createExpressionStatement(initializeClassNode(ts.factory.createIdentifier(className), true, ts)),
        constructorArityGuard(constructorQName, member, ts), ...constructorSlots, ...stagedFieldSetup, ...leadingLocals,
        ...(superStatement === null ? [] : [prepareStatement, superStatement])]
        .concat(prologue, [ts.factory.createTryStatement(
        ts.factory.createBlock(tryBody, true), catchClause, finallyClause)]);
    if (derived && superStatement === null) {
        throw new HardenedSemanticError("HARDENED_EMIT_CONSTRUCTOR", "derived constructor lacks its proven top-level super call", program.sourceNodeId);
    }
    return ts.factory.createConstructorDeclaration(member === null ? undefined : modifierTokens(member.modifiers, ts),
        constructorParameters,
        ts.factory.createBlock(body, true));
}

function importNode(item: any, ts: TypeScriptCompilerApi): any {
    const specifier = ts.factory.createImportSpecifier(
        false,
        item.targetExport === item.sourceLocalName ? undefined : ts.factory.createIdentifier(item.targetExport),
        ts.factory.createIdentifier(item.sourceLocalName),
    );
    return ts.factory.createImportDeclaration(
        undefined,
        ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports([specifier])),
        ts.factory.createStringLiteral(item.targetModule),
        undefined,
    );
}

function interfaceMemberNode(member: SemanticMember, ts: TypeScriptCompilerApi): any {
    if (member.kind === "method") {
        return ts.factory.createMethodSignature(undefined, member.name, undefined, undefined,
            member.parameters.map(parameter => parameterNode(parameter, ts)), typeNode(member.returnType, ts));
    }
    if (member.kind === "getter") {
        return ts.factory.createGetAccessorDeclaration(undefined, member.name, [], typeNode(member.returnType, ts), undefined);
    }
    if (member.kind === "setter") {
        return ts.factory.createSetAccessorDeclaration(undefined, member.name,
            [parameterNode(member.parameter, ts)], undefined);
    }
    throw new HardenedSemanticError("HARDENED_EMIT_INTERFACE_MEMBER",
        "interface semantic IR contains a field or constructor implementation");
}

function programUsesVector(program: SemanticProgram): boolean {
    const visitType = (type: SemanticType | null): boolean => type !== null
        && (type.emittedName === "AS3Vector" || type.typeArguments.some(visitType));
    const visitExpression = (expression: SemanticExpression): boolean => {
        if (expression.kind === "new") return visitType(expression.sourceType) || expression.arguments.some(visitExpression);
        if (expression.kind === "vectorConversion") return true;
        if (expression.kind === "runtimeType") return visitType(expression.targetType) || visitExpression(expression.value);
        if (expression.kind === "functionApply") return visitExpression(expression.target) || visitExpression(expression.receiver) || visitExpression(expression.argumentsArray);
        if (expression.kind === "coercion") return expression.argument !== null && visitExpression(expression.argument);
        if (expression.kind === "array") return expression.elements.some(visitExpression);
        if (expression.kind === "object") return expression.properties.some(property => visitExpression(property.value));
        if (expression.kind === "dictionaryHas") return visitExpression(expression.index) || visitExpression(expression.target);
        if (expression.kind === "objectOperation") return visitExpression(expression.target)
            || visitExpression(expression.index) || expression.arguments.some(visitExpression);
        if (expression.kind === "index") return visitType(expression.resultType)
            || visitExpression(expression.target) || visitExpression(expression.index);
        if (expression.kind === "member") return visitExpression(expression.target);
        if (expression.kind === "math" || expression.kind === "globalCall" || expression.kind === "parseInteger" || expression.kind === "numericPredicate") return expression.arguments?.some(visitExpression) || false;
        if (expression.kind === "call") return visitExpression(expression.callee) || expression.arguments.some(visitExpression);
        if (expression.kind === "assignment") return visitExpression(expression.target) || visitExpression(expression.value);
        if (expression.kind === "binary") return visitExpression(expression.left) || visitExpression(expression.right);
        if (expression.kind === "unary") return visitExpression(expression.operand);
        if (expression.kind === "parenthesized") return visitExpression(expression.expression);
        if (expression.kind === "nonNull") return visitExpression(expression.expression);
        if (expression.kind === "conditional") return visitExpression(expression.condition)
            || visitExpression(expression.whenTrue) || visitExpression(expression.whenFalse);
        if (expression.kind === "update") return visitExpression(expression.target);
        if (expression.kind === "lambda") return visitType(expression.returnType)
            || expression.parameters.some(parameter => visitType(parameter.type)
                || (parameter.defaultValue !== null && visitExpression(parameter.defaultValue)))
            || expression.statements.some(visitStatement);
        if (expression.kind === "delete") return visitExpression(expression.target);
        return false;
    };
    const visitStatement = (statement: SemanticStatement): boolean => {
        if (statement.kind === "expression") return visitExpression(statement.expression);
        if (statement.kind === "return") return statement.expression !== null && visitExpression(statement.expression);
        if (statement.kind === "local") return statement.declarations.some(local => visitType(local.type) || visitExpression(local.initializer));
        if (statement.kind === "while") return visitExpression(statement.condition) || statement.statements.some(visitStatement);
        if (statement.kind === "doWhile") return visitExpression(statement.condition) || statement.statements.some(visitStatement);
        if (statement.kind === "switch") return visitExpression(statement.expression)
            || statement.cases.some(item => (item.test !== null && visitExpression(item.test)) || item.statements.some(visitStatement));
        if (statement.kind === "throw") return visitExpression(statement.expression);
        if (statement.kind === "for") return (statement.initializer?.kind === "expression" && visitExpression(statement.initializer.expression))
            || (statement.initializer?.kind === "local" && statement.initializer.declarations.some(local => visitType(local.type) || visitExpression(local.initializer)))
            || (statement.condition !== null && visitExpression(statement.condition))
            || (statement.update !== null && visitExpression(statement.update)) || statement.statements.some(visitStatement);
        if (statement.kind === "forEach") return visitType(statement.binding.type) || visitType(statement.iterableType)
            || visitExpression(statement.iterable) || statement.statements.some(visitStatement);
        if (statement.kind === "forIn") return visitType(statement.targetType) || visitType(statement.iterableType)
            || visitExpression(statement.target)
            || visitExpression(statement.iterable) || statement.statements.some(visitStatement);
        if (statement.kind === "try") return statement.tryStatements.some(visitStatement)
            || (statement.catchClause !== null && (visitType(statement.catchClause.type)
                || statement.catchClause.statements.some(visitStatement)))
            || (statement.finallyStatements !== null && statement.finallyStatements.some(visitStatement));
        if (statement.kind === "label") return visitStatement(statement.statement);
        if (statement.kind === "if") return visitExpression(statement.condition) || statement.thenStatements.some(visitStatement)
            || (statement.elseStatements !== null && statement.elseStatements.some(visitStatement));
        return false;
    };
    if (program.declaration.declarationKind === "packageField") {
        return visitType(program.declaration.type) || visitExpression(program.declaration.initializer);
    }
    if (program.declaration.declarationKind === "packageFunction") return visitType(program.declaration.returnType)
        || program.declaration.parameters.some(parameter=>visitType(parameter.type)) || program.declaration.body.some(visitStatement);
    return visitType(program.declaration.extendsType)
        || program.declaration.interfaceExtendsTypes.some(visitType)
        || program.declaration.members.some(member => {
        if (member.kind === "field") return visitType(member.type)
            || (member.initializer !== null && visitExpression(member.initializer));
        if (member.kind === "constructor") return member.parameters.some(parameter => visitType(parameter.type))
            || member.body.some(visitStatement);
        if (member.kind === "setter") return visitType(member.parameter.type) || member.body.some(visitStatement);
        return visitType(member.returnType) || (member.kind === "method" && member.parameters.some(parameter => visitType(parameter.type)))
            || member.body.some(visitStatement);
    });
}

function vectorRuntimeImport(ts: TypeScriptCompilerApi): any {
    const names = [
        ["AS3Vector", "__as3Vector"], ["AS3VectorPolicies", "__as3VectorPolicies"],
        ["as3VectorReference", "__as3VectorReference"], ["as3VectorType", "__as3VectorType"],
        ["as3VectorNested", "__as3VectorNested"],
    ].map(([exported, local]) => ts.factory.createImportSpecifier(false,
        ts.factory.createIdentifier(exported!), ts.factory.createIdentifier(local!)));
    return ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports(names)),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3Vector"), undefined);
}

function programHasKind(program: SemanticProgram, kind: string): boolean {
    const seen = new WeakSet<object>();
    const visit = (value: unknown): boolean => {
        if (typeof value !== "object" || value === null) return false;
        if (seen.has(value)) return false;
        seen.add(value);
        const record = value as { [key: string]: unknown };
        if (record.kind === kind) return true;
        return Object.keys(record).some(key => visit(record[key]));
    };
    return visit(program);
}

function programUsesRuntimeType(program: SemanticProgram): boolean {
    const seen = new Set<object>();
    const visit = (value: any): boolean => {
        if (value === null || typeof value !== "object" || seen.has(value)) return false;
        seen.add(value);
        return value.kind === "runtimeType" || value.reference !== undefined
            && (value.kind === "coercion" || value.kind === "assignmentStorageCoercion")
            || Object.values(value).some(visit);
    };
    return visit(program);
}

function programUsesClassValue(program: SemanticProgram): boolean {
    const seen = new Set<object>();
    const visit = (value: unknown): boolean => {
        if (typeof value !== "object" || value === null) return false;
        if (seen.has(value)) return false;
        seen.add(value);
        const record = value as { [key: string]: unknown };
        if (record.sourceName === "Class") return true;
        return Object.keys(record).some(key => visit(record[key]));
    };
    return visit(program);
}

function embeddedBitmapDeclarations(program: SemanticProgram, imports: any[], ts: TypeScriptCompilerApi): any[] {
    if (program.declaration.declarationKind !== "class") return [];
    const fields = program.declaration.members.filter((member): member is SemanticField => member.kind === "field" && !!member.embeddedBitmap);
    if (fields.length === 0) return [];
    const bitmap = fields[0]!.embeddedBitmap!;
    const namedImport = (module: string, exported: string, local: string) => ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(false, ts.factory.createIdentifier(exported), ts.factory.createIdentifier(local))])),
        ts.factory.createStringLiteral(module), undefined);
    imports.push(namedImport(bitmap.bitmapModule, bitmap.bitmapExport, "__as3EmbeddedBitmap"));
    imports.push(namedImport("@bleach/as3-runtime/AS3Embed", "as3EmbeddedBitmapData", "__as3EmbeddedBitmapData"));
    return fields.flatMap(field => {
        const asset = field.embeddedBitmap!, name = asset.className, instances = name + "Instances";
        const propertyCall = (owner: string, method: string, args: any[]) => ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier(owner), method), undefined, args);
        return [ts.factory.createVariableStatement(undefined, ts.factory.createVariableDeclarationList([
            ts.factory.createVariableDeclaration(instances, undefined, undefined,
                ts.factory.createNewExpression(ts.factory.createIdentifier("WeakSet"),
                    [ts.factory.createKeywordTypeNode(ts.SyntaxKind.ObjectKeyword)], []))], ts.NodeFlags.Const)),
            ts.factory.createClassDeclaration([ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)], name, undefined,
                [ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [ts.factory.createExpressionWithTypeArguments(
                    ts.factory.createIdentifier("__as3EmbeddedBitmap"), undefined)])], [
                    ts.factory.createConstructorDeclaration(undefined, [], ts.factory.createBlock([
                        ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createSuper(), undefined, [
                            ts.factory.createCallExpression(ts.factory.createIdentifier("__as3EmbeddedBitmapData"), undefined,
                                [ts.factory.createStringLiteral(asset.resourceId)])])),
                        ts.factory.createExpressionStatement(propertyCall(instances, "add", [ts.factory.createThis()])),
                    ], true)),
                ]),
            ts.factory.createFunctionDeclaration([ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)], undefined,
                name + "Predicate", undefined, [ts.factory.createParameterDeclaration(undefined, undefined, "value", undefined,
                    ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword), undefined)],
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword), ts.factory.createBlock([
                    ts.factory.createReturnStatement(propertyCall(instances, "has", [ts.factory.createAsExpression(
                        ts.factory.createIdentifier("value"), ts.factory.createKeywordTypeNode(ts.SyntaxKind.ObjectKeyword))])),
                ], true)),
        ];
    });
}

function runtimeTypeImport(ts: TypeScriptCompilerApi, referenceEnumeration: boolean = false): any {
    const names = [
        ["AS3ClassValue", "__as3ClassValue"], ["AS3Types", "__as3Types"], ["as3As", "__as3As"], ["as3Is", "__as3Is"], ["as3Cast", "__as3Cast"],
        ["as3ClassType", "__as3ClassType"], ["as3InterfaceType", "__as3InterfaceType"],
        ["as3NamedReferenceType", "__as3NamedReferenceType"],
        ["as3ConstructClass", "__as3ConstructClass"],
        ["as3RejectConstructorArity", "__as3RejectConstructorArity"],
        ["as3InitializeInstanceFields", "__as3InitializeInstanceFields"],
        ["as3PrepareConstruction", "__as3PrepareConstruction"],
        ["as3CancelPreparedConstruction", "__as3CancelPreparedConstruction"],
        ["as3EnterConstruction", "__as3EnterConstruction"],
        ["as3AbortConstruction", "__as3AbortConstruction"],
        ["as3CompleteConstruction", "__as3CompleteConstruction"],
        ...(referenceEnumeration ? [["as3ReferenceValues", "__as3ReferenceValues"]] : []),
    ].map(([exported, local]) => ts.factory.createImportSpecifier(false,
        ts.factory.createIdentifier(exported!), ts.factory.createIdentifier(local!)));
    return ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports(names)),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3Type"), undefined);
}

function methodClosureRuntimeImport(ts: TypeScriptCompilerApi): any {
    return ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(false, ts.factory.createIdentifier("as3BindMethod"),
                ts.factory.createIdentifier("__as3BindMethod")),
            ts.factory.createImportSpecifier(false, ts.factory.createIdentifier("as3BindStaticMethod"),
                ts.factory.createIdentifier("__as3BindStaticMethod")),
        ])),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3MethodClosure"), undefined);
}

function coercionRuntimeImport(ts: TypeScriptCompilerApi): any {
    const names = ["as3IsNaN", "as3ParseInt", "as3Boolean", "as3Int", "as3Number", "as3String", "as3Uint", "as3Object", "as3ObjectConversion", "as3TraceValue", "as3NumericBinary", "as3StringLength", "as3ErrorToString", "as3ErrorID", "as3StringToLowerCase", "as3StringCharAt", "as3StringSplit", "as3NumberToFixed", "as3Add", "as3Equals", "as3Relation"].map(exported =>
        ts.factory.createImportSpecifier(false, ts.factory.createIdentifier(exported),
            ts.factory.createIdentifier(`__${exported}`)));
    return ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports(names)),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3Coerce"), undefined);
}

function arrayRuntimeImport(ts: TypeScriptCompilerApi): any {
    return ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(false, ts.factory.createIdentifier("as3ArrayLiteral"),ts.factory.createIdentifier("__as3ArrayLiteral")),
            ts.factory.createImportSpecifier(false, ts.factory.createIdentifier("as3NewArray"),ts.factory.createIdentifier("__as3NewArray")),
            ts.factory.createImportSpecifier(false, ts.factory.createIdentifier("as3ArrayRead"),
                ts.factory.createIdentifier("__as3ArrayRead")),
            ts.factory.createImportSpecifier(false, ts.factory.createIdentifier("as3ArrayWrite"),
                ts.factory.createIdentifier("__as3ArrayWrite")),
            ts.factory.createImportSpecifier(false, ts.factory.createIdentifier("as3ArrayLengthWrite"),
                ts.factory.createIdentifier("__as3ArrayLengthWrite")),
            ts.factory.createImportSpecifier(false, ts.factory.createIdentifier("as3ArrayCall"),
                ts.factory.createIdentifier("__as3ArrayCall")),
            ts.factory.createImportSpecifier(false, ts.factory.createIdentifier("as3ArrayValues"),
                ts.factory.createIdentifier("__as3ArrayValues")),
        ])),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3Array"), undefined);
}

function programUsesArrayIndex(program: SemanticProgram): boolean {
    const seen = new WeakSet<object>();
    const visit = (value: unknown): boolean => {
        if (typeof value !== "object" || value === null) return false;
        if (seen.has(value)) return false;
        seen.add(value);
        const record = value as { [key: string]: unknown };
        if (record.kind === "array" || record.kind === "new" && record.nativeArray
            || record.kind === "assignment" && record.arrayLengthStorage
            || record.kind === "index" && record.accessKind === "array"
            || record.kind === "call" && record.capabilitySource === "Array"
            || record.kind === "forEach" && (record.iterableType as SemanticType)?.sourceName === "Array") return true;
        return Object.keys(record).some(key => visit(record[key]));
    };
    return visit(program);
}

function ownRecordRuntimeImport(ts: TypeScriptCompilerApi): any {
    const names = [
        ["AS3OwnRecord", "__AS3OwnRecord"], ["as3CreateOwnRecord", "__as3CreateOwnRecord"],
        ["as3OwnRecordGet", "__as3OwnRecordGet"], ["as3OwnRecordSet", "__as3OwnRecordSet"],
    ].map(([exported, local]) => ts.factory.createImportSpecifier(false,
        ts.factory.createIdentifier(exported!), ts.factory.createIdentifier(local!)));
    return ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports(names)),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3OwnRecord"), undefined);
}

function bigTurnTableInnerRuntimeImport(ts: TypeScriptCompilerApi): any {
    return ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(false,
                ts.factory.createIdentifier("BigTurnTableInnerConfig"),
                ts.factory.createIdentifier("__BigTurnTableInnerConfig")),
            ts.factory.createImportSpecifier(false,
                ts.factory.createIdentifier("as3BigTurnTableInnerEntry"),
                ts.factory.createIdentifier("__as3BigTurnTableInnerEntry")),
        ])),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3BigTurnTableInnerDto"), undefined);
}

function programUsesBigTurnTableInner(program: SemanticProgram): boolean {
    const seen = new WeakSet<object>();
    const visit = (value: unknown): boolean => {
        if (typeof value !== "object" || value === null) return false;
        if (seen.has(value)) return false;
        seen.add(value);
        const record = value as { [key: string]: unknown };
        if (record.kind === "index" && record.accessKind === "bigTurnTableInnerRoot") return true;
        return Object.keys(record).some(key => visit(record[key]));
    };
    return visit(program);
}

export function emitSemanticProgram(program: SemanticProgram, options: EmitterOptions): EmittedTypeScript {
    assertAdaptedSemanticProgram(program);
    if (program.fileLocalScope && (program.declaration.declarationKind !== "class" || program.packageName !== ""
        || program.declaration.name !== program.fileLocalScope.name
        || program.declaration.modifiers.some(value => value !== "dynamic"))) {
        throw new HardenedSemanticError("HARDENED_EMIT_FILE_LOCAL", "file-local class differs from its authenticated scope");
    }
    const fileLocalIdentity = program.fileLocalScope ? fileLocalClassIdentity(program.fileLocalScope) : null;
    const ts = options.compiler;
    if (!ts || ts.version !== options.expectedTypeScriptVersion || !ts.factory || typeof ts.createPrinter !== "function") {
        throw new HardenedSemanticError("HARDENED_TYPESCRIPT_VERSION", "structural emitter requires the exact configured modern TypeScript compiler API");
    }
    const imports = program.imports.filter((item) => !item.compileTimeNamespace).map((item) => importNode(item, ts));
    if (program.declaration.declarationKind === "class" && program.declaration.extendsType?.runtimeName === "Array")
        imports.push(ts.factory.createImportDeclaration(undefined,
            ts.factory.createImportClause(false,undefined,ts.factory.createNamedImports([
                ts.factory.createImportSpecifier(false,ts.factory.createIdentifier("AS3ArrayBase"),ts.factory.createIdentifier("__AS3ArrayBase")),
                ts.factory.createImportSpecifier(false,ts.factory.createIdentifier("as3ArrayConstructorArguments"),ts.factory.createIdentifier("__as3ArrayConstructorArguments"))])),
            ts.factory.createStringLiteral("@bleach/as3-runtime/AS3Array"),undefined));
    imports.push(ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports(
            ["as3InitializeClass", "as3DefineClassInitialization", "as3InitializeStaticField", "as3ClassMemberReceiver"].map(name =>
                ts.factory.createImportSpecifier(false, ts.factory.createIdentifier(name), ts.factory.createIdentifier("__" + name))))),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3ClassInitialization"), undefined));
    if (program.imports.some(item => item.sourceQualifiedName === "flash.utils.getQualifiedClassName")) {
        for (const [module, exported, local] of [
            ["laya/flash/utils/getQualifiedClassName", "resolveNativeClassName", "__as3ResolveNativeClassName"],
            ["@bleach/as3-runtime/AS3Type", "as3ReflectionClassIdentity", "__as3ReflectionClassIdentity"],
        ]) imports.push(ts.factory.createImportDeclaration(undefined,
            ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports([
                ts.factory.createImportSpecifier(false, ts.factory.createIdentifier(exported!), ts.factory.createIdentifier(local!))])),
            ts.factory.createStringLiteral(module!), undefined));
    }
    if (programHasKind(program, "object")) imports.push(ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(false, ts.factory.createIdentifier("as3ObjectLiteral"),
                ts.factory.createIdentifier("__as3ObjectLiteral"))])),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3Object"), undefined));
    const usesObjectDispatch = (value:any):boolean => value !== null && typeof value === "object" && (
        value.kind === "objectOperation" || value.kind === "index" && value.accessKind === "object"
        || Object.values(value).some(usesObjectDispatch));
    if (usesObjectDispatch(program)) imports.push(ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false,undefined,ts.factory.createNamedImports(
            ["as3ObjectRead","as3ObjectWrite","as3ObjectUpdate","as3ObjectDelete","as3ObjectIn","as3ObjectCall"].map(name =>
                ts.factory.createImportSpecifier(false,ts.factory.createIdentifier(name),ts.factory.createIdentifier("__"+name))))),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3ObjectDispatch"),undefined));
    const globalCalls = new Map<string, Extract<SemanticExpression, {kind: "globalCall"}>>();
    let referenceEnumeration = false;
    const collectGlobals = (value: any): void => {
        if (!value || typeof value !== "object") return;
        if (value.kind === "forEach" && value.bindingReference) referenceEnumeration = true;
        if (value.kind === "globalCall" || value.kind === "globalFunction") globalCalls.set(value.name, value);
        Object.keys(value).forEach(key => collectGlobals(value[key]));
    };
    collectGlobals(program);
    for (const [name, call] of [...globalCalls].sort(([left], [right]) => left.localeCompare(right)))
        imports.push(ts.factory.createImportDeclaration(undefined,
            ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports([
                ts.factory.createImportSpecifier(false, ts.factory.createIdentifier(call.targetExport),
                    ts.factory.createIdentifier("__as3Global_" + name))])),
            ts.factory.createStringLiteral(call.targetModule), undefined));
    if (programUsesVector(program)) imports.push(vectorRuntimeImport(ts));
    const implementsTypes = program.declaration.declarationKind === "packageField" || program.declaration.declarationKind === "packageFunction"
        ? [] : program.declaration.implementsTypes;
    if (program.declaration.declarationKind !== "packageField" || programUsesClassValue(program)
        || programUsesRuntimeType(program) || referenceEnumeration || implementsTypes.length > 0 || programUsesVector(program)) {
        imports.push(runtimeTypeImport(ts,referenceEnumeration));
    }
    const argumentError=(value:any):boolean => value !== null && typeof value === "object" && (
        value.kind === "new" && value.sourceType.emittedName === "__AS3ArgumentError"
        && value.sourceType.runtimeName === "ArgumentError" || Object.values(value).some(argumentError));
    if (argumentError(program)) imports.push(ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false,undefined,ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(false,ts.factory.createIdentifier("AS3ArgumentError"),
                ts.factory.createIdentifier("__AS3ArgumentError"))])),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3Error"),undefined));
    const primitiveMember=(value:any):boolean => value !== null && typeof value === "object" && (
        value.kind === "member" && value.capabilitySource === "String" && value.name === "length"
        || value.kind === "member" && value.capabilitySource === "Error" && value.name === "errorID"
        || value.kind === "call" && value.capabilitySource === "Number" && value.capabilityMember === "toFixed"
        || value.kind === "call" && value.capabilitySource === "Error" && value.capabilityMember === "toString"
        || value.kind === "call" && value.capabilitySource === "String" && ["toLowerCase","charAt","split"].includes(value.capabilityMember)
        || Object.values(value).some(primitiveMember));
    if (programHasKind(program, "update") || programHasKind(program, "coercion") || programHasKind(program, "assignmentStorageCoercion")
        || programHasKind(program, "parseInteger") || programHasKind(program,"numericPredicate") || programHasKind(program, "binary") || globalCalls.size > 0 || primitiveMember(program)) imports.push(coercionRuntimeImport(ts));
    const functionRuntime=(value:any):boolean => value !== null && typeof value === "object" && (
        value.kind === "member" && value.capabilitySource === "Function" && value.name === "length"
        || value.kind === "functionApply" || value.kind === "globalFunction"
        || value.kind === "lambda"
        || (value.kind === "coercion" || value.kind === "assignmentStorageCoercion") && value.slot
            && value.targetType.sourceName !== "Dictionary"
        || value.kind === "constructor" && value.parameters.some(nativeParameterSlot)
        || value.kind === "method"
        || value.declarationKind === "packageFunction" || Object.values(value).some(functionRuntime));
    if (functionRuntime(program)) imports.push(ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false,undefined,ts.factory.createNamedImports(
            ["as3DefineFunctionLength","as3DefineMethodLength","as3FunctionLength","as3SourceLambda","as3FunctionApply","as3FunctionCall","as3FunctionInvoke","as3FunctionFieldInvoke","as3CheckLambdaArity","as3FunctionArgument","as3CheckFunctionArity","as3CheckMethodMinimumArity","as3CheckMethodArity","as3TraceFunction"].map(name =>
                ts.factory.createImportSpecifier(false,ts.factory.createIdentifier(name),ts.factory.createIdentifier("__"+name))))),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3Function"),undefined));
    const dictionarySlot = (value:any):boolean => value !== null && typeof value === "object" && (
        (value.kind === "coercion" || value.kind === "assignmentStorageCoercion") && value.slot
            && value.targetType.sourceName === "Dictionary"
        || value.kind === "forEach" && value.iterableType.sourceName === "Dictionary" || Object.values(value).some(dictionarySlot));
    if (dictionarySlot(program)) imports.push(ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(false, ts.factory.createIdentifier("as3DictionarySlot"),
                ts.factory.createIdentifier("__as3DictionarySlot")),
            ts.factory.createImportSpecifier(false, ts.factory.createIdentifier("as3DictionaryValues"),
                ts.factory.createIdentifier("__as3DictionaryValues"))])),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3Dictionary"), undefined));
    if (programHasKind(program,"dictionaryHas")) imports.push(ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false,undefined,ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(false,ts.factory.createIdentifier("as3DictionaryIn"),
                ts.factory.createIdentifier("__as3DictionaryIn"))])),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3Dictionary"),undefined));
    const dynamicEnumeration=(value:any):boolean => value !== null && typeof value === "object" && (
        value.kind === "forEach" && ["*","Object"].includes(value.iterableType.sourceName)
        || Object.values(value).some(dynamicEnumeration));
    if (dynamicEnumeration(program)) imports.push(ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false,undefined,ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(false,ts.factory.createIdentifier("as3DynamicValues"),ts.factory.createIdentifier("__as3DynamicValues"))])),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3Enumeration"),undefined));
    if (programUsesArrayIndex(program)) imports.push(arrayRuntimeImport(ts));
    if (programHasKind(program, "ownRecord")) {
        imports.push(ownRecordRuntimeImport(ts));
    }
    if (programUsesBigTurnTableInner(program)) {
        imports.push(bigTurnTableInnerRuntimeImport(ts));
    }
    if (programHasKind(program,"methodClosure")) imports.push(methodClosureRuntimeImport(ts));
    if (program.declaration.declarationKind === "packageField" || program.declaration.declarationKind === "packageFunction") {
        const declaration = program.declaration.declarationKind === "packageFunction" ? packageFunctionNode(program,ts) : ts.factory.createVariableStatement(
            [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
            ts.factory.createVariableDeclarationList([
                ts.factory.createVariableDeclaration(program.declaration.name, undefined,
                    typeNode(program.declaration.type, ts), expressionNode(program.declaration.initializer, ts)),
            ], ts.NodeFlags.Const),
        );
        const empty = ts.createSourceFile(program.outputModulePath, "", ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
        const functionLength = program.declaration.declarationKind === "packageFunction" ? [
            ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createIdentifier("__as3DefineFunctionLength"),
                undefined,[ts.factory.createIdentifier(program.declaration.name),
                    ts.factory.createNumericLiteral(program.declaration.parameters.filter(parameter=>!parameter.rest).length)]))] : [];
        const sourceFile = ts.factory.updateSourceFile(empty, imports.concat([declaration],functionLength));
        const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
        let code = printer.printFile(sourceFile).replace(/\r\n?/g, "\n").replace(/\n*$/, "\n");
        const reparsed = ts.createSourceFile(program.outputModulePath, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        if (Array.isArray(reparsed.parseDiagnostics) && reparsed.parseDiagnostics.length !== 0) {
            throw new HardenedSemanticError("HARDENED_EMIT_SYNTAX", "TypeScript printer output did not parse without diagnostics");
        }
        return { schema: "as3-structural-typescript-output@1", modulePath: program.outputModulePath,
            code, typeScriptVersion: ts.version };
    }
    const boundMethods = boundMethodNames(program);
    const classModifiers = program.declaration.modifiers.indexOf("public") >= 0
        ? [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)] : [];
    const heritage: any[] = [];
    if (program.declaration.extendsType !== null) heritage.push(
        ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
            ts.factory.createExpressionWithTypeArguments(
                ts.factory.createIdentifier(program.declaration.extendsType.emittedName), undefined,
            ),
        ]));
    if (program.declaration.implementsTypes.length > 0) heritage.push(
        ts.factory.createHeritageClause(ts.SyntaxKind.ImplementsKeyword,
            program.declaration.implementsTypes.map(item => ts.factory.createExpressionWithTypeArguments(
                ts.factory.createIdentifier(item.type.emittedName), undefined))));
    const constructorMember = program.declaration.declarationKind === "class"
        ? program.declaration.members.find((member): member is SemanticConstructor => member.kind === "constructor") ?? null : null;
    const staticFields = program.declaration.declarationKind === "class"
        ? program.declaration.members.filter((field): field is SemanticField => field.kind === "field" && field.modifiers.includes("static")) : [];
    const classMembers = program.declaration.declarationKind === "class"
        ? program.declaration.members.filter(member => member.kind !== "constructor").map(member => memberNode(member, ts,
            fileLocalIdentity?.reflectionName ?? (program.packageName ? program.packageName+"."+program.declaration.name : program.declaration.name),
            staticFields, program.declaration.name)) : [];
    if (program.declaration.declarationKind === "class") {
        for (const forward of program.declaration.inheritedAccessors || []) {
            const target = ts.factory.createPropertyAccessExpression(ts.factory.createSuper(), forward.name);
            if (forward.kind === "getter") classMembers.push(ts.factory.createGetAccessorDeclaration(
                modifierTokens(forward.modifiers, ts), forward.name, [], typeNode(forward.type, ts),
                ts.factory.createBlock([ts.factory.createReturnStatement(target)], true)));
            else classMembers.push(ts.factory.createSetAccessorDeclaration(
                modifierTokens(forward.modifiers, ts), forward.name,
                [ts.factory.createParameterDeclaration(undefined, undefined, "value", undefined, typeNode(forward.type, ts))],
                ts.factory.createBlock([ts.factory.createExpressionStatement(ts.factory.createAssignment(target,
                    ts.factory.createIdentifier("value")))], true)));
        }
        classMembers.push(classConstructorNode(program, constructorMember, boundMethods, ts));
    }
    const declaration = program.declaration.declarationKind === "interface"
        ? ts.factory.createInterfaceDeclaration(
            classModifiers,
            program.declaration.name,
            undefined,
            program.declaration.interfaceExtendsTypes.length === 0 ? undefined : [
                ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword,
                    program.declaration.interfaceExtendsTypes.map(item => ts.factory.createExpressionWithTypeArguments(
                        ts.factory.createIdentifier(item.emittedName), undefined))),
            ],
            program.declaration.members.map(member => interfaceMemberNode(member, ts)),
        )
        : ts.factory.createClassDeclaration(
            classModifiers,
            program.declaration.name,
            undefined,
            heritage.length === 0 ? undefined : heritage,
            classMembers,
        );
    const empty = ts.createSourceFile(program.outputModulePath, "", ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    const nominalState = program.declaration.declarationKind === "interface" ? [] : [
        ts.factory.createVariableStatement(undefined,
            ts.factory.createVariableDeclarationList([
                ts.factory.createVariableDeclaration("__as3ClassInstances", undefined,
                    ts.factory.createTypeReferenceNode("WeakSet", [ts.factory.createKeywordTypeNode(ts.SyntaxKind.ObjectKeyword)]),
                    ts.factory.createNewExpression(ts.factory.createIdentifier("WeakSet"), undefined, [])),
                ts.factory.createVariableDeclaration("__as3ConstructionTargets", undefined,
                    ts.factory.createTypeReferenceNode("WeakMap", [
                        ts.factory.createKeywordTypeNode(ts.SyntaxKind.ObjectKeyword),
                        ts.factory.createTypeQueryNode(ts.factory.createIdentifier(program.declaration.name)),
                    ]), ts.factory.createNewExpression(ts.factory.createIdentifier("WeakMap"), undefined, [])),
                ts.factory.createVariableDeclaration("__as3ConstructionProof", undefined, undefined,
                    ts.factory.createObjectLiteralExpression([], false)),
            ], ts.NodeFlags.Const)),
    ];
    const nominalPredicate = program.declaration.declarationKind === "interface" ? [] : [
        ts.factory.createFunctionDeclaration(
            [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)], undefined, "isAS3ClassInstance", undefined,
            [ts.factory.createParameterDeclaration(undefined, undefined, "value", undefined,
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword), undefined)],
            ts.factory.createTypePredicateNode(undefined, ts.factory.createIdentifier("value"),
                ts.factory.createTypeReferenceNode(program.declaration.name, undefined)),
            ts.factory.createBlock([ts.factory.createReturnStatement(ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("__as3ClassInstances"), "has"),
                undefined, [ts.factory.createAsExpression(ts.factory.createIdentifier("value"),
                    ts.factory.createKeywordTypeNode(ts.SyntaxKind.ObjectKeyword))]))], true)),
        ts.factory.createFunctionDeclaration(
            [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)], undefined, "as3ConstructionTarget", undefined,
            [ts.factory.createParameterDeclaration(undefined, undefined, "value", undefined,
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword), undefined)],
            ts.factory.createUnionTypeNode([ts.factory.createTypeQueryNode(ts.factory.createIdentifier(program.declaration.name)),
                ts.factory.createLiteralTypeNode(ts.factory.createNull())]),
            ts.factory.createBlock([ts.factory.createIfStatement(ts.factory.createBinaryExpression(
                ts.factory.createBinaryExpression(ts.factory.createTypeOfExpression(ts.factory.createIdentifier("value")),
                    ts.factory.createToken(ts.SyntaxKind.ExclamationEqualsEqualsToken), ts.factory.createStringLiteral("object")),
                ts.factory.createToken(ts.SyntaxKind.BarBarToken),
                ts.factory.createBinaryExpression(ts.factory.createIdentifier("value"),
                    ts.factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken), ts.factory.createNull())),
            ts.factory.createReturnStatement(ts.factory.createNull())), ts.factory.createReturnStatement(
                ts.factory.createBinaryExpression(ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier("__as3ConstructionTargets"), "get"), undefined,
                [ts.factory.createAsExpression(ts.factory.createIdentifier("value"),
                    ts.factory.createKeywordTypeNode(ts.SyntaxKind.ObjectKeyword))]),
                ts.factory.createToken(ts.SyntaxKind.QuestionQuestionToken), ts.factory.createNull()))], true)),
        ts.factory.createFunctionDeclaration(
            [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)], undefined, "isAS3ConstructionProof", undefined,
            [ts.factory.createParameterDeclaration(undefined, undefined, "value", undefined,
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword), undefined)],
            ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
            ts.factory.createBlock([ts.factory.createReturnStatement(ts.factory.createBinaryExpression(
                ts.factory.createIdentifier("value"), ts.factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
                ts.factory.createIdentifier("__as3ConstructionProof")))], true)),
    ];
    const embedded = embeddedBitmapDeclarations(program, imports, ts);
    const deferredInitialization = program.declaration.declarationKind === "class" ? [classInitializationNode(program, ts)] : [];
    const privateBinding = fileLocalIdentity ? [ts.factory.createExportDeclaration(undefined, false,
        ts.factory.createNamedExports([ts.factory.createExportSpecifier(false,
            ts.factory.createIdentifier(program.declaration.name), ts.factory.createIdentifier("__as3FileLocalClass"))]), undefined)] : [];
    const methodLengths = program.declaration.declarationKind !== "class" ? []
        : program.declaration.members.filter(member=>member.kind === "method").map(member=>
            ts.factory.createExpressionStatement(ts.factory.createCallExpression(
                ts.factory.createIdentifier("__as3DefineMethodLength"),undefined,[
                    member.modifiers.includes("static") ? ts.factory.createIdentifier(program.declaration.name)
                        : ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier(program.declaration.name),"prototype"),
                    ts.factory.createStringLiteral(member.name),
                    ts.factory.createNumericLiteral((member as SemanticMethod).parameters.filter(parameter=>!parameter.rest).length)])));
    const sourceFile = ts.factory.updateSourceFile(empty, imports.concat(embedded, nominalState, [declaration], methodLengths, deferredInitialization, nominalPredicate, privateBinding));
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    let code = printer.printFile(sourceFile).replace(/\r\n?/g, "\n");
    code = code.replace(/\n*$/, "\n");
    const reparsed = ts.createSourceFile(program.outputModulePath, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    if (Array.isArray(reparsed.parseDiagnostics) && reparsed.parseDiagnostics.length !== 0) {
        throw new HardenedSemanticError("HARDENED_EMIT_SYNTAX", "TypeScript printer output did not parse without diagnostics");
    }
    return {
        schema: "as3-structural-typescript-output@1",
        modulePath: program.outputModulePath,
        code,
        typeScriptVersion: ts.version,
    };
}
