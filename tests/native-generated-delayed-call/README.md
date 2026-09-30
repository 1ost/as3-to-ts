# Imported two-argument delayed calls

The shared emitter routes exactly imported com.greensock.TweenMax.delayedCall(delay, callback) to the existing FlashTweenRuntime. The engine stays at d17b928f57bdf79f2825295409682662e789ae20; its GSAP package pins 13e2b790546426a1a2e0e9b409f3f8dc6d6611f2. This is the approved native GSAP migration, not source TweenMax Class authority.

The complete DelayedSubject.as is compiled unchanged into native source-Class factories. Original AIR WIN 51,3,4,2 executes that same subject with 34 maintained GreenSock sources (source-library.json). Both original captures, source hashes, SWF and receipt are retained. Nine complete observations compare deferred delivery, evaluation order, two bound receivers, zero delay, and cancellation by stable private method closure. The original driver moves returned Objects onto a paused SimpleTimeline using explicit TweenMax casts; the native observer supplies corresponding manual clock samples to FlashTweenRuntime. The driver is a comparison harness, not generated production code.

ES5 and ES2015 factories pass in Node and Chromium under script-src self, with zero generated-TypeScript diagnostics against actual providers. Fifteen guards preserve exact import ownership, shadowed/unimported names, opt-in behavior, construction/extraction rejection, TweenLite rejection, and unsupported argument counts. Two applied runtime controls force zero delay or ignore cancellation; each changes the expected trace in both realms. Existing 10-row control and 19-row handle suites also pass at this compiler, along with native-imported-tween guards.

Run with LAYA_ENGINE_REPOSITORY pointing to the pinned engine worktree:

    node node_modules/typescript/bin/tsc --pretty false
    node tests/native-generated-delayed-call/run.cjs
    node tests/native-generated-delayed-call/verify-runtime.cjs --check-current

runtime.json.gz preserves complete generated artifacts, observations, applied controls, compiler/runner/observer/input hashes and type results. regressions.json.gz retains the related fresh comparisons. verify.cjs authenticates both original captures and all source/artifact hashes. verify-runtime.cjs checks the retained reports; --check-current also checks local compiled dependency inputs.

Optional callback parameters/scope/frame overloads, TweenMax return declarations and source Class/reflection are not admitted. Negative/nonfinite delay and other unqualified values retain existing runtime boundaries. Whole Shell behavior, application clock integration and real game startup remain unqualified.
