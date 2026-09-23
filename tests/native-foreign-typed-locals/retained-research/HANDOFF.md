# Foreign typed-local reference prerequisites

The common engine already supplies nominal declaration tokens and reference coercion. Two separate changes remain: compiler-owned sharing of those tokens without Class initialization, and the demonstrated source Error allocation gap for declaration-backed coercion failures. No production code is changed in this research packet.

Baselines are compiler `1ebbed38900ed88c5c0bfa4723de61f408a86b9a` and engine `6aba63414d3e63db6ebe120af9c396741759e5cc`. `compiler/` and `engine/` are isolated archives; compiler output was built without source edits. Later engine integration does not relabel these observations.

## Source evidence and native limits

Final complete original captures `capture-g` and `capture-h` retain 33 nominal/local observations, seven initialization observations, 14 Error observations, and complete Class plus instance XML for twelve classes. Both runs match; raw XML is retained and whole-document semantic equality permits only serialization order variation. Sources, commands, SWFs, Flex compiler, playerglobal26 SWC, Electron, and Flash DLL hashes are in each provenance receipt. Earlier 33-row and 40-row captures remain intact. No authored class was pruned to make it emit.

`compiler-results.json` records unmodified compiler results. ForeignLocals, QualifiedLocals, SamePackage, both mutually referencing classes, and DeferredHolder are rejected by `AS3_TYPED_LOCAL_UNSUPPORTED: foreign local reference identity held`. The derived Child is separately rejected by the Object-root lexical guard. Five complete classes emit and transpile for ES5 and ES2015; these are structural results, not a native replay of the rejected methods. Whole-group emission remains rejected. No native comparison of the 54 source rows is claimed.

The complete maintained source and authenticated metadata diagnostic independently reproduce the first foreign-local guard in TweenPlugin and TweenCore. PropTween emits in the explicit complete-own-class diagnostic; the full source group is not thereby admitted. SimpleTimeline and TweenLite remain held by source ancestry. The maintained metadata verifier's returned artifact is copied into this packet; its standard temporary output was created by that existing tool, with no tracked tool or probe edits.

`provider-results.json` separately records sixteen direct trusted-compiler protocol checks on the actual engine: Node and Chromium agree, and 186 actual type files produce zero diagnostics. These prove token coercion, exact entered identity, derived-to-base acceptance, and forged/copied/same-name token rejection. They deliberately do not stand in for compiler emission of any rejected class. The two common property reads of the generic reference error reproduce the source Error gap.

## Established local contract

| Trigger | Original result |
| --- | --- |
| Uninitialized foreign typed local | `null` |
| Initialization with genuine instance or subtype | Identity retained |
| Initialization/write with null or undefined | Stored null |
| Assignment/chained assignment with undefined | Raw expression result stays undefined; typed slot stores null |
| Incompatible initializer | TypeError 1034; default null remains when observed in catch |
| Incompatible later write | TypeError 1034; previous slot remains |
| Object with throwing public conversion hooks | Hooks are not invoked for nominal coercion |
| RHS expression | Evaluated once; its own thrown object propagates unchanged |
| Foreign same-spelling class | Different identity; rejected |
| Mutually typed A/B local methods | Genuine counterpart accepted; wrong counterpart rejected |

The seven initialization rows are decisive: creating the holder, reading an uninitialized typed local, assigning undefined, and rejecting an incompatible value do not execute the foreign Class initializer. Only construction of DeferredPeer logs its Class initializer and constructor. `readNativeClass(handle)` is therefore not an acceptable way to obtain a local reference target. The existing lazy Class API initializes the factory on read; the independent negative control shows that effect. A declaration token can be used without this read.

Import ownership is source syntax, not a terminal-name lookup. A qualified annotation without its necessary import failed original compilation. Adding a wildcard while retaining an ambiguous bare Peer also failed. Two explicit imports with both annotations qualified compile and distinguish identities. Both failed complete-source variants were preserved and recompiled, with tool/source receipts. Same-package Companion resolves originally without an import. `nativeSourceTypeIdentity` alone returns unresolved simple names in that case; a complete package/import/source table must resolve them before assigning authority.

## Smallest compiler implementation boundary

1. Introduce a validated per-source-domain declaration plan. Bind local annotation AST nodes against the exact complete source and authenticated metadata set, including qualified names, explicit/wildcard imports, own declarations and same-package scope. Unresolved or ambiguous names remain errors. QName strings can key the compiler's closed plan; they must never confer runtime identity by themselves.
2. Allocate each Object-root declaration authority once in a generated compiler-only domain module, before Class factories or authored static effects. Referencing a token must not import/initialize the other Class value. Keep publishers private to compiler machinery and give source slots only their token. Avoid global name registries: identical names in different domains remain distinct. Ordinary source-reference cycles can share already allocated tokens without Class factory cycles.
3. Change `native-callable-classes.ts` to consume the same planned authority for generation publication and own/foreign type sites; its current per-module private `declareAS3ReferenceType` allocation cannot be independently duplicated by a consumer. Keep constructor-entry publication before authored effects, exact metadata before generation publication, and failed/retried generation authority intact.
4. Extend `native-typed-locals.ts` from a string-only scalar type plan to an exact reference-token expression. Use `as3CoerceReference(raw, token)` for initialization and writes, preserve null entry defaults and the existing raw assignment-result sequencing, and preserve catch/local/parameter ownership guards. Do not admit unproved nonnumeric update or compound/reference behavior simply because a token exists.
5. Emit collision-safe declaration/type imports independently of lazy Class value imports. Test both module load orders and native cycles in Node/Chromium, both consumer targets, and real declarations. The original source fixtures and provider controls are ready regressions, not substitutes for that generated-output proof.

Relevant compiler files are `native-typed-locals.ts`, `native-callable-classes.ts`, `native-class-metadata.ts`, `native-source-type.ts`, `native-class-initializers.ts`, and emitter import/type handling, plus a new closed declaration-plan component. No blanket removal of the foreign-type guard is justified.

The whole-map metadata/lexical validation defect is a separate prerequisite tracked by the other timing reviewer: current-file lexical proof cannot validate another class's nonpublic declarations. Derived source metadata/lexical ancestry remains separate as well. The first bounded compiler slice should establish complete Object-root multi-class token composition; it must not claim TweenCore/SimpleTimeline or complete timing modules.

## Separate common Error prerequisite

All fourteen repeated Error observations match the current closed Error field model: initial `TypeError`, `Error #1034`, id 1034 for foreign instance/plain/number/Class mismatches; fresh identity per failure; wildcard name/message; false deletion of fixed fields; readonly id throwing `ReferenceError`, `Error #1074`, id 1074; ordinary dynamic slots; same caught/rethrown identity; live TypeError prototype-name snapshot; no valueOf/toString; RHS-thrown identity untouched.

Current `AS3Type.as3CoerceReference` allocates a closed source Error only for Array. A genuine declaration-backed mismatch still creates a raw host TypeError, whose name/id fail common source property access. The smallest common change is an internal closed reference-coercion allocator using the already established Error constructor path, invoked only for the captured declaration-backed branch (including genuine published Class values that resolve to that declaration). Preserve the prior Array path, invalid-token rejection, legacy/uncaptured target behavior, no-hook order, and null/undefined short circuit. The helper must remain non-API ownership; this adds neither Error Class metadata nor typed-catch/Class/compiler authority. A separate provider packet and independent review should precede using it as proof of complete foreign-local Error behavior.

## Reproduction

Use physical Python and the retained capture scripts for fresh isolated output directories, with `OP2_FLASH_PLUGIN` pointing to the retained tool. `final-authenticate.py` authenticates repeats and derives complete metadata. `compiler-probe.cjs` uses the isolated unchanged compiler. `run-provider.cjs` uses actual engine sources and `PLAYWRIGHT_MODULE`; it emits separately scoped protocol results. Raw capture sources are authoritative; setup/augmentation scripts are preparation history and must not overwrite frozen evidence. `files.json` and `handoff.json` freeze the research files. Engine/compiler archives and installed dependencies are reproducible from the exact pins and are not bundled as research delivery.
