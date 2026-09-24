# Object property paths

Run `node tests/native-object-property-paths/run.cjs`, optionally with `--consumer`
and/or `--order`. All paths use the common AS3Property module, explicitly bound
through `nativeObjectPropertyModule` and `importModules['compiler.AS3Property']`.

The default fixture emits all three unchanged Reader/Root/Domain subjects from
the thirty-row AIR nested-property-call packet. It compares full error identity,
messages, typed catches, receiver identity, intermediate getter effects, final
getter/argument order and thrown marker propagation on ES5/ES2015 in Node and
Chromium. Consumer mode emits Reader as an ordinary reference consumer.

Order mode emits the complete unchanged Reader from the twelve-row AIR
property-call-order packet. Its Subject's anonymous getter remains held by
generated declaration admission; a rejection guard preserves that limitation.
The already-qualified complete native Subject adapter supplies the counterpart
and remains ES2015 on both Reader targets, as do native engine providers. Its
source and emitted adapter hashes are recorded separately. It is not counted as
a transpiled Subject. All dot and bracket call forms are compared exactly.

The opt-in lowering proves a public path rooted in an Object/wildcard local or
parameter, preserving shadowed source Object types and bound fields. Dot calls
use as3CallNamedProperty; bracket calls retain as3CallProperty. Nested receiver
reads use as3GetProperty. Existing specialized and lexical dispatch retains its
own authority. Simple path assignments use as3SetProperty and are independently
qualified by native-object-property-writes. Dot compound addition is independently
qualified by native-dot-property-addition. Updates, other compound assignments,
deletion and property constructors remain held. Computed function-return roots, native
ApplicationDomain publication and full UIComponent remain separate work.
