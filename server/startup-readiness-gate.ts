import type { NextFunction, Request, Response } from "express";

type StartupState = "starting" | "ready" | "failed";

export interface StartupReadinessGate {
  middleware: (req: Request, res: Response, next: NextFunction) => void;
  markReady: () => void;
  markFailed: (error: unknown) => void;
  getState: () => StartupState;
}

export function createStartupReadinessGate(): StartupReadinessGate {
  let state: StartupState = "starting";
  let failureMessage = "Critical startup initialization failed";

  return {
    middleware(req, res, next) {
      if (state === "ready") {
        next();
        return;
      }

      if (state === "failed") {
        res.status(500).json({
          status: "failed",
          error: failureMessage,
        });
        return;
      }

      if (
        req.method === "GET"
        && (req.path === "/" || req.path === "/health")
      ) {
        res.status(200).json({ status: "starting" });
        return;
      }

      res.setHeader("Retry-After", "1");
      res.status(503).json({
        status: "starting",
        error: "Service initialization is still in progress",
      });
    },

    markReady() {
      state = "ready";
    },

    markFailed(error) {
      state = "failed";
      failureMessage = error instanceof Error ? error.message : String(error);
    },

    getState() {
      return state;
    },
  };
}