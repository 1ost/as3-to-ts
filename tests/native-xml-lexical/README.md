# XML fields and lexical namesakes

CollectionMenuButton's private XML config field selects `config.state`, while the
caller also declares a private `state` field. Native XML lowering previously
ignored bound fields, and lexical lookup rejected the XML receiver. The compiler
now authenticates a lexical field's exact source annotation through the generated
plan and leaves its storage read to ordinary lexical dispatch. Local/parameter
shadowing remains distinct. Named-child `for each` selection uses the same native
XMLList helper as child-method enumeration and preserves order/empty lists.

Two original AIR captures agree on ten observations from complete XMLSubject.
Both ES5/ES2015 match in Node and CSP Chromium with zero type errors. The fixture
covers private namesakes, attributes, child strings/lengths, zero/one/multiple
children, enumeration, local shadowing and null errors. Eight guards retain the
missing/mismatched provider restrictions and reject XML writes, deletes, calls and
reserved method-name selection. An applied wrong-child helper mutation is detected
in both runtimes/targets. The pre-fix compiler rejection is retained.

Run `node tests/native-xml-lexical/run.cjs` with LAYA_ENGINE_REPOSITORY set to the
reviewed engine worktree. Use `verify-runtime.cjs --retain <report.json>` to retain
new proof and `verify-runtime.cjs --check-current` to verify it. The engine is
unchanged. Adjacent tests retain 23 child-enumeration and 27 child-method/list-return
AIR rows in both targets and runtimes; the latter uses CSP, while the older
children runner does not. Their typechecks now include DOM iterable definitions
required by the current engine. Complete CollectionMenuButton runtime and whole
H5 account acceptance remain separate requirements.
