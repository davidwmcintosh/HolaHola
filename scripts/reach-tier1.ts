#!/usr/bin/env tsx
/**
 * OpenAI Tier 1 Spending Script
 * 
 * This script helps you reach Tier 1 by spending $5 on the OpenAI API.
 * It uses GPT-4o-mini (the cheapest model) to efficiently reach the threshold.
 * 
 * Cost breakdown:
 * - GPT-4o-mini: $0.15/1M input tokens, $0.60/1M output tokens
 * - To spend $5: Need ~8.3M output tokens
 * 
 * Usage: npm run reach-tier1
 */

import 'dotenv/config';

const OPENAI_API_KEY = process.env.USER_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const TARGET_SPEND = 5.00; // $5 to reach Tier 1
const MODEL = 'gpt-4o-mini';

// Pricing for GPT-4o-mini (per 1M tokens)
const PRICE_INPUT = 0.15;
const PRICE_OUTPUT = 0.60;

interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  callCount: number;
}

const stats: UsageStats = {
  inputTokens: 0,
  outputTokens: 0,
  totalCost: 0,
  callCount: 0,
};

function calculateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens * PRICE_INPUT / 1_000_000) + (outputTokens * PRICE_OUTPUT / 1_000_000);
}

function printStats() {
  console.log('\n📊 Current Statistics:');
  console.log(`   Calls made: ${stats.callCount}`);
  console.log(`   Input tokens: ${stats.inputTokens.toLocaleString()}`);
  console.log(`   Output tokens: ${stats.outputTokens.toLocaleString()}`);
  console.log(`   Total cost: $${stats.totalCost.toFixed(4)}`);
  console.log(`   Progress: ${((stats.totalCost / TARGET_SPEND) * 100).toFixed(1)}%`);
  console.log(`   Remaining: $${(TARGET_SPEND - stats.totalCost).toFixed(4)}\n`);
}

async function makeApiCall(topic: string): Promise<void> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: `Write a detailed, comprehensive 800-word essay about: ${topic}. Include specific examples, analysis, and conclusions.`
          }
        ],
        max_tokens: 1500, // Generate substantial output to spend efficiently
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const usage = data.usage;

    const inputTokens = usage.prompt_tokens;
    const outputTokens = usage.completion_tokens;
    const cost = calculateCost(inputTokens, outputTokens);

    stats.inputTokens += inputTokens;
    stats.outputTokens += outputTokens;
    stats.totalCost += cost;
    stats.callCount++;

    console.log(`✓ Call ${stats.callCount}: +$${cost.toFixed(6)} (${inputTokens} in / ${outputTokens} out)`);

  } catch (error: any) {
    console.error(`❌ Error on call ${stats.callCount + 1}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 OpenAI Tier 1 Spending Script');
  console.log('================================\n');
  console.log(`Target: Spend $${TARGET_SPEND} to unlock Tier 1`);
  console.log(`Model: ${MODEL}`);
  console.log(`Pricing: $${PRICE_INPUT}/1M input, $${PRICE_OUTPUT}/1M output\n`);

  if (!OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY or USER_OPENAI_API_KEY not found in environment');
    console.error('Please set your OpenAI API key in .env file');
    process.exit(1);
  }

  console.log('Starting API calls...\n');

  // Topics to generate essays about (for variety)
  const topics = [
    'The history of artificial intelligence and machine learning',
    'Climate change and its impact on global ecosystems',
    'The evolution of programming languages',
    'Modern architecture and urban planning',
    'The future of renewable energy',
    'Digital privacy in the modern age',
    'Space exploration and colonization',
    'The impact of social media on society',
    'Quantum computing fundamentals',
    'Biotechnology and genetic engineering',
    'The psychology of decision making',
    'Ancient civilizations and their technologies',
    'Neuroscience and brain function',
    'Economic theories and global markets',
    'Philosophy of consciousness',
  ];

  let topicIndex = 0;

  try {
    while (stats.totalCost < TARGET_SPEND) {
      const topic = topics[topicIndex % topics.length];
      await makeApiCall(topic);
      
      topicIndex++;

      // Print stats every 10 calls
      if (stats.callCount % 10 === 0) {
        printStats();
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n🎉 SUCCESS! Target reached!\n');
    printStats();
    
    console.log('✅ Next Steps:');
    console.log('   1. Check your usage tier at: https://platform.openai.com/settings/organization/limits');
    console.log('   2. Tier upgrade can take up to 7 days to process');
    console.log('   3. Once upgraded to Tier 1, voice chat will work automatically!');
    console.log('   4. Tier 1 unlocks: 200 RPM, 1,000 RPD, 40,000 TPM for Realtime API\n');

  } catch (error: any) {
    console.error('\n❌ Script failed:', error.message);
    console.log('\nSpending progress before error:');
    printStats();
    process.exit(1);
  }
}

main();
