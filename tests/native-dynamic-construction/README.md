# Source value construction

Run `node tests/native-dynamic-construction/run.cjs`; add `--consumer`, `--cast`,
or both. Each of the two separate AIR packets retains 31 observations from two
complete classes and one interface. Generated and ordinary Reader modes match
both targets (ES5/ES2015) in Node/Chromium with zero source/provider type errors.

`nativeDynamicConstructionModule` must match `importModules['compiler.AS3Invocation']`.
Within a reference plan, construction through local/parameter Object, Function
or wildcard values delegates to common `as3ConstructValue`. A builtin `as Class`
target also delegates after its original cast. Target evaluation precedes the
argument thunk; argument evaluation precedes constructor validation. Invalid
constructors, method closures, interfaces and builtin scalar constructors retain
the common runtime semantics rather than raw JavaScript `new` behavior.

Four guards reject absent/mismatched providers, namespace emission and omitted
argument-list syntax, which remains outside this lowering. The cast uses the
separate qualified Class predicate provider. The observer supplies a named
method closure for the captured probe's method; it does not infer names from JS.
The source Subject constructor and Reader bodies are emitted unchanged.

Bound constructor fields, other computed constructor expressions, complete
UIComponent/ApplicationDomain integration and native display Class authority
remain separate work. Existing typed-Class local construction keeps its earlier
qualified path. No native Class identity is created by this change.
