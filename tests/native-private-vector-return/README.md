# Private Vector returns

The maintained OP2 BitmapNumber.getDigit method returns Vector.<int> from a
private method. The shared lexical collector previously treated that return
declaration as Vector field storage and rejected it. Private instance and static
methods now use the existing authenticated Vector signature lowering. Unknown
specializations, protected/internal returns, constants and anonymous Vector
returns remain held.

Two original AIR captures agree on 17 observations: exact identity, null and
undefined coercion, five wrong-type rejections, method closure binding, static
returns, and the numeric digit construction pattern. Unchanged compiler 40379d5
rejects that complete fixture for ES5/ES2015; baseline.json retains the rejection
and source/build hashes. No engine or font-rendering change is needed.

Run `node tests/native-private-vector-return/run.cjs` after building the compiler.
It verifies both targets in Node and CSP Chromium, with six rejection guards,
two applied mutations and zero type diagnostics. The retained packet also
includes 58 interface/private Vector boundary rows, 19 protected storage rows,
and 16 nested callback rows from fresh runs at the changed compiler.

The older protected-storage test incorrectly rejected a one-argument Vector
construction already supported before this fix (reproduced at 40379d5). Its
guard now exercises the unsupported three-argument construction instead.

`node tests/native-private-vector-return/verify.cjs --check-current` validates
the packet and current recorded inputs. This proves a shared compiler boundary,
not complete BitmapNumber rendering, whole-client execution or H5 acceptance.
