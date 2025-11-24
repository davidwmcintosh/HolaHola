import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

/**
 * Custom error class for API errors with better error messages
 */
export class APIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Get user-friendly error message based on status code
 */
function getUserFriendlyErrorMessage(status: number, message: string): string {
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'Please log in to continue.';
    case 403:
      return "You don't have permission to perform this action.";
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'This action conflicts with existing data.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'Server error. Our team has been notified.';
    case 503:
      return 'Service temporarily unavailable. Please try again shortly.';
    default:
      if (status >= 500) {
        return 'A server error occurred. Please try again later.';
      }
      return message || 'An unexpected error occurred.';
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const userMessage = getUserFriendlyErrorMessage(res.status, text);
    throw new APIError(res.status, res.statusText, userMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    // Check if it's a network error (no response)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await fetch(queryKey.join("/") as string, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      // Check if it's a network error (no response)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  };

/**
 * Recursively check if an error or its cause chain contains an AbortError
 */
function isAbortError(error: unknown, depth: number = 0): boolean {
  // Prevent infinite recursion
  if (depth > 5) return false;
  
  if (error instanceof Error && error.name === 'AbortError') return true;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  
  // Recursively check error.cause chain
  if (error instanceof Error && 'cause' in error && error.cause) {
    return isAbortError(error.cause, depth + 1);
  }
  
  return false;
}

/**
 * Determine if an error should be retried
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  // Don't retry after 3 attempts
  if (failureCount >= 3) return false;
  
  // Don't retry aborted requests (recursively check cause chain)
  if (isAbortError(error)) return false;
  
  // Don't retry local errors (JSON parsing, type errors, etc.)
  if (error instanceof TypeError || error instanceof SyntaxError) {
    return false;
  }
  
  // Retry on specific HTTP status codes
  if (error instanceof APIError) {
    return error.status === 408 || // Request Timeout
           error.status === 429 || // Too Many Requests
           error.status === 503 || // Service Unavailable
           error.status === 504;   // Gateway Timeout
  }
  
  return false;
}

/**
 * Global error handler for queries
 */
function onQueryError(error: unknown) {
  console.error('Query error:', error);
  
  // Don't show toasts for 401 errors (handled by auth)
  if (error instanceof APIError && error.status === 401) {
    return;
  }
  
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  
  toast({
    variant: "destructive",
    title: "Error",
    description: message,
  });
}

/**
 * Global error handler for mutations
 */
function onMutationError(error: unknown) {
  console.error('Mutation error:', error);
  
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  
  toast({
    variant: "destructive",
    title: "Action Failed",
    description: message,
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: shouldRetry,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: shouldRetry,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      onError: onMutationError,
    },
  },
});
