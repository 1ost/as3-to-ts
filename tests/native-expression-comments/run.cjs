const assert = require('assert');
const {spawnSync} = require('child_process');
const parse = require('../../lib/parse');
const K = require('../../lib/syntax/nodeKind').default;

const wrap = expression => `package probe { public class Comments {
  public function read():* { return ${expression}; }
} }`;
const cases = [
  ['factory(1).ns::value()', 'factory(1) /* receiver */ .ns::value()'],
  ['factory(index(1)).ns::value()', 'factory(index(/* argument */ 1)).ns::value()'],
  ['factory(index(1)).ns::value()', 'factory(/** before */ index(1) /* after */).ns /* qualifier */ :: /* member */ value()'],
  ['factory(1,2).ns::value()', 'factory(1, /* separator */ 2).ns::value()'],
  ['factory().ns::value()', 'factory(/* empty */).ns::value()'],
  ['factory(1).value', 'factory(1) /* receiver */ . /* member */ value'],
  ['factory("(,),::").ns::value()', 'factory(/* literal */ "(,),::").ns::value()'],
  ['factory(index(1)).ns::value()', 'factory(// line comment\nindex(1)).ns::value()'],
  ['factory(1)[0].ns::value()', 'factory(1) /* index */ [0] /* selector */ .ns::value()']
];
function shape(node) {
  if (!node) return null;
  return {kind:K[node.kind], text:node.text, children:node.children.filter(Boolean).map(shape)};
}
if (process.argv[2] === '--child') {
  const test = JSON.parse(process.argv[3]);
  if (test.invalid) {
    assert.throws(() => parse('Comments.as', wrap(test.invalid)), /AS3_ARGUMENT_LIST|AS3_PARSE_UNEXPECTED_(TOKEN|EOF)|unexpected token|failed to parse/);
  } else {
    const actual = parse('Comments.as', wrap(test.source));
    assert.deepStrictEqual(shape(actual), shape(parse('Comments.as', wrap(test.base))));
    const accesses = [];
    (function walk(node) {
      if (!node) return;
      if (node.kind === K.NAMESPACE_ACCESS) accesses.push(node);
      node.children.forEach(walk);
    })(actual);
    if (test.base.includes('::')) {
      assert.strictEqual(accesses.length, 1);
      assert.strictEqual(accesses[0].children[0].kind, K.DOT, 'retain the explicit receiver');
      const span = wrap(test.source).slice(accesses[0].start, accesses[0].end);
      assert(span.startsWith('factory(') && span.endsWith('value'), span);
    }
  }
} else {
  const tests = cases.map(([base,source]) => ({base,source})).concat([
    {invalid:'factory(1 2)'}, {invalid:'factory(1'}, {invalid:'factory(/* comment */ 1 2)'}
  ]);
  for (const test of tests) {
    const result = spawnSync(process.execPath, [__filename, '--child', JSON.stringify(test)], {
      encoding:'utf8', timeout:5000
    });
    assert.ifError(result.error);
    assert.strictEqual(result.status, 0, JSON.stringify(test) + '\n' + result.stdout + result.stderr);
  }
  console.log(JSON.stringify({status:'pass',parserCases:tests.length,timeoutMs:5000}));
}
