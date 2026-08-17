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
        throw new HardenedSemanticError("HARDENED_EMIT_MODIFIER", "semantic IR contains an unsupported modifier");
    });
}

function typeNode(type: SemanticType, ts: TypeScriptCompilerApi): any {
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
    return ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(type.emittedName), undefined);
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
        return ts.factory.createPropertyAccessExpression(expressionNode(expression.target, ts), expression.name);
    }
    if (expression.kind === "methodClosure") {
        return ts.factory.createPropertyAccessExpression(ts.factory.createThis(), expression.methodName);
    }
    if (expression.kind === "call") {
        return ts.factory.createCallExpression(expressionNode(expression.callee, ts), undefined,
            expression.arguments.map((argument) => expressionNode(argument, ts)));
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
    throw new HardenedSemanticError("HARDENED_EMIT_STATEMENT", "semantic IR contains an unsupported statement");
}

function parameterNode(parameter: any, ts: TypeScriptCompilerApi): any {
    return ts.factory.createParameterDeclaration(undefined, undefined, parameter.name, undefined, typeNode(parameter.type, ts), undefined);
}

function boundMethodNames(program: SemanticProgram): string[] {
    const names: { [name: string]: true } = Object.create(null);
    const inspectExpression = (expression: SemanticExpression): void => {
        if (expression.kind === "methodClosure") {
            names[expression.methodName] = true;
        } else if (expression.kind === "member") {
            inspectExpression(expression.target);
        } else if (expression.kind === "call") {
            inspectExpression(expression.callee);
            expression.arguments.forEach(inspectExpression);
        }
    };
    program.declaration.members.forEach((member) => {
        if (member.kind === "field" && member.initializer !== null) {
            inspectExpression(member.initializer);
        } else if (member.kind === "constructor" || member.kind === "method") {
            member.body.forEach((statement) => {
                if (statement.kind === "expression") {
                    inspectExpression(statement.expression);
                } else if (statement.expression !== null) {
                    inspectExpression(statement.expression);
                }
            });
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

export function emitSemanticProgram(program: SemanticProgram, options: EmitterOptions): EmittedTypeScript {
    assertAdaptedSemanticProgram(program);
    const ts = options.compiler;
    if (!ts || ts.version !== options.expectedTypeScriptVersion || !ts.factory || typeof ts.createPrinter !== "function") {
        throw new HardenedSemanticError("HARDENED_TYPESCRIPT_VERSION", "structural emitter requires the exact configured modern TypeScript compiler API");
    }
    const imports = program.imports.map((item) => importNode(item, ts));
    const boundMethods = boundMethodNames(program);
    if (boundMethods.length > 0 && !program.declaration.members.some((member) => member.kind === "constructor")) {
        throw new HardenedSemanticError("HARDENED_METHOD_CLOSURE_CONSTRUCTOR",
            "AS3 method closure identity requires one explicit per-instance constructor binding point");
    }
    const classModifiers = program.declaration.modifiers.indexOf("public") >= 0
        ? [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)] : [];
    const heritage = program.declaration.extendsType === null ? undefined : [
        ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
            ts.factory.createExpressionWithTypeArguments(
                ts.factory.createIdentifier(program.declaration.extendsType.emittedName), undefined,
            ),
        ]),
    ];
    const declaration = ts.factory.createClassDeclaration(
        classModifiers,
        program.declaration.name,
        undefined,
        heritage,
        program.declaration.members.map((member) => memberNode(member, ts, boundMethods)),
    );
    const empty = ts.createSourceFile(program.outputModulePath, "", ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    const sourceFile = ts.factory.updateSourceFile(empty, imports.concat([declaration]));
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
