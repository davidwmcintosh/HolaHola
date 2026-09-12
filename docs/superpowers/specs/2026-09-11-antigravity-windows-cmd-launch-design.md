# Antigravity Windows Command-Launch Repair

## Scope

Repair the bounded Gate 3 Windows executor after the first production attempt
failed before starting its fixed test command. Do not broaden task 1448, add an
installer, productize the coordinator, or change Windows' permitted edit path.

## Observed failure

The canonical record proves the attempt:

1. exchanged and consumed the one-shot DPAPI bootstrap;
2. received a short-lived broker credential;
3. created and consumed the assignment packet;
4. acquired and renewed a claim;
5. accepted one `run_test` model intent; and
6. violated the claim with `rejected_tool_result` before creating an execution.

The rejection occurred about one second after renewal. The executor maps the
logical `npx` command to `npx.cmd` on Windows, then tries to start that command
shim with `shell: false`. Windows does not directly execute `.cmd` shims through
that process-launch path.

The failed bootstrap, packet receipt, claim, and ownership authority are spent.
They must remain immutable evidence and must not be reused or repaired.

## Selected design

Keep the logical command contract unchanged:

```text
npx tsx server/scripts/test-coordination-runtime.test.ts
```

The executor must continue to validate the complete logical argument array
against the fixed allowlist before adapting it for the host operating system.

On Windows only, after successful validation:

1. map `npx` to `npx.cmd` as today;
2. invoke the Windows command interpreter explicitly with `/d /s /c`;
3. keep Node's `shell` option disabled for that interpreter process;
4. pass only the fixed, validated command and arguments;
5. do not concatenate provider-, task-, model-, or user-controlled text; and
6. preserve the logical `npx tsx ...` array in execution evidence.

Non-Windows process launching remains unchanged.

## Security boundary

The command interpreter is a Windows execution adapter, not a new command
authority. The exact logical allowlist remains authoritative.

- `/d` disables command-processor AutoRun hooks.
- The command name, arguments, target path, and command order are fixed.
- No arbitrary command string enters the interpreter.
- The child receives the existing reduced environment.
- Fixed actor credentials remain prohibited.
- Bootstrap credentials remain one-shot, DPAPI `CurrentUser` protected, and
  absent from output, arguments, files other than the protected store, chat,
  and receipts.
- This design does not claim containment against malicious software already
  running as the same Windows user.

## Regression proof

Add focused tests proving:

1. Windows `run_test` launches the interpreter with the fixed safe flags and
   fixed `npx.cmd tsx` arguments.
2. Evidence still records the exact logical `npx tsx` command.
3. Non-Windows launch behavior is unchanged.
4. Commands and arguments outside the allowlist remain rejected.
5. A normal nonzero fixed-test exit is recorded rather than treated as a spawn
   failure.
6. The two unauthorized same-runtime/different-profile claims still return
   `consumption_not_authorized`.
7. The bounded driver, Windows launcher, public-bundle, and end-to-end suites
   pass.

## New bundle lifecycle

The installed runtime bundle is hash-pinned and contains the defective driver.
It cannot be reused.

After implementation and unconditional independent approval:

1. commit and publish a new approved source snapshot;
2. generate and verify a new hash-pinned runtime bundle and public provisioning
   bundle;
3. deploy the corrected coordinator;
4. update Windows to the exact new approved commit and confirm a clean worktree;
5. run `initialize` and `prepare` once for the replacement bootstrap;
6. complete a fresh explicit founder approval and Phase B registration;
7. create a fresh assignment/window under current authority; and
8. run the bounded Windows launcher exactly once.

Task 1449 remains cancelled.