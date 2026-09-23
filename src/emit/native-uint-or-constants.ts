import Node from '../syntax/node';
import K from '../syntax/nodeKind';

/** AIR-qualified own public uint constants: literal leaves and named OR chains.
 * Resolve only immutable declarations, including forward references. Calls,
 * inherited/qualified names, other operators and cyclic references stay held.
 */
export function nativeUintOrConstants(declaration: Node, source: string): {constants: {[name:string]:string}; variables: {[name:string]:string}} {
    const constants: {[name:string]:string}=Object.create(null), variables: {[name:string]:string}=Object.create(null);
    const expressions: {[name:string]:string}=Object.create(null), fields: {[name:string]:string}=Object.create(null);
    const end=(node:Node):number=>node.children.reduce((last,child)=>Math.max(last,end(child)),Math.max(node.start,node.end));
    declaration.findChild(K.CONTENT).children.forEach(group=>{
        if(group.kind!==K.CONST_LIST&&group.kind!==K.VAR_LIST)return;
        const mods=group.findChild(K.MOD_LIST),flags=mods?mods.children.map(m=>m.text):[];
        if(flags.length!==2||flags.indexOf('public')<0||flags.indexOf('static')<0)return;
        group.findChildren(K.NAME_TYPE_INIT).forEach(field=>{
            const type=field.findChild(K.TYPE),init=field.findChild(K.INIT);
            if(!type||type.text!=='uint'||!init)return;
            const name=field.findChild(K.NAME).text,value=source.slice(init.start,end(init)).trim();
            (group.kind===K.CONST_LIST?expressions:fields)[name]=value;
        });
    });
    const active=new Set<string>(),values: {[name:string]:number}=Object.create(null);
    const resolve=(name:string):number|undefined=>{
        if(Object.prototype.hasOwnProperty.call(values,name))return values[name];
        const value=expressions[name];if(value===undefined||active.has(name))return undefined;
        if(/^(?:0[xX][0-9a-fA-F]+|0|[1-9][0-9]*)$/.test(value)){
            const number=Number(value);if(number<=4294967295)return values[name]=number;
            return undefined;
        }
        if(!/^[A-Za-z_$][\w$]*(?:\s*\|\s*[A-Za-z_$][\w$]*)+$/.test(value))return undefined;
        active.add(name);let result=0;
        for(const operand of value.split('|')){
            const next=resolve(operand.trim());
            if(next===undefined){active.delete(name);return undefined;}
            result=(result|next)>>>0;
        }
        active.delete(name);values[name]=result;constants[name]=String(result);return result;
    };
    Object.keys(expressions).forEach(resolve);
    Object.keys(fields).forEach(name=>{
        const expression=fields[name];
        if(Object.prototype.hasOwnProperty.call(constants,expression))variables[name]=constants[expression];
    });
    return Object.freeze({constants:Object.freeze(constants),variables:Object.freeze(variables)});
}
