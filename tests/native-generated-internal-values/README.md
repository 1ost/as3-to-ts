# Internal Object/int method signatures

Five complete source Classes compare with thirty observations from two identical
AIR Desktop WIN 51,3,4,2 captures. Run `verify.cjs` to authenticate original
artifacts, or `verify-native.cjs --check-current` for the retained native reports.
The initial compiler at 40065ffca rejects these source signatures before emission.

The compiler now admits required intrinsic Object/int parameters with void return,
in addition to the previously admitted interface signatures and zero-argument
void methods. Exact source type spans distinguish intrinsic types from namesakes.
Existing signature lowering owns argument-count checks and parameter coercion;
the shared engine handles arbitrary safe parameter counts for internal methods.

Run `node tests/native-generated-internal-values/run.cjs --combined` and without
`--combined`, with LAYA_ENGINE_REPOSITORY pointing at the shared engine candidate
recorded in native-pin.json. ES5/ES2015 output is checked in Node and Chromium.
Both modes have zero generated/dependency type errors and nineteen rejection
guards. Retain their report paths with `retain.cjs COMBINED_REPORT ORDINARY_REPORT`.

The comparison covers Object identity, undefined-to-null conversion, boxed
primitive/array acceptance, integer wrapping/truncation, mixed and three-argument
calls, argument ordering before typed null errors, dynamic lookup order, arity,
closure identity, overrides, package separation, writes, deletion and reflection.
Method bodies detect missing parameter coercion before typed field storage can
hide it. Three applied mutations restore the old engine count limit or remove
Object/int coercion; each must fail the comparison. Optional/rest arguments,
static/internal super methods, other new parameter types and non-void returns
remain held. This is shared language evidence, not completed OP2 manager behavior.

Reproduce AIR capture with the pinned engine scripts/nativeFlashOracle.py,
`--source tests/native-generated-internal-values/source --entry InternalValueProbe`,
AIR SDK 51.3.4 and a fresh `--output` directory. The receipt hashes tools, sources,
compiled SWF and both captures. Compiler warnings about comparing a typed Object
with undefined are intentional conversion observations.
