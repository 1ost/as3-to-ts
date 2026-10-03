import K from '../syntax/nodeKind';
import Node from '../syntax/node';
import {NativeGeneratedDeclarationPlan,nativeGeneratedDeclarationNode,nativeGeneratedDeclarationResolver} from './native-generated-declarations';

/** Primitive built-in bounds are compile-time values, not authored property reads.
 * Resolve the exact source spelling and reject declaration/local shadowing. */
export function nativeBuiltinNumericConstants(plan:NativeGeneratedDeclarationPlan,owner:string,source:string):{[name:string]:string} {
    const declaration=nativeGeneratedDeclarationNode(plan,owner),resolver=nativeGeneratedDeclarationResolver(plan,owner,source);
    const result:{[name:string]:string}=Object.create(null),shadowed=new Set<string>();
    const walk=(node:Node):void=>{if(node.kind===K.NAME)shadowed.add(node.text);node.children.forEach(walk);};walk(declaration);
    // Inherited names need ancestor lexical ownership before constant folding.
    if(declaration.findChild(K.EXTENDS))return Object.freeze(result);
    const end=(node:Node):number=>node.children.reduce((last,child)=>Math.max(last,end(child)),Math.max(node.start,node.end));
    const bounds:{[name:string]:string}={'int.MAX_VALUE':'2147483647','int.MIN_VALUE':'-2147483648','uint.MAX_VALUE':'4294967295','uint.MIN_VALUE':'0'};
    declaration.findChild(K.CONTENT).children.forEach(group=>{
        const mods=group.findChild(K.MOD_LIST),flags=mods?mods.children.map(m=>m.text):[];
        if(group.kind!==K.CONST_LIST||flags.length!==2||flags.indexOf('public')<0||flags.indexOf('static')<0)return;
        group.findChildren(K.NAME_TYPE_INIT).forEach(field=>{
            const type=field.findChild(K.TYPE),init=field.findChild(K.INIT);
            if(!type||['int','uint','Number'].indexOf(type.text)<0||!init)return;
            const match=/^(int|uint)\s*\.\s*(MAX_VALUE|MIN_VALUE)$/.exec(source.slice(init.start,end(init)).trim());
            if(!match||shadowed.has(match[1])||resolver.resolve(match[1])!==match[1])return;
            result[field.findChild(K.NAME).text]=bounds[match[1]+'.'+match[2]];
        });
    });
    return Object.freeze(result);
}
