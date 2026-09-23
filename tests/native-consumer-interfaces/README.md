# Ordinary interface consumers

Run `node tests/native-consumer-interfaces/run.cjs --combined` from the compiler
checkout. The test authenticates the common engine's consumer-interfaces AIR
packet, emits its six complete subjects and compares all 75 observations in Node
and Chromium on ES5/ES2015. Consumer is excluded from the generated declaration
plan; the three runtime classes and two interfaces use the common registrar.

The unmodified compiler rejected Consumer with the source-interface-coercion
qualification guard. The fix routes its typed parameters, returns and locals
through authenticated nominal interface tokens and existing reference coercion.
Fifteen rejection checks retain field, ancestry, implementation, constructor,
accessor, cast, rest/default, arguments and lexical-scope boundaries. Three
comparison controls reject missing, reordered and changed observations.

Strict checking includes the real provider graph. The observer is test code;
subject methods are never replaced. Full application integration is not implied.
