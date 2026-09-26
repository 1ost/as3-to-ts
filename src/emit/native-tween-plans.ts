import Node from '../syntax/node';
import K from '../syntax/nodeKind';
const hash=(source:string):string=>require('crypto').createHash('sha256').update(source).digest('hex');
export interface NativeTweenSourcePlans {
    source:string;
    calls:ReadonlyArray<{start:number;end:number;callSha256:string;initialization:ReadonlyArray<string>}>;
}
function fail(reason:string):never{throw new Error('AS3_TWEEN_UNSUPPORTED: '+reason);}
export function tweenOptionNames(node:Node):string[]{
    if(!node||node.kind!==K.OBJECT)return [];
    return node.children.map(p=>p.children[0].text.replace(/^(['"])(.*)\1$/,'$2'));
}
/** Property enumeration order is captured evidence, never inferred from JS keys. */
export class NativeTweenPlans {
    private plans=new Map<number,{end:number;initialization:ReadonlyArray<string>}>();
    constructor(source:string,root:Node,input:NativeTweenSourcePlans,module:string){
        if(input===undefined)return;
        if(!module||!input||input.source!==source||!Array.isArray(input.calls))fail('source plan must match exact source and provider');
        const calls:Node[]=[];
        const walk=(n:Node)=>{if(!n)return;if(n.kind===K.CALL)calls.push(n);n.children.forEach(walk);};walk(root);
        input.calls.forEach(item=>{
            if(!item||!Number.isSafeInteger(item.start)||!Number.isSafeInteger(item.end)
                ||item.start<0||item.end<=item.start||item.end>source.length||this.plans.has(item.start))fail('invalid or duplicate source call span');
            const call=calls.find(n=>n.start===item.start&&n.end===item.end);
            if(!call||item.callSha256!==hash(source.slice(item.start,item.end)))fail('source call hash/span mismatch');
            const callee=call.children[0],args=call.findChild(K.ARGUMENTS);
            if(callee.kind!==K.DOT||callee.children[0].kind!==K.IDENTIFIER
                ||callee.children[0].text!=='TweenMax'||callee.children[1].text!=='to'
                ||!args||args.children.length!==3||args.children[2].kind!==K.OBJECT)fail('source plan requires direct TweenMax.to with literal options');
            const names=tweenOptionNames(args.children[2]);
            if(new Set(names).size!==names.length||names.indexOf('sourcePlan')>=0
                ||['alpha','bezier','scaleX','scaleY'].some(n=>names.indexOf(n)<0))fail('source plan requires fresh Bezier companion options');
            if(!Array.isArray(item.initialization)||['scaleX,alpha,bezier,scaleY','scaleX,bezier,scaleY,alpha'].indexOf(item.initialization.join(','))<0)fail('unproved source initialization order');
            this.plans.set(item.start,{end:item.end,initialization:item.initialization.slice()});
        });
    }
    get(node:Node):ReadonlyArray<string>|undefined{
        const plan=this.plans.get(node.start);return plan&&plan.end===node.end?plan.initialization:undefined;
    }
}
