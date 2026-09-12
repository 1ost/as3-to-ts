# Independent native-oracle profiles

`create-fixture-profile.py` creates an explicit application profile for one
independent AS3 class. It leaves the default Bleach trust root untouched and
uses the real declaration worker, qualifier and emitter. Build the transpiler
with `npm ci --ignore-scripts` and `npm run build` first.

```sh
python3 tools/create-fixture-profile.py \
  --source /absolute/path/to/fixture \
  --entry Probe \
  --laya /absolute/path/to/LayaAir \
  --air-sdk /absolute/path/to/AIRSDK \
  --output /absolute/path/to/new-profile

node bin/as3-frontend transpile /absolute/path/to/fixture /absolute/path/to/new-output \
  --source-census /absolute/path/to/new-profile/census.json \
  --target-capabilities /absolute/path/to/LayaAir/docTool/architecture/authored-content-capabilities.json \
  --profile-lock /absolute/path/to/new-profile/profile-lock.json
```

The source directory must contain exactly the requested class and only explicit
Flash imports. Local dependencies, wildcard imports and application-wide source
censuses require a full application profile. This fixture generator uses a
bounded source scan for imports and roles; it is not a production census tool.
Admission of expressions and member access still comes from the hardened adapter.

Primitive Flash properties are recovered from the actual SDK's getter/setter
signatures through its class ancestry and matched to the pinned Laya public
surface. This permits original overrides and `super` property reads/writes
without adding accessors or changing visibility in the AS3 input. Mismatched
override types and unmapped members remain held. Numeric `int`/`uint`/`Number`
operations retain numeric expression results and coercion at assignment boundaries.
Default-package base classes still require their declared local dependency edges.

The profile pins source content, declaration-worker output, capability mapping,
runtime predicates, Laya capability bytes and AIR SDK member ancestry recovered
from its actual `airglobal.swc`/`swfdump` output. The retained generator-inputs file
identifies the exact tooling and SDK inputs. An explicit profile is a new caller
supplied authority context, not permission to rewrite the compiled default lock.
The CLI verifies source path and content even for classes that never reference a
local member. Modified source requires a newly generated profile.

The generated `__as3_runtime/ApplicationEntry.generated.js` seals the authority
before loading application classes. Execute that entry and honor its generated
package exports. Substituting raw runtime TypeScript aliases can load a second,
unsealed authority instance. Parsing or successful TypeScript emission alone is
not native parity evidence.

LayaAir's `tests/nativeFlashOracle/README.md` documents the paired AIR/browser
suite, authored SWF conversion, exact pixels and retained qualification holds.
Language fixes belong here; Flash display and authored-content fixes belong in
LayaAir. The shared application-profile/normalizer/member support incorporates
the existing generic converter patch series previously carried by AP's port
integration. AP-specific entry lists and source inventories remain consumers.

Preserve the original AS3 class contract when investigating a hold or mismatch.
Do not alter input types, inheritance, visibility, fields, method signatures or
constructors to make the current emitter accept a class. Parsing, binding and
emission fixes must accept the same source and preserve its native behavior;
runtime differences belong in LayaAir and its bridges. A new profile authenticates
changed bytes but does not establish that those edits are a compatibility fix.
Keep the original failing fixture and native evidence, and close it only after
the shared implementation passes that same input. Smaller reproducers and
simpler passing examples are additional coverage, not substitutes.

Focused validation (canonical `/private/tmp` avoids macOS `/var` symlink aliases):

```sh
TMPDIR=/private/tmp node --test tests/hardened-cli/cli.test.cjs
TMPDIR=/private/tmp node tests/hardened/parser-normalizer.test.cjs
TMPDIR=/private/tmp HARDENED_FIXTURE_AIR_SDK=/path/to/AIRSDK \
  HARDENED_FIXTURE_LAYA=/path/to/LayaAir \
  node --test tests/hardened-cli/application-profile.test.cjs
```

The fixture-profile test skips unless both explicit environment paths are set;
report that skip as unavailable validation. The historical full test suite also
contains external Bleach/Windows fixture dependencies absent from a fresh clone.
Full application-profile generators can reuse `source_members()` and
`primitive_property_mappings()` from `create-fixture-profile.py`. Supply the
authenticated SDK inventory and the exact target capability row, then retain
the returned mappings and member uses in the locked application profile. Read
and write access are checked separately; missing or ambiguous target accessors
remain unmapped. This uses the same authority logic as the native fixture lane.


Styled original classes can add `--ffdec-jar /path/to/ffdec.jar`. The shared
`native-api-profile.py` recovers complete public SDK signatures, optional
arguments and declaring owners from retained decompiled SDK bytes. The profile
pins this evidence in its source manifest; unsupported target members remain
unmapped. Native inheritance is resolved from the authenticated SDK ancestry.
`TextField.autoSize` uses the shared `flashAutoSize` bridge to avoid Laya's
boolean property collision; source field and method names remain intact.

The admitted `[Embed(source="relative.png")]` form is an original static const
Class field with no explicit initializer. PNG bytes are retained under their
SHA-256 in the output manifest, and the compiler emits a Bitmap subclass for
that field. Install the generated runtime's `installAS3EmbeddedBitmapDataHost`
only after shared Laya `EmbeddedBitmapAssets` has preloaded the manifest's
resources. Each construction receives independent canonical BitmapData.
Other formats/options and constructor arguments remain held. Compiler-generated
embedded class names are internal identities; native synthesized linkage-name
reflection still requires conversion evidence before it can be accepted.

Focused SDK-backed Embed regression:

```sh
TMPDIR=/private/tmp HARDENED_FIXTURE_AIR_SDK=/path/to/AIRSDK \
  HARDENED_FIXTURE_LAYA=/path/to/LayaAir HARDENED_FIXTURE_FFDEC_JAR=/path/to/ffdec.jar \
  node --test tests/hardened-cli/embedded-bitmap-profile.test.cjs
PYTHONDONTWRITEBYTECODE=1 python3 tools/test-native-api-profile.py
```

Math admission currently includes numeric `min`/`max` and `PI`; String includes
source-typed `indexOf`/`substr`. Loose equality is limited to null comparisons.
Binary chains preserve left associativity, conditional branches join compatible
numeric/nullability types, and reference upcasts require authenticated ancestry.
These are language lowerings, not application-profile implementations.

Object literals use the shared `AS3Object` runtime factory. Native AIR evaluates
all name/value pairs left-to-right but installs them in reverse, so the first
value wins for duplicate names. Special names including `__proto__` remain own
data properties. Wildcard-to-Object assignment converts undefined to null while
preserving other values; uninitialized wildcard locals use explicit undefined IR and emit function-scoped
`var` declarations without resetting the value at the declaration site.
`ObjectValuesProbe` in the shared Laya oracle retains the executable comparison.
Authenticated profiles route scalar-key Object/wildcard reads, writes, deletion,
`in`, `hasOwnProperty` and `toString` through shared Object dispatch. Class reads
use retained traits and lexical caller identity; no raw JS class access is admitted.
Uninitialized Number locals and defaults of other local types before their
declaration remain separate compatibility work.

Generated local class authority now includes immutable instance `objectTraits`:
member kind, runtime type name, original visibility and original namespace name.
The declaring QName remains attached through the ordered class chain. These
records participate in the canonical authority SHA-256. Mapped bridge classes
without this metadata remain explicitly unresolved; JavaScript own properties or
a mutable `constructor` property cannot supply missing source traits.

Native AIR dynamic-class probes show that computed access uses lexical namespaces:
same-class access can reach a private field while external access fails; `in` and
`hasOwnProperty` use public names. Do not implement generic indexing using only
public descriptors, nor infer source privacy from generated JavaScript fields.
Namespace names retained here are source identities, not resolved namespace URIs.
The dispatcher implements retained sealed-class reads/writes and public presence
checks; native-only class captures are replayed against the runtime helper. The
unchanged dynamic-object fixture also passes actual generated Laya execution.
Mapped classes without traits, protected lookup, resolved named namespaces,
namespace storage collisions, primitive receivers, Object-valued keys and reference
slot coercion remain explicit unsupported boundaries. General dynamic calls and
dynamic class declarations remain held. Helper tests do not establish full class
execution or application parity.


Application profiles also admit value-preserving `&&` and `||` for supported
value domains. The result retains the selected operand rather than inventing a
Boolean return type, and the emitted operator evaluates the right operand only
when required. A consuming Boolean context performs its own coercion. The shared
LogicalValuesProbe retains native null/zero/false/empty/reference/undefined values
and side-effect counts; XML/XMLList and void operands remain held.


Array push/pop/shift/unshift now use shared AS3Array dispatch for all authenticated
Array receivers, including static fields. Insertions preserve arguments as `*`;
push/unshift return uint lengths, while removals return the actual value or
undefined. Native null-receiver errors are retained. Overridden methods and length
overflow remain explicit unsupported boundaries. Indexed writes and other Array
methods still require shared support.

Strict equality involving Object/wildcard values preserves native type-sensitive
primitive comparisons and reference identity; loose coercive equality is unchanged.
Class registration admits recursively literal static Array/Object containers,
which cannot call source code or observe another class. Aggregate coercions,
constructors, source calls and other executable static initialization remain held.
The ArrayMutationProbe, DynamicEqualityProbe and definition-closure tests retain
these boundaries. This is not a waiver for general lazy AS3 class initialization.


Native String conversion now handles scalar values, plain Objects, Arrays,
authenticated local instance traits, registered/builtin Class labels, Function
labels and canonical Error text. Native null-result fallback and errors 1006/1050
are retained. Unresolved mapped instance traits, cyclic Arrays, overridden Array
join, XML/XMLList and other unproved value domains remain explicit boundaries.

Generated trace arguments use deferred shared conversion values. The Laya trace
bridge performs each conversion after the native separator, so failures retain
already-written text and do not convert later arguments. The original TraceValues
and TraceErrors probes now pass complete output-stream comparisons, not merely
state observations. Canonical Error name/message reads and zero/one non-null
String Error construction support the retained failure path. Error IDs and broader
Error construction remain outside that bounded constructor admission.

Unshadowed undefined/NaN/Infinity use language constants; local, imported and
inherited bindings retain precedence. Authenticated local/mapped class identifiers
have Class value types. Non-void functions ending in throw terminate normally for
return-path analysis; throwing getters and lambdas use the same shared rule.


## Dynamic numeric operations

The authenticated application adapter admits wildcard `-`, `*`, `/` and `%`
against wildcard or numeric operands. The generated shared runtime evaluates both
operand expressions before converting left then right; it preserves Number
results and applies int/uint narrowing only at typed boundaries. Original Object
field reads therefore retain their native numeric behavior without source casts.

Number/int/uint call conversion uses the shared public valueOf/toString path.
Explicit `Number(undefined)` differs from omitted `Number()`. Retained AIR 51
evidence covers signed hex, rejected binary/octal text, the AVM whitespace set,
empty exponents, null conversion results, non-callable methods and side effects.
The parsing behavior was cross-checked against Adobe's MathUtils implementation:
https://github.com/adobe/avmplus/blob/master/core/MathUtils.cpp
The native captures, not this older source alone, establish the exercised runtime.

Run `HARDENED_FIXTURE_LAYA=/path/to/LayaAir node --test
tests/hardened-runtime/as3-number.test.cjs` and Laya's paired `dynamic-number`
case. Its 81 checkpoints execute the same AS3 through AIR and generated Laya.
This does not establish addition/loose equality, all decimal-rounding edge cases,
Date/XML/Vector conversion, mapped instance traits, or overridden Function/Class
conversion. Unregistered objects and unresolved mapped traits remain explicit
runtime boundaries. Existing typed-slot and other intrinsic conversion paths
still need their own consumer evidence.
