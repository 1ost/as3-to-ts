# Storage recovery checkpoint

The subsequent storage recovery attempt did not provide usable C: capacity.
C: reported zero available and total free bytes even after removal of two
generated reports whose exact bytes were verified in retained archives. No
source code, original AS3, captures, committed archive or Git pack was removed.
The cause of the unchanged free-space reading has not been established.

Current evidence locations:

- `.local/native-startup-proxy/run-P2wA0H/error-event-type-tests-candidate-report.json`
  remains readable at the original OP2 path. Its parent directory is now a
  junction to
  `D:/op2-urlrequest-type-tests-20261004/temp/restored-run-P2wA0H`.
  The exact 5,855,021 bytes match the committed archive. Keep that D: target.
- `.local/native-startup-proxy/run-z6KBn9/shape-return-candidate-report.json`
  remains unchanged. Both compression attempts failed; its bytes match the
  retained shape-return archive.
- `.local/native-startup-proxy/run-KSre30/initializer-candidate-report.json`
  is now archived only. Its exact 58,970,311 bytes are preserved in the tracked
  `game-client-laya/tests/startup-prompt-text-review/initializer-candidate.json.gz`.
  Restore this generated report before running a historical check that requires
  that expanded file. This is not a missing source or lost observation.

Verify the three archived reports and both live reports:

```
node tests/native-capabilities-readiness-audit/storage-recovery.cjs
```

Once C: has at least 67,358,919 free bytes, restore the older generated report:

```
node tests/native-capabilities-readiness-audit/storage-recovery.cjs --restore
```

The command authenticates archive pins and exact report hashes, refuses to
overwrite existing files, confines restoration to the original generated-output
directory, and checks free capacity before opening the destination. Leave the
latest-report junction in place; moving it back to C: is not required for
verification and would consume additional space.

At this checkpoint D: has about 2 MB free. The next AIR/browser/compiler
qualification cannot proceed with the existing output footprint. No production
provider or compiler behavior was changed. The policy-rejected temporary Git-pack
deletion was not retried.
