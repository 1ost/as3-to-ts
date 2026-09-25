# Authenticated Array parameters to Vector

The typed Array argument in original AP `VectorUtilities` previously stopped
at `HARDENED_VECTOR_CONVERSION_SOURCE`, although literal arrays were admitted.
The adapter now accepts authenticated Array identities through its existing
Array type resolver, preserving rejection of arbitrary Object/wildcard inputs.

The exact AIR fixture `LayaAir/tests/nativeFlashOracle/vector-array-conversion`
is compiled without source rewriting and compared in Node and Chromium. Twelve
rows cover copy isolation, primitive and sparse-slot coercion, RegExp identity,
null/incompatible conversion error 1034 and fixed resize error 1126. The numeric
error IDs are observed; diagnostic message equality is not asserted.

The common engine and packaged Vector runtime now retain null/undefined spellings
in `join`, as observed in AIR. Existing reference brands, allocation limits and
source type guards remain in force. The original VectorUtilities source is used
unchanged in the targeted qualification; this does not qualify all of TextStyle
or imply an original AP client launch.
