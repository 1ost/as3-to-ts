# Hardened parser normalizer

`parser-normalizer.ts` is the only adapter from the hardened legacy parser's
mutable `Node` tree to `authored-ui-as3-flat-ast@1`. It does not modify the
parser, recover malformed input, or call the legacy emitter.

## Closed normalization

The caller supplies the parser root, the exact source string used to produce
that root, and a SHA-256 function. The normalizer emits deterministic preorder
nodes with `n0..nN` IDs, parent IDs, contiguous sibling order, named node kinds,
non-null source spans, and parser semantic text (`undefined` becomes the flat
contract's explicit `null`). It hashes the full source and authenticates the
node array as `SHA-256(JSON.stringify(nodes))`.

Every span must be an integer range contained by its parent and the exact
source. The compilation unit must cover the complete source. Leaf semantic text
has an exact source slice; the normalizer repairs the parser's keyword-biased
`IMPORT` range by locating its qualified-name text inside the owning content
span. Structural nodes such as `FUNCTION` retain their whole structural span
and their semantic text must occur verbatim inside it. Ambiguous synthesized
text is never accepted. Null children, shared children, cycles, unknown numeric
kinds, and every kind outside the semantic adapter's closed subset are rejected.

## Recovery and comments

An `AS3ParseError` has no normalizable result. Any tree carrying recovery,
diagnostic, or error metadata is rejected even when the collection is empty.
This prevents a future parser recovery mode from becoming silently admissible.

Comments are not semantic AST nodes. The compilation unit's complete trivia
list and every node's leading-trivia list are checked against exact comment
text and source spans. Leading trivia must belong to the complete parser list.
The comments remain byte-authenticated by the full-source digest; they cannot
be reclassified as declarations or expressions.

## Admission changes

Adding a parser node kind to the normalizer is an explicit authored-UI semantic
admission. It requires corresponding fail-closed handling in `adapter.ts` and
new real parser-to-normalizer-to-adapter tests. It must never be added merely
to make a broader legacy corpus pass.

Run the focused gate from any working directory:

```text
node <repo>/tests/hardened/parser-normalizer.test.cjs
```
