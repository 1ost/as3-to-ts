import { getAS3StaticReflectionDescriptor, authorityStatus, AS3StaticReflectionDescriptor } from "./internal/AS3TypeRegistry";

import { as3InitializeClass } from "./AS3ClassInitialization";

export interface AS3ReflectionXml {
    readonly variable: AS3ReflectionXmlList;
    select(name: string): AS3ReflectionXmlList;
    attribute(name: string): AS3ReflectionXmlList;
}
export interface AS3ReflectionXmlList extends Iterable<AS3ReflectionXml> {
    length(): number;
    toPropertyKey(): string;
    toString(): string;
}
export interface AS3ReflectionProvider<Metadata> {
    createFlashReflectionMetadata(bindings: readonly {constructor: Function; descriptor: AS3StaticReflectionDescriptor}[]): Metadata;
    describeTypeXml(value: unknown, metadata: Metadata): AS3ReflectionXml;
}
let describeBound: ((value: Function, descriptor: AS3StaticReflectionDescriptor) => AS3ReflectionXml) | null = null;
let installing = false;

/** Compiler's authenticated target wiring installs the shared implementation once. */
export function installAS3ReflectionProvider<Metadata>(value: AS3ReflectionProvider<Metadata>): void {
    if (!authorityStatus().sealed) throw new TypeError("AS3 reflection requires sealed type authority");
    if (describeBound || installing) throw new TypeError("AS3 reflection provider already installed");
    installing = true;
    try {
        const create = value?.createFlashReflectionMetadata;
        const describe = value?.describeTypeXml;
        if (typeof create !== "function" || typeof describe !== "function") throw new TypeError("Invalid AS3 reflection provider");
        const contexts = new WeakMap<Function, Metadata>();
        const pending = new WeakSet<Function>();
        describeBound = (constructor, descriptor) => {
            if (!contexts.has(constructor)) {
                if (pending.has(constructor)) throw new TypeError("Reentrant AS3 reflection binding");
                pending.add(constructor);
                try {
                    const bindings = Object.freeze([Object.freeze({constructor, descriptor})]);
                    contexts.set(constructor, create.call(value, bindings));
                } finally { pending.delete(constructor); }
            }
            return describe.call(value, constructor, contexts.get(constructor)!);
        };
    } finally { installing = false; }
}

export function as3DescribeTypeStatic(value: unknown): AS3ReflectionXml {
    const descriptor = getAS3StaticReflectionDescriptor(value);
    if (!describeBound) throw new TypeError("AS3 reflection requires an authenticated shared provider");
    return brandXml(describeBound(value as Function, descriptor), "type");
}


type XmlKind = "type" | "variable" | "attribute";
const XML_VALUES = new WeakMap<object, {kind:XmlKind; select:(name:string)=>AS3ReflectionXmlList; attribute:(name:string)=>AS3ReflectionXmlList}>();
const LIST_VALUES = new WeakMap<object, {kind:"variables"|"attributes"; iterate:()=>Iterator<AS3ReflectionXml>; key:()=>string}>();
function objectValue(value:unknown):value is object { return value !== null && typeof value === "object"; }
function unsupported(operation:string):never { throw new TypeError(`Unsupported authenticated static reflection operation: ${operation}`); }
function brandXml(value:AS3ReflectionXml, kind:XmlKind):AS3ReflectionXml {
    if (!objectValue(value)) return unsupported("invalid provider XML");
    if (!XML_VALUES.has(value)) {
        const select=value.select, attribute=value.attribute;
        if (typeof select !== "function" || typeof attribute !== "function") return unsupported("invalid provider XML methods");
        XML_VALUES.set(value,{kind,select:select.bind(value),attribute:attribute.bind(value)});
    } else if (XML_VALUES.get(value)!.kind !== kind) return unsupported("provider XML kind changed");
    return value;
}
function brandList(value:AS3ReflectionXmlList,kind:"variables"|"attributes"):AS3ReflectionXmlList {
    if (!objectValue(value)) return unsupported("invalid provider XMLList");
    if (!LIST_VALUES.has(value)) {
        const iterate=value[Symbol.iterator],key=value.toPropertyKey;
        if (typeof iterate !== "function" || typeof key !== "function") return unsupported("invalid provider XMLList methods");
        LIST_VALUES.set(value,{kind,iterate:iterate.bind(value),key:key.bind(value)});
    } else if (LIST_VALUES.get(value)!.kind !== kind) return unsupported("provider XMLList kind changed");
    return value;
}
/** Brands originate only at the installed provider boundary, never by structural discovery. */
export function isAS3ReflectionValue(value:unknown):boolean {
    return objectValue(value) && (XML_VALUES.has(value) || LIST_VALUES.has(value));
}
export function isAS3ReflectionList(value:unknown):boolean { return objectValue(value) && LIST_VALUES.has(value); }
export function as3ReflectionVariable(value:unknown):AS3ReflectionXmlList {
    const row=objectValue(value) ? XML_VALUES.get(value) : undefined;
    if (!row || row.kind !== "type") return unsupported("variable selection receiver");
    return brandList(row.select("variable"),"variables");
}
export function as3ReflectionAttribute(value:unknown,name:unknown):AS3ReflectionXmlList {
    const row=objectValue(value) ? XML_VALUES.get(value) : undefined;
    if (!row || row.kind !== "variable" || (name !== "name" && name !== "type")) return unsupported("attribute selection");
    return brandList(row.attribute(name),"attributes");
}
export function* as3ReflectionValues(value:unknown):Generator<AS3ReflectionXml,void,unknown> {
    const row=objectValue(value) ? LIST_VALUES.get(value) : undefined;
    if (!row || row.kind !== "variables") return unsupported("variable iteration receiver");
    const iterator=row.iterate();
    // Use the provider's bounded, immutable list without inspecting enumerable JS fields.
    for(let next=iterator.next();!next.done;next=iterator.next()) yield brandXml(next.value,"variable");
}
/** Read only a sealed public static variable; unsupported accessors never execute. */
export function as3ReflectionStaticRead(constructor:unknown,key:unknown):unknown {
    const descriptor=getAS3StaticReflectionDescriptor(constructor);
    const list=objectValue(key) ? LIST_VALUES.get(key) : undefined;
    const name=typeof key === "string" ? key : list?.kind === "attributes" ? list.key() : unsupported("static property key");
    if (typeof name !== "string" || !descriptor.staticVariables.some(variable=>variable.name === name))
        return unsupported("unproved public static variable");
    as3InitializeClass(constructor);
    const slot=Object.getOwnPropertyDescriptor(constructor,name);
    if (!slot || !Object.prototype.hasOwnProperty.call(slot,"value")) return unsupported("static variable data storage");
    return slot.value;
}
