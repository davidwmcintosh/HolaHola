import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { createStartupReadinessGate } from "../startup-readiness-gate";

function captureResponse() {
  let statusCode: number | null = null;
  let payload: unknown = null;
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(body: unknown) {
      payload = body;
      return response;
    },
    setHeader() {
      return response;
    },
  } as unknown as Response;
  return {
    response,
    read: () => ({ statusCode, payload }),
  };
}

test("readiness handler exposes starting, ready, and failed without failure details", () => {
  const gate = createStartupReadinessGate();

  const starting = captureResponse();
  gate.readinessHandler({} as Request, starting.response);
  assert.deepEqual(starting.read(), {
    statusCode: 503,
    payload: { status: "starting" },
  });

  gate.markReady();
  const ready = captureResponse();
  gate.readinessHandler({} as Request, ready.response);
  assert.deepEqual(ready.read(), {
    statusCode: 200,
    payload: { status: "ready" },
  });

  gate.markFailed(new Error("private database failure"));
  const failed = captureResponse();
  gate.readinessHandler({} as Request, failed.response);
  assert.deepEqual(failed.read(), {
    statusCode: 503,
    payload: { status: "failed" },
  });
  assert.equal(JSON.stringify(failed.read()).includes("private database failure"), false);
});

test("existing deployment health exemption remains unchanged during startup", () => {
  const gate = createStartupReadinessGate();
  const response = captureResponse();
  let nextCalled = false;
  gate.middleware(
    { method: "GET", path: "/health" } as Request,
    response.response,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(nextCalled, false);
  assert.deepEqual(response.read(), {
    statusCode: 200,
    payload: { status: "starting" },
  });
});
