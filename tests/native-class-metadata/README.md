# Authenticated source Class metadata and operations

Run from this compiler checkout after building it:

```powershell
node tests/native-class-metadata/run.cjs
```

Requirements: the checkout's TypeScript compiler dependencies, the sibling
`LayaAir-op2` checkout with TypeScript 4.9 and esbuild installed, Python 3, and
Playwright Chromium. `PYTHON`, `LAYAAIR_CHECKOUT`, and `PLAYWRIGHT_MODULE` override
their executable/module locations. `COMPILER_CHECKOUT` optionally selects a
different built compiler. The default always compiles against an archive of
engine commit `ebf256ec0a2458b54203f3f7410a67d13d1ec0c3`, independently of engine
working changes. `ENGINE_SOURCE_OVERRIDE` is an explicit development override;
reports then omit a claimed engine commit and record the actual provider source
hashes. Each run writes a new directory under `.cache/native-class-metadata`.

The retained original captures supply:

- Nine Class alias, container, and callback observations. Correct Flash errors
  are compared as errors; they are not counted as successful constructions.
- Fourteen ordered lifecycle steps covering failed Class publication, leaked
  identity, retry, old and new generation construction, and nominal coercion.
- One complete delete/`in` result and evaluation-order trace.
- Twelve independent mixed Class, nominal `is/as`, and int/uint boundary
  observations from a complete source class.

The runner compiles the original sources without edits, executes their emitted
JavaScript in Node and Chromium for ES5 and ES2015, and compares those exact
observations. It separately checks forged native objects and Class prototype
publication boundaries. These hostile-host checks are not additional Flash rows.
The predicate corpus also runs with `nativeCallableMetadata.module` configured
as `./CommonProvider`, separate from `./AS3MethodBinding`. This exercises the
compiler-generated helper exemption without exempting arbitrary authored calls.
The alternate module is an import of the same real common provider bundle.

Six strict type surfaces use TypeScript 4.9 and declarations generated from the
unmodified selected engine sources, with `strictNullChecks:false`. Source output
targets remain ES5/ES2015; ES2020 library declarations are required by the common
runtime. This does not establish old-browser support. No declarations are adapted
and no compiler-generated source is rewritten to obtain a passing result.

## Metadata authentication

`evidence-index.json` pins each retained receipt. Each receipt binds source,
compiled SWF, original JSON with reflection XML, capture script, commands,
provenance, and the exact ordered metadata payload by SHA-256. Files identified
in original provenance are cross-checked against those original hashes.
Historical absolute paths are evidence labels only; the tests read retained
relative files. SDK/player binaries and browser profiles are not included.

Before compilation, `evidence.cjs` verifies those receipts, uses Python's standard
XML parser to regenerate metadata from the authenticated original XML, and
compares the complete ordered result. It also verifies each source hash.
`authenticateMetadata` rejects a reordered payload even when its source hash
and member set are unchanged. A matching source hash alone is insufficient:
the compiler's sorted source-surface checks do not authenticate reflection order.

The trust root is the reviewed, committed evidence index and receipts, not a
self-signed runtime assertion or a network identity service. Changing that index
requires a new source-evidence review. The package validates the accepted capture;
it does not claim to authenticate arbitrary external metadata supplied directly
to the compiler. Retained SWFs are original Flash evidence, never production code
executed by the port. Node's isolated JavaScript context is only a test harness.

## Limits and guards

The suite verifies thirteen compiler rejection cases (hash/surface fabrication,
nonpublic members, method arguments, enumeration, and typeof), two trusted-input
authentication failures, and one lowerer check that an authored import from a
provider-looking module remains routed through common invocation. These are
sixteen guards, separate from original observation counts. Synthetic negative
inputs deliberately bypass the trusted capture entry point to test the compiler's
own rejection behavior; they are not authenticated source admissions.

Inherited/nonpublic/custom-namespace metadata, ordinary-function global context,
general method coercion/arity/return rules, method arguments, enumeration, typeof,
and complete source Class semantics remain unimplemented or separately gated.
This package does not prove a complete game module or in-game validation.
