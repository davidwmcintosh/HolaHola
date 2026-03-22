/**
 * Cost Tracker
 *
 * Tracks approximate AI token costs across all LLM providers.
 * Maintains a rolling in-memory window and provides summary methods
 * for Lyra's reporting cycle.
 */

interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  label: string;
}

const PRICING: Record<string, ModelPricing> = {
  'gemini-3-flash-preview': { inputPerMillion: 0.075, outputPerMillion: 0.30,  label: 'Gemini Flash'   },
  'gemini-3-pro-preview':   { inputPerMillion: 3.50,  outputPerMillion: 10.50, label: 'Gemini Pro'     },
  'claude-sonnet-4-5':      { inputPerMillion: 3.00,  outputPerMillion: 15.00, label: 'Claude Sonnet'  },
  'claude-opus-4-6':        { inputPerMillion: 15.00, outputPerMillion: 75.00, label: 'Claude Opus'    },
  'gpt-4o':                 { inputPerMillion: 2.50,  outputPerMillion: 10.00, label: 'GPT-4o'         },
  'gpt-4o-mini':            { inputPerMillion: 0.15,  outputPerMillion: 0.60,  label: 'GPT-4o Mini'   },
  'gpt-4':                  { inputPerMillion: 30.00, outputPerMillion: 60.00, label: 'GPT-4'          },
};

interface CostEntry {
  timestamp: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  context?: string;
}

export interface CostSummary {
  windowHours: number;
  totalCostUsd: number;
  callCount: number;
  byModel: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }>;
  mostExpensiveModel: string | null;
  avgCostPerCall: number;
}

const MAX_ENTRIES = 10_000;

class CostTracker {
  private entries: CostEntry[] = [];
  private devAutoResolvedCount = 0;

  track(model: string, inputTokens: number, outputTokens: number, context?: string): number {
    const pricing = PRICING[model];
    const costUsd = pricing
      ? (inputTokens / 1_000_000) * pricing.inputPerMillion +
        (outputTokens / 1_000_000) * pricing.outputPerMillion
      : 0;

    this.entries.push({ timestamp: Date.now(), model, inputTokens, outputTokens, costUsd, context });
    if (this.entries.length > MAX_ENTRIES) this.entries = this.entries.slice(-MAX_ENTRIES);
    return costUsd;
  }

  incrementDevAutoResolved() {
    this.devAutoResolvedCount++;
  }

  getDevAutoResolvedCount(): number {
    return this.devAutoResolvedCount;
  }

  resetDevAutoResolvedCount() {
    this.devAutoResolvedCount = 0;
  }

  private getWindow(hours: number): CostEntry[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.entries.filter(e => e.timestamp >= cutoff);
  }

  getSummary(hours = 24): CostSummary {
    const window = this.getWindow(hours);
    const byModel: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }> = {};
    let totalCostUsd = 0;

    for (const e of window) {
      totalCostUsd += e.costUsd;
      if (!byModel[e.model]) byModel[e.model] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
      byModel[e.model].calls++;
      byModel[e.model].inputTokens += e.inputTokens;
      byModel[e.model].outputTokens += e.outputTokens;
      byModel[e.model].costUsd += e.costUsd;
    }

    const mostExpensiveModel = Object.entries(byModel)
      .sort((a, b) => b[1].costUsd - a[1].costUsd)[0]?.[0] || null;

    return {
      windowHours: hours,
      totalCostUsd,
      callCount: window.length,
      byModel,
      mostExpensiveModel,
      avgCostPerCall: window.length > 0 ? totalCostUsd / window.length : 0,
    };
  }

  formatForReport(hours = 12): string {
    const s = this.getSummary(hours);
    if (s.callCount === 0) return `No AI calls tracked in the last ${hours}h.`;

    const modelLines = Object.entries(s.byModel)
      .sort((a, b) => b[1].costUsd - a[1].costUsd)
      .map(([model, stats]) => {
        const label = PRICING[model]?.label || model;
        const tokensIn  = (stats.inputTokens  / 1000).toFixed(1);
        const tokensOut = (stats.outputTokens / 1000).toFixed(1);
        return `  ${label}: ${stats.calls} call(s), ${tokensIn}k in / ${tokensOut}k out → ~$${stats.costUsd.toFixed(4)}`;
      });

    const perCallLine = s.avgCostPerCall > 0 ? ` | avg $${s.avgCostPerCall.toFixed(5)}/call` : '';
    const devNote = this.devAutoResolvedCount > 0
      ? `\n  Dev runtime faults auto-resolved this window: ${this.devAutoResolvedCount}`
      : '';

    return [
      `**AI Cost Report (last ${hours}h):** ~$${s.totalCostUsd.toFixed(4)} across ${s.callCount} call(s)${perCallLine}`,
      ...modelLines,
      devNote,
    ].filter(Boolean).join('\n');
  }
}

export const costTracker = new CostTracker();
