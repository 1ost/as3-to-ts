/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// Adapted from Adobe AVMplus core/ArrayClass.cpp at
// 858d034a3bd3a54d9b70909386435cf4aec81d21. See THIRD_PARTY_NOTICES.md.
import { as3NativeNumber, as3NativeString, as3ObjectRead } from "../AS3ObjectDispatch";

export class AS3ArraySortOperationUnavailable extends Error {
    constructor(message:string) { super(message); this.name="AS3ArraySortOperationUnavailable"; }
}
function unavailable(message:string):never { throw new AS3ArraySortOperationUnavailable(message); }

/** Single public numeric field, with native snapshot, comparison and tie order. */
export function as3ArraySortOnNumeric(array:unknown[], name:unknown, options:unknown):unknown[] {
    if (typeof name !== "string" || options !== 16 && options !== 18)
        return unavailable("Array.sortOn requires one String field and NUMERIC with optional DESCENDING");
    if (Object.getPrototypeOf(array) !== Array.prototype || Reflect.has(array,"sortOn"))
        return unavailable("Array.sortOn overrides and subclasses require native dispatch evidence");
    const length=array.length;
    if (length>=0x10000000) return unavailable("Oversized Array.sortOn requires retained target-runtime evidence");
    if (length===0) return array;
    const order:number[]=new Array(length), fields:unknown[]=new Array(length), items:unknown[]=new Array(length);
    let present=length, defined=length;
    // AIR reads each original slot and its public field from the end first.
    for (let i=length-1;i>=0;i--) {
        order[i]=i;
        const key=String(i), descriptor=Object.getOwnPropertyDescriptor(array,key);
        if (Object.prototype.hasOwnProperty.call(Array.prototype,key)
            || Object.prototype.hasOwnProperty.call(Object.prototype,key)
            || descriptor && (!("value" in descriptor) || !descriptor.enumerable))
            return unavailable("Array.sortOn inherited, hidden and accessor indices require native evidence");
        const item=descriptor?.value; items[i]=item;
        if (item!==null && (typeof item==="object" || typeof item==="function")) {
            fields[i]=as3ObjectRead(item,name);
        } else {
            defined--;
            const prior=order[i]!;order[i]=order[defined]!;
            if (!descriptor) {present--;order[defined]=order[present]!;order[present]=prior;}
            else order[defined]=prior;
        }
    }
    const compare=(left:number,right:number):number=>{
        // Descending swaps operands before conversion; negating afterward would
        // observe user valueOf hooks in the wrong order.
        if (options===18) {const prior=left;left=right;right=prior;}
        const x=as3NativeNumber(fields[order[left]!]!), y=as3NativeNumber(fields[order[right]!]!);
        const difference=x-y;
        return !Number.isNaN(difference) ? difference<0 ? -1 : difference>0 ? 1 : 0
            : !Number.isNaN(y) ? 1 : !Number.isNaN(x) ? -1 : 0;
    };
    sortIndices(order,defined,compare);
    // No writes occur until every getter and comparison has completed.
    for(let i=0;i<present;i++) {
        const key=String(i),descriptor=Object.getOwnPropertyDescriptor(array,key);
        if (Object.prototype.hasOwnProperty.call(Array.prototype,key)
            || Object.prototype.hasOwnProperty.call(Object.prototype,key)
            || descriptor && (!("value" in descriptor) || !descriptor.writable)
            || !Object.getOwnPropertyDescriptor(array,"length")?.writable)
            return unavailable("Array.sortOn requires ordinary writable indices");
        if (!Reflect.set(array,key,items[order[i]!])) return unavailable("Array.sortOn write rejected by host storage");
    }
    for(let i=present;i<length;i++) if(!Reflect.deleteProperty(array,String(i)))
        return unavailable("Array.sortOn hole deletion rejected by host storage");
    return array;
}

/** The retained AVMplus partition order also controls coercion and equal-key order. */
function sortIndices(order:number[], defined:number, compare:(left:number,right:number)=>number):void {
    const swap=(left:number,right:number):void=>{const prior=order[left]!;order[left]=order[right]!;order[right]=prior;};
    const pending:Array<[number,number]>=[];
    if (defined>1) pending.push([0,defined-1]);
    while(pending.length) {
        let [lo,hi]=pending.pop()!;
        for (;;) {
            const size=hi-lo+1;
            if(size<4) {
                if(size===3) {
                    if(compare(lo,lo+1)>0) {
                        swap(lo,lo+1);
                        if(compare(lo+1,lo+2)>0) {swap(lo+1,lo+2);if(compare(lo,lo+1)>0) swap(lo,lo+1);}
                    } else if(compare(lo+1,lo+2)>0) {swap(lo+1,lo+2);if(compare(lo,lo+1)>0) swap(lo,lo+1);}
                } else if(size===2 && compare(lo,lo+1)>0) swap(lo,lo+1);
                break;
            }
            swap(lo+Math.floor(size/2),lo);
            let left=lo,right=hi+1;
            for (;;) {
                do {left++;} while(left<=hi && compare(left,lo)<=0);
                do {right--;} while(right>lo && compare(right,lo)>=0);
                if(right<left) break;
                swap(left,right);
            }
            swap(lo,right);
            if (((right-1-lo)>>>0)>=((hi-left)>>>0)) {
                if(lo+1<right) pending.push([lo,right-1]);
                if(left<hi) {lo=left;continue;}
            } else {
                if(left<hi) pending.push([left,hi]);
                if(lo+1<right) {hi=right-1;continue;}
            }
            break;
        }
    }
}

/** Array.NUMERIC validates every slot before its native comparison pass. */
export function as3ArraySortNumeric(array:unknown[], options:unknown):unknown[] {
    if (options !== 16 && options !== 18)
        return unavailable("Array.sort requires NUMERIC with optional DESCENDING");
    if (Object.getPrototypeOf(array) !== Array.prototype || Reflect.get(array,"sort") !== Array.prototype.sort)
        return unavailable("Array.sort overrides and subclasses require native dispatch evidence");
    const length=array.length;
    if (length>=0x10000000) return unavailable("Oversized Array.sort requires retained target-runtime evidence");
    const order:number[]=new Array(length),items:unknown[]=new Array(length);
    for(let i=length-1;i>=0;i--) {
        const key=String(i),descriptor=Object.getOwnPropertyDescriptor(array,key);
        if (Object.prototype.hasOwnProperty.call(Array.prototype,key)
            || Object.prototype.hasOwnProperty.call(Object.prototype,key)
            || descriptor && (!("value" in descriptor) || !descriptor.enumerable))
            return unavailable("Array.sort inherited, hidden and accessor indices require native evidence");
        const item=descriptor?.value;items[i]=item;order[i]=i;
        if (typeof item!=="number" && Number.isNaN(as3NativeNumber(item))) {
            const label=typeof item==="string" ? `"${item.replace(/\0/g,"")}"`
                : item!==null && (typeof item==="object" || typeof item==="function") ? "value" : as3NativeString(item);
            const error=new TypeError(`Error #1034: Type Coercion failed: cannot convert ${label} to Number.`);
            Object.defineProperty(error,"errorID",{value:1034});throw error;
        }
    }
    const compare=(left:number,right:number):number=>{
        if(options===18) {const prior=left;left=right;right=prior;}
        const x=as3NativeNumber(items[order[left]!]!),y=as3NativeNumber(items[order[right]!]!);
        const difference=x-y;
        return !Number.isNaN(difference) ? difference<0 ? -1 : difference>0 ? 1 : 0
            : !Number.isNaN(y) ? 1 : !Number.isNaN(x) ? -1 : 0;
    };
    sortIndices(order,length,compare);
    for(let i=0;i<length;i++) {
        const key=String(i),descriptor=Object.getOwnPropertyDescriptor(array,key);
        if (Object.prototype.hasOwnProperty.call(Array.prototype,key)
            || Object.prototype.hasOwnProperty.call(Object.prototype,key)
            || descriptor && (!("value" in descriptor) || !descriptor.writable)
            || !Object.getOwnPropertyDescriptor(array,"length")?.writable)
            return unavailable("Array.sort requires ordinary writable indices");
        if(!Reflect.set(array,key,items[order[i]!])) return unavailable("Array.sort write rejected by host storage");
    }
    return array;
}
