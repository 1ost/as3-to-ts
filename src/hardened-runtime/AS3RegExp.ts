import {as3NativeString} from "./AS3ObjectDispatch";
import {lowerAS3RegExpLiteral} from "./internal/AS3RegExpPattern";

export function as3RegExpTest(literal:string,value:unknown):boolean {
    const pattern=new RegExp(lowerAS3RegExpLiteral(literal));
    return pattern.test(as3NativeString(value));
}

/** Resolve the String receiver before evaluating replacement arguments. */
export function as3RegExpReplaceReceiver(value:unknown):(literal:string,replacement:unknown)=>string {
    if(value===null || value===undefined) {
        const id=value===null?1009:1010;
        const error=new TypeError(`Error #${id}: ${id===1009?"Cannot access a property or method of a null object reference.":"A term is undefined and has no properties."}`);
        Object.defineProperty(error,"errorID",{value:id});throw error;
    }
    if(typeof value!=="string") throw new Error("native RegExp replacement requires a String receiver");
    return (literal,replacement)=>{
        const pattern=new RegExp(lowerAS3RegExpLiteral(literal));
        if(typeof replacement==="function") throw new Error("native RegExp callable replacement is unavailable");
        return value.replace(pattern,as3NativeString(replacement));
    };
}
