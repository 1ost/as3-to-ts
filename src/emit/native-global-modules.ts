import Node from '../syntax/node';
import K from '../syntax/nodeKind';
import {typeOfBinding} from './native-typeof';

/** Binding only: construction/conversion semantics remain owned by providers. */
export class NativeGlobalModules {
    private modules: {[name:string]:string};
    private sourceClasses:string[] = [];
    private aliases:{[name:string]:string} = Object.create(null);

    constructor(private source:string, modules:{[name:string]:string},
        definitions:{[namespace:string]:string[]}, useNamespaces:boolean) {
        this.modules = modules || Object.create(null);
        if (modules && useNamespaces)
            throw new Error('AS3_GLOBAL_MODULE_UNSUPPORTED: module emission required');
        Object.keys(this.modules).forEach(name => {
            const module = this.modules[name];
            if (['QName','XML','XMLList','Namespace','Date','trace','parseInt'].indexOf(name) < 0
                || typeof module !== 'string' || !module.trim() || /["\\\x00-\x1f\u2028\u2029]/.test(module))
                throw new Error('AS3_GLOBAL_MODULE_UNSUPPORTED: invalid builtin module binding: ' + name);
        });
        Object.keys(definitions || {}).forEach(ns => definitions[ns].forEach(name =>
            this.sourceClasses.push((ns ? ns + '.' : '') + name)));
    }

    resolve(node:Node, typePosition = false):{name:string; module:string; alias:string} {
        const name = node.text;
        if (node.qualifiedName || !Object.prototype.hasOwnProperty.call(this.modules, name)) return null;
        // Type annotations resolve in the type namespace, independently of a
        // parameter/local that happens to have the same spelling.
        for (let scope = node.parent; scope; scope = scope.parent) {
            if (scope.kind === K.CLASS && scope.findChild(K.NAME).text === name) return null;
            if (scope.kind === K.PACKAGE) {
                const ns = scope.findChild(K.NAME).text;
                if (this.sourceClasses.indexOf((ns ? ns + '.' : '') + name) >= 0) return null;
            }
            if (scope.kind !== K.CONTENT) continue;
            if (scope.findChildren(K.IMPORT).some(item => item.text === name || item.text.endsWith('.' + name)))
                return null;
            if (scope.findChildren(K.IMPORT).some(item => item.text.endsWith('.*')
                && this.sourceClasses.indexOf(item.text.slice(0, -1) + name) >= 0)) return null;
            if (scope.findChildren(K.CLASS).concat(scope.findChildren(K.INTERFACE))
                .some(item => item.findChild(K.NAME).text === name)) return null;
        }
        if (!typePosition) {
            const binding = typeOfBinding(node, this.source, this.sourceClasses);
            if (binding === 'lexical' || binding === 'class') return null;
        }
        if ((name === 'trace' || name === 'parseInt') && (typePosition || !node.parent || node.parent.kind !== K.CALL
            || node.parent.children[0] !== node))
            throw new Error('AS3_GLOBAL_MODULE_UNSUPPORTED: '+name+' function identity requires separate qualification');
        let alias = this.aliases[name];
        if (!alias) {
            alias = '__as3_global_' + name;
            while (this.source.indexOf(alias) >= 0) alias += '_';
            this.aliases[name] = alias;
        }
        return {name:name === 'Date' ? 'AS3Date' : name === 'parseInt' ? 'sourceParseInt' : name, alias, module:this.modules[name]};
    }
}
