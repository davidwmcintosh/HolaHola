import assert from "node:assert/strict";
import test from "node:test";
import {
  computeCoordinationPublicMaterialDigest,
  isContainedPath,
  prepareCoordinationWindowsGeneration,
} from "./coordination-windows-prepare";

function storage() {
  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>(["C:"]);
  return {
    files, dirs,
    inspect: (path: string) => ({ exists: dirs.has(path) || files.has(path), isDirectory: dirs.has(path), reparseFree: true, aclSafe: true }),
    mkdir: (path: string) => { dirs.add(path); },
    write: (path: string, bytes: Uint8Array) => { files.set(path, bytes.slice()); },
    read: (path: string) => files.get(path)?.slice() ?? new Uint8Array(),
    atomicReplace: (from: string, to: string) => {
      const bytes = files.get(from);
      if (!bytes) throw new Error("missing_temp");
      files.delete(from);
      files.set(to, bytes);
    },
    rename: (from: string, to: string) => {
      if (dirs.has(from)) { dirs.delete(from); dirs.add(to); }
      for (const directory of [...dirs]) {
        if (directory.startsWith(`${from}/`)) {
          dirs.delete(directory);
          dirs.add(`${to}${directory.slice(from.length)}`);
        }
      }
      for (const [path, bytes] of [...files]) {
        if (path.startsWith(`${from}/`)) {
          files.delete(path);
          files.set(`${to}${path.slice(from.length)}`, bytes);
        }
      }
      const bytes = files.get(from);
      if (bytes) { files.delete(from); files.set(to, bytes); }
    },
    remove: (path: string) => { dirs.delete(path); files.delete(path); },
  };
}

const artifacts = { "public.json": new TextEncoder().encode('{"ok":true}') };
const reservation = {
  id: "reservation-1", sessionId: "session-1", enrolledHostId: "host-1",
  generationId: "generation-1", reservationDigest: "a".repeat(64),
  publicMaterialDigest: computeCoordinationPublicMaterialDigest(artifacts),
  protocolVersion: 1 as const,
};

test("path containment is flavor-aware for POSIX, drive, and UNC fixtures", () => {
  const fixtures: Array<[string, string, boolean]> = [
    ["/srv/coordinator", "/srv/coordinator/generation-1/active", true],
    ["/srv/coordinator", "/srv/coordinator-other/active", false],
    ["/srv/coordinator", "/srv/coordinator/../escape", false],
    ["C:", "C:/Hola/Coordinator/generation-1/active", true],
    ["C:\\Hola\\Coordinator", "C:\\Hola\\Coordinator\\generation-1\\active", true],
    ["C:\\Hola\\Coordinator", "C:\\Hola\\Coordinator\\..\\escape", false],
    ["C:\\Hola\\Coordinator", "D:\\Hola\\Coordinator\\generation-1", false],
    ["\\\\server\\share\\Coordinator", "\\\\server\\share\\Coordinator\\generation-1", true],
    ["\\\\server\\share\\Coordinator", "\\\\server\\other\\Coordinator\\generation-1", false],
    ["/srv/coordinator", "/srv/coordinator\\..\\escape", false],
  ];
  for (const [root, candidate, expected] of fixtures) {
    assert.equal(isContainedPath(root, candidate), expected, `${root} -> ${candidate}`);
  }
  assert.equal(isContainedPath("/srv/coordinator", "/srv/coordinator"), false);
  assert.equal(isContainedPath("/srv/coordinator", "/srv/coordinator", true), true);
});

test("pre-promotion write fault removes staging and never changes active pointer", async () => {
  const fs = storage();
  fs.files.set("C:/active", new TextEncoder().encode("old-generation"));
  const plain = new Uint8Array([1, 3, 3, 7]);
  let failed = false;
  await assert.rejects(() => prepareCoordinationWindowsGeneration({
    reservation, root: "C:", activePointer: "C:/active", publicArtifacts: artifacts,
    secretPlaintext: plain,
    dependencies: {
      storage: fs,
      protect: () => new Uint8Array([1, 2, 3]),
      server: { promote: async () => undefined, acknowledge: async () => undefined, recover: async () => ({ state: "promoted" }), fail: async () => { failed = true; } },
      fault: { beforeWrite: (_path, index) => { if (index === 0) throw new Error("write"); } },
    },
    acknowledgementRequestKey: "ack-1", safePromotionEvidenceDigest: "b".repeat(64),
  }));
  assert.equal(new TextDecoder().decode(fs.files.get("C:/active")), "old-generation");
  assert.equal(failed, true);
  assert.equal(fs.dirs.has("C:/.staging-generation-1"), false);
  assert.deepEqual([...plain], [0, 0, 0, 0]);
});

test("acknowledgement loss recovers and retries the exact generation", async () => {
  const fs = storage();
  let acknowledgements = 0;
  const plain = new Uint8Array([9, 8, 7]);
  const result = await prepareCoordinationWindowsGeneration({
    reservation, root: "C:", activePointer: "C:/active", publicArtifacts: artifacts,
    secretPlaintext: plain,
    dependencies: {
      storage: fs, protect: (plain) => new Uint8Array([plain.byteLength]),
      server: {
        promote: async () => undefined,
        acknowledge: async () => { acknowledgements++; if (acknowledgements === 1) throw new Error("lost"); },
        recover: async () => ({ state: "promoted" }),
      },
    },
    acknowledgementRequestKey: "ack-1", safePromotionEvidenceDigest: "b".repeat(64),
  });
  assert.equal(result.state, "acknowledged");
  assert.equal(result.generationId, reservation.generationId);
  assert.equal(acknowledgements, 2);
  assert.equal(new TextDecoder().decode(fs.files.get("C:/active")), "generation-1");
  assert.deepEqual([...plain], [0, 0, 0]);
});

test("generation promotion retries after active-pointer replacement loss", async () => {
  const fs = storage();
  let replaceCalls = 0;
  const originalReplace = fs.atomicReplace;
  fs.atomicReplace = (from: string, to: string) => {
    replaceCalls += 1;
    if (replaceCalls === 1) throw new Error("pointer-replace-lost");
    originalReplace(from, to);
  };
  let promotes = 0;
  const input = {
    reservation, root: "C:", activePointer: "C:/active", publicArtifacts: artifacts,
    secretPlaintext: new Uint8Array([4, 5]),
    dependencies: {
      storage: fs,
      protect: () => new Uint8Array([8, 8]),
      server: {
        promote: async () => { promotes += 1; },
        acknowledge: async () => undefined,
        recover: async () => ({ state: "promoted" }),
        fail: async () => undefined,
      },
    },
    acknowledgementRequestKey: "ack-retry", safePromotionEvidenceDigest: "c".repeat(64),
  };
  const first = await prepareCoordinationWindowsGeneration(input);
  assert.equal(first.state, "promoted");
  assert.equal(promotes, 0);
  const second = await prepareCoordinationWindowsGeneration(input);
  assert.equal(second.state, "acknowledged");
  assert.equal(promotes, 1);
  assert.equal(new TextDecoder().decode(fs.files.get("C:/active")), "generation-1");
  fs.files.set("C:/generation-1/protected.bin", new Uint8Array([0]));
  await assert.rejects(
    () => prepareCoordinationWindowsGeneration(input),
    (error: unknown) => (error as Error).message === "preparation_error",
  );
});

test("public material digest is deterministic and differs on drift", () => {
  assert.equal(computeCoordinationPublicMaterialDigest({ a: "one", b: "two" }),
    computeCoordinationPublicMaterialDigest({ b: "two", a: "one" }));
  assert.notEqual(computeCoordinationPublicMaterialDigest({ a: "one" }),
    computeCoordinationPublicMaterialDigest({ a: "two" }));
});
