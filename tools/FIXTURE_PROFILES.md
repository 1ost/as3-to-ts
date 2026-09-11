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
