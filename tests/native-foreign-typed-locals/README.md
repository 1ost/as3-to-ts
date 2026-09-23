# Native foreign typed-local references

This compiler change uses an authenticated complete declaration domain to coerce foreign and self typed locals through the exact shared declaration tokens. It preserves function-entry null defaults, source-position initialization, raw assignment/chain results, failed-write storage, source Error1034 allocation and lazy Class initialization. Ordinary typed/void method signatures, derived source classes, reference compounds/updates, source closures, unsupported catch bindings and enumeration/destructuring remain guarded.

Compiler base: `2a5a57a9d558df4846ccc96fbb53e5a59f1f6b1f`. Final native provider: committed engine `cc1baecaa0c2b4dd701516bc9a5d5c86188004fd`. No engine source or pin is changed. Engine code runs at its supported modern target; emitted consumers are tested at ES5 and ES2015 against all 754 actual provider type files.

Use `createNativeDeclarationDomain` once with complete original source, authenticated metadata, lexicalModule and typedLocals enabled, write its compiler-only module once, and emit every class using the exact returned metadata capability and sources. `emit-domain.cjs` demonstrates this existing API. The caller must reserve one resolved domain module and ensure every participating class resolves to it; module specifier aliases and output collisions remain caller responsibilities. No source Class is read merely to obtain a coercion target.

The builder resolves annotation identities before lexical/local validation, but does not publish its exact metadata capability until every declaration passes validation. Its provisional local resolver never escapes builder validation. Ordinary emission obtains local references only through the existing exact metadata capability and matching complete source bytes. NativeCallableClasses forwards a token expression from the same binding used for Class generation publication. Copied contexts and incomplete tables reject. Local reference operations do not manufacture Class values or publish new engine authority.

After local type erasure, the compiler removes only now-unused named source declaration imports whose names and output paths match the closed declaration set. Surviving value/type identifiers preserve the import. This is needed for the complete qualified namesake fixture: AS3 permits two explicit Peer imports with qualified annotations, whereas leaving both unused Peer bindings in emitted TypeScript causes duplicate-binding errors. Source imports do not run Class initializers. The emitter's general import handling is unchanged.

## Original evidence and native comparison

`capture-c` and `capture-d` contain a separately authored complete 12-class Object-root fixture: 41 nominal/storage observations, seven lazy-initialization observations and nine source Error observations. Complete Class and instance XML for all 12 classes repeat. It includes cross-class/self storage, qualified namesakes, same-package types, mutual references, once-only RHS/throw identity, failed initialization/write, raw undefined chains, skipped defaults, repeated declarations, reads before declaration and constructor-local default/coercion. All 57 observations pass Node and Chromium for both consumer targets. Ten additional provider/domain controls and four comparison negatives pass.

`capture-a` and `capture-b` retain the initial complete 11-class fixture and its 54 observations. These are historical captures, not substituted source for the final 12-class run. Original duplicate-var compiler warnings remain in the command receipts; their observed preservation behavior is tested.

The native driver is a fixture adapter. It creates real emitted classes and invokes their intact methods/constructors. Registered external callbacks correspond to the original oracle's observer/RHS functions; they use an existing trusted builtin script context solely to enter the common invocation API with explicit object receivers. They do not access or mutate locals, replace method bodies or claim support for compiling source closures. Error field observations use actual common source property APIs. Generated catch/state reads and all store/coercion sequencing stay inside the compiled classes.

## Preserved whole-source holds

The earlier research handoff `5a5da5e3e5e26709dd2b9a0b4f93e930bf3f26f529a4d5dc5642eb41bbb7deff` remains immutable. Both final retained original captures preserve all 33 nominal, seven initialization and 14 Error rows with all 12 complete classes. That entire original domain still rejects `foreign.Child` through the Object-root restriction. None of those 54 rows is claimed as a complete native-domain pass by dropping Child. The new fixture above is separate evidence with additional storage/constructor cases.

All five maintained timing sources and all metadata remain in the diagnostic. A complete declaration-domain attempt now holds the unresolved `com.greensock.TweenLite.Dictionary` annotation, before later ancestry/signature prerequisites. It is not ready. No classes or methods are pruned to change this result.

The older declaration-domain suite's seven single-class probes still reject because they omit their foreign declaration targets (Child still rejects ancestry). Its expected guard category was updated to the specific missing-domain-reference error; no rejection assertion was removed. Complete original and maintained groups are separately asserted here.

## Running

After building the compiler, set `PYTHON` to physical Python, `LAYA_ENGINE_REPOSITORY` to a repository containing the committed provider and installed dependencies, and `PLAYWRIGHT_MODULE` to Playwright. Run:

```
node tests/native-foreign-typed-locals/guards.cjs
node tests/native-foreign-typed-locals/holds.cjs
node tests/native-foreign-typed-locals/run.cjs
```

The first commands retain 28 explicit compiler/operation guards and two complete-group holds. Results go under `.cache/native-foreign-typed-locals`. Capture receipts, source bytes, complete XML and evidence pins authenticate before emission. `verify-evidence.py --tools` additionally verifies installed original Flash tools when available. No native runner recaptures or edits originals.

Existing declaration-domain16, self-constructor8, typed-local47, lexical-map21, Array precedence and associated guards pass in their retained historical provider configurations; those old pins are not relabeled as the current engine.
