# Text-format constant Class consumer

Build the compiler, then run node tests/native-generated-format-constants/run.cjs.
The default engine is ../LayaAir-op2-format-constants-review; override it with
LAYA_ENGINE_REPOSITORY when replaying an exact pin elsewhere.

The complete LayoutUse source tests direct references to all 42 maintained
TextLayoutFormat constant selections. Five generated rows and 298 native Class
rows match AIR on ES5 and ES2015 in Node and Chromium. There are zero generated
type errors, 78 native identity checks, 13 missing-provider rejection checks and
one wrong-constant mutation per target. Reflection comparison normalizes only
inter-element whitespace. This uses the existing generic compiler provider path;
there are no compiler production changes or font renderer changes.

Full TextLayoutFormat initialization and whole-client startup remain open.
