/**
 * Gemini Function Declarations for Daniela Commands
 * 
 * This file re-exports declarations and command mappings from the
 * unified Daniela Function Registry (daniela-function-registry.ts).
 * 
 * The registry is the SINGLE SOURCE OF TRUTH for all function definitions.
 * This file provides backward-compatible exports + the extractFunctionCalls
 * utility used by the Gemini streaming service.
 */

import { FunctionDeclaration } from "@google/genai";
import {
  DANIELA_FUNCTION_DECLARATIONS as REGISTRY_DECLARATIONS,
  FUNCTION_TO_COMMAND_MAP as REGISTRY_COMMAND_MAP,
  buildFunctionContinuationResponse,
  getFilteredFunctionDeclarations,
} from "./daniela-function-registry";

export {
  buildFunctionContinuationResponse,
  getFilteredFunctionDeclarations,
};

export const DANIELA_FUNCTION_DECLARATIONS: FunctionDeclaration[] = REGISTRY_DECLARATIONS;

export const FUNCTION_TO_COMMAND_MAP: Record<string, string> = REGISTRY_COMMAND_MAP;

/**
 * Create Gemini tools config with Daniela functions
 * @param allowedFunctions Optional allowlist of function names to include. If undefined, includes all.
 */
export function createDanielaTools(allowedFunctions?: string[]) {
  const declarations = getFilteredFunctionDeclarations(allowedFunctions);
  return [{
    functionDeclarations: declarations,
  }];
}

/**
 * Function call extracted from a streaming chunk
 * This is the canonical type used across the codebase
 */
export interface ExtractedFunctionCall {
  name: string;
  args: Record<string, unknown>;
  legacyType: string;
  /** Gemini 3 thought signature - MUST be passed back for multi-step function calling */
  thoughtSignature?: string;
}

/**
 * Extract function calls from a streaming chunk
 * Gemini 3 provides function_call in content parts
 * 
 * IMPORTANT: Gemini 3 includes thought_signature on function call parts.
 * For parallel function calls, only the FIRST functionCall part has the signature.
 * For sequential function calls (multi-step), EACH step has a signature.
 * These signatures MUST be passed back in subsequent requests.
 * 
 * @see https://docs.cloud.google.com/vertex-ai/generative-ai/docs/thought-signatures
 */
export function extractFunctionCalls(chunk: any): ExtractedFunctionCall[] {
  const calls: ExtractedFunctionCall[] = [];
  
  try {
    const parts = chunk?.candidates?.[0]?.content?.parts || [];
    
    for (const part of parts) {
      if (part.functionCall) {
        const name = part.functionCall.name;
        const args = part.functionCall.args || {};
        
        const thoughtSignature = part.thought_signature || 
                                  part.thoughtSignature || 
                                  part.metadata?.thought_signature ||
                                  part.metadata?.thoughtSignature ||
                                  undefined;
        
        calls.push({
          name,
          args,
          legacyType: FUNCTION_TO_COMMAND_MAP[name] || name.toUpperCase(),
          thoughtSignature,
        });
      }
    }
    
    const withSignatures = calls.filter(c => c.thoughtSignature);
    if (withSignatures.length > 0) {
      console.log(`[FunctionDeclarations] Extracted ${calls.length} function calls, ${withSignatures.length} with thought signatures`);
    }
  } catch (err) {
    console.error('[FunctionDeclarations] Error extracting function calls:', err);
  }
  
  return calls;
}
