import {
    HardenedSemanticError,
    LocalDeclarationExtract,
    LocalDeclarationMember,
    LocalDeclarationParameter,
    NormalizedParserAst,
} from "./contracts";
import { buildTree, TreeNode } from "./adapter";
import { Sha256Function } from "./ledger";

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const QNAME = /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;
const ORDINARY_MODIFIERS = new Set(["public", "private", "protected", "internal", "static", "override", "final"]);

function fail(code: string, message: string, node: TreeNode | null = null): never {
    throw new HardenedSemanticError(code, message, node?.id ?? null);
}

function one(node: TreeNode, kind: string, optional: boolean = false): TreeNode | null {
    const matches = node.children.filter(child => child.kind === kind);
    if (matches.length !== (optional ? 0 : 1) && !(optional && matches.length === 1)) {
        fail("HARDENED_LOCAL_DECLARATION_SHAPE", `${node.kind} requires ${optional ? "at most" : "exactly"} one ${kind}`, node);
    }
    return matches[0] ?? null;
}

function requiredText(node: TreeNode, label: string): string {
    if (typeof node.text !== "string" || node.text.length === 0) {
        fail("HARDENED_LOCAL_DECLARATION_TEXT", `${label} requires exact parser text`, node);
    }
    return node.text;
}

function identifier(node: TreeNode, label: string): string {
    const value = requiredText(node, label);
    if (!IDENTIFIER.test(value)) fail("HARDENED_LOCAL_DECLARATION_NAME", `${label} is not an AS3 identifier`, node);
    return value;
}

function sourceType(node: TreeNode): string {
    if (node.kind === "TYPE") {
        if (node.children.length !== 0) fail("HARDENED_LOCAL_DECLARATION_TYPE", "named type must be a leaf", node);
        if (node.text === null) return "*";
        const value = requiredText(node, "source type");
        if (value !== "*" && !QNAME.test(value)) {
            fail("HARDENED_LOCAL_DECLARATION_TYPE", "named type has unsupported spelling", node);
        }
        return value;
    }
    if (node.kind === "VECTOR") {
        if (node.children.length !== 1 || !["TYPE", "VECTOR"].includes(node.children[0]!.kind)) {
            fail("HARDENED_LOCAL_DECLARATION_TYPE", "Vector type requires one nested source type", node);
        }
        return `Vector.<${sourceType(node.children[0]!)}>`;
    }
    fail("HARDENED_LOCAL_DECLARATION_TYPE", "declaration type must be named or Vector", node);
}

function declarationType(node: TreeNode): TreeNode {
    const matches = node.children.filter(child => child.kind === "TYPE" || child.kind === "VECTOR");
    if (matches.length !== 1) fail("HARDENED_LOCAL_DECLARATION_TYPE", "declaration requires exactly one type", node);
    return matches[0]!;
}

function modifiers(node: TreeNode): { values: string[]; namespaceName: string | null } {
    const list = one(node, "MOD_LIST", true);
    if (list === null) return { values: [], namespaceName: null };
    if (list.children.some(child => child.kind !== "MODIFIER")) {
        fail("HARDENED_LOCAL_DECLARATION_MODIFIER", "modifier list contains a non-modifier", list);
    }
    const values: string[] = [];
    let namespaceName: string | null = null;
    const seen = new Set<string>();
    list.children.forEach(child => {
        const value = identifier(child, "modifier");
        if (seen.has(value)) fail("HARDENED_LOCAL_DECLARATION_MODIFIER", "modifier is duplicated", child);
        seen.add(value);
        if (ORDINARY_MODIFIERS.has(value)) values.push(value);
        else if (namespaceName === null) namespaceName = value;
        else fail("HARDENED_LOCAL_DECLARATION_MODIFIER", "member has multiple namespace modifiers", child);
    });
    return { values, namespaceName };
}

function parameters(node: TreeNode): LocalDeclarationParameter[] {
    if (node.children.some(child => child.kind !== "PARAMETER")) {
        fail("HARDENED_LOCAL_DECLARATION_PARAMETER", "parameter list contains a non-parameter", node);
    }
    const seen = new Set<string>();
    return node.children.map((parameter, index) => {
        const rest = one(parameter, "REST", true);
        if (rest !== null) {
            if (parameter.children.length !== 1 || index !== node.children.length - 1) {
                fail("HARDENED_LOCAL_DECLARATION_PARAMETER", "rest parameter must be final and structurally isolated", parameter);
            }
            const name = identifier(rest, "rest parameter");
            if (seen.has(name)) fail("HARDENED_LOCAL_DECLARATION_PARAMETER", "parameter name is duplicated", rest);
            seen.add(name);
            return { name, type: "*", optional: false, rest: true };
        }
        const declaration = one(parameter, "NAME_TYPE_INIT")!;
        const nameNode = one(declaration, "NAME")!;
        const name = identifier(nameNode, "parameter");
        if (seen.has(name)) fail("HARDENED_LOCAL_DECLARATION_PARAMETER", "parameter name is duplicated", nameNode);
        seen.add(name);
        const init = one(declaration, "INIT", true);
        if (init !== null && init.children.length !== 1) {
            fail("HARDENED_LOCAL_DECLARATION_PARAMETER", "default parameter requires one expression", init);
        }
        return { name, type: sourceType(declarationType(declaration)), optional: init !== null, rest: false };
    });
}

function callable(node: TreeNode, className: string): LocalDeclarationMember {
    const nameNode = one(node, "NAME")!;
    const name = identifier(nameNode, "member name");
    const parameterList = one(node, "PARAMETER_LIST")!;
    const memberModifiers = modifiers(node);
    const constructor = node.kind === "FUNCTION" && name === className;
    const kind = constructor ? "constructor" : node.kind === "GET" ? "getter" : node.kind === "SET" ? "setter" : "method";
    const returnType = constructor ? null : sourceType(declarationType(node));
    return {
        kind, name, modifiers: memberModifiers.values, namespaceName: memberModifiers.namespaceName,
        parameters: parameters(parameterList), returnType, fieldType: null, readonly: false,
    };
}

function fields(node: TreeNode): LocalDeclarationMember[] {
    const memberModifiers = modifiers(node);
    return node.children.filter(child => child.kind === "NAME_TYPE_INIT").map<LocalDeclarationMember>(declaration => ({
        kind: "field",
        name: identifier(one(declaration, "NAME")!, "field name"),
        modifiers: memberModifiers.values,
        namespaceName: memberModifiers.namespaceName,
        parameters: [], returnType: null,
        fieldType: sourceType(declarationType(declaration)),
        readonly: node.kind === "CONST_LIST",
    }));
}

export function extractLocalDeclaration(ast: NormalizedParserAst, sourceText: string,
    sha256: Sha256Function): LocalDeclarationExtract {
    const root = buildTree(ast, sourceText, sha256);
    if (root.kind !== "COMPILATION_UNIT") fail("HARDENED_LOCAL_DECLARATION_ROOT", "root must be a compilation unit", root);
    const packageNode = one(root, "PACKAGE")!;
    const packageNameNode = one(packageNode, "NAME", true);
    const packageName = packageNameNode === null || packageNameNode.text === null ? ""
        : requiredText(packageNameNode, "package name");
    if (packageName !== "" && !QNAME.test(packageName)) {
        fail("HARDENED_LOCAL_DECLARATION_PACKAGE", "package name is invalid", packageNameNode);
    }
    const content = one(packageNode, "CONTENT")!;
    const declarations = content.children.filter(child => child.kind === "CLASS" || child.kind === "INTERFACE");
    const packageSymbols = content.children.filter(child => child.kind === "CONST_LIST" || child.kind === "NAMESPACE");
    if ((declarations.length !== 1 || packageSymbols.length !== 0)
        && (declarations.length !== 0 || packageSymbols.length !== 1)
        || content.children.some(child => !["IMPORT", "USE", "CLASS", "INTERFACE", "CONST_LIST", "NAMESPACE"].includes(child.kind))) {
        fail("HARDENED_LOCAL_DECLARATION_CONTENT",
            "package must contain exactly one class, interface, constant declaration, or namespace declaration", content);
    }
    const declaration = declarations[0] || packageSymbols[0]!;
    let name: string;
    if (declaration.kind === "CONST_LIST") {
        const constantFields = fields(declaration);
        if (constantFields.length !== 1) {
            fail("HARDENED_LOCAL_DECLARATION_CONTENT", "package constant source requires exactly one declaration", declaration);
        }
        name = constantFields[0]!.name;
    } else if (declaration.kind === "NAMESPACE") {
        name = identifier(declaration, "namespace declaration");
    } else {
        name = identifier(one(declaration, "NAME")!, "declaration name");
    }
    const qualifiedName = packageName === "" ? name : `${packageName}.${name}`;
    const members: LocalDeclarationMember[] = [];
    if (declaration.kind === "CONST_LIST") {
        members.push(...fields(declaration));
    } else if (declaration.kind === "NAMESPACE") {
        const memberModifiers = modifiers(declaration);
        members.push({
            kind: "namespace", name, modifiers: memberModifiers.values,
            namespaceName: memberModifiers.namespaceName, parameters: [], returnType: null,
            fieldType: null, readonly: false,
        });
    } else {
        const body = one(declaration, "CONTENT")!;
        body.children.forEach(member => {
            if (member.kind === "FUNCTION" || member.kind === "GET" || member.kind === "SET") {
                members.push(callable(member, name));
            } else if (member.kind === "VAR_LIST" || member.kind === "CONST_LIST") {
                members.push(...fields(member));
            } else {
                fail("HARDENED_LOCAL_DECLARATION_MEMBER", "class member kind is not structurally admitted", member);
            }
        });
    }
    const imports = content.children.filter(child => child.kind === "IMPORT").map(child => requiredText(child, "import"));
    if (new Set(imports).size !== imports.length) fail("HARDENED_LOCAL_DECLARATION_IMPORT", "import is duplicated", content);
    let packageInitializer: LocalDeclarationExtract["packageInitializer"] = null;
    if (declaration.kind === "CONST_LIST") {
        const declarator = declaration.children.filter(child => child.kind === "NAME_TYPE_INIT")[0]!;
        const init = one(declarator, "INIT", true);
        const expression = init !== null && init.children.length === 1 ? init.children[0]! : null;
        const call = expression?.kind === "NEW" && expression.children.length === 1
            && expression.children[0]!.kind === "CALL" ? expression.children[0]! : null;
        if (!call || call.children.length !== 2 || call.children[0]!.kind !== "IDENTIFIER"
            || call.children[1]!.kind !== "ARGUMENTS" || call.children[1]!.children.length !== 0) {
            fail("HARDENED_LOCAL_PACKAGE_INITIALIZER",
                "package const initializer must be one zero-argument direct constructor", init || declarator);
        }
        packageInitializer = {
            kind: "new", typeName: requiredText(call.children[0]!, "package initializer type"), argumentCount: 0,
        };
    }
    const result: LocalDeclarationExtract = {
        schema: "as3-local-declaration-extract@1",
        sourceSha256: ast.sourceSha256,
        packageName,
        qualifiedName,
        declarationKind: declaration.kind === "CLASS" ? "class"
            : declaration.kind === "INTERFACE" ? "interface" : "package",
        imports,
        extendsNames: declarations.length === 0 ? []
            : declaration.children.filter(child => child.kind === "EXTENDS").map(child => requiredText(child, "base type")),
        implementsNames: declarations.length === 0 ? [] : declaration.children.filter(child => child.kind === "IMPLEMENTS_LIST")
            .flatMap(list => list.children.map(child => requiredText(child, "implemented type"))),
        members,
        packageInitializer,
    };
    return result;
}
