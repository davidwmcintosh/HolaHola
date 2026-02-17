import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
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
import { hiveConsciousnessService } from "./services/hive-consciousness-service";
import { migrationOrchestrator } from "./migrations/migration-orchestrator";
import { memoryRecoveryWorker } from "./services/memory-recovery-worker";
import { supportPersonaService } from "./services/support-persona-service";

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

// CRITICAL: Add immediate health check endpoint for Cloud Run deployment
// This responds BEFORE any heavy initialization to pass health checks quickly
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
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
    
    // Run versioned migrations (for cross-env sync)
    console.log('Running database migrations...');
    const migrationResult = await migrationOrchestrator.runMigrations();
    if (migrationResult.applied.length > 0) {
      console.log(`Applied migrations: ${migrationResult.applied.join(', ')}`);
    }
    if (migrationResult.errors.length > 0) {
      console.error('Migration errors:', migrationResult.errors);
    }
    
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
      const { beaconSyncService } = await import('./services/beacon-sync-service');
      const changelogResult = await beaconSyncService.syncChangelogToNeuralNetwork();
      console.log(`Build changelog synced: ${changelogResult.synced} new, ${changelogResult.skipped} existing`);
      
      // Sync active roadmap/sprints to neural network
      console.log('Syncing roadmap to neural network...');
      const roadmapResult = await beaconSyncService.syncRoadmapToNeuralNetwork();
      console.log(`Roadmap synced: ${roadmapResult.synced} new, ${roadmapResult.skipped} unchanged, ${roadmapResult.cleaned} cleaned`);
      
      // Sync beacon status to neural network (replaces prompt injection)
      console.log('Syncing beacon status to neural network...');
      const beaconStatusResult = await beaconSyncService.syncBeaconStatusToNeuralNetwork();
      console.log(`Beacon status synced: ${beaconStatusResult.synced} synced, ${beaconStatusResult.cleaned} cleaned`);
      
      // Sync replit.md architectural baseline to neural network (Wren's knowledge)
      console.log('Syncing architectural baseline to neural network...');
      const archResult = await beaconSyncService.syncReplitMdToNeuralNetwork();
      console.log(`Architectural baseline synced: ${archResult.synced} synced, ${archResult.skipped} unchanged`);
      
      // Sync North Star principles to neural network (Daniela's constitutional foundation)
      console.log('Syncing North Star principles to neural network...');
      const northStarResult = await beaconSyncService.syncNorthStarToNeuralNetwork();
      console.log(`North Star synced: ${northStarResult.synced} synced, ${northStarResult.skipped} unchanged`);
      
      // Refresh cache if any entries were synced or cleaned so Daniela/Wren can access them
      if (changelogResult.synced > 0 || roadmapResult.synced > 0 || roadmapResult.cleaned > 0 || beaconStatusResult.synced > 0 || beaconStatusResult.cleaned > 0 || archResult.synced > 0 || northStarResult.synced > 0) {
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
  // Register routes (no longer creates server - we created it above)
  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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
    
    // DEFERRED STARTUP: Start heavy background workers AFTER server is listening
    // This ensures Cloud Run health checks pass quickly before workers initialize
    // Workers are STAGGERED to avoid simultaneous DB connection storms on boot
    
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
      const ZOMBIE_MAX_AGE_SECONDS = 7200;
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

    // GRACEFUL SHUTDOWN: Drain active sessions and flush data before exit
    const gracefulShutdown = async (signal: string) => {
      console.log(`[Shutdown] ${signal} received — starting graceful drain...`);
      
      // 1. Stop accepting new connections
      server.close(() => {
        console.log('[Shutdown] HTTP server closed');
      });

      // 2. Notify active voice sessions to reconnect
      try {
        if (io) {
          io.of('/voice').emit('server_restarting', { reason: 'deployment', reconnectMs: 3000 });
          console.log('[Shutdown] Notified voice clients to reconnect');
        }
      } catch (err: any) {
        console.warn('[Shutdown] Could not notify voice clients:', err.message);
      }

      // 3. Flush voice telemetry
      try {
        await voiceTelemetry.flush();
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
  });
})();
