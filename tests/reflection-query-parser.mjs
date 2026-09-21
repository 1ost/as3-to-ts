import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const parse = require("../lib/parse");
const NodeKind = require("../lib/syntax/nodeKind").default;

const source = `import flash.utils.describeType;
public class Probe {
 public function read():int {
  return describeType(Probe).factory.method.(@name == "optional").parameter.length();
 }
}`;
const tree = parse("ReflectionQueryProbe.as", source);
let filter;
function visit(node) {
    if (!node) return;
    if (node.kind === NodeKind.E4X_FILTER) filter = node;
    for (const child of node.children || []) visit(child);
}
visit(tree);
assert.ok(filter, "parser should retain an E4X_FILTER node");
assert.equal(source.slice(filter.start, filter.end),
    `describeType(Probe).factory.method.(@name == "optional")`);
assert.equal(filter.start, source.lastIndexOf("describeType"));
console.log("PASS: E4X filter range includes its receiver");
