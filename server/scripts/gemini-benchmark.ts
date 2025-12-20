/**
 * Gemini Model Benchmark Script
 * 
 * Compares latency between gemini-2.5-flash and gemini-3-flash-preview
 * Measures TTFT (Time to First Token) and total response time.
 */

import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const BASE_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

if (!API_KEY) {
  console.error("Missing AI_INTEGRATIONS_GEMINI_API_KEY");
  process.exit(1);
}

const genAI = new GoogleGenAI({
  apiKey: API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: BASE_URL || '',
  },
});

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash"
];

const TEST_PROMPTS = [
  {
    name: "Simple greeting",
    prompt: "Respond naturally as a Spanish tutor named Daniela to: 'Hola, como estas?'"
  },
  {
    name: "Vocabulary help",
    prompt: "As a Spanish tutor, explain the difference between 'ser' and 'estar' briefly."
  },
  {
    name: "Conversational turn",
    prompt: "You are Daniela, a friendly Spanish tutor. The student just said 'I went to the store yesterday'. Give a brief encouraging response and ask a follow-up question in Spanish."
  },
  {
    name: "Error correction",
    prompt: "As a Spanish tutor, gently correct this sentence and explain: 'Yo soy cansado hoy'"
  }
];

const ITERATIONS = 3;

interface BenchmarkResult {
  model: string;
  prompt: string;
  ttft: number;
  totalTime: number;
  outputTokens: number;
  tokensPerSecond: number;
  error?: string;
}

async function benchmarkModel(
  model: string,
  promptName: string,
  promptText: string
): Promise<BenchmarkResult> {
  const startTime = performance.now();
  let ttft = 0;
  let outputTokens = 0;
  let fullResponse = "";

  try {
    const response = await genAI.models.generateContentStream({
      model,
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      config: {
        maxOutputTokens: 150,
        temperature: 0.7
      }
    });

    let firstChunkReceived = false;

    for await (const chunk of response) {
      if (!firstChunkReceived) {
        ttft = performance.now() - startTime;
        firstChunkReceived = true;
      }
      const text = chunk.text || "";
      fullResponse += text;
    }

    const totalTime = performance.now() - startTime;
    outputTokens = Math.ceil(fullResponse.length / 4);
    const tokensPerSecond = outputTokens / (totalTime / 1000);

    return {
      model,
      prompt: promptName,
      ttft: Math.round(ttft),
      totalTime: Math.round(totalTime),
      outputTokens,
      tokensPerSecond: Math.round(tokensPerSecond)
    };
  } catch (error: any) {
    return {
      model,
      prompt: promptName,
      ttft: 0,
      totalTime: 0,
      outputTokens: 0,
      tokensPerSecond: 0,
      error: error.message
    };
  }
}

async function runBenchmark() {
  console.log("=".repeat(80));
  console.log("GEMINI MODEL BENCHMARK: 2.5 Flash vs 3.0 Flash");
  console.log("=".repeat(80));
  console.log(`Running ${ITERATIONS} iterations per prompt\n`);

  const allResults: BenchmarkResult[] = [];

  for (const model of MODELS) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`Testing: ${model}`);
    console.log("─".repeat(60));

    for (const { name, prompt } of TEST_PROMPTS) {
      const iterResults: BenchmarkResult[] = [];
      
      for (let i = 0; i < ITERATIONS; i++) {
        process.stdout.write(`  ${name} (iter ${i + 1}/${ITERATIONS})... `);
        const result = await benchmarkModel(model, name, prompt);
        iterResults.push(result);
        
        if (result.error) {
          console.log(`ERROR: ${result.error}`);
        } else {
          console.log(`TTFT: ${result.ttft}ms, Total: ${result.totalTime}ms`);
        }
        
        await new Promise(r => setTimeout(r, 500));
      }

      allResults.push(...iterResults);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY STATISTICS");
  console.log("=".repeat(80));

  for (const model of MODELS) {
    const modelResults = allResults.filter(r => r.model === model && !r.error);
    
    if (modelResults.length === 0) {
      console.log(`\n${model}: No successful results`);
      continue;
    }

    const avgTtft = modelResults.reduce((sum, r) => sum + r.ttft, 0) / modelResults.length;
    const avgTotal = modelResults.reduce((sum, r) => sum + r.totalTime, 0) / modelResults.length;
    const avgTps = modelResults.reduce((sum, r) => sum + r.tokensPerSecond, 0) / modelResults.length;
    
    const minTtft = Math.min(...modelResults.map(r => r.ttft));
    const maxTtft = Math.max(...modelResults.map(r => r.ttft));
    const minTotal = Math.min(...modelResults.map(r => r.totalTime));
    const maxTotal = Math.max(...modelResults.map(r => r.totalTime));

    console.log(`\n┌─────────────────────────────────────────────────────────┐`);
    console.log(`│ ${model.padEnd(55)} │`);
    console.log(`├─────────────────────────────────────────────────────────┤`);
    console.log(`│ Time to First Token (TTFT):                             │`);
    console.log(`│   Average: ${String(Math.round(avgTtft)).padStart(5)}ms   Min: ${String(minTtft).padStart(5)}ms   Max: ${String(maxTtft).padStart(5)}ms   │`);
    console.log(`│ Total Response Time:                                    │`);
    console.log(`│   Average: ${String(Math.round(avgTotal)).padStart(5)}ms   Min: ${String(minTotal).padStart(5)}ms   Max: ${String(maxTotal).padStart(5)}ms   │`);
    console.log(`│ Tokens/Second: ${String(Math.round(avgTps)).padStart(5)}                                      │`);
    console.log(`│ Successful runs: ${modelResults.length}/${allResults.filter(r => r.model === model).length}                                      │`);
    console.log(`└─────────────────────────────────────────────────────────┘`);
  }

  const flash25 = allResults.filter(r => r.model === "gemini-2.5-flash" && !r.error);
  const flash30 = allResults.filter(r => r.model === "gemini-3-flash-preview" && !r.error);

  if (flash25.length > 0 && flash30.length > 0) {
    const avg25Ttft = flash25.reduce((sum, r) => sum + r.ttft, 0) / flash25.length;
    const avg30Ttft = flash30.reduce((sum, r) => sum + r.ttft, 0) / flash30.length;
    const avg25Total = flash25.reduce((sum, r) => sum + r.totalTime, 0) / flash25.length;
    const avg30Total = flash30.reduce((sum, r) => sum + r.totalTime, 0) / flash30.length;

    const ttftDiff = ((avg25Ttft - avg30Ttft) / avg25Ttft * 100);
    const totalDiff = ((avg25Total - avg30Total) / avg25Total * 100);

    console.log("\n" + "=".repeat(80));
    console.log("COMPARISON");
    console.log("=".repeat(80));
    
    if (avg30Ttft < avg25Ttft) {
      console.log(`✅ Gemini 3 Flash is ${Math.abs(ttftDiff).toFixed(1)}% FASTER for TTFT`);
    } else {
      console.log(`⚠️  Gemini 3 Flash is ${Math.abs(ttftDiff).toFixed(1)}% SLOWER for TTFT`);
    }
    
    if (avg30Total < avg25Total) {
      console.log(`✅ Gemini 3 Flash is ${Math.abs(totalDiff).toFixed(1)}% FASTER for total response`);
    } else {
      console.log(`⚠️  Gemini 3 Flash is ${Math.abs(totalDiff).toFixed(1)}% SLOWER for total response`);
    }

    console.log("\n" + "─".repeat(80));
    console.log("RECOMMENDATION FOR VOICE CHAT:");
    if (avg30Ttft < avg25Ttft && ttftDiff > 10) {
      console.log("→ Consider upgrading to Gemini 3 Flash for noticeably faster responses");
    } else if (Math.abs(ttftDiff) <= 10) {
      console.log("→ Minimal difference - stay with 2.5 Flash (cheaper) unless quality matters");
    } else {
      console.log("→ Keep using Gemini 2.5 Flash - it's faster and cheaper");
    }
    console.log("─".repeat(80));
  }
}

runBenchmark().catch(console.error);
