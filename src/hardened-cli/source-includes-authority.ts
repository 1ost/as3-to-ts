import {spawnSync} from "node:child_process";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {readFileSync,lstatSync,realpathSync} from "node:fs";
import {resolve,sep} from "node:path";
import {includePath,IncludeSource,IncludeEdge} from "../hardened/source-includes";
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item && typeof item==="object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])) : item);
const hash=(text:string|Buffer):string=>createHash("sha256").update(text).digest("hex");
export interface SourceIncludeInventory {
    schema:"as3-source-includes@1"; sourceRoot:string;
    roots:Array<{path:string;sha256:string}>;
    fragments:Array<{path:string;sha256:string;bytes:number}>;
    edges:IncludeEdge[];
    imports:Array<{rootPath:string;ownerPath:string;qname:string}>;
}
export function readIncludeSource(root:string,path:string):{bytes:Buffer;content:string} {
    const file=resolve(root,path);
    if(path.split("/").some(part=>!part || part==="." || part==="..") || path.includes("\\") || !file.startsWith(root+sep) || realpathSync(file)!==file) throw new Error("HARDENED_INCLUDE_PATH: unsafe source file");
    const stat=lstatSync(file,{bigint:true});
    if(!stat.isFile() || stat.isSymbolicLink() || stat.size>8n*1024n*1024n) throw new Error("HARDENED_INCLUDE_FILE: invalid source file");
    const bytes=readFileSync(file), after=lstatSync(file,{bigint:true});
    if(stat.ino!==after.ino || stat.dev!==after.dev || stat.mtimeNs!==after.mtimeNs || stat.size!==after.size || BigInt(bytes.length)!==stat.size) throw new Error("HARDENED_INCLUDE_DRIFT: source changed during read");
    return {bytes,content:new TextDecoder("utf-8",{fatal:true}).decode(bytes).replace(/\r\n?/g,"\n")};
}
export function loadSourceIncludes(json:string):{inventory:SourceIncludeInventory; fragments:IncludeSource[]} {
    const document=JSON.parse(json) as SourceIncludeInventory;
    if(!document || document.schema!=="as3-source-includes@1" || !Array.isArray(document.roots)) throw new Error("HARDENED_INCLUDE_PROOF: invalid inventory");
    const helper=join(__dirname,"source-includes.js"),before=hash(readFileSync(helper));
    const inspected=spawnSync(process.execPath,["--max-old-space-size=512",helper,"--inventory-request"],{
        input:JSON.stringify({sourceRoot:document.sourceRoot,roots:document.roots.map(item=>item.path)}),encoding:"utf8",timeout:120000,maxBuffer:64*1024*1024});
    if(inspected.status!==0 || inspected.stderr || before!==hash(readFileSync(helper))) throw new Error("HARDENED_INCLUDE_PROOF: inventory inspector failed: "+inspected.stderr);
    let recomputed:unknown;
    try{recomputed=JSON.parse(inspected.stdout);}catch{throw new Error("HARDENED_INCLUDE_PROOF: invalid inspector response");}
    if(canonical(recomputed)!==canonical(document)) throw new Error("HARDENED_INCLUDE_PROOF: retained inventory is not the exact source include closure");
    const actual=document;
    if(resolve(actual.sourceRoot)!==actual.sourceRoot || realpathSync(actual.sourceRoot)!==actual.sourceRoot || !Array.isArray(actual.fragments) || !Array.isArray(actual.edges) || !Array.isArray(actual.imports)) throw new Error("HARDENED_INCLUDE_PROOF: invalid inventory structure");
    const paths=new Set<string>();
    for(const item of [...actual.roots,...actual.fragments]) {
        if(!item || typeof item.path!=="string" || !/^[0-9a-f]{64}$/.test(item.sha256)) throw new Error("HARDENED_INCLUDE_PROOF: malformed file record");
        const bytes=readIncludeSource(actual.sourceRoot,item.path).bytes;
        if(hash(bytes)!==item.sha256 || ("bytes" in item && item.bytes!==bytes.length)) throw new Error("HARDENED_INCLUDE_PROOF: stale file hash");
        paths.add(item.path);
    }
    if(new Set(actual.roots.map(item=>item.path)).size!==actual.roots.length || new Set(actual.fragments.map(item=>item.path)).size!==actual.fragments.length) throw new Error("HARDENED_INCLUDE_PROOF: duplicate source");
    for(const edge of actual.edges) {
        if(!paths.has(edge.ownerPath)||!paths.has(edge.targetPath) || includePath(edge.ownerPath,edge.specifier)!==edge.targetPath) throw new Error("HARDENED_INCLUDE_PROOF: invalid edge source");
        const source=readIncludeSource(actual.sourceRoot,edge.ownerPath).content;
        const spelling=source.slice(edge.directiveStart,edge.directiveEnd);
        const literal=spelling.match(/^(?:include|#include)\s+(["'])([^"'\\\r\n]*)\1$/);
        if(!Number.isSafeInteger(edge.directiveStart)||!Number.isSafeInteger(edge.directiveEnd)||edge.directiveStart<0||edge.directiveEnd<=edge.directiveStart||!literal || literal[2]!==edge.specifier || hash(readIncludeSource(actual.sourceRoot,edge.targetPath).content)!==edge.targetSha256)
            throw new Error("HARDENED_INCLUDE_PROOF: invalid directive provenance");
    }
    return {inventory:actual,fragments:actual.fragments.map(item=>{const source=readIncludeSource(actual.sourceRoot,item.path);return {path:item.path,content:source.content,sha256:hash(source.content)};})};
}
