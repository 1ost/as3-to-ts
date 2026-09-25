import { SemanticExpression, SemanticField } from "./contracts";
import { as3Add, as3Equals, as3Int, as3Uint, as3Number, as3String } from "../hardened-runtime/AS3Coerce";

type Scalar = string | number | boolean | null | undefined;
export type StaticConstant = { value: Scalar } | null;

/** ASC stores constant expressions in trait defaults, before any cinit statements.
 * Calls, allocations, variable reads and conditional expressions remain executable.
 */
export function staticConstant(expression: SemanticExpression, fields: readonly SemanticField[],
    active: ReadonlySet<string> = new Set()): StaticConstant {
    const fold = (value: SemanticExpression) => staticConstant(value, fields, active);
    if (expression.kind === "literal" || expression.kind === "intrinsicConstant") return {value:expression.value};
    if (expression.kind === "undefined") return {value:undefined};
    if (expression.kind === "parenthesized") return fold(expression.expression);
    if (expression.kind === "member" && expression.target.kind === "identifier"
        && expression.target.bindingKind === "current-class") {
        const field = fields.find(field => field.name === expression.name && field.readonly);
        if (!field?.initializer || active.has(field.name)) return null;
        return staticConstant(field.initializer, fields, new Set([...active,field.name]));
    }
    if (expression.kind === "coercion" && expression.argument && !expression.reference && !expression.objectCall) {
        const argument = fold(expression.argument);
        if (!argument) return null;
        const value=argument.value;
        switch (expression.targetType.sourceName) {
            case "int": return {value:as3Int(value)};
            case "uint": return {value:as3Uint(value)};
            case "Number": return {value:as3Number(value)};
            case "Boolean": return {value:Boolean(value)};
            case "String": return {value:expression.slot && value == null ? null : as3String(value)};
        }
        return null;
    }
    if (expression.kind === "unary") {
        const argument=fold(expression.operand);
        if (!argument) return null;
        switch (expression.operator) {
            case "+": return {value:as3Number(argument.value)};
            case "-": return {value:-as3Number(argument.value)};
            case "~": return {value:~as3Int(argument.value)};
            case "!": return {value:!argument.value};
        }
        return null;
    }
    if (expression.kind === "binary" && !["&&","||"].includes(expression.operator)) {
        const left=fold(expression.left),right=fold(expression.right);
        if (!left || !right) return null;
        const a=left.value,b=right.value;
        switch (expression.operator) {
            case "+": return {value:as3Add(a,b)};
            case "-": return {value:as3Number(a)-as3Number(b)};
            case "*": return {value:as3Number(a)*as3Number(b)};
            case "/": return {value:as3Number(a)/as3Number(b)};
            case "%": return {value:as3Number(a)%as3Number(b)};
            case "&": return {value:as3Int(a)&as3Int(b)};
            case "|": return {value:as3Int(a)|as3Int(b)};
            case "^": return {value:as3Int(a)^as3Int(b)};
            case "<<": return {value:as3Int(a)<<as3Uint(b)};
            case ">>": return {value:as3Int(a)>>as3Uint(b)};
            case ">>>": return {value:as3Uint(a)>>>as3Uint(b)};
            case "==": return {value:as3Equals(a,b)};
            case "!=": return {value:!as3Equals(a,b)};
            case "===": return {value:a===b};
            case "!==": return {value:a!==b};
            case "<": return {value:typeof a === "string" && typeof b === "string" ? a<b : as3Number(a)<as3Number(b)};
            case "<=": return {value:typeof a === "string" && typeof b === "string" ? a<=b : as3Number(a)<=as3Number(b)};
            case ">": return {value:typeof a === "string" && typeof b === "string" ? a>b : as3Number(a)>as3Number(b)};
            case ">=": return {value:typeof a === "string" && typeof b === "string" ? a>=b : as3Number(a)>=as3Number(b)};
        }
    }
    return null;
}
