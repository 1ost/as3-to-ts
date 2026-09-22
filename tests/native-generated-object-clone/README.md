# Complete source object-clone qualification probe (currently held)

Run node tests/native-generated-object-clone/run.cjs. This retains both complete
Base/Record sources from the engine native-object-clone AIR packet. It currently
emits Base unchanged and exits nonzero at Record dynamic source routing in
NativeGeneratedEmission. Public instance primitive literal constants are now
qualified by the separate native-generated-instance-constants AIR fixture. Do not remove the
constant, dynamic modifier, private fields or accessors to get a passing fixture.

Once prerequisites are established, the observer compares all 12 AIR observations
on ES5/ES2015 in Node/Chromium. It uses the actual common NativeObjectCodec, which
currently only qualifies the seven Date rows independently. Generated-field
serialization, registered aliases, complex getter ordering and Date prototype
behavior remain unfinished. This file is a reproducible investigation checkpoint,
not a passing test or completed compiler feature. No source implementations are
replaced by the observer.
