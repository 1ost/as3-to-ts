# Own private access through descendant-typed locals

FlowElement reads its own private _parent storage through a local typed as an
authenticated descendant. Original Game bytecode selects FlowElement's private
namespace, but generated lexical resolution previously demanded the exact owner
type spelling. The compiler now follows complete authenticated source ancestry
for a local receiver and an own instance-private capability. Existing namespace,
public, protected, static and dynamic receiver decisions remain in place.

Three complete original Classes from engine 4bcc68bf2's fields subpacket compile
unchanged. Eleven AIR observations match ES5/ES2015 in Node and Chromium with
zero type errors: child/grandchild reads, writes and numeric updates, a separate
child-private namesake, bound method closures, separate instances and null 1009.

Six guards retain rejection of unrelated receiver ancestry, untyped casts,
reference-only ancestry, a copied plan, private instance constants and private
getters. An applied compiler control removes descendant authorization and restores
the exact-source-type diagnostic on both targets. The original broader oracle
(including private constants/getters) is preserved and remains unqualified; the
field/method subpacket has its own two original AIR captures.

Run node tests/native-generated-descendant-private-receiver/run.cjs after building.
Retained report: run-uaoXjh. Verify with
node tests/native-generated-descendant-private-receiver/verify-runtime.cjs --check-current.
Full FlowElement dependencies, factory and application startup remain open.

Adjacent regressions pass: own lexical receiver run-LYtgKc (9 rows), protected
getter full-ClCIdp (19), namespace/internal isolation run-eaXLhF (7), and
namespace/Proxy isolation run-v3aUHv (20).
