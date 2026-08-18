import {
    SemanticExpression,
    SemanticMember,
    SemanticModifier,
    SemanticProgram,
    SemanticStatement,
    SemanticType,
    HardenedSemanticError,
} from "./contracts";
import { assertAdaptedSemanticProgram } from "./adapter";

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
    };
    const policy = names[element.sourceName];
    if (policy) {
        return ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier("__as3VectorPolicies"), policy);
    }
    if (element.emittedName === "AS3Vector") {
        return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3VectorNested"), undefined,
            [vectorPolicyNode(element, ts)]);
    }
    return ts.factory.createCallExpression(ts.factory.createIdentifier("__as3VectorReference"), undefined, [
        ts.factory.createStringLiteral(element.sourceName), ts.factory.createIdentifier(element.emittedName),
    ]);
}

function runtimeTypeTokenNode(expression: Extract<SemanticExpression, { kind: "runtimeType" }>,
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

function expressionNode(expression: SemanticExpression, ts: TypeScriptCompilerApi): any {
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
        return ts.factory.createIdentifier(expression.name);
    }
    if (expression.kind === "this") {
        return ts.factory.createThis();
    }
    if (expression.kind === "super") {
        return ts.factory.createSuper();
    }
    if (expression.kind === "member") {
        const target = expressionNode(expression.target, ts);
        return ts.factory.createPropertyAccessExpression(
            expression.targetNullable ? ts.factory.createNonNullExpression(target) : target,
            expression.name,
        );
    }
    if (expression.kind === "methodClosure") {
        return ts.factory.createPropertyAccessExpression(ts.factory.createThis(), expression.methodName);
    }
    if (expression.kind === "call") {
        const callee = expressionNode(expression.callee, ts);
        return ts.factory.createCallExpression(
            expression.calleeNullable ? ts.factory.createNonNullExpression(callee) : callee, undefined,
            expression.arguments.map((argument) => expressionNode(argument, ts)));
    }
    if (expression.kind === "array") {
        return ts.factory.createArrayLiteralExpression(expression.elements.map(element => expressionNode(element, ts)), false);
    }
    if (expression.kind === "object") {
        return ts.factory.createObjectLiteralExpression(expression.properties.map(property =>
            ts.factory.createPropertyAssignment(ts.factory.createStringLiteral(property.name),
                expressionNode(property.value, ts))), false);
    }
    if (expression.kind === "index") {
        const target = expressionNode(expression.target, ts);
        const admittedTarget = expression.targetNullable ? ts.factory.createNonNullExpression(target) : target;
        if (expression.accessKind === "dictionary") {
            return ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(admittedTarget, "get"), undefined,
                [expressionNode(expression.index, ts)],
            );
        }
        return ts.factory.createElementAccessExpression(
            admittedTarget,
            expressionNode(expression.index, ts),
        );
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
    if (expression.kind === "coercion") {
        const helper: { [sourceName: string]: string } = {
            int: "__as3Int", uint: "__as3Uint", Number: "__as3Number",
            Boolean: "__as3Boolean", String: "__as3String",
        };
        const name = helper[expression.targetType.sourceName];
        if (!name) throw new HardenedSemanticError("HARDENED_EMIT_COERCION", "unknown AS3 coercion helper");
        return ts.factory.createCallExpression(ts.factory.createIdentifier(name), undefined,
            expression.argument === null ? [] : [expressionNode(expression.argument, ts)]);
    }
    if (expression.kind === "assignment") {
        if (expression.target.kind === "index" && expression.target.accessKind === "dictionary") {
            const target = expressionNode(expression.target.target, ts);
            const admittedTarget = expression.target.targetNullable
                ? ts.factory.createNonNullExpression(target) : target;
            return ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(admittedTarget, "set"), undefined,
                [expressionNode(expression.target.index, ts), expressionNode(expression.value, ts)],
            );
        }
        return ts.factory.createBinaryExpression(
            expressionNode(expression.target, ts),
            ts.factory.createToken(ts.SyntaxKind.EqualsToken),
            expressionNode(expression.value, ts),
        );
    }
    if (expression.kind === "new") {
        if (expression.sourceType.emittedName === "AS3Vector") {
            return ts.factory.createNewExpression(ts.factory.createIdentifier("__as3Vector"),
                [vectorElementTypeNode(expression.sourceType.typeArguments[0]!, ts)],
                [vectorPolicyNode(expression.sourceType, ts)].concat(
                    expression.arguments.map((argument) => expressionNode(argument, ts))));
        }
        return ts.factory.createNewExpression(
            ts.factory.createIdentifier(expression.sourceType.emittedName),
            undefined,
            expression.arguments.map((argument) => expressionNode(argument, ts)),
        );
    }
    if (expression.kind === "binary") {
        const tokens: { [operator: string]: any } = {
            "<": ts.SyntaxKind.LessThanToken,
            "<=": ts.SyntaxKind.LessThanEqualsToken,
            ">": ts.SyntaxKind.GreaterThanToken,
            ">=": ts.SyntaxKind.GreaterThanEqualsToken,
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
        return ts.factory.createBinaryExpression(
            expressionNode(expression.left, ts), ts.factory.createToken(token), expressionNode(expression.right, ts),
        );
    }
    if (expression.kind === "unary") {
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
        const token = expression.operator === "++" ? ts.SyntaxKind.PlusPlusToken : ts.SyntaxKind.MinusMinusToken;
        return expression.prefix
            ? ts.factory.createPrefixUnaryExpression(token, expressionNode(expression.target, ts))
            : ts.factory.createPostfixUnaryExpression(expressionNode(expression.target, ts), token);
    }
    if (expression.kind === "lambda") {
        return ts.factory.createFunctionExpression(undefined, undefined, undefined, undefined,
            expression.parameters.map(parameter => parameterNode(parameter, ts)),
            typeNode(expression.returnType, ts),
            ts.factory.createBlock(expression.statements.map(statement => statementNode(statement, ts)), true));
    }
    if (expression.kind === "delete") {
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
                        expressionNode(local.initializer, ts))), ts.NodeFlags.None);
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
        return ts.factory.createForOfStatement(undefined, binding,
            statement.iterableType.nullable ? ts.factory.createNonNullExpression(iterable) : iterable,
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
                ts.factory.createBlock([guard, binding].concat(
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
            local.name, undefined, typeNode(local.type, ts), expressionNode(local.initializer, ts),
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
    if (program.declaration.declarationKind === "packageField") return [];
    const names: { [name: string]: true } = Object.create(null);
    const inspectExpression = (expression: SemanticExpression): void => {
        if (expression.kind === "methodClosure") {
            names[expression.methodName] = true;
        } else if (expression.kind === "member") {
            inspectExpression(expression.target);
        } else if (expression.kind === "call") {
            inspectExpression(expression.callee);
            expression.arguments.forEach(inspectExpression);
        } else if (expression.kind === "assignment") {
            inspectExpression(expression.target);
            inspectExpression(expression.value);
        } else if (expression.kind === "new") {
            expression.arguments.forEach(inspectExpression);
        } else if (expression.kind === "array") {
            expression.elements.forEach(inspectExpression);
        } else if (expression.kind === "object") {
            expression.properties.forEach(property => inspectExpression(property.value));
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
        } else if (expression.kind === "parenthesized") {
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
        ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(method, "bind"), undefined,
            [ts.factory.createThis()]),
    ));
}

function memberNode(member: SemanticMember, ts: TypeScriptCompilerApi, boundMethods: string[]): any {
    if (member.kind === "field") {
        const modifiers = modifierTokens(member.modifiers, ts);
        if (member.readonly) modifiers.push(ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword));
        return ts.factory.createPropertyDeclaration(
            modifiers, member.name, undefined, typeNode(member.type, ts),
            member.initializer === null ? undefined : expressionNode(member.initializer, ts),
        );
    }
    if (member.kind === "constructor") {
        const original = member.body.map((statement) => statementNode(statement, ts));
        const bindings = boundMethods.map((name) => bindMethodStatement(name, ts));
        const first = member.body[0];
        const beginsWithSuper = first !== undefined && first.kind === "expression"
            && first.expression.kind === "call" && first.expression.callee.kind === "super";
        const body = beginsWithSuper ? [original[0]!].concat(bindings, original.slice(1)) : bindings.concat(original);
        return ts.factory.createConstructorDeclaration(
            modifierTokens(member.modifiers, ts),
            member.parameters.map((parameter) => parameterNode(parameter, ts)),
            ts.factory.createBlock(body, true),
        );
    }
    if (member.kind === "method") {
        return ts.factory.createMethodDeclaration(
            modifierTokens(member.modifiers, ts), undefined, member.name, undefined, undefined,
            member.parameters.map((parameter) => parameterNode(parameter, ts)), typeNode(member.returnType, ts),
            ts.factory.createBlock(member.body.map((statement) => statementNode(statement, ts)), true),
        );
    }
    if (member.kind === "getter") {
        return ts.factory.createGetAccessorDeclaration(
            modifierTokens(member.modifiers, ts), member.name, [], typeNode(member.returnType, ts),
            ts.factory.createBlock(member.body.map((statement) => statementNode(statement, ts)), true),
        );
    }
    if (member.kind === "setter") {
        return ts.factory.createSetAccessorDeclaration(
            modifierTokens(member.modifiers, ts), member.name, [parameterNode(member.parameter, ts)],
            ts.factory.createBlock(member.body.map((statement) => statementNode(statement, ts)), true),
        );
    }
    throw new HardenedSemanticError("HARDENED_EMIT_MEMBER", "semantic IR contains an unsupported member");
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
        if (expression.kind === "coercion") return expression.argument !== null && visitExpression(expression.argument);
        if (expression.kind === "array") return expression.elements.some(visitExpression);
        if (expression.kind === "object") return expression.properties.some(property => visitExpression(property.value));
        if (expression.kind === "index") return visitType(expression.resultType)
            || visitExpression(expression.target) || visitExpression(expression.index);
        if (expression.kind === "member") return visitExpression(expression.target);
        if (expression.kind === "call") return visitExpression(expression.callee) || expression.arguments.some(visitExpression);
        if (expression.kind === "assignment") return visitExpression(expression.target) || visitExpression(expression.value);
        if (expression.kind === "binary") return visitExpression(expression.left) || visitExpression(expression.right);
        if (expression.kind === "unary") return visitExpression(expression.operand);
        if (expression.kind === "parenthesized") return visitExpression(expression.expression);
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
    return programHasKind(program, "runtimeType");
}

function runtimeTypeImport(ts: TypeScriptCompilerApi): any {
    const names = [
        ["AS3Types", "__as3Types"], ["as3As", "__as3As"], ["as3Is", "__as3Is"],
        ["as3ClassType", "__as3ClassType"], ["as3InterfaceType", "__as3InterfaceType"],
        ["as3RegisterInterfaces", "__as3RegisterInterfaces"],
    ].map(([exported, local]) => ts.factory.createImportSpecifier(false,
        ts.factory.createIdentifier(exported!), ts.factory.createIdentifier(local!)));
    return ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports(names)),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3Type"), undefined);
}

function coercionRuntimeImport(ts: TypeScriptCompilerApi): any {
    const names = ["as3Boolean", "as3Int", "as3Number", "as3String", "as3Uint"].map(exported =>
        ts.factory.createImportSpecifier(false, ts.factory.createIdentifier(exported),
            ts.factory.createIdentifier(`__${exported}`)));
    return ts.factory.createImportDeclaration(undefined,
        ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports(names)),
        ts.factory.createStringLiteral("@bleach/as3-runtime/AS3Coerce"), undefined);
}

export function emitSemanticProgram(program: SemanticProgram, options: EmitterOptions): EmittedTypeScript {
    assertAdaptedSemanticProgram(program);
    const ts = options.compiler;
    if (!ts || ts.version !== options.expectedTypeScriptVersion || !ts.factory || typeof ts.createPrinter !== "function") {
        throw new HardenedSemanticError("HARDENED_TYPESCRIPT_VERSION", "structural emitter requires the exact configured modern TypeScript compiler API");
    }
    const imports = program.imports.filter((item) => !item.compileTimeNamespace).map((item) => importNode(item, ts));
    if (programUsesVector(program)) imports.push(vectorRuntimeImport(ts));
    const implementsTypes = program.declaration.declarationKind === "packageField"
        ? [] : program.declaration.implementsTypes;
    if (programUsesRuntimeType(program) || implementsTypes.length > 0) imports.push(runtimeTypeImport(ts));
    if (programHasKind(program, "coercion")) imports.push(coercionRuntimeImport(ts));
    if (program.declaration.declarationKind === "packageField") {
        const declaration = ts.factory.createVariableStatement(
            [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
            ts.factory.createVariableDeclarationList([
                ts.factory.createVariableDeclaration(program.declaration.name, undefined,
                    typeNode(program.declaration.type, ts), expressionNode(program.declaration.initializer, ts)),
            ], ts.NodeFlags.Const),
        );
        const empty = ts.createSourceFile(program.outputModulePath, "", ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
        const sourceFile = ts.factory.updateSourceFile(empty, imports.concat([declaration]));
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
    if (boundMethods.length > 0 && !program.declaration.members.some((member) => member.kind === "constructor")) {
        throw new HardenedSemanticError("HARDENED_METHOD_CLOSURE_CONSTRUCTOR",
            "AS3 method closure identity requires one explicit per-instance constructor binding point");
    }
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
            program.declaration.members.map((member) => memberNode(member, ts, boundMethods)),
        );
    const empty = ts.createSourceFile(program.outputModulePath, "", ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    const registration = program.declaration.implementsTypes.length === 0 ? [] : [
        ts.factory.createExpressionStatement(ts.factory.createCallExpression(
            ts.factory.createIdentifier("__as3RegisterInterfaces"), undefined, [
                ts.factory.createIdentifier(program.declaration.name),
                ts.factory.createArrayLiteralExpression(program.declaration.implementsTypes.map(item =>
                    ts.factory.createCallExpression(ts.factory.createIdentifier("__as3InterfaceType"), undefined,
                        [ts.factory.createStringLiteral(item.runtimeName)]))),
            ])),
    ];
    const sourceFile = ts.factory.updateSourceFile(empty, imports.concat([declaration]).concat(registration));
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
