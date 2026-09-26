# File-local Class module execution

Run `node tests/native-generated-private-modules/run.cjs` after building, using
the isolated shared engine checkout (or `LAYA_ENGINE_REPOSITORY`).

Two complete source cohorts execute through the common native loading session:

- The five unchanged `file-local-classes` sources reproduce 24 Flash rows for
  nominal helper identities, reflection names/base, inheritance, coercion,
  fields, bound methods, overrides, vectors, static storage, import scopes and
  private names being absent from public definition lookup.
- Three `file-local-lifetime` sources reproduce ten Flash rows for caller and
  defining globals, repeated closures, explicit/null receivers and separate
  same-spelled private Classes. In particular, `call(null)` proves that the
  primary class and its helpers share one global per source file.

Both ES5 and ES2015 factories run in Node and CSP Chromium with strict generated
and provider type checks. Thirteen additional native checks cover sibling and
inherited domain identity, retained instances after unload, and reflection
authority: scalar identity queries do not grant full XML reflection, accept
constructor-name spoofing, or silently inherit unregistered subclass metadata.
Eight compile-time guards cover forged plans, missing providers, unqualified
static initialization and multi-declaration Class-script retries. Receipts
retain original sources, emitted modules, type-check inputs and runtime results.

The emitter visits each actual declaration and its original import nodes, using
compiler identities to connect separate implementation modules. The generated
factory initializes each source file once through `instantiateAS3ScriptUnit`,
supplies all public/private bindings together and exports only public names to
the loader. No invented package, helper implementation, or SWF bytecode runs.

Two source regressions found by this replay are fixed in the shared compiler:
consecutive argument lists now form nested calls, and a class without modifiers
retains its `class` token in its source span. Function-valued method results use
the common call/apply provider even when invoked immediately. Scalar reflection
name/base reads use exact registered identity fields without fabricating a full
reflection document.

Remaining boundaries include private interfaces/implements, arbitrary
multi-declaration static-initializer failure/retry, and complete generated XML
reflection. This test does not qualify the entire OP2 client or Parcel port.
