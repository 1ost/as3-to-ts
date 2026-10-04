# Generated FTE constant access

The production factory/class loader executes complete FTEUse against all three
canonical native providers. Ninety-one AIR observations are compared on ES5 and
ES2015 in Node and strict-CSP Chromium. The native observer additionally exercises
all captured constants, reflection, Class/instance identity, casts, constructor
arity and property behavior. Generated and runtime dependencies typecheck strictly.

Set LAYA_ENGINE_REPOSITORY to ../LayaAir-op2-fte-constants-review, then run:

    npm run build
    node tests/native-generated-fte-constants/run.cjs
    node tests/native-generated-fte-constants/verify.cjs --check-current

Three missing-provider guards, 18 host identity/property controls and one applied
wrong-constant mutation per Class per target verify the comparison boundaries.
The retained archive hashes compiler source/build inputs, runtime/type dependencies,
complete source captures, generated outputs, observers and each mutation artifact.
Only inter-element XML indentation is normalized. No compiler logic change is
required. Full OP2 source emission, text layout and H5 acceptance are separate gates.
