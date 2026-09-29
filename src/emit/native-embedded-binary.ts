import Node from '../syntax/node';
import K from '../syntax/nodeKind';

export interface NativeEmbeddedBinaryInput {
    readonly source: string;
    readonly symbol: string;
    readonly className: string;
    readonly sourceSha256: string;
    readonly definitionSha256: string;
    readonly payload: ReadonlyArray<number>;
}
export interface NativeEmbeddedBinaryBinding extends NativeEmbeddedBinaryInput {
    readonly owner: string;
    readonly field: string;
    readonly start: number;
    readonly end: number;
    readonly getterExport: string;
}
function fail(reason:string):never {throw new Error('AS3_EMBEDDED_BINARY_UNSUPPORTED: '+reason);}
/** Authenticates a complete private static Embed field, including exact payload
 * bytes. Original generated Class names and symbol provenance are supplied by
 * the pinned SWF/asset extraction, never invented from the source field name. */
export function planNativeEmbeddedBinary(owner:string,cls:Node,records:{[field:string]:NativeEmbeddedBinaryInput}|undefined):NativeEmbeddedBinaryBinding[] {
    if(records!==undefined&&(!records||typeof records!=='object'||Array.isArray(records)))fail('field table required');
    const result:NativeEmbeddedBinaryBinding[]=[];
    for(const member of cls.findChild(K.CONTENT).children) {
        const metadata=member.findChild(K.META_LIST),embeds=metadata&&metadata.children.filter(n=>/^\[\s*Embed\b/.test(n.text||''));
        if(!embeds||!embeds.length)continue;
        const fields=member.findChildren(K.NAME_TYPE_INIT),mods=member.findChild(K.MOD_LIST);
        if(member.kind!==K.CONST_LIST||fields.length!==1||embeds.length!==1||!mods
            ||mods.children.length!==2||!mods.children.some(n=>n.text==='private')||!mods.children.some(n=>n.text==='static'))fail('one private static constant per Embed required');
        const field=fields[0],name=field.findChild(K.NAME).text,type=field.findChild(K.TYPE);
        if(!type||type.text!=='Class'||field.findChild(K.INIT))fail('uninitialized Class Embed field required');
        const input=records&&records[name];
        if(!input||typeof input!=='object'||Array.isArray(input))fail('authenticated binary field required: '+owner+'.'+name);
        const keys=['source','symbol','className','sourceSha256','definitionSha256','payload'];
        if(Object.keys(input).length!==keys.length||Object.keys(input).some(k=>keys.indexOf(k)<0))fail('exact binary binding fields required');
        for(const key of (['source','symbol','className'] as Array<keyof NativeEmbeddedBinaryInput>))if(typeof input[key]!=='string'||!input[key]||/[\x00\r\n]/.test(input[key] as string))fail('binary identity required');
        for(const key of (['sourceSha256','definitionSha256'] as Array<keyof NativeEmbeddedBinaryInput>))if(typeof input[key]!=='string'||! /^[a-f0-9]{64}$/.test(input[key] as string))fail('pinned binary hashes required');
        if(!Array.isArray(input.payload)||Object.keys(input.payload).length!==input.payload.length
            ||!input.payload.every(b=>Number.isInteger(b)&&b>=0&&b<=255))fail('dense byte payload required');
        const digest=require('crypto').createHash('sha256').update(require('buffer').Buffer.from(input.payload)).digest('hex');
        if(digest!==input.sourceSha256)fail('binary payload differs from pinned hash');
        const envelope=/^\[\s*Embed\s*\(([\s\S]*)\)\s*\]$/.exec(embeds[0].text);
        if(!envelope)fail('binary Embed metadata required');
        let rest=envelope[1];const attributes:{[name:string]:string}=Object.create(null);
        while(rest.trim()){
            const item=/^\s*(source|mimeType)\s*=\s*(?:"([^"\\\r\n]*)"|'([^'\\\r\n]*)')\s*(,|$)/.exec(rest);
            if(!item||Object.prototype.hasOwnProperty.call(attributes,item[1]))fail('literal binary Embed attributes required');
            attributes[item[1]]=item[2]===undefined?item[3]:item[2];rest=rest.slice(item[0].length);
            if(item[4]===','&&!rest.trim())fail('trailing Embed separator');
        }
        if(Object.keys(attributes).length!==2||attributes.source!==input.source||attributes.mimeType!=='application/octet-stream')fail('binding differs from binary Embed metadata');
        result.push(Object.freeze({...input,owner,field:name,start:field.start,end:field.end,getterExport:''}));
    }
    if(records&&Object.keys(records).some(name=>!result.some(b=>b.field===name)))fail('binding without exact Embed field');
    return result;
}
