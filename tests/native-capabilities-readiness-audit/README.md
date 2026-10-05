# Capabilities readiness audit

This is an investigation checkpoint, not a qualified provider or compiler fix.
No production binding, compiler implementation, engine implementation or original
AS3 source changes. The unchanged retained cohort contains 1,356 source units
and 95 class scripts.

Run `node tests/native-capabilities-readiness-audit/run.cjs` from this compiler
checkout. It authenticates the previous URLRequest original replay and current
compiler/helper inputs, replays two isolated emission diagnostics, probes the
actual native Capabilities implementation in memory, and compares the results
with `report.json`. It writes no build outputs. `--record` creates a new report
only if none exists. Original replay verification still needs its documented
retained C: inputs and the isolated D: engine sibling.

## Findings

- The unchanged original InlineGraphicElement remains held at
  `AS3_CLASS_INITIALIZER_UNSUPPORTED: unresolved class-value identity: Capabilities`.
- Adding only an unqualified native Capabilities provider to an in-memory copy
  of the plan moves the hold to
  `AS3_GENERATED_LEXICAL_UNSUPPORTED: static lexical primitive initializer requires qualification`.
  No generated output is accepted or executed. The relevant source is the
  private static Boolean initializer `Capabilities.os.search("Mac OS") > -1`.
  `native-generated-lexical.ts` permits private Boolean literals and calls, but
  only the protected Boolean path currently admits relation expressions.
- The textual source inventory includes imports, dot reads and bracket reads.
  It is reproducible discovery, not an authenticated semantic dependency graph.
  The four observed members are `os`, `version`, `hasAccessibility`, and
  `touchScreenType`. The last is accessed with brackets in Configuration.
- The existing native `os` getter recognizes the representative supplied host
  identities. These Node VM probes are diagnostics, not browser/platform or AIR
  conformance tests.
- The native version is `LAYA 3,4,0,0`. Evaluating Configuration's numeric version
  predicate on this string makes both the 10.1 and 10.2 gates false. Configuration
  uses those predicates for `playerEnablesArgoFeatures` and
  `playerEnablesSpicyFeatures`; their consumers include tab layout, word spacing,
  line-data cleanup, and soft-keyboard behavior. This does not establish that the
  corresponding shared-engine features are complete, nor authorize changing the
  reported native version to pretend to be Flash.
- `hasAccessibility` and `touchScreenType` are absent from the current native
  class. AccessibilityImplementation supplies callback state and source overrides;
  AccessibilityProperties explicitly binds metadata to an existing DOM element.
  InteractiveObject stores an authenticated implementation. Those surfaces alone
  do not demonstrate a host accessibility tree invoking the callbacks. Reporting
  accessibility support requires an actual host contract and validation.

## Next bounded qualifications

1. Qualify the private static Boolean relation initializer against AIR, including
   publication/default values, initializer effects, failure/retry and evaluation
   order; retain protected Boolean coverage. Do not broaden the guard solely to
   make the original declaration emit. The existing adjacent compiler suite is
   `tests/native-generated-protected-static-booleans/run.cjs`, backed by engine
   `tests/nativeFlashOracle/generated-protected-static-booleans`. Its ten AIR
   observations cover protected computed comparisons, calls and logical-and,
   early/default values, inherited storage and initialization order; they do not
   independently qualify the new private relation case.
2. Establish a common runtime Capabilities provider and its source-used static
   dispatch/identity behavior. Establish truthful accessibility and touch support
   from real host integration, and qualify the version-gated TLF behavior before
   promoting a binding. Preserve native runtime identity and the original source.
3. Replay the unchanged declaration and continue from the next demonstrated hold.
   A complete factory build, generated type check and real H5/account validation
   remain required and were not run here.

Storage at this checkpoint prevents normal evidence-heavy qualification runs:
C: has no free space and D: has about 7.9 MB. D: does not support filesystem
compression. The previously policy-rejected C: temporary Git-pack deletion was
not retried. This audit consumes only a small script and report; it retains all
existing evidence. Restore adequate writable capacity before new build/browser/
AIR capture runs.
