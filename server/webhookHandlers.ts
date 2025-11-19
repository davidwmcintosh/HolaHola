import { StripeSync } from 'stripe-replit-sync';
import { getStripeSecretKey, getStripeWebhookSecret } from './stripeClient';

let stripeSync: StripeSync | null = null;

async function getStripeSync(): Promise<StripeSync> {
  if (!stripeSync) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for Stripe webhook processing');
    }

    const secretKey = await getStripeSecretKey();
    const webhookSecret = await getStripeWebhookSecret();

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
    await sync.processWebhook(payload, signature, undefined);
  }
}
