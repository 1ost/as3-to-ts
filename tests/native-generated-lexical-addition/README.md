# Generated lexical compound addition

Run `npm run tsc`, then `node tests/native-generated-lexical-addition/run.cjs`.
Complete unchanged AIR Adder/Slot sources use the production source-class
factory on ES5/ES2015, strict provider/generated typechecks and Node/Chromium
under CSP. All 25 authenticated observations cover lexical bracket/dot +=,
private traits, public QName isolation, typed setter storage, locale-style
continuation strings, receiver/key reassignment, key-expression timing,
repeated key conversion, and read/RHS/conversion/write failure order.

The RHS sees the read first. Addition precedes storage, which rereads the
receiver and converts the retained key value again. Assignment returns the
sum before typed setter coercion. An applied bundle mutation that stores to the
read receiver must produce different observations. Three forged-scope guards,
two isolated-domain checks and two unsupported-operator guards also run.
Ordinary Object inputs come from the shared source Object factory.

Other compound operators, own static constant lookup assignments, and newly
computed receiver families remain held. Full LocaleManager and game startup
need application qualification separately.
