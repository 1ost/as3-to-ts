import { as3ArrayValues } from "./AS3Array";
import { as3DictionaryValues, isAS3Dictionary } from "./AS3Dictionary";
import { as3FunctionArgument } from "./AS3Function";
import { as3ObjectEnumerableValues, AS3ObjectDispatchUnavailable } from "./AS3ObjectDispatch";
import { isAS3Vector } from "./AS3Vector";

/** Dispatch an original dynamically typed for-each receiver once, preserving typed local assignment. */
export function* as3DynamicValues(value:unknown, bindingType:string):Generator<any,void,unknown> {
    if (value == null || ["string","number","boolean"].includes(typeof value)) return;
    if (Array.isArray(value)) { yield* as3ArrayValues(value,bindingType); return; }
    if (isAS3Dictionary(value)) { yield* as3DictionaryValues(value,bindingType); return; }
    if (isAS3Vector(value)) {
        for (const item of value) yield as3FunctionArgument(item,bindingType);
        return;
    }
    if (typeof value !== "object")
        throw new AS3ObjectDispatchUnavailable("Dynamic enumeration of Function, Class or host-only primitives requires native evidence");
    for (const item of as3ObjectEnumerableValues(value)) yield as3FunctionArgument(item,bindingType);
}
