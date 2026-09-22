# Complete source object-clone qualification

Run `node tests/native-generated-object-clone/run.cjs`. Both complete Base/Record
subjects from the engine native-object-clone AIR packet are emitted unchanged.
Public constants, private/protected fields, dynamic modifiers, all accessors and
methods remain present. Their declaration plan allocates no unused script globals;
these source bodies contain no lexical Function calls. A host observer compares
12 AIR observations on ES5/ES2015 in Node and Chromium with zero type diagnostics.

The actual common NativeObjectCodec retains declared public variables, read/write
accessors and own enumerable dynamic slots, preserving nested aliases and cycles.
Constants, nonpublic slots, methods and one-sided accessors are omitted; source
classes decode as plain objects. Five separate host controls reject forged source
instances and unqualified source aliases, omit host descriptor overlays, preserve
getter exceptions and verify clone alias isolation. Source Date behavior remains
covered. Multiple getter ordering/mutation, registered source aliases and external
serialization are unqualified. This is a native object envelope, not AMF encoding.
