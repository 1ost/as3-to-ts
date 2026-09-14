/** Evidenced no-flag, noncapturing subset. Never pass unvalidated source to JS RegExp. */
export function lowerAS3RegExpLiteral(literal:string):string {
    const reject=():never=>{throw new Error("unsupported native RegExp grammar");};
    if (literal.length > 2048 || literal[0] !== "/" || literal[literal.length-1] !== "/") reject();
    const source=literal.slice(1,-1); let offset=0,depth=0,budget=0;
    const printable=(c:string)=>c.length===1 && c.charCodeAt(0)>=32 && c.charCodeAt(0)<=126;
    function escaped():string {
        const c=source[offset++];
        if (!c || !"/\\.^$[](){}|*+?-".includes(c)) return reject();
        return "\\"+c;
    }
    function sequence(group:boolean):string {
        if (++depth>16) reject();
        let result="", atom=false;
        while(offset<source.length) {
            const c=source[offset++]!;
            if (c===")") {if(!group) reject(); depth--;return result+")";}
            if(c==="|") {result+=c;atom=false;continue;}
            if(c==="(") {
                if(source.slice(offset,offset+2)!=="?:" && source.slice(offset,offset+2)!=="?=") reject();
                const prefix=source.slice(offset,offset+2);offset+=2;
                result+="("+prefix+sequence(true);atom=false;continue;
            }
            if(c==="[") {
                let body="";
                while(offset<source.length && source[offset]!=="]") {
                    const item=source[offset++]!;
                    if(!printable(item)||"[^\\".includes(item)) reject();
                    body+=item;
                }
                if(!body || source[offset++]!=="]") reject();
                result+="["+body+"]";atom=true;continue;
            }
            if(c==="{") {
                if(!atom) reject();
                const count=/^(0|[1-9][0-9]{0,2})\}/.exec(source.slice(offset));
                if(!count) return reject();
                budget+=Number(count[1]);if(budget>1024) reject();
                offset+=count[0].length;result+="{"+count[0];atom=false;continue;
            }
            if(c==="$") {
                // AIR's final newline sequence is broader than ECMAScript's no-flag anchor.
                result+="(?=\\r\\n$|[\\n\\r\\v\\f\\u0085\\u2028\\u2029]$|$)";atom=false;continue;
            }
            if(c==="^") {result+=c;atom=false;continue;}
            if(c==="\\") {result+=escaped();atom=true;continue;}
            if(!printable(c)||"/.*+?]}".includes(c)) reject();
            result+=c;atom=true;
        }
        if(group) reject();depth--;return result;
    }
    const lowered=sequence(false);
    // Validate ranges and all remaining structural constraints with the host parser too.
    try {new RegExp(lowered);} catch {return reject();}
    return lowered;
}
