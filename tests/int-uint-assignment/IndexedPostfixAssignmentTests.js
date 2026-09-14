const assert = require('assert');
const vm = require('vm');
const ts = require('typescript');
const parse = require('../../lib/parse');
const emit = require('../../lib/emit');
const NodeKind = require('../../lib/syntax/nodeKind').default;

// A typed assignment nested in an index must coerce the postfix expression,
// without consuming the closing bracket or leaving ++/-- outside the coercion.
// Number cursors exercise assignment truncation independently of inc/dec's own
// integer-overflow semantics (which are outside this regression).
const cases = [
  { expression: 'cursor++', evaluate: n => n, delta: 1 },
  { expression: 'cursor--', evaluate: n => n, delta: -1 },
  { expression: '(cursor++)', evaluate: n => n, delta: 1 },
  { expression: '(cursor--)', evaluate: n => n, delta: -1 },
  { expression: 'cursor++ + 2', evaluate: n => n + 2, delta: 1 },
  { expression: 'cursor-- * 2', evaluate: n => n * 2, delta: -1 },
  { expression: '2 * cursor++', evaluate: n => 2 * n, delta: 1 },
  { expression: 'data.flag ? cursor++ : cursor--', evaluate: n => n, delta: 1 },
  { expression: 'data.flag ? cursor-- : cursor++', evaluate: n => n, delta: -1 }
];

let executed = 0;
for (const type of ['int', 'uint']) {
  for (const assignment of ['=', '+=']) {
    for (const testCase of cases) {
      const source = [
        'package { public class IndexedPostfix {',
        ' public function run(values:Object, data:Object):Array {',
        '  var index:' + type + ' = 3;',
        '  var cursor:Number = data.start;',
        '  values[index ' + assignment + ' ' + testCase.expression + '] = data.value;',
        '  return [index, cursor, values[index]];',
        ' }',
        // Cover other tokens adjacent to a postfix RHS: comma, semicolon, and
        // closing parenthesis, including typed initialization and return values.
        ' public function boundaries(data:Object):Array {',
        '  var cursor:Number = data.start;',
        '  var first:' + type + ' = cursor++;',
        '  var second:' + type + ' = cursor--;',
        '  return [first, second, first = cursor++, (second = cursor--), cursor];',
        ' }',
        '} }'
      ].join('\n');
      const ast = parse('IndexedPostfix.as', source);
      const spans = [];
      function inspect(node) {
        if (!node) return;
        if (node.kind === NodeKind.POST_INC || node.kind === NodeKind.POST_DEC) {
          const span = source.slice(node.start, node.end);
          assert.match(span, /^cursor(?:\+\+|--)$/, 'exact postfix source span: ' + span);
          spans.push(span);
        }
        node.children.forEach(inspect);
      }
      inspect(ast);
      assert.ok(spans.length >= 5);

      const generated = emit(ast, source, {
        lineSeparator: '\n', definitionsByNamespace: {}, customVisitors: []
      });
      const executable = generated
        .replace(/^import .*$/gm, '')
        .replace(/@classBound\s*/g, '')
        .replace(/@bound\s*/g, '')
        .replace('export class IndexedPostfix', 'class IndexedPostfix') +
        '\nthis.Subject = IndexedPostfix;';
      const result = ts.transpileModule(executable, {
        compilerOptions: { target: ts.ScriptTarget.ES2015 },
        reportDiagnostics: true
      });
      assert.deepStrictEqual(result.diagnostics, [], generated);
      const context = {};
      vm.runInNewContext(result.outputText, context);
      const subject = new context.Subject();
      const coerce = type === 'uint' ? n => Number(n) >>> 0 : n => Number(n) | 0;
      for (const start of [-1.75, 2147483647.75, 4294967295.75]) {
        const values = {};
        const events = [];
        const data = {
          get start() { events.push('start'); return start; },
          get flag() { events.push('flag'); return true; },
          get value() { events.push('value'); return 45; }
        };
        const expectedIndex = coerce(testCase.evaluate(start) + (assignment === '+=' ? 3 : 0));
        assert.deepStrictEqual(Array.from(subject.run(values, data)),
          [expectedIndex, start + testCase.delta, 45], generated);
        assert.deepStrictEqual(Object.keys(values), [String(expectedIndex)]);
        assert.deepStrictEqual(events,
          testCase.expression.includes('data.flag') ? ['start', 'flag', 'value'] : ['start', 'value']);
        assert.deepStrictEqual(Array.from(subject.boundaries({ start })),
          [coerce(start), coerce(start + 1), coerce(start), coerce(start + 1), start]);
        executed++;
      }
    }
  }
}

console.log('indexed postfix integer assignments: ' + executed + ' executable cases passed');
