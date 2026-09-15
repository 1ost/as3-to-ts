import NodeKind, {nodeKindName} from './nodeKind';
import Token from '../parse/token';
import {VERBOSE_MASK} from '../config';
import {ReportFlags} from '../reports/report-flags';

interface CreateNodeOptions {
    qualifiedName?: string;
    start?: number;
    end?: number;
    text?: string;
    tok?: Token;
}

export function createNode(kind: NodeKind, options?: CreateNodeOptions, ... children: Node[]) {
    let start = -1;
    let end = -1;
    let text:string;
    if (options) {
        text = options.text;
        if ('tok' in options) {
            start = options.tok.index;
            end = options.tok.end;
            text = options.tok.text
        }
        if ('start' in options) {
            start = options.start;
        }
        if ('end' in options) {
            end = options.end;
        } else if (('start' in options) && text) {
            end = start + text.length;
        }
    }

    // Initialize in this order to emit the same .ast.json test-old files
    let node = new Node();
    node.kind = kind;
    node.start = start;
    node.end = end;
    node.text = text;
    if (options && options.qualifiedName) node.qualifiedName = options.qualifiedName;
    node.children = children;

    //if(VERBOSE >= 3) {
    if((VERBOSE_MASK & ReportFlags.CREATE_NODES) == ReportFlags.CREATE_NODES) {

        console.log("node.ts - createNode() - kind: " + nodeKindName(node.kind) + ", text: " + node.text);
    }

    return node;
}

/** Parentheses preserve a single expression's reference; comma lists do not. */
export function unwrapEncapsulatedExpression(node: Node): Node {
    while (node.kind === NodeKind.ENCAPSULATED && node.children.length === 1) node = node.children[0];
    return node;
}

export function outerEncapsulatedExpression(node: Node): Node {
    while (node.parent && node.parent.kind === NodeKind.ENCAPSULATED
        && node.parent.children.length === 1 && node.parent.children[0] === node) node = node.parent;
    return node;
}

export default class Node {
    /** Full source type spelling when the legacy text retains only its terminal name. */
    public qualifiedName?: string;
    public kind: NodeKind;
    public start: number;
    public end: number;
    public text: string;
    public children: Node[];
    public parent: Node; // only during emit

    toString(offset:string = ""):string {
        let str:string = (offset === "" ? "" : offset + "↳") + nodeKindName(this.kind);
        if(this.text) {
            str += ", text: '" + this.text + "'";
        }
        str += "\n";
        for(let i:number = 0; i < this.children.length; i++) {
            const child:Node = this.children[i];
            str += child.toString(offset + "  ");
        }
        return str;
    }

    findChild(kind: NodeKind): Node {
        for (var i = 0; i < this.children.length; i++) {
            if (this.children[i].kind === kind) {
                return this.children[i];
            }
        }
        return null;
    }

    get previousSibling (): Node {
        let thisIdx = this.parent.children.indexOf(this);
        return this.parent.children[thisIdx-1];
    }

    get nextSibling (): Node {
        let thisIdx = this.parent.children.indexOf(this);
        return this.parent.children[thisIdx+1];
    }

    findChildren(kind: NodeKind): Node[] {
        return this.children.filter(child => child.kind === kind);
    }

    getChildFrom(kind: NodeKind): Node[] {
        let child = this.findChild(kind);
        if (!child) {
            return this.children.slice(0);
        } else {
            let index = this.children.indexOf(child);
            return this.children.slice(index + 1);
        }
    }

    getChildUntil(kind: NodeKind): Node[] {
        let child = this.findChild(kind);
        if (!child) {
            return this.children.splice(0);
        } else {
            let index = this.children.indexOf(child);
            return this.children.slice(0, index);
        }
    }

    get lastChild(): Node {
        return this.children[this.children.length - 1];
    }

}
