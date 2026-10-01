import type OpenAI from 'openai';
import type { ResponseCreateParamsBase } from 'openai/resources/responses/responses';
import {
  RuntimeOnboardingClient,
  type RuntimeOpenAIResponsesPolicy,
  type RuntimeOpenAIResponsesResult,
} from './runtime-onboarding-client';
import type { RuntimeOnboardingFetch } from './runtime-onboarding-client';
import {
  createNativeRuntimeOnboardingStore,
  HostedRuntimeOnboardingStore,
} from './runtime-onboarding-store';
import type {
  HostedSecretStoreAdapter,
  RuntimeOnboardingStore,
} from './runtime-onboarding-store';

export {
  RuntimeOnboardingClient,
  createNativeRuntimeOnboardingStore,
  HostedRuntimeOnboardingStore,
};
export type {
  HostedSecretStoreAdapter,
  RuntimeOnboardingStore,
  RuntimeOpenAIResponsesPolicy,
  RuntimeOpenAIResponsesResult,
};

export type RuntimeOpenAIResponsesClientOptions = {
  endpoint: string;
  actor: string;
  runtimeId: string;
  store: RuntimeOnboardingStore;
  /** Already-authorized OpenAI SDK instance; its API key remains host-managed. */
  sdk: Pick<OpenAI, 'responses'>;
  /** Optional narrowing only; remote MCP approval is always required. */
  policy?: RuntimeOpenAIResponsesPolicy;
  fetchImpl?: RuntimeOnboardingFetch;
  /** Only isolated fake-endpoint tests should enable plain HTTP. */
  allowInsecureHttpForTests?: boolean;
};

export type RuntimeOpenAIResponsesClient = {
  responses: {
    create(request: ResponseCreateParamsBase): Promise<RuntimeOpenAIResponsesResult>;
  };
};

/**
 * Adapt an authorized OpenAI SDK client to the enrolled coordination MCP
 * server. The returned API contains no credential or secret-bearing config.
 */
export function createRuntimeOpenAIResponsesClient(
  options: RuntimeOpenAIResponsesClientOptions,
): RuntimeOpenAIResponsesClient {
  const onboarding = new RuntimeOnboardingClient({
    endpoint: options.endpoint,
    actor: options.actor,
    runtimeId: options.runtimeId,
    store: options.store,
    fetchImpl: options.fetchImpl,
    allowInsecureHttpForTests: options.allowInsecureHttpForTests,
  });
  return {
    responses: {
      create: (request) => onboarding.createOpenAIResponse(options.sdk, request, options.policy),
    },
  };
}