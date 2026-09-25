import AS3Scanner from "../parse/scanner";
import { EOF } from "../syntax/keywords";
import parse from "../parse/index";
import {nodeKindName} from "../syntax/nodeKind";

/** Inspect directives only. Unsupported surrounding AS3 expressions remain the qualifier's responsibility. */
export function inspectIncludeSyntax(path:string,content:string):{directives:Array<{start:number;end:number;specifier:string}>;imports:string[]} {
    const scanner=new AS3Scanner();scanner.setContent(content,path);
    const tokens:Array<{text:string;index:number;end:number}>=[];
    let previous="", beforePrevious="", expressionStart=true;
    const parentheses:Array<"control"|"expression"|"function-expression"|"function-declaration">=[];
    let pendingFunction: "function-expression"|"function-declaration"|null=null;
    let pendingFunctionBody: "function-expression"|"function-declaration"|null=null;
    const braces:Array<"block"|"expression">=[];
    const controlKeywords=new Set(["if","while","for","with","switch","catch"]);
    const prefixKeywords=new Set(["return","throw","case","delete","typeof","void","new","in","instanceof","else","do"]);
    const prefixOperators=new Set(["=","+=","-=","*=","/=","%=","&=","|=","^=","==","===","!=","!==","<",">","<=",">=","<<",">>",">>>","+","-","*","/","%","&","|","^","&&","||","!","~","?",":",",",";","["]);

    for(let count=0;count<=content.length+1;count++) {
        let token=scanner.nextToken();
        if(token.text===EOF) break;
        if(token.text.startsWith("//") || token.text.startsWith("/*")) continue;
        // A slash starts a regexp only where an expression/statement may begin.
        // Control-parenthesis and member-keyword context distinguish if(x) /r/
        // from call(x) / divisor and object.return / divisor.
        const regexp=token.text==="/" && expressionStart;
        if(regexp) token=scanner.scanRegExp();
        const memberName=previous==="." || previous==="::";
        if(token.text==="function" && !memberName) pendingFunction=["=","(","[",",",":","return","throw","?","!"].includes(previous)?"function-expression":"function-declaration";
        if(regexp) expressionStart=false;
        else if(token.text==="(") {
            parentheses.push(pendingFunction || ((controlKeywords.has(previous) && beforePrevious!=="." && beforePrevious!=="::" || previous==="each" && beforePrevious==="for") ? "control" : "expression"));
            pendingFunction=null;
            expressionStart=true;
        } else if(token.text===")") {
            const closed=parentheses.pop(); expressionStart=closed==="control";
            if(closed==="function-expression" || closed==="function-declaration") pendingFunctionBody=closed;
        } else if(token.text==="{") {
            const objectContext=["=","(","[",",",":","return","throw","?"].includes(previous);
            braces.push(pendingFunctionBody ? pendingFunctionBody==="function-expression"?"expression":"block" : objectContext?"expression":"block"); pendingFunctionBody=null; expressionStart=true;
        } else if(token.text==="}") expressionStart=braces.pop()!=="expression";
        else if(memberName) expressionStart=false;
        else if(token.text==="]" || token.text==="++" || token.text==="--" || token.text==="." || token.text==="::") expressionStart=false;
        else expressionStart=prefixOperators.has(token.text)||prefixKeywords.has(token.text);
        tokens.push({text:token.text,index:token.index,end:token.end});beforePrevious=previous;previous=token.text;
        if(count===content.length+1)throw new Error("HARDENED_INCLUDE_SCAN: token budget exceeded");
    }
    const directives:Array<{start:number;end:number;specifier:string}>=[],imports:string[]=[];
    for(let i=0;i<tokens.length;i++) {
        const token=tokens[i]!;
        if(token.text==="include" || token.text==="#include") {
            if(i>0 && [".","::"].includes(tokens[i-1]!.text)) continue;
            const value=tokens[i+1];
            if(!value || !/^("[^"\\\r\n]*"|'[^'\\\r\n]*')$/.test(value.text)) throw new Error("HARDENED_INCLUDE_LITERAL: include path must be a literal string");
            const directive=content.slice(token.index,value.end);
            const ast=parse(path,directive+";");
            const node=ast.children[0]?.children[0];
            if(!node || nodeKindName(node.kind)!=="INCLUDE") throw new Error("HARDENED_INCLUDE_SYNTAX: invalid directive");
            directives.push({start:token.index,end:value.end,specifier:value.text.slice(1,-1)});i++;
        } else if(token.text==="import") {
            if(i>0 && [".","::"].includes(tokens[i-1]!.text)) continue;
            let j=i+1,name="";
            while(j<tokens.length && tokens[j]!.text!==";") {name+=tokens[j]!.text;j++;}
            if(!/^[A-Za-z_$][\w$]*(?:\.(?:[A-Za-z_$][\w$]*|\*))*$/.test(name)) throw new Error("HARDENED_INCLUDE_IMPORT: malformed import");
            const ast=parse(path,"import "+name+";");
            if(nodeKindName(ast.children[0]!.children[0]!.kind)!=="IMPORT")throw new Error("HARDENED_INCLUDE_IMPORT: invalid import");
            imports.push(name);i=j;
        }
    }
    return {directives,imports};
}
export function hasIncludeToken(path:string,content:string):boolean {return inspectIncludeSyntax(path,content).directives.length>0;}
