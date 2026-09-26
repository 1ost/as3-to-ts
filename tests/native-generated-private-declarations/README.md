# Generated file-private declaration headers

Run `npm run -s build` then
`node tests/native-generated-private-declarations/run.cjs`.

The planner reads all five unchanged sources from the authenticated shared
24-row file-local-classes Flash fixture. Five public bindings and three private
bindings retain exact original source units, separate package/file import scopes,
private inheritance and private Vector element identities. Compiler-internal
keys are not public QNames. Helpers receive no public script binding or domain
publication.

Generated ES5 and ES2015 headers run against real engine providers in Node and
Chromium under an external-script CSP. Ten checks per target/runtime cover token
authenticity, same-spelling identity separation, inheritance, separate loads,
null coercion, public lookup absence and incompatible reference rejection.
The generated TypeScript and real provider dependencies must typecheck without
errors. Six rejection checks preserve unsupported emission/base/interface and
forged-source boundaries. Each run retains generated files and a JSON report in
`.cache/native-generated-private-declarations`.

This qualifies declaration headers only. It does not execute helper methods,
construct source instances, publish helper Classes, or replay all 24 Flash rows.
Complete native factory emission is explicitly gated until source-unit class
initialization, loading and per-declaration trait emission are implemented.
