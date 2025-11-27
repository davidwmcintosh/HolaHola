import express, { type Request, Response, NextFunction } from "express";
import { runMigrations, StripeSync } from 'stripe-replit-sync';
import { getStripeSecretKey, getStripeWebhookSecret } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { getTTSService } from "./services/tts-service";
import { generalLimiter } from "./middleware/rate-limiter";

const app = express();

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
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

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
  const server = await registerRoutes(app);

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
    
    if (status.fallbackActive) {
      console.warn('\n⚠️  WARNING: Google Cloud TTS is not healthy, using OpenAI TTS fallback');
      console.warn('   Voice quality degraded - users will hear OpenAI voices instead of authentic WaveNet pronunciation');
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
  }, () => {
    log(`serving on port ${port}`);
  });
})();
