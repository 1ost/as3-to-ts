# IO and security error-event references

This fixture emits the unchanged `model.TypeProbe` from the engine's independent
23-row AIR oracle at `7772311e362185a9c81d0eb15e00a84ac5a8f624`.
It compares every row in Node and CSP Chromium for ES5 and ES2015 and typechecks
all generated sources. The observer supplies native host events and genuine
subclasses; it does not emulate the subject's reference operations.

`nativeErrorEventSubtypeReferenceModule` requires exact canonical providers for
both `flash.events.IOErrorEvent` and `flash.events.SecurityErrorEvent`. It lowers
method-body `is`, `as`, single-argument explicit casts, and `text` reads on typed
locals or explicit casts. It leaves the existing ErrorEvent constructor-parameter
option unchanged. Fourteen compiler guards cover provider mismatches, missing
authority, copied plans, shadowing, invalid cast arity, construction, unqualified
members, writes, computed reads, direct `as`-result member reads, and initializers.
An applied compiler control restores the old reference-operation restriction and
must reject the original subject.

Run `node tests/native-generated-error-event-references/run.cjs`, then verify the
retained result with `node tests/native-generated-error-event-references/verify-runtime.cjs
--check-current`. The default engine worktree is `../LayaAir-op2-error-event-review`;
`LAYA_ENGINE_REPOSITORY` can override its location without changing the pinned
original source evidence.

This is not startup qualification, source subclass emission, complete Class
reflection, transport, or security-policy implementation.
