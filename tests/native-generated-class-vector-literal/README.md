# Class-vector literals

Run npm run tsc, then node tests/native-generated-class-vector-literal/run.cjs --combined.
Repeat with --collision for a parameter named like the generated temporary.
The complete three-source AIR packet matches six rows on ES5/ES2015 in Node
and Chromium with zero generated/dependency types. Three rejection guards keep
other element kinds held, and three comparison controls reject altered rows.

Each literal creates a mutable typed vector and inserts elements in source
order. Each insertion coerces to Class before the following expression runs.
Invalid first/middle elements throw source TypeError 1034 and skip later effects.
Nullish elements, empty literals, identity, growth and fresh allocation are covered.
The shared Class provider also requires source-visible errors for bad coercion.

This harness uses a test-only module loader. Production factory/resource-loader
integration and other literal element kinds remain separate requirements.
