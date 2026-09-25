import type { Sha256Function } from "./ledger";
export interface IncludeSource { path: string; content: string; sha256: string; }
export interface IncludeEdge { ownerPath: string; directiveStart: number; directiveEnd: number; specifier: string; targetPath: string; targetSha256: string; }
export interface IncludeSegment { expandedStart:number; expandedEnd:number; sourcePath:string; sourceStart:number; sourceEnd:number; }
export interface IncludeExpansion { offsetUnit:"utf16-code-units"; sourceTextBasis:"decoded-utf8-lf"; segments:IncludeSegment[]; sourcePath: string; fragments: IncludeSource[]; edges: IncludeEdge[]; expandedSha256: string; }
export function includePath(owner: string, specifier: string): string {
    if (!owner || owner.startsWith("/") || owner.includes("\\") || !specifier || specifier.startsWith("/") || specifier.includes("\\") || specifier.includes(":")) throw new Error("HARDENED_INCLUDE_PATH: invalid relative include path");
    const parts = owner.split("/"); parts.pop();
    for (const part of specifier.split("/")) {
        if (!part || part === ".") continue;
        if (part === "..") { if (!parts.length) throw new Error("HARDENED_INCLUDE_PATH: include escapes source root"); parts.pop(); }
        else parts.push(part);
    }
    const result=parts.join("/");
    if (!result.endsWith(".as")) throw new Error("HARDENED_INCLUDE_PATH: include must reference AS3 source");
    return result;
}
export function expandSourceIncludes(path:string,content:string,resolve:(path:string)=>IncludeSource,sha256:Sha256Function, inspect:(path:string,text:string)=>{directives:Array<{start:number;end:number;specifier:string}>}): {content:string; proof:IncludeExpansion} {
    const fragments=new Map<string,IncludeSource>(), edges:IncludeEdge[]=[];
    let bytes=content.length;
    let output="";
    const segments:IncludeSegment[]=[];
    function append(owner:string,text:string,start:number,end:number):void {
        if(end===start)return;
        segments.push({expandedStart:output.length,expandedEnd:output.length+end-start,sourcePath:owner,sourceStart:start,sourceEnd:end});
        output+=text.slice(start,end);
    }
    function expand(owner:string,text:string,stack:string[]):void {
        if(stack.length>32) throw new Error("HARDENED_INCLUDE_BUDGET: include depth exceeds 32");
        const syntax=inspect(owner,text); let cursor=0;
        for(const directive of syntax.directives) {
            if(directive.start<cursor) throw new Error("HARDENED_INCLUDE_OVERLAP: overlapping directives");
            const target=includePath(owner,directive.specifier);
            if(stack.includes(target)) throw new Error("HARDENED_INCLUDE_CYCLE: cyclic source include");
            const source=resolve(target);
            if(source.path!==target || !/^[0-9a-f]{64}$/.test(source.sha256) || sha256(source.content)!==source.sha256) throw new Error("HARDENED_INCLUDE_HASH: included source does not match authenticated bytes");
            const previous=fragments.get(target);
            if(previous && previous.sha256!==source.sha256) throw new Error("HARDENED_INCLUDE_HASH: included source changed");
            fragments.set(target,source); bytes+=source.content.length;
            if(bytes>16*1024*1024 || edges.length>=1024) throw new Error("HARDENED_INCLUDE_BUDGET: expanded source exceeds limits");
            edges.push({ownerPath:owner,directiveStart:directive.start,directiveEnd:directive.end,specifier:directive.specifier,targetPath:target,targetSha256:source.sha256});
            append(owner,text,cursor,directive.start);
            output+="\n";
            expand(target,source.content,stack.concat(target));
            output+="\n";
            cursor=directive.end;
        }
        append(owner,text,cursor,text.length);
    }
    expand(path,content,[path]);
    const expanded=output;
    return {content:expanded,proof:{offsetUnit:"utf16-code-units",sourceTextBasis:"decoded-utf8-lf",segments,sourcePath:path,fragments:[...fragments.values()].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0),edges,expandedSha256:sha256(expanded)}};
}
export function verifyIncludeExpansion(proof:IncludeExpansion,root:string,sha256:Sha256Function):string {
    if(!proof || !Array.isArray(proof.fragments)) throw new Error("HARDENED_INCLUDE_PROOF: missing include evidence");
    const sources=new Map(proof.fragments.map(source=>[source.path,source]));
    if(sources.size!==proof.fragments.length) throw new Error("HARDENED_INCLUDE_PROOF: duplicate fragment");
    const result=expandSourceIncludes(proof.sourcePath,root.replace(/\r\n?/g,"\n"),path=>{const source=sources.get(path);if(!source)throw new Error("HARDENED_INCLUDE_MISSING: missing fragment "+path);return source;},sha256,(owner,text)=>({directives:proof.edges.filter(edge=>edge.ownerPath===owner).filter((edge,index,all)=>all.findIndex(other=>other.directiveStart===edge.directiveStart)===index).map(edge=>{
        const spelling=text.slice(edge.directiveStart,edge.directiveEnd);
        const literal=spelling.match(/^(?:include|#include)\s+(["'])([^"'\\\r\n]*)\1$/);
        if(!literal || literal[2]!==edge.specifier) throw new Error("HARDENED_INCLUDE_PROOF: directive spelling differs");
        return {start:edge.directiveStart,end:edge.directiveEnd,specifier:edge.specifier};
    })}));
    if(JSON.stringify(result.proof)!==JSON.stringify(proof)) throw new Error("HARDENED_INCLUDE_PROOF: include provenance differs");
    return result.content;
}
/** One expanded span can cross root and fragment text; callers must retain every segment. */
export function includedSourceOrigins(proof:IncludeExpansion,start:number,end:number):Array<{path:string;start:number;end:number;offsetUnit:"utf16-code-units";sourceTextBasis:"decoded-utf8-lf"}> {
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start) throw new Error("HARDENED_INCLUDE_SPAN: invalid span");
    return proof.segments.filter(segment=>segment.expandedStart<end && segment.expandedEnd>start).map(segment=>({
        path:segment.sourcePath,start:segment.sourceStart+Math.max(start,segment.expandedStart)-segment.expandedStart,
        end:segment.sourceStart+Math.min(end,segment.expandedEnd)-segment.expandedStart,
        offsetUnit:"utf16-code-units",sourceTextBasis:"decoded-utf8-lf",
    }));
}
