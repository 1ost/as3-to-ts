import Node from '../syntax/node';
import K from '../syntax/nodeKind';

/** Inert, unshadowed undefined sentinel in a root Class. Do not fold a source
 * declaration named undefined or an inherited/imported value into the intrinsic. */
export function nativeUndefinedConstant(field:Node, declaration:Node, source:string):boolean {
    const member=field.parent,mods=member&&member.findChild(K.MOD_LIST),flags=mods?mods.children.map(m=>m.text):[];
    const type=field.findChild(K.TYPE),init=field.findChild(K.INIT);
    if(!member||member.kind!==K.CONST_LIST||flags.length!==2||flags.indexOf('private')<0||flags.indexOf('static')<0
        ||!type||type.text!=='*'||!init||init.children.length!==1||init.children[0].kind!==K.IDENTIFIER||init.children[0].text!=='undefined'
        ||declaration.findChild(K.EXTENDS))return false;
    let root=declaration;while(root.parent)root=root.parent;
    const end=(n:Node):number=>n.children.reduce((last,child)=>Math.max(last,end(child)),n.end);
    const shadows=(n:Node):boolean=>n.kind===K.NAME&&n.text==='undefined'
        ||n.kind===K.IMPORT&&/\.(?:undefined|\*)\s*;?$/.test(source.slice(n.start,end(n)).trim())
        ||n.children.some(shadows);
    return !shadows(root);
}
