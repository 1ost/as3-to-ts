# Generated URLRequest type tests

The explicit `nativeURLRequestReferenceModule` option qualifies method-body `is`
and `as` with the exact planned URLRequest export/import. It uses the common
nominal type operations and preserves operand evaluation and short-circuiting.
Shadowed targets, class initializer operations and qualified-name forms stay held.

Two AIR captures from engine evidence commit
`7d0e97587611013bea23e8a7bf36e377763f18a7` agree on 31 observations. Complete
generated Reader source matches them in Node and strict-CSP Chromium for ES5
and ES2015, with zero type diagnostics. Ten compiler guards and six host checks
cover provider/plan authority, forgeries, proxies, copied fields and domain/lifetime
boundaries. Three mutations per target are detected in both runtimes.

The adjacent legacy URL reference suite also passes its 77 AIR rows, six compiler
guards and six provider guards. Its browser harness uses its existing dynamic
module loader, not the primary suite's strict CSP harness. Its type program now
includes `lib.dom.iterable.d.ts`, required by the current shared engine.

Run `npm run tsc`, then `node tests/native-generated-urlrequest-type-tests/run.cjs`.
`node tests/native-generated-urlrequest-type-tests/verify.cjs --check-current`
authenticates the retained compiler, runtime, generated code, AIR evidence,
baseline rejection and all primary mutation bundles.

This qualification ran in `D:/op2-urlrequest-type-tests-20261004` because C: was
full. The sibling `engine` checkout contains unchanged runtime code from
`5c699b637a2ac7921e1ae2cf1648c17533238d63` plus the new AIR evidence. Temporary
files and npm cache were directed to that D: workspace. Existing C: worktrees
and evidence remain intact. These isolated repositories use the original local
Git object stores as alternates; keep those stores available.

Full source factory, startup and real H5/account acceptance remain open.
