import { StripeSync } from 'stripe-replit-sync';
import { getStripeSecretKey, getStripeWebhookSecret } from './stripeClient';

let stripeSync: StripeSync | null = null;

async function getStripeSync(): Promise<StripeSync | null> {
  if (!stripeSync) {
    const databaseUrl = process.env.NEON_SHARED_DATABASE_URL || process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.warn('[Stripe] DATABASE_URL or NEON_SHARED_DATABASE_URL is required for Stripe webhook processing');
      return null;
    }

    const secretKey = await getStripeSecretKey();
    const webhookSecret = await getStripeWebhookSecret();

    if (!secretKey || !webhookSecret) {
      console.warn('[Stripe] Stripe credentials not available - webhooks disabled');
      return null;
    }

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: databaseUrl,
        max: 2,
      },
      stripeSecretKey: secretKey,
      stripeWebhookSecret: webhookSecret,
    });
  }
  return stripeSync;
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }
    
    const sync = await getStripeSync();
    if (!sync) {
      console.warn('[Stripe] Webhook received but Stripe is not configured - ignoring');
      return;
    }
    await sync.processWebhook(payload, signature, undefined);
  }
}
