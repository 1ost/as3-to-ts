import Node from '../syntax/node';
import K from '../syntax/nodeKind';

// Conservative source control-flow proof. Normal fallthrough and unresolved jumps
// remain distinct from return/throw; finally can replace a pending completion.
export function generatedMethodCompletes(body: Node): boolean {
    const normal=1, exit=2, brk=4, next=8;
    const sequence=(nodes:Node[]):number=>{
        let result=normal;
        for(let i=0;i<nodes.length;i++){
            const node=nodes[i];let current:number;
            if(node.kind===K.TRY){
                current=flow(node.findChild(K.BLOCK));
                while(i+1<nodes.length&&nodes[i+1].kind===K.CATCH)current|=flow(nodes[++i].findChild(K.BLOCK));
                if(i+1<nodes.length&&nodes[i+1].kind===K.FINALLY){
                    const final=flow(nodes[++i].findChild(K.BLOCK));
                    current=(final&normal?current:0)|(final&~normal);
                }
            }else current=flow(node);
            result=(result&~normal)|(result&normal?current:0);
        }
        return result;
    };
    const flow=(node:Node):number=>{
        if(!node)return normal;
        if(node.kind===K.RETURN)return exit; // Source parser also uses RETURN for throw.
        if(node.kind===K.BREAK)return brk;
        if(node.kind===K.CONTINUE)return next;
        if(node.kind===K.BLOCK||node.kind===K.SWITCH_BLOCK)return sequence(node.children);
        if(node.kind===K.IF)return flow(node.children[1])|flow(node.children[2]);
        if(node.kind===K.SWITCH){
            const cases=node.findChild(K.CASES).children;let suffix=normal,result=0;
            for(let i=cases.length-1;i>=0;i--){
                const own=flow(cases[i].findChild(K.SWITCH_BLOCK));
                suffix=(own&~normal)|(own&normal?suffix:0);result|=suffix;
            }
            if(!cases.some(c=>!!c.findChild(K.DEFAULT)))result|=normal;
            return (result&~brk)|(result&brk?normal:0);
        }
        // Loops/labels are not proved exhaustive. A following return can still
        // establish completion; they never turn an unresolved jump into return.
        return normal;
    };
    return flow(body)===exit;
}
