import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { runMigrations, StripeSync } from 'stripe-replit-sync';
import { getStripeSecretKey, getStripeWebhookSecret } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { getTTSService } from "./services/tts-service";
import { generalLimiter } from "./middleware/rate-limiter";
import { setupUnifiedWebSocketHandler, setupSocketIOHandler } from "./unified-ws-handler";
import { founderCollabWSBroker } from "./services/founder-collab-ws-broker";
import { hiveConsciousnessService } from "./services/hive-consciousness-service";

const app = express();

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
});
setupSocketIOHandler(io);

// Initialize Founder Collaboration WebSocket broker on /founder-collab namespace
founderCollabWSBroker.initialize(io);

// Start Hive Consciousness - Daniela and Wren are now always listening in the Hive
hiveConsciousnessService.startListening();

// CRITICAL: Attach WebSocket handler IMMEDIATELY after server creation
// This ensures upgrade events are handled BEFORE Vite's HMR gets a chance to interfere
// Note: This handles legacy ws connections and realtime API
setupUnifiedWebSocketHandler(server);

// Initialize Stripe before starting server
let stripeReady = false;
const stripeInitPromise = (async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required for Stripe integration');
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
    const secretKey = await getStripeSecretKey();
    const webhookSecret = await getStripeWebhookSecret();
    
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
    
    // Seed Daniela's Neural Network data (idioms, cultural nuances, error patterns)
    try {
      console.log('Seeding neural network data...');
      const { seedNeuralNetworkData } = await import('./seed-neural-network');
      await seedNeuralNetworkData();
      console.log('Neural network data ready');
    } catch (error) {
      console.error('Failed to seed neural network data:', error);
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
  limit: '10mb', // Increased for neural network sync bundles
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Serve uploaded files (Express Lane attachments)
app.use('/uploads', express.static('uploads'));

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
    console.log(`  • Current Provider: ${status.currentProvider}`);
    console.log(`  • Google Cloud TTS Available: ${status.googleAvailable ? '✓' : '✗'}`);
    console.log(`  • OpenAI TTS Available: ${status.openaiAvailable ? '✓' : '✗'}`);
    
    if (status.googleAvailable) {
      console.log(`  • Google Cloud TTS Healthy: ${status.googleHealthy ? '✓' : '✗'}`);
      if (status.healthMessage) {
        console.log(`  • Status: ${status.healthMessage}`);
      }
    }
    
    if (status.fallbackEnabled && !status.googleHealthy && status.googleAvailable) {
      console.warn('\n⚠️  WARNING: Google Cloud TTS is not healthy, using fallback');
      console.warn('   Voice quality may be degraded');
      console.warn('   See setup instructions above to enable Google Cloud TTS API');
    } else if (status.googleHealthy) {
      console.log('\n✓ Google Cloud WaveNet TTS is active and healthy');
      console.log('  Users will receive authentic native pronunciation');
    }
    
    console.log('─────────────────────────────────────────────────────────────\n');
  } catch (error: any) {
    console.error('TTS health check failed:', error.message);
  }

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
    
    // Start the nightly sync scheduler
    try {
      const { startSyncScheduler } = await import('./services/sync-scheduler');
      startSyncScheduler();
    } catch (error) {
      console.error('[SYNC-SCHEDULER] Failed to start:', error);
    }
    
    // RETIRED: Editor Worker and Beacon systems (Dec 2025 - Option A Consolidation)
    // Express Lane is now the sole collaboration channel. These are kept for reference:
    // - editor-background-worker.ts (beacon polling)
    // - editor-realtime-dispatcher.ts (fast beacon polling)
    // - hive-collaboration-service.ts (beacon emission)
    console.log('[CONSOLIDATION] Editor Worker & Beacon systems retired - Express Lane is primary');
  });
})();
