import {loadSourceIncludes,readIncludeSource as read,SourceIncludeInventory} from "./source-includes-authority";
import {expandSourceIncludes,IncludeEdge} from "../hardened/source-includes";
import {inspectIncludeSyntax,hasIncludeToken} from "../hardened/source-includes-parser";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import {realpathSync,lstatSync,readFileSync} from "node:fs";
const hash=(text:string|Buffer):string=>createHash("sha256").update(text).digest("hex");
function inspectSourceIncludes(root:string,paths:string[]):SourceIncludeInventory {
    if(resolve(root)!==root || realpathSync(root)!==root || !lstatSync(root).isDirectory()) throw new Error("HARDENED_INCLUDE_ROOT: source root must be canonical");
    if(!paths.length || paths.length>10000 || new Set(paths).size!==paths.length) throw new Error("HARDENED_INCLUDE_ROOTS: invalid roots");
    const roots:SourceIncludeInventory['roots']=[], fragments=new Map<string,SourceIncludeInventory['fragments'][number]>(), edges:IncludeEdge[]=[], imports:SourceIncludeInventory['imports']=[];
    for(const path of paths.slice().sort()) {
        const source=read(root,path); roots.push({path,sha256:hash(source.bytes)});
        if(!hasIncludeToken(path,source.content)) continue;
        const expansion=expandSourceIncludes(path,source.content,target=>{
            const part=read(root,target);fragments.set(target,{path:target,sha256:hash(part.bytes),bytes:part.bytes.length});
            return {path:target,content:part.content,sha256:hash(part.content)};
        },hash,inspectIncludeSyntax);
        edges.push(...expansion.proof.edges);
        for(const part of [{path,content:source.content},...expansion.proof.fragments]) for(const qname of inspectIncludeSyntax(part.path,part.content).imports)
            imports.push({rootPath:path,ownerPath:part.path,qname});
    }
    return {schema:"as3-source-includes@1",sourceRoot:root,roots,fragments:[...fragments.values()].sort((a,b)=>a.path<b.path?-1:1),edges,imports};
}

export {inspectSourceIncludes,loadSourceIncludes};
if(require.main===module) {
    try {
        const input=process.argv[2]==="--inventory-request" ? JSON.parse(readFileSync(0,"utf8")) : {sourceRoot:process.argv[2],roots:process.argv.slice(3)};
        process.stdout.write(JSON.stringify(inspectSourceIncludes(input.sourceRoot,input.roots))+"\n");
    }
    catch(error) {process.stderr.write((error instanceof Error?error.message:String(error))+"\n");process.exitCode=1;}
}
