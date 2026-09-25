# Generated TextSnapshot references

Run npm run tsc, then node tests/native-text-snapshot-reference/run.cjs.

The complete unchanged TextSnapshotHolder.as matches 32 AIR observations on
ES5/ES2015 in Node and Chromium with CSP forbidding runtime compilation. Its
typed constructor parameter, field, getter, method parameter/return and is/as
checks use the shared native Sprite value-reference binding. All generated and
provider code typechecks without diagnostics. Seven compiler rejection controls
exercise missing/mismatched bindings, lexical shadowing and unsupported native
inheritance; twelve runtime controls cover nominal identity, forged/revoked
proxies without traps, typed-slot atomicity, other native families and retirement.

This is a closed reference token backed by the private TextSnapshot allocation
map. It does not invent full Class reflection, construction, method/property
projection or generated native inheritance. The existing three-family Sprite
value-reference suite remains the regression gate for the shared option.
