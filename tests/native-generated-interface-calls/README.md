# Calls on interface-cast results

Run `node tests/native-generated-interface-calls/run.cjs --combined`.
Seven complete captured subjects match 44 AIR observations in Node and
Chromium on ES5/ES2015 with zero strict type diagnostics. Before the fix three
TS2339 diagnostics exposed unknown-typed cast receivers. A JS type assertion
alone cannot preserve source null errors or argument evaluation order.

Lowering evaluates the cast and argument array first, then dispatches through
the common as3CallProperty provider. The observer never substitutes a subject
method. Four rejection checks retain missing provider and shadowed interface
target boundaries; three comparison controls reject altered observations.

Own private interface fields now share the qualified receiver/argument ordering. The field identity comes from exact source trait spans in the authenticated plan. Public/protected fields, extracted methods and computed names are separate boundaries.
