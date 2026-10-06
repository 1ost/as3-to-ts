# File-local opened namespace scope

Root CONTENT use directives now govern file-local classes following the package
block. Package directives remain separate; class directives are combined with
their actual enclosing scope. The same lookup supplies typed dot, this,
implicit identifier and fail-closed namespace checks.

Ten observations from two equal AIR 51.3.4 captures match ES5/ES2015 in Node and
Chromium CSP with zero semantic errors. The probe covers same-name methods in
different package/root namespaces, two interface-backed file helpers, own
implicit/this fields and methods, local shadows, class directives and call counts.
Three guards reject copied plans, ambiguous root namespaces and missing root
namespace access. Applied mutations substitute a public method or the wrong URI;
both are detected in both targets/realms. Receiver-chain regression retains 16 rows.

The retained pre-fix four-row investigation has two type errors and fails
getFloatAt at runtime in both targets/realms. It predates the expanded ten-row
fixture; it is corroborating baseline evidence, not a replay of identical input.
The expanded source also rejected implicit count access before the fix.
Qualified use namespace syntax is not covered; this fixture uses imported names.

Run with LAYA_ENGINE_REPOSITORY and PLAYWRIGHT_MODULE configured:

    node tests/native-generated-namespace-file-scope/run.cjs
    node tests/native-generated-namespace-file-scope/verify.cjs --check-current

The portable packet hashes compiler source/build inputs, AIR evidence, generated
sources, bundles, mutation results and adjacent regression evidence. This does
not establish whole-client TLF or real H5 game acceptance.
