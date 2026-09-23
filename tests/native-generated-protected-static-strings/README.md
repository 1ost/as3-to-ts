# Protected static String emission

Run `node tests/native-generated-protected-static-strings/run.cjs --combined`.
Three complete captured AS3 subjects match thirteen AIR observations in Node
and Chromium on ES5/ES2015, with strict checking against the real provider graph.
The fixture covers early literal publication, mutation during initialization,
shared immediate-parent storage, String coercion and own computed access.

Before the fix the inherited static ownership and primitive initializer guards
reject these sources. Computed access additionally requires the common engine's
qualified String variable lookup; otherwise named writes create public storage
instead of updating the lexical slot. Four guards retain unqualified private,
computed and other primitive initializers; three comparison controls reject
missing, reordered and altered AIR observations.
