/**
 * Context Budget Service
 * 
 * Manages token estimation and trimming for beacon context.
 * Ensures Editor doesn't exceed Claude's context window limits.
 * 
 * Features:
 * - Token estimation (GPT-4 tokenizer approximation)
 * - Context trimming (oldest first)
 * - Budget allocation for different context types
 * - Priority-based trimming
 */

// Token budget configuration
const DEFAULT_CONTEXT_BUDGET = parseInt(process.env.EDITOR_CONTEXT_BUDGET || '8000', 10);
const SYSTEM_PROMPT_BUDGET = parseInt(process.env.EDITOR_SYSTEM_BUDGET || '2000', 10);
const RESPONSE_BUDGET = parseInt(process.env.EDITOR_RESPONSE_BUDGET || '1000', 10);

// Approximate tokens per character (GPT-4 average)
const TOKENS_PER_CHAR = 0.25;
const TOKENS_PER_WORD = 1.3;

export interface ContextItem {
  content: string;
  type: 'beacon' | 'history' | 'neural_knowledge' | 'session_context';
  priority: number; // Higher = more important (keep longer)
  timestamp: Date;
}

export interface TrimResult {
  items: ContextItem[];
  estimatedTokens: number;
  trimmedCount: number;
  originalCount: number;
}

export interface BudgetAllocation {
  systemPrompt: number;
  beacons: number;
  history: number;
  neuralKnowledge: number;
  sessionContext: number;
  response: number;
  total: number;
}

/**
 * Estimate tokens for a string (GPT-4 approximation)
 * More accurate than character-based but doesn't require tiktoken
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  
  // Split by whitespace to count words
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  
  // Base estimate from words
  let tokens = words.length * TOKENS_PER_WORD;
  
  // Add tokens for punctuation and special characters
  const punctuation = (text.match(/[.,!?;:'"()\[\]{}<>@#$%^&*+=|\\\/`~-]/g) || []).length;
  tokens += punctuation * 0.5;
  
  // Add tokens for numbers (often split into multiple tokens)
  const numbers = (text.match(/\d+/g) || []).length;
  tokens += numbers * 0.5;
  
  // Add tokens for non-ASCII characters (common in language learning context)
  const nonAscii = (text.match(/[^\x00-\x7F]/g) || []).length;
  tokens += nonAscii * 0.5;
  
  return Math.ceil(tokens);
}

/**
 * Get default budget allocation
 */
export function getDefaultBudgetAllocation(totalBudget: number = DEFAULT_CONTEXT_BUDGET): BudgetAllocation {
  const systemPrompt = SYSTEM_PROMPT_BUDGET;
  const response = RESPONSE_BUDGET;
  const available = totalBudget - systemPrompt - response;
  
  return {
    systemPrompt,
    beacons: Math.floor(available * 0.4),       // 40% for beacons
    history: Math.floor(available * 0.2),       // 20% for conversation history
    neuralKnowledge: Math.floor(available * 0.25), // 25% for neural network knowledge
    sessionContext: Math.floor(available * 0.15),  // 15% for session context
    response,
    total: totalBudget,
  };
}

/**
 * Trim context items to fit within token budget
 * Removes oldest items first, respecting priority
 */
export function trimToFitBudget(
  items: ContextItem[],
  budget: number
): TrimResult {
  const originalCount = items.length;
  
  if (items.length === 0) {
    return {
      items: [],
      estimatedTokens: 0,
      trimmedCount: 0,
      originalCount,
    };
  }
  
  // Sort by priority (desc) then by timestamp (desc - newer first)
  const sortedItems = [...items].sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return b.timestamp.getTime() - a.timestamp.getTime();
  });
  
  // Calculate tokens for each item
  const itemsWithTokens = sortedItems.map(item => ({
    ...item,
    tokens: estimateTokens(item.content),
  }));
  
  // Greedily select items that fit
  const selected: ContextItem[] = [];
  let totalTokens = 0;
  
  for (const item of itemsWithTokens) {
    if (totalTokens + item.tokens <= budget) {
      selected.push(item);
      totalTokens += item.tokens;
    }
  }
  
  // Re-sort by timestamp (oldest first) for chronological presentation
  selected.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  return {
    items: selected,
    estimatedTokens: totalTokens,
    trimmedCount: originalCount - selected.length,
    originalCount,
  };
}

/**
 * Trim a list of text items (simpler interface for common use case)
 */
export function trimTextItems(
  texts: string[],
  budget: number,
  type: ContextItem['type'] = 'beacon',
  priority: number = 1
): { texts: string[]; estimatedTokens: number; trimmedCount: number } {
  const items: ContextItem[] = texts.map((content, idx) => ({
    content,
    type,
    priority,
    timestamp: new Date(Date.now() - (texts.length - idx) * 1000), // Simulate chronological order
  }));
  
  const result = trimToFitBudget(items, budget);
  
  return {
    texts: result.items.map(i => i.content),
    estimatedTokens: result.estimatedTokens,
    trimmedCount: result.trimmedCount,
  };
}

/**
 * Format beacons for Editor context with budget management
 */
export function formatBeaconsForContext(
  beacons: Array<{
    tutorTurn: string;
    studentTurn?: string | null;
    beaconType: string;
    beaconReason?: string | null;
    createdAt: Date;
  }>,
  budget: number
): { formatted: string; estimatedTokens: number; includedCount: number } {
  // Convert beacons to context items
  const items: ContextItem[] = beacons.map(beacon => {
    let content = `[${beacon.beaconType}]\n`;
    content += `Tutor: ${beacon.tutorTurn}\n`;
    if (beacon.studentTurn) {
      content += `Student: ${beacon.studentTurn}\n`;
    }
    if (beacon.beaconReason) {
      content += `Reason: ${beacon.beaconReason}\n`;
    }
    
    return {
      content,
      type: 'beacon' as const,
      priority: getPriorityForBeaconType(beacon.beaconType),
      timestamp: beacon.createdAt,
    };
  });
  
  const result = trimToFitBudget(items, budget);
  
  const formatted = result.items
    .map(item => item.content)
    .join('\n---\n');
  
  return {
    formatted,
    estimatedTokens: result.estimatedTokens,
    includedCount: result.items.length,
  };
}

/**
 * Get priority for beacon types (higher = more important)
 */
function getPriorityForBeaconType(beaconType: string): number {
  const priorities: Record<string, number> = {
    'self_surgery_proposal': 5, // Highest priority
    'breakthrough': 4,
    'student_struggle': 4,
    'teaching_moment': 3,
    'correction': 3,
    'tool_usage': 2,
    'vocabulary_intro': 2,
    'cultural_insight': 2,
  };
  
  return priorities[beaconType] ?? 1;
}

/**
 * Estimate total tokens for Editor conversation
 */
export function estimateConversationTokens(
  systemPrompt: string,
  beacons: string,
  history: string,
  neuralKnowledge: string
): { total: number; breakdown: Record<string, number> } {
  const breakdown = {
    systemPrompt: estimateTokens(systemPrompt),
    beacons: estimateTokens(beacons),
    history: estimateTokens(history),
    neuralKnowledge: estimateTokens(neuralKnowledge),
  };
  
  return {
    total: Object.values(breakdown).reduce((a, b) => a + b, 0),
    breakdown,
  };
}

/**
 * Check if content fits within budget
 */
export function fitsInBudget(content: string, budget: number): boolean {
  return estimateTokens(content) <= budget;
}

/**
 * Truncate text to fit token budget
 */
export function truncateToFit(text: string, budget: number): { text: string; truncated: boolean } {
  const currentTokens = estimateTokens(text);
  
  if (currentTokens <= budget) {
    return { text, truncated: false };
  }
  
  // Estimate characters per token and calculate target length
  const charsPerToken = text.length / currentTokens;
  const targetChars = Math.floor(budget * charsPerToken * 0.9); // 10% safety margin
  
  // Truncate with ellipsis
  const truncated = text.slice(0, targetChars) + '...';
  
  return { text: truncated, truncated: true };
}
