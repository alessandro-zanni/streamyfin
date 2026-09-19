# bun's mock.module is process-wide, so one test file can break another

**Date**: 2026-09-20
**Category**: testing
**Key files**: `utils/downloadSize.ts`, `utils/downloadSize.test.ts`

## Detail

`mock.module("@/providers/JellyfinProvider", …)` in one test file replaces that module for
every file in the same `bun test` run, not just the file that called it. A test that
mocked the providers behind `utils/download.ts` to reach the pure size math next to them
took 26 unrelated tests down with it, all of them files that import those providers for
real. On its own the file passed, which is what makes this one expensive to find: run
`bun run test:unit`, not the single file, before believing a test is green.

The fix is not a better mock. A pure helper living beside a hook is the actual problem, so
the helper moves to a module with no imports — here `utils/downloadSize.ts`, split out of
`utils/download.ts`, which kept the hook and its default export — and the test imports it
directly with no mocks at all.
