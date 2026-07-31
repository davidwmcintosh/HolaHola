import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import fs from "fs";
import { Server as SocketIOServer } from "socket.io";
import { runMigrations, StripeSync } from 'stripe-replit-sync';
import { getStripeSecretKey, getStripeWebhookSecret } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { getTTSService } from "./services/tts-service";
import { validateVoiceConfig } from "./services/voice-config";
import { generalLimiter } from "./middleware/rate-limiter";
import { setupUnifiedWebSocketHandler, setupSocketIOHandler } from "./unified-ws-handler";
import { founderCollabWSBroker } from "./services/founder-collab-ws-broker";
import { founderCollabService } from "./services/founder-collaboration-service";
import { initializeTeamRoomWS } from "./services/team-room-ws-broker";
import { hiveConsciousnessService } from "./services/hive-consciousness-service";
import { migrationOrchestrator } from "./migrations/migration-orchestrator";
import { memoryRecoveryWorker } from "./services/memory-recovery-worker";
import { supportPersonaService } from "./services/support-persona-service";
import { warmupNeonPool } from "./neon-db";
import { runProxyStartupChecks } from "./services/proxy-startup-check";

const app = express();

app.set('trust proxy', 1);

// CRITICAL: Create HTTP server FIRST, before any middleware
// This allows us to attach WebSocket upgrade handler BEFORE Express/Vite interfere
const server = createServer(app);

// Setup Socket.io for voice streaming (handles Replit proxy transport negotiation)
const io = new SocketIOServer(server, {
  cors: {
    origin: true,  // Allow the requesting origin with credentials
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Allow both websocket and polling transports
  transports: ['websocket', 'polling'],
  // Increase max buffer size for audio chunks (default 1MB may be too small)
  maxHttpBufferSize: 5e6, // 5MB
  // Keep-alive settings for voice chat stability
  // Default pingInterval is 25s, pingTimeout is 20s - too aggressive for voice chat
  pingInterval: 30000,   // Send ping every 30 seconds
  pingTimeout: 120000,   // Wait 2 minutes for pong before disconnect (allows long pauses)
});
setupSocketIOHandler(io);

// Initialize Founder Collaboration WebSocket broker on /founder-collab namespace
founderCollabWSBroker.initialize(io);

// Initialize Team Room WebSocket broker on /team-room namespace
initializeTeamRoomWS(io);

// CRITICAL: Add immediate health check endpoint for Cloud Run deployment
// This responds BEFORE any heavy initialization to pass health checks quickly
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// CRITICAL: Cloud Run / Replit deployment platform health-probes hit '/' (not '/health').
// Intercept probe requests BEFORE Vite middleware is registered so that '/' returns 200
// immediately at startup — preventing the healthcheck death spiral where consecutive 500s
// trigger a SIGTERM → restart → 500 → SIGTERM loop seen in production logs.
// Browser requests pass through to Vite via next() since they don't use the probe UA.
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const ua = req.get('user-agent') || '';
  if (ua.startsWith('GoogleHC') || ua.startsWith('Go-http-client')) {
    return res.status(200).send('OK');
  }
  next();
});

// NOTE: Heavy background workers (Hive, MemoryRecovery, Sofia) are started AFTER
// server.listen() to ensure fast health check response for Cloud Run deployments

// CRITICAL: Attach WebSocket handler IMMEDIATELY after server creation
// This ensures upgrade events are handled BEFORE Vite's HMR gets a chance to interfere
// Note: This handles legacy ws connections and realtime API
setupUnifiedWebSocketHandler(server);

// Initialize Stripe before starting server (non-blocking if credentials missing)
let stripeReady = false;
const stripeInitPromise = (async function initStripe() {
  const databaseUrl = process.env.NEON_SHARED_DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('NEON_SHARED_DATABASE_URL environment variable is required for Stripe integration');
    return;
  }

  // Check credentials FIRST before attempting schema migration
  console.log('Checking Stripe credentials...');
  const secretKey = await getStripeSecretKey();
  const webhookSecret = await getStripeWebhookSecret();
  
  // Always run versioned migrations — even without Stripe credentials
  try {
    console.log('Running database migrations...');
    const migrationResult = await migrationOrchestrator.runMigrations();
    if (migrationResult.applied.length > 0) {
      console.log(`Applied migrations: ${migrationResult.applied.join(', ')}`);
    }
    if (migrationResult.errors.length > 0) {
      console.error('Migration errors:', migrationResult.errors);
    }
  } catch (migErr: any) {
    console.error('Migration error (non-fatal):', migErr.message);
  }

  if (!secretKey || !webhookSecret) {
    console.log('Stripe credentials not available - skipping Stripe schema and sync');
    stripeReady = false;
    return;
  }

  try {
    console.log('Initializing Stripe schema...');
    await runMigrations({ 
      databaseUrl,
      schema: 'stripe'
    });
    console.log('Stripe schema ready');
    
    console.log('Syncing Stripe data...');
    const stripeSync = new StripeSync({
      poolConfig: {
        connectionString: databaseUrl,
        max: 10,
      },
      stripeSecretKey: secretKey,
      stripeWebhookSecret: webhookSecret,
    });
    await stripeSync.syncBackfill();
    console.log('Stripe data synced');
    
    // Seed Can-Do Statements (one-time)
    try {
      console.log('Seeding ACTFL Can-Do Statements...');
      const { storage } = await import('./storage');
      await storage.seedCanDoStatements();
      console.log('Can-Do statements ready');
    } catch (error) {
      console.error('Failed to seed Can-Do statements:', error);
    }
    
    // Seed Class Types (one-time)
    try {
      console.log('Seeding class types...');
      const { storage } = await import('./storage');
      await storage.seedClassTypes();
      console.log('Class types ready');
    } catch (error) {
      console.error('Failed to seed class types:', error);
    }
    
    // Seed Topics (grammar, function, subject)
    try {
      console.log('Seeding topic categories...');
      const { seedTopics } = await import('./topic-seed');
      await seedTopics();
      console.log('Topics ready');
    } catch (error) {
      console.error('Failed to seed topics:', error);
    }

    // Seed Cultural Tips for all languages
    try {
      console.log('Seeding cultural tips...');
      const { seedCulturalTips } = await import('./cultural-tips-seed');
      await seedCulturalTips();
      console.log('Cultural tips ready');
    } catch (error) {
      console.error('Failed to seed cultural tips:', error);
    }
    
    // Seed Drill Content for Numbers and Greetings
    try {
      console.log('Seeding drill content...');
      const { seedDrillContent } = await import('./seeds/drill-content');
      await seedDrillContent();
      console.log('Drill content ready');
    } catch (error) {
      console.error('Failed to seed drill content:', error);
    }
    
    // Initialize syllabi for all teacher classes from their templates
    try {
      console.log('Initializing class syllabi...');
      const { initializeAllSyllabi } = await import('./seeds/initialize-syllabi');
      const result = await initializeAllSyllabi();
      console.log(`Syllabi ready: ${result.initialized} initialized, ${result.skipped} skipped`);
    } catch (error) {
      console.error('Failed to initialize syllabi:', error);
    }
    
    // Initialize fluency wiring (lesson-to-CanDo mappings)
    try {
      console.log('Checking fluency wiring...');
      const { seedFluencyWiring } = await import('./seeds/fluency-wiring-seed');
      const fluencyResult = await seedFluencyWiring();
      if (fluencyResult.skipped) {
        console.log(`Fluency wiring: ${fluencyResult.reason}`);
      } else {
        console.log(`Fluency wiring ready: ${fluencyResult.linksCreated} links created`);
      }
    } catch (error) {
      console.error('Failed to check fluency wiring:', error);
    }
    
    // Seed Daniela's Neural Network data (idioms, cultural nuances, error patterns)
    try {
      console.log('Seeding neural network data...');
      const { seedNeuralNetworkData } = await import('./seed-neural-network');
      await seedNeuralNetworkData();
      console.log('Neural network data ready');
    } catch (error) {
      console.error('Failed to seed neural network data:', error);
    }
    
    // Seed Assistant Tutors (practice partners for all languages)
    try {
      console.log('Seeding assistant tutors...');
      const { seedAssistantTutors } = await import('./seed-assistant-tutors');
      await seedAssistantTutors();
      console.log('Assistant tutors ready');
    } catch (error) {
      console.error('Failed to seed assistant tutors:', error);
    }
    
    // Migrate all main tutor voices to Google Chirp 3 HD (idempotent, safe every boot)
    try {
      const { storage: storageForVoiceMigration } = await import('./storage');
      await storageForVoiceMigration.migrateTutorVoicesToGoogle();
    } catch (error) {
      console.error('Failed to migrate tutor voices to Google:', error);
    }

    // Seed Pedagogical Persona Registry (teaching profiles for each tutor)
    try {
      console.log('Seeding tutor personas...');
      const { seedTutorPersonas } = await import('./seed-tutor-personas');
      await seedTutorPersonas();
      console.log('Tutor personas ready');
    } catch (error) {
      console.error('Failed to seed tutor personas:', error);
    }
    
    // Validate tutor names match expected canonical values
    // See replit.md "Tutor Naming Architecture" section
    try {
      const { validateTutorNames } = await import('./validation/tutor-names-validation');
      await validateTutorNames();
    } catch (error) {
      console.error('Failed to validate tutor names:', error);
    }
    
    // Seed Daniela's Advanced Intelligence Layer (subtlety, emotions, creativity)
    try {
      console.log('Seeding advanced intelligence layer...');
      const { seedAdvancedIntelligence } = await import('./seed-advanced-intelligence');
      await seedAdvancedIntelligence();
      console.log('Advanced intelligence layer ready');
    } catch (error) {
      console.error('Failed to seed advanced intelligence:', error);
    }
    
    // Seed Daniela's Reflection Triggers (proactive suggestion system)
    try {
      console.log('Seeding reflection triggers...');
      const { seedReflectionTriggers } = await import('./seed-reflection-triggers');
      await seedReflectionTriggers();
      console.log('Reflection triggers ready');
    } catch (error) {
      console.error('Failed to seed reflection triggers:', error);
    }
    
    // Tag curriculum lessons with canonical topic slugs (enables scenario-to-textbook bridge)
    // Must run BEFORE the scenario topic seeder so the full topic set is available
    try {
      const { tagLessonTopics } = await import('./services/lesson-topic-tagger');
      await tagLessonTopics();
    } catch (error) {
      console.error('Failed to tag lesson topics:', error);
    }

    // Enrich scenario curriculum topic tags (auto-tagging pass)
    // Runs AFTER lesson tagger so scenarios can reference the full lesson topic set
    try {
      const { seedScenarioTopics } = await import('./seed-scenario-topics');
      await seedScenarioTopics();
    } catch (error) {
      console.error('Failed to seed scenario topics:', error);
    }

    // Generate cover images for curriculum lessons — continuous background worker
    // Runs batches back-to-back with a short cooldown until all lessons are covered
    import('./services/lesson-image-generator').then(({ startLessonImageWorker }) => {
      startLessonImageWorker();
    }).catch(err => console.error('Failed to import lesson-image-generator:', err));

    // Generate cover images for all 27 practice scenarios — one-shot background worker
    import('./services/scenario-image-generator').then(({ startScenarioImageWorker }) => {
      startScenarioImageWorker();
    }).catch(err => console.error('Failed to import scenario-image-generator:', err));

    // Augment Level 3-5 curriculum paths with thematic topic units — one-shot background worker
    // Adds Technology, Travel, Health (L3), Business, Science, Arts (L4), Finance, Media, Heritage (L5)
    setTimeout(() => {
      import('./services/curriculum-augmentor').then(({ startCurriculumAugmentor }) => {
        startCurriculumAugmentor();
      }).catch(err => console.error('Failed to import curriculum-augmentor:', err));
    }, 15000); // 15s delay — let the server stabilize before generating content

    // Initialize procedural memory cache for tool knowledge
    try {
      console.log('Initializing procedural memory cache...');
      const { initToolKnowledgeCache } = await import('./services/procedural-memory-retrieval');
      await initToolKnowledgeCache();
      console.log('Procedural memory cache ready');
    } catch (error) {
      console.error('Failed to initialize procedural memory cache:', error);
    }
    
    // Initialize Wren's architectural memory (replit.md cache)
    try {
      console.log('Initializing Wren architectural memory...');
      const { initReplitMdCache } = await import('./services/hive-consciousness-service');
      await initReplitMdCache();
      console.log('Wren architectural memory ready');
    } catch (error) {
      console.error('Failed to initialize Wren memory:', error);
    }
    
    // Sync build changelog to neural network (What Shipped for Daniela & Editor)
    try {
      console.log('Syncing build changelog to neural network...');
      const { contextSyncService } = await import('./services/context-sync-service');
      const changelogResult = await contextSyncService.syncChangelogToNeuralNetwork();
      console.log(`Build changelog synced: ${changelogResult.synced} new, ${changelogResult.skipped} existing`);
      
      // Sync active roadmap/sprints to neural network
      console.log('Syncing roadmap to neural network...');
      const roadmapResult = await contextSyncService.syncRoadmapToNeuralNetwork();
      console.log(`Roadmap synced: ${roadmapResult.synced} new, ${roadmapResult.skipped} unchanged, ${roadmapResult.cleaned} cleaned`);
      
      // Sync replit.md architectural baseline to neural network (Wren's knowledge)
      console.log('Syncing architectural baseline to neural network...');
      const archResult = await contextSyncService.syncReplitMdToNeuralNetwork();
      console.log(`Architectural baseline synced: ${archResult.synced} synced, ${archResult.skipped} unchanged`);
      
      // Sync North Star principles to neural network (Daniela's constitutional foundation)
      console.log('Syncing North Star principles to neural network...');
      const northStarResult = await contextSyncService.syncNorthStarToNeuralNetwork();
      console.log(`North Star synced: ${northStarResult.synced} synced, ${northStarResult.skipped} unchanged`);
      
      // Refresh cache if any entries were synced or cleaned so Daniela/Wren can access them
      if (changelogResult.synced > 0 || roadmapResult.synced > 0 || roadmapResult.cleaned > 0 || archResult.synced > 0 || northStarResult.synced > 0) {
        const { refreshToolKnowledgeCache } = await import('./services/procedural-memory-retrieval');
        await refreshToolKnowledgeCache();
        console.log('Procedural memory cache refreshed with new entries');
      }
    } catch (error) {
      console.error('Failed to sync to neural network:', error);
    }
    
    stripeReady = true;
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
    console.error('Stripe billing features will be unavailable');
  }
})();

// CRITICAL: Register Stripe webhook route BEFORE express.json()
// Webhook needs raw Buffer, not parsed JSON
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }
    
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      
      if (!Buffer.isBuffer(req.body)) {
        const errorMsg = 'STRIPE WEBHOOK ERROR: req.body is not a Buffer. ' +
          'This means express.json() ran before this webhook route. ' +
          'FIX: Move this webhook route registration BEFORE app.use(express.json()) in your code.';
        console.error(errorMsg);
        return res.status(500).json({ error: 'Webhook processing error' });
      }
      
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      
      if (error.message && error.message.includes('payload must be provided as a string or a Buffer')) {
        const helpfulMsg = 'STRIPE WEBHOOK ERROR: Payload is not a Buffer. ' +
          'This usually means express.json() parsed the body before the webhook handler. ' +
          'FIX: Ensure the webhook route is registered BEFORE app.use(express.json()).';
        console.error(helpfulMsg);
      }
      
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// NOW apply JSON middleware for all other routes
declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '50mb', // Increased for large neural network sync bundles (advanced-intel can be 20MB+)
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Serve uploaded files (Express Lane attachments)
app.use('/uploads', express.static('uploads'));

// Serve TTS evaluation audio files (temporary)
app.use('/tts-eval', express.static('public/tts-eval'));

// Apply general rate limiting to all API routes
app.use('/api', generalLimiter);

// SEO: explicitly allow indexing so proxies/CDNs don't suppress it
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.setHeader('X-Robots-Tag', 'index, follow');
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await warmupNeonPool();

  await registerRoutes(app);

  // Sofia student-support resolve endpoint
  app.post('/api/sofia/incidents/:id/resolve', async (req: Request, res: Response) => {
    try {
      const { resolveIncident } = await import('./services/sophia-worker');
      const ok = await resolveIncident(req.params.id);
      if (ok) {
        res.json({ ok: true });
      } else {
        res.status(404).json({ ok: false, error: 'incident not found or already resolved' });
      }
    } catch (err: any) {
      console.error('[SophiaRoute] resolve error:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Luca's autonomous session watchdog — scans active sessions every 30s for
  // SOS signals, tool error spikes, stalled sessions, and degraded vision pipeline.
  const { startSessionMonitor } = await import('./services/session-monitor');
  startSessionMonitor();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (_req.accepts('html') && !_req.path.startsWith('/api/')) {
      res.status(status).set({ 'Content-Type': 'text/html' }).send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HolaHola</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;color:#334155}
.c{text-align:center;padding:2rem;max-width:420px}.icon{font-size:3rem;margin-bottom:1rem}.h{font-size:1.5rem;font-weight:600;margin-bottom:.5rem}.p{color:#64748b;margin-bottom:1.5rem;line-height:1.5}
.btn{display:inline-block;padding:.75rem 1.5rem;background:#2563eb;color:#fff;border-radius:.5rem;text-decoration:none;font-weight:500;border:none;cursor:pointer;font-size:1rem}
.btn:hover{background:#1d4ed8}
@media(prefers-color-scheme:dark){body{background:#0f172a;color:#e2e8f0}.p{color:#94a3b8}}</style>
</head><body><div class="c">
<div class="icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg></div>
<div class="h">Something went wrong</div>
<p class="p">HolaHola ran into an issue loading this page. This is usually temporary.</p>
<button class="btn" onclick="location.reload()">Try Again</button>
</div></body></html>`);
    } else {
      res.status(status).json({ message });
    }
    console.error(`[Error Handler] ${status}: ${message}`, err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : '');
  });

  // Run TTS service health check on startup
  try {
    console.log('\n┌─────────────────────────────────────────────────────────────┐');
    console.log('│ TTS SERVICE HEALTH CHECK                                    │');
    console.log('└─────────────────────────────────────────────────────────────┘');
    
    const ttsService = getTTSService();
    const status = await ttsService.getStatus();
    
    console.log(`Provider Configuration:`);
    console.log(`  • Primary Provider: ${status.currentProvider.toUpperCase()}`);
    console.log(`  • Google Cloud TTS: ${status.googleAvailable ? '✓ Available' : '✗ Not configured'}`);
    console.log(`  • Cartesia: ${status.cartesiaAvailable ? '✓ Available' : '✗ Not configured'}`);
    console.log(`  • OpenAI TTS: ${status.openaiAvailable ? '✓ Available' : '✗ Not configured'}`);
    
    if (status.googleAvailable) {
      console.log(`  • Google Cloud TTS Healthy: ${status.googleHealthy ? '✓' : '✗'}`);
      if (status.healthMessage) {
        console.log(`  • Status: ${status.healthMessage}`);
      }
    }
    
    if (status.currentProvider === 'google' && status.googleHealthy) {
      console.log('\n✓ Google Cloud TTS (Chirp 3 HD) is PRIMARY and healthy');
    } else if (status.currentProvider === 'google' && !status.googleHealthy) {
      console.warn('\nWARNING: Google Cloud TTS is PRIMARY but not healthy');
      console.warn('   Will fall back to other providers if available');
    } else if (status.googleHealthy) {
      console.log(`\n✓ ${status.currentProvider.toUpperCase()} is PRIMARY, Google Cloud TTS available as fallback`);
    }
    
    console.log('─────────────────────────────────────────────────────────────\n');
  } catch (error: any) {
    console.error('TTS health check failed:', error.message);
  }

  // Validate voice configuration (Deepgram + Cartesia requirements)
  validateVoiceConfig();

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);

    // Log which object-storage backend is active and probe credentials.
    // On failure, post a founder-visible alert to the Express Lane so the
    // broken configuration is caught immediately rather than silently.
    try {
      const { logStorageBackend } = await import('./replit_integrations/object_storage/objectStorage');
      const { handleStorageProbeResult } = await import('./services/storage-probe-alerter');
      const probeResult = await logStorageBackend();
      await handleStorageProbeResult(probeResult, founderCollabService, founderCollabWSBroker);
    } catch (err: any) {
      console.error('[ObjectStorage] Failed to run startup check:', err?.message ?? err);
    }

    // Periodic storage probe — re-runs every 30 minutes so a credential
    // rotation or bucket-policy change mid-session is caught and alerted
    // without waiting for the next server restart.
    setInterval(async () => {
      try {
        const { logStorageBackend } = await import('./replit_integrations/object_storage/objectStorage');
        const { runPeriodicStorageProbe } = await import('./services/storage-probe-alerter');
        await runPeriodicStorageProbe(logStorageBackend, founderCollabService, founderCollabWSBroker);
      } catch (err: any) {
        console.warn('[ObjectStorage] Periodic probe threw unexpectedly:', err?.message ?? err);
      }
    }, 30 * 60 * 1000).unref();

    // Run CopyObject probe — detects whether the S3 bucket supports in-place
    // metadata updates.  Failure logs a WARN but does not block startup.
    try {
      const { runCopyObjectProbeAtStartup } = await import('./replit_integrations/object_storage/objectStorage');
      await runCopyObjectProbeAtStartup();
    } catch (err: any) {
      console.warn('[ObjectStorage] CopyObject probe threw unexpectedly:', err?.message ?? err);
    }

    // Record this boot for restart-spiral detection in AldenWatch.
    // Kept deliberately simple — any write error is silently swallowed.
    try {
      const bootFile = `${process.cwd()}/.local/server-boot-log.json`;
      const existing: number[] = fs.existsSync(bootFile)
        ? (JSON.parse(fs.readFileSync(bootFile, 'utf8')) as number[])
        : [];
      existing.push(Date.now());
      fs.mkdirSync(`${process.cwd()}/.local`, { recursive: true });
      fs.writeFileSync(bootFile, JSON.stringify(existing.slice(-20)), 'utf8');
    } catch { /* non-fatal */ }
    
    // DEFERRED STARTUP: Start heavy background workers AFTER server is listening
    // This ensures Cloud Run health checks pass quickly before workers initialize
    // Workers are STAGGERED to avoid simultaneous DB connection storms on boot

    // Immediate: Wire up persistent AI cost logging (fire-and-forget inserts to ai_cost_logs)
    (async () => {
      try {
        const { getSharedDb } = await import('./neon-db');
        const { aiCostLogs } = await import('../shared/schema');
        const { setCostPersister } = await import('./services/cost-tracker');
        const sharedDb = getSharedDb();
        setCostPersister(async (entry) => {
          await sharedDb.insert(aiCostLogs).values({
            loggedAt: entry.timestamp,
            model: entry.model,
            inputTokens: entry.inputTokens,
            outputTokens: entry.outputTokens,
            costUsd: entry.costUsd,
            context: entry.context ?? null,
          });
        });
        console.log('[CostTracker] DB persister wired — AI cost logs will survive restarts.');
      } catch (err: any) {
        console.warn('[CostTracker] Failed to wire DB persister:', err?.message);
      }
    })();

    // Immediate: AI proxy reachability check (non-blocking, logs warnings only)
    runProxyStartupChecks().catch(() => {/* non-fatal */});

    // Immediate: Hive Consciousness (lightweight event listener)
    hiveConsciousnessService.startListening();
    
    // Immediate: Voice telemetry (in-memory batching, 2s flush)
    const { voiceTelemetry } = await import('./services/voice-pipeline-telemetry');
    voiceTelemetry.start();
    
    console.log('[CONSOLIDATION] Sync-bridge retired - Neon routing is primary');

    // +3s: Memory Recovery Worker
    setTimeout(() => {
      memoryRecoveryWorker.start(5);
    }, 3000);
    
    // +6s: Sofia Issue Monitoring Worker
    setTimeout(() => {
      supportPersonaService.startIssueMonitoringWorker(5);
    }, 6000);
    
    // +9s: Zombie session cleanup
    setTimeout(async () => {
      const { usageService } = await import('./services/usage-service');
      const ZOMBIE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
      const ZOMBIE_MAX_AGE_SECONDS = 1800; // 30 min — GL idle timeout (5 min) is primary guard; this is the safety net
      setInterval(async () => {
        try {
          const cleaned = await usageService.cleanupZombieSessions(ZOMBIE_MAX_AGE_SECONDS);
          if (cleaned > 0) {
            console.log(`[ZombieCleanup] Cleaned ${cleaned} zombie sessions`);
          }
        } catch (err: any) {
          console.warn(`[ZombieCleanup] Error:`, err.message);
        }
      }, ZOMBIE_CLEANUP_INTERVAL_MS);
    }, 9000);

    // +12s: Voice Health Monitor
    setTimeout(async () => {
      const { startVoiceHealthMonitor, onHealthStatusChange } = await import('./services/voice-health-monitor');
      onHealthStatusChange(async (transition) => {
        await supportPersonaService.handleHealthTransition(transition);
      });
      startVoiceHealthMonitor();
    }, 12000);

    // +15s: Context Health Monitor
    setTimeout(async () => {
      const { startContextHealthMonitor, onContextHealthStatusChange } = await import('./services/context-health-monitor');
      onContextHealthStatusChange(async (transition) => {
        await supportPersonaService.handleContextHealthTransition(transition);
      });
      startContextHealthMonitor();
    }, 15000);

    // +18s: Brain Health Aggregator
    setTimeout(async () => {
      const { startBrainHealthAggregator, onBrainHealthStatusChange } = await import('./services/brain-health-aggregator');
      onBrainHealthStatusChange(async (transition) => {
        await supportPersonaService.handleBrainHealthTransition(transition);
      });
      startBrainHealthAggregator();
    }, 18000);

    // +25s: Wren Security Audit Worker
    setTimeout(async () => {
      const { startSecurityAuditWorker } = await import('./services/wren-security-audit-worker');
      startSecurityAuditWorker();
    }, 25000);

    // +30s: Reading Module Pre-generation (shared cache for all students)
    setTimeout(async () => {
      const { startBackgroundPrefetch } = await import('./services/reading-module-prefetch');
      startBackgroundPrefetch();
    }, 30000);

    // +35s: Lyra Learning Experience Analyst Worker
    setTimeout(async () => {
      const { startLyraAnalyticsWorker } = await import('./services/lyra-analytics-worker');
      startLyraAnalyticsWorker();
    }, 35000);

    // +40s: Alden Weekly Digest Worker (CAP-002)
    setTimeout(async () => {
      const { startAldenDigestWorker } = await import('./services/alden-digest-worker');
      startAldenDigestWorker();
    }, 40000);

    // +45s: Alden Watch Worker — proactive notifications (CAP-009)
    setTimeout(async () => {
      const { startAldenWatchWorker } = await import('./services/alden-watch-worker');
      startAldenWatchWorker();
    }, 45000);

    // +46s: Thread Weaver Monthly Refresh — re-weave identity threads if stale (> 28 days)
    setTimeout(async () => {
      const { runMonthlyThreadRefresh } = await import('./services/thread-weaver-service');
      await runMonthlyThreadRefresh();
    }, 46000);

    // +47s: Shared Lobe Snapshot — regenerate docs/shared-lobe-snapshot.md from DB
    setTimeout(async () => {
      const { generateSharedLobeSnapshot } = await import('./services/shared-lobe-snapshot');
      await generateSharedLobeSnapshot();
    }, 46000);

    // +47s: Agent Notes Snapshot — regenerate docs/alden-to-agent.md from unread Alden→Agent notes
    setTimeout(async () => {
      const { generateAgentNotesSnapshot } = await import('./services/agent-notes-snapshot');
      await generateAgentNotesSnapshot();
    }, 47000);

    // +48s: Agent Briefing — regenerate docs/agent-briefing.md (the Agent's room at session start)
    setTimeout(async () => {
      const { generateAgentBriefing } = await import('./services/agent-briefing');
      await generateAgentBriefing();
    }, 48000);

    // +55s: Menu Image Worker — auto-resume if there are still pending food images
    setTimeout(async () => {
      const { startMenuImageWorker } = await import('./services/menu-image-worker');
      const result = await startMenuImageWorker({ batchLimit: 1000, delayBetween: 2000, silent: false });
      if (result.ok) {
        console.log(`[MenuWorker] Auto-started at boot — ${result.pending} pending items`);
      } else if (result.pending === 0) {
        console.log('[MenuWorker] Boot check: all food images already generated');
      }
    }, 55000);

    // +50s: Sofia Issue Cleanup Worker (CAP-005)
    setTimeout(async () => {
      const { startSofiaCleanupWorker } = await import('./services/sofia-issue-cleanup-worker');
      startSofiaCleanupWorker();
    }, 50000);

    // +55s: Sophia Student Support Worker (ph-spelling — student-facing incident layer)
    setTimeout(async () => {
      const { startSophiaWorker } = await import('./services/sophia-worker');
      startSophiaWorker();
    }, 55000);

    // +70s: Vocab Image Library — fill any gaps since cache hits are free/instant.
    // Processes all textbook vocab words for all languages; skips words that already
    // have a cached watercolor image. Only calls the image engine on true misses.
    // SKIP CHECK: If seeder ran within the last 24h, skip this startup run entirely
    // to avoid DB pool saturation during /chat session init.
    setTimeout(async () => {
      try {
        const { getSharedDb } = await import('./neon-db');
        const { sql } = await import('drizzle-orm');
        const db = getSharedDb();
        const rows = await db.execute(sql`
          SELECT content FROM editor_insights
          WHERE title = 'vocab_image_seed_last_run' AND category = 'context'
          ORDER BY created_at DESC LIMIT 1
        `);
        if (rows.rows.length > 0) {
          const lastRun = new Date(rows.rows[0].content as string);
          const hoursSince = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60);
          if (hoursSince < 24) {
            console.log(`[VocabImageSeed] Skipping startup seed — last run ${hoursSince.toFixed(1)}h ago (< 24h)`);
            return;
          }
        }
        const { seedAllVocabImages } = await import('./services/vocab-image-seed-service');
        const jobId = `boot-vocab-seed-${Date.now()}`;
        seedAllVocabImages(jobId).catch((e: any) =>
          console.error('[VocabImageSeed] Background error:', e.message)
        );
        console.log('[VocabImageSeed] Background seeding started — watercolor vocab images for all languages');
      } catch (err: any) {
        console.warn('[VocabImageSeed] Failed to start:', err.message);
      }
    }, 70000);

    // +65s: Fact Confidence Decay Worker — weekly 15% decay on unreinforced time-sensitive facts
    setTimeout(async () => {
      const { startFactConfidenceDecayWorker } = await import('./services/fact-confidence-decay-worker');
      startFactConfidenceDecayWorker();
    }, 65000);

    // +60s: Diagnostic retention (daily cleanup, no rush)
    setTimeout(async () => {
      const DIAG_RETENTION_DAYS = 30;
      const DIAG_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
      const { generateDailySummary } = await import('./services/voice-health-monitor');
      const runDiagRetention = async () => {
        try {
          await generateDailySummary();
          const { getSharedDb } = await import('./neon-db');
          const { sql } = await import('drizzle-orm');
          const sharedDb = getSharedDb();
          const cutoff = new Date(Date.now() - DIAG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
          const result = await sharedDb.execute(sql`
            DELETE FROM voice_pipeline_events
            WHERE event_type LIKE 'client_diag_%'
              AND created_at < ${cutoff}
          `);
          const deleted = (result as any).rowCount || 0;
          if (deleted > 0) {
            console.log(`[DiagRetention] Purged ${deleted} diagnostic events older than ${DIAG_RETENTION_DAYS} days`);
          }
        } catch (err: any) {
          console.warn(`[DiagRetention] Error:`, err.message);
        }
      };
      runDiagRetention();
      setInterval(runDiagRetention, DIAG_CLEANUP_INTERVAL_MS);
    }, 60000);

    // +80s: Daniela Absence Worker — daily check for absent students, Express Lane nudge
    setTimeout(async () => {
      const { startDanielaAbsenceWorker } = await import('./services/daniela-absence-worker');
      startDanielaAbsenceWorker();
    }, 80000);

    // +85s: Daniela Presence Worker — generates narrative "where I am with this student"
    // doc every 30min so Daniela arrives oriented, not blank, at each session start
    setTimeout(async () => {
      const { startDanielaPresenceWorker } = await import('./services/daniela-presence-worker');
      startDanielaPresenceWorker();

      const { startAgentTeamRoomWorker } = await import('./services/team-room-agent-worker');
      startAgentTeamRoomWorker();

      const { startDanielaDialogueWorker } = await import('./services/agent-daniela-dialogue-worker');
      startDanielaDialogueWorker();

      const { startAgentSweepWorker } = await import('./services/agent-proactive-sweep-worker');
      startAgentSweepWorker();

      const { startAgentSessionAutosave } = await import('./services/agent-session-autosave');
      startAgentSessionAutosave();

      const { startMondayBriefScheduler } = await import('./services/board-meeting-service');
      startMondayBriefScheduler();

      const { startTeamRoomAutoSaveWorker } = await import('./services/team-room-alden-service');
      startTeamRoomAutoSaveWorker();

      const { startDanielaConsultAutosave } = await import('./services/daniela-consult-autosave');
      startDanielaConsultAutosave();
    }, 85000);

    // +50s: Memory Decay Migration — idempotent ALTER TABLE that adds strength/
    // last_reinforced_at/pinned columns to memory_embeddings. Safe to run every boot.
    setTimeout(async () => {
      const { runMemoryDecayMigration } = await import('./services/memory-decay-service');
      runMemoryDecayMigration().catch((err: Error) =>
        console.warn('[MemoryDecay] Migration skipped:', err.message)
      );
    }, 50000);

    // +55s: Learning Goals Migration — idempotent CREATE TABLE IF NOT EXISTS for
    // learning_goals table. Tracks outcome-based goals + capability arcs for
    // self-directed students and business travelers. Safe to run every boot.
    setTimeout(async () => {
      const { runLearningGoalsMigration } = await import('./services/learning-goal-service');
      runLearningGoalsMigration().catch((err: Error) =>
        console.warn('[LearningGoals] Migration skipped:', err.message)
      );
    }, 55000);

    // +95s: Memory Embedding Indexer — generates Gemini text-embedding-004 vectors
    // for all memory records (student_insights, hive_snapshots, personal_facts, growth_memories)
    // enabling semantic similarity search in the recall scatter-gather tool
    setTimeout(async () => {
      const { startMemoryEmbeddingIndexer } = await import('./services/memory-embedding-indexer');
      startMemoryEmbeddingIndexer();
    }, 95000);

    // +100s: Daniela Tool Indexer — embeds all function declarations into neural memory
    // (memoryType='daniela_tool', userId=null, pinned=true). Daniela can recall what
    // tools she has and when to use them even if context injection is degraded.
    setTimeout(async () => {
      const { runDanielaToolIndexer } = await import('./services/daniela-tool-indexer');
      runDanielaToolIndexer().catch((err: Error) =>
        console.warn('[ToolIndexer] Skipped:', err.message)
      );
    }, 100000);

    // +105s: Learning Goal Capability Indexer — embeds all active + recently-archived
    // goal capabilities into neural memory (memoryType='goal_capability', userId=studentId).
    // Daniela can recall capability status and evidence notes via semantic search.
    setTimeout(async () => {
      const { indexAllActiveGoalCapabilities } = await import('./services/learning-goal-service');
      indexAllActiveGoalCapabilities().catch((err: Error) =>
        console.warn('[LearningGoal] Capability index skipped:', err.message)
      );
    }, 105000);

    // +108s: Shadow Auditor Stale-Session Reaper — suspends any active pedagogical
    // loops whose GL sessions closed without a clean stop() call (e.g., tab closed,
    // network drop). Runs every 30 minutes. Loops are marked 'suspended' so they
    // can be resumed next session via get_current_teaching_context.
    setTimeout(async () => {
      const { reapStaleSessions } = await import('./services/shadow-auditor');
      const runReaper = () => reapStaleSessions().catch((err: Error) =>
        console.warn('[ShadowAudit] Reaper error:', err.message)
      );
      runReaper();
      setInterval(runReaper, 30 * 60 * 1000); // every 30 min
    }, 108000);

    // +300s outer + 90s inner = +390s total: Madrigal Unit Embedding Indexer
    // Embeds each Madrigal pedagogical unit into memory_embeddings (type='madrigal_unit',
    // userId=null) so that start_madrigal_loop can use semantic search to route vocab queries.
    // Idempotent: skips units whose embedding content hash hasn't changed.
    // MUST use default 90s inner delay — passing 0 caused simultaneous fire with ToolIndexer
    // (+100s) and EmbedIndexer (+95s) which pushed heap to 2033 MB → OOM crash. See embed-indexer-oom.md.
    // Outer delay bumped from 110s→300s: VocabImageSeed (+70s) takes 4-5 min in production;
    // overlap with MadrigalIndexer at +200s caused second OOM. 390s total ensures no overlap.
    setTimeout(async () => {
      const { scheduleMadrigalIndexing } = await import('./services/madrigal-embedding-indexer');
      scheduleMadrigalIndexing(); // uses default 90s inner delay → total +390s from boot
    }, 300000);

    // +120s: Memory Consolidation Worker — weekly job that merges related session_summary
    // snapshots into aggregate_analytics entries, reducing noise in long-running students
    setTimeout(async () => {
      const { startMemoryConsolidator } = await import('./services/memory-consolidator');
      startMemoryConsolidator();
    }, 120000);

    // +125s: Session Insight Consolidation Worker (T003 + T006)
    // Runs every 6 hours. Synthesizes student_insight memories (what each student is working
    // on, struggling with, growing toward) and growth_memory entries (Daniela's between-session
    // reflection in her own voice). Both stored as memory_embeddings for neural net recall.
    // Also triggers voice drift check after each cycle (T004).
    setTimeout(async () => {
      const { startConsolidationWorker } = await import('./services/memory-consolidation-worker');
      startConsolidationWorker();
    }, 125000);

    // +135s: Voice Drift Baseline — build once if no baseline exists yet (T004).
    // The drift check itself fires after each consolidation cycle.
    setTimeout(async () => {
      const { ensureVoiceDriftBaseline } = await import('./services/voice-drift-service');
      ensureVoiceDriftBaseline().catch((err: Error) =>
        console.warn('[VoiceDrift] Baseline skipped:', err.message)
      );
    }, 135000);

    // +130s: Conversation Curator — daily job that finds substantive conversations not yet
    // in conversation_memories and saves them as verbatim-transcript memories. Idempotent.
    setTimeout(async () => {
      const { startConversationCurator } = await import('./services/history-backfill-service');
      startConversationCurator();
    }, 130000);

    // +75s: Curriculum Enrichment Auto-Resume
    // Fires on every boot. The enrichment service skips already-enriched lessons
    // (within 7 days), so this is safe to run repeatedly and acts as a self-healing
    // resume mechanism when server restarts interrupt a bulk enrichment run.
    setTimeout(async () => {
      try {
        const { Pool } = await import('pg');
        const pool = new Pool({ connectionString: process.env.NEON_SHARED_DATABASE_URL });
        const result = await pool.query(
          'SELECT COUNT(*)::int AS cnt FROM curriculum_lessons WHERE enriched_at IS NULL'
        );
        await pool.end();
        const remaining = result.rows[0].cnt as number;
        if (remaining > 0) {
          console.log(`[CurriculumEnrich] Boot-resume: ${remaining} unenriched lessons found — starting bulk enrichment`);
          const { bulkEnrichAllPaths } = await import('./services/curriculum-enrichment-service');
          const jobId = `bulk-enrich-boot-${Date.now()}`;
          bulkEnrichAllPaths(jobId).catch((err: any) => {
            console.error('[CurriculumEnrich] Boot-resume failed:', err.message);
          });
        } else {
          console.log('[CurriculumEnrich] Boot-resume: all lessons already enriched, nothing to do');
        }
      } catch (err: any) {
        console.warn('[CurriculumEnrich] Boot-resume check failed:', err.message);
      }
    }, 75000);

    // GRACEFUL SHUTDOWN: Drain active sessions and flush data before exit
    const gracefulShutdown = async (signal: string) => {
      console.log(`[Shutdown] ${signal} received — starting graceful drain...`);
      
      // 1. Stop accepting new connections
      server.close(() => {
        console.log('[Shutdown] HTTP server closed');
      });

      // 2. Notify active voice sessions to reconnect
      let activeVoiceClients = 0;
      try {
        if (io) {
          const voiceNs = io.of('/voice');
          const sockets = await voiceNs.fetchSockets();
          activeVoiceClients = sockets.length;
          voiceNs.emit('server_restarting', { reason: 'deployment', reconnectMs: 5000 });
          console.log(`[Shutdown] Notified ${activeVoiceClients} voice client(s) to reconnect`);
        }
      } catch (err: any) {
        console.warn('[Shutdown] Could not notify voice clients:', err.message);
      }

      // 2b. Drain window — let in-flight audio finish playing before the process exits.
      // Cloud Run gives 30s from SIGTERM before SIGKILL; we use 25s so cleanup still runs.
      // If no clients are connected we skip the wait to keep deployments fast.
      const drainSeconds = activeVoiceClients > 0 ? 25 : 2;
      console.log(`[Shutdown] Drain window: ${drainSeconds}s (${activeVoiceClients} active voice session(s))...`);
      await new Promise(resolve => setTimeout(resolve, drainSeconds * 1000));
      console.log('[Shutdown] Drain complete');

      // 3. Flush voice telemetry
      try {
        await (voiceTelemetry as any).flush();
        console.log('[Shutdown] Voice telemetry flushed');
      } catch (err: any) {
        console.warn('[Shutdown] Telemetry flush error:', err.message);
      }

      // 4. Close database pools (both primary db.ts and neon-db.ts)
      try {
        const { closeDbConnections } = await import('./db');
        await closeDbConnections();
        const { closeNeonConnections } = await import('./neon-db');
        await closeNeonConnections();
        console.log('[Shutdown] Database connections closed');
      } catch (err: any) {
        console.warn('[Shutdown] DB close error:', err.message);
      }

      console.log('[Shutdown] Graceful shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (err) => {
      console.error('[FATAL] Uncaught exception:', err.message, err.stack);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('[WARN] Unhandled promise rejection:', reason);
    });
  });
})();
