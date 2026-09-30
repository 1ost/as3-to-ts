# Public numeric compound assignment

ItemManager and OperationManager require += and -= on source-typed public int
fields. The shared compiler previously rejected these as foreign public lexical
collisions. This change admits numeric fields and read/write accessors and uses
common AS3 property, addition and numeric conversion behavior.

Four complete source Classes match 24 original AIR Desktop 51.3.4 observations
in Node and Chromium for ES5/ES2015, with zero type errors. AIR captures agree
across two runs. Coverage includes int/uint overflow, fractional truncation,
String/Array addition, null/undefined operands, negative zero, NaN, accessors,
getter/RHS/setter order, exceptions, null receivers and private namesakes.

Flash repeats the receiver path for storage after RHS evaluation and value
conversion. Singleton and owned-target redirection are observed both during
RHS evaluation and during a source valueOf method. Capturing the initial target
would read and write the wrong object. The expression result remains uncoerced;
only field storage or the setter parameter is coerced.

Seven rejection checks retain missing-provider, nonnumeric, readonly, method,
unknown-receiver and unqualified-operator boundaries. Four applied controls
capture the wrong addition/subtraction receiver, reverse getter/RHS evaluation,
or return the stored value; all fail the original comparison.

    node tests/native-generated-public-compound/run.cjs
    node tests/native-generated-public-compound/retain.cjs <run>/report.json
    node tests/native-generated-public-compound/verify-runtime.cjs --check-current

Set LAYA_ENGINE_REPOSITORY to the engine commit in runtime-pin.json. The retained
report authenticates fixture/compiler sources, complete generated output, bundle
inputs and typecheck inputs. Current-input verification requires local artifacts.
Reproduce AIR via scripts/nativeFlashOracle.py with source, entry CompoundProbe,
and AIR SDK 51.3.4. Earlier accessor-update and derived/internal retry regressions
also pass; complete manager behavior and game startup remain separate work.
