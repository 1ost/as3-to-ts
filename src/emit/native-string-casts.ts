import Node from '../syntax/node';
import NodeKind from '../syntax/nodeKind';
import {typeOfBinding} from './native-typeof';

/** Exact unshadowed intrinsic String-as expression; evaluation remains in the emitter. */
export function intrinsicStringAs(emitter:any,node:Node):boolean {
    return !!emitter.references&&!!emitter.options.nativeComputedTypeTestModule&&!!node
        &&node.kind===NodeKind.RELATION&&node.children.length===3&&node.children[1].text==='as'
        &&node.lastChild.kind===NodeKind.IDENTIFIER&&node.lastChild.text==='String'
        &&emitter.references.resolve('String')==='String'&&!emitter.references.sourceClass('String')
        &&!emitter.references.sourceInterface('String')&&!emitter.findDefInScope('String')
        &&typeOfBinding(node.lastChild,emitter.source,[])==='builtin';
}
