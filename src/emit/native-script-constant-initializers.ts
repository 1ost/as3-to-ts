import Node from '../syntax/node';
import K from '../syntax/nodeKind';
import {nativeNumericProductConstant} from './native-numeric-product-constant';

/** Static constants whose initialization cannot enter authored code or observe
 * an unpublished source Class. Primitive values use the existing early slots;
 * flat Array literals are fresh deferred storage in each selected script unit.
 * This does not authorize failing/cyclic/general executable initializers.
 */
export function nativeScriptConstantInitializers(declaration: Node, source: string,
    uintConstants: {[name:string]:string}): Set<Node> {
    const end=(node:Node):number=>node.children.reduce((last,child)=>Math.max(last,end(child)),Math.max(node.start,node.end));
    const text=(node:Node):string=>source.slice(node.start,end(node)).trim();
    const literal=(value:string):boolean=>/^(?:null|true|false|[+-]?(?:0[xX][0-9a-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)|"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*')$/.test(value);
    const fields:Node[]=[],allowed=new Set<Node>(),early=new Set<string>();
    declaration.findChild(K.CONTENT).children.forEach(member=>{
        const mods=member.findChild(K.MOD_LIST),flags=mods?mods.children.map(m=>m.text):[];
        if(member.kind!==K.CONST_LIST||flags.length!==2||flags.indexOf('public')<0||flags.indexOf('static')<0)return;
        fields.push(...member.findChildren(K.NAME_TYPE_INIT));
    });
    fields.forEach(field=>{
        const type=field.findChild(K.TYPE),init=field.findChild(K.INIT),name=field.findChild(K.NAME).text;
        if(!type||!init||['int','uint','Number','Boolean','String'].indexOf(type.text)<0)return;
        if(literal(text(init))||nativeNumericProductConstant(text(init),type.text)
            ||type.text==='uint'&&Object.prototype.hasOwnProperty.call(uintConstants,name)){
            allowed.add(field);early.add(name);
        }
    });
    fields.forEach(field=>{
        const type=field.findChild(K.TYPE),init=field.findChild(K.INIT);
        if(!type||type.text!=='Array'||!init||init.children.length!==1||init.children[0].kind!==K.ARRAY)return;
        // An identifier must resolve to this class's immutable early slot.
        // No getters, variables, imports, array aliases, member reads or calls.
        if(init.children[0].children.every(element=>element.kind===K.IDENTIFIER
            ? early.has(element.text)
            : literal(text(element))))allowed.add(field);
    });
    return allowed;
}
