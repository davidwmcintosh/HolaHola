import { StripeSync } from 'stripe-replit-sync';
import Stripe from 'stripe';
import { getStripeSecretKey, getStripeWebhookSecret } from './stripeClient';

let stripeSync: StripeSync | null = null;
let stripeClient: Stripe | null = null;

async function getStripeSync(): Promise<StripeSync | null> {
  if (!stripeSync) {
    const databaseUrl = process.env.NEON_SHARED_DATABASE_URL;
    if (!databaseUrl) {
      console.warn('[Stripe] NEON_SHARED_DATABASE_URL is required for Stripe webhook processing');
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

async function getStripeClient(): Promise<Stripe | null> {
  if (!stripeClient) {
    const secretKey = await getStripeSecretKey();
    if (!secretKey) return null;
    stripeClient = new Stripe(secretKey, { apiVersion: '2025-01-27.acacia' });
  }
  return stripeClient;
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

    // Let stripe-replit-sync handle its DB sync first
    await sync.processWebhook(payload, signature, undefined);

    // Additionally handle our business logic (credit fulfillment, subscription updates)
    const webhookSecret = await getStripeWebhookSecret();
    const stripe = await getStripeClient();
    if (!stripe || !webhookSecret) return;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      console.error('[Stripe] Webhook signature verification failed:', err.message);
      return;
    }

    console.log(`[Stripe] Webhook event: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.metadata?.type === 'hour_package') {
            // Auto-fulfill hour package purchase (idempotent — duplicate guard inside fulfillHourPackage)
            const { stripeService } = await import('./stripeService');
            const result = await stripeService.fulfillHourPackage(session.id);
            if (result.success && !result.alreadyProcessed) {
              console.log(`[Stripe] Webhook auto-fulfilled ${result.hoursAdded}h for user ${session.metadata.userId}`);
            } else if (result.alreadyProcessed) {
              console.log(`[Stripe] Webhook: session ${session.id} already fulfilled, skipping`);
            } else {
              console.error(`[Stripe] Webhook fulfillment failed for session ${session.id}: ${result.error}`);
            }
          }
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          await WebhookHandlers.syncSubscriptionToUser(sub, stripe);
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          // Downgrade user to free tier
          await WebhookHandlers.syncSubscriptionToUser(sub, stripe, true);
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
          if (customerId) {
            const { storage } = await import('./storage');
            const user = await storage.getUserByStripeCustomerId(customerId);
            if (user) {
              await storage.updateUserStripeInfo(user.id, { subscriptionStatus: 'past_due' });
              console.log(`[Stripe] Marked user ${user.id} as past_due after payment failure`);
            }
          }
          break;
        }

        default:
          break;
      }
    } catch (bizErr: any) {
      console.error(`[Stripe] Business logic error for event ${event.type}:`, bizErr.message);
    }
  }

  private static async syncSubscriptionToUser(
    sub: Stripe.Subscription,
    stripe: Stripe,
    forceCancel = false
  ): Promise<void> {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    if (!customerId) return;
    const { storage } = await import('./storage');
    const user = await storage.getUserByStripeCustomerId(customerId);
    if (!user) return;

    const status = forceCancel ? 'canceled' : sub.status;
    const tier = forceCancel ? 'free' : WebhookHandlers.tierFromSubscription(sub);

    await storage.updateUserStripeInfo(user.id, {
      stripeSubscriptionId: sub.id,
      subscriptionTier: tier,
      subscriptionStatus: status,
    });
    console.log(`[Stripe] Updated user ${user.id} subscription: ${tier}/${status}`);
  }

  private static tierFromSubscription(sub: Stripe.Subscription): string {
    // Map price/product metadata to tier name; fall back to 'basic'
    const item = sub.items?.data?.[0];
    const meta = (item?.price?.product as Stripe.Product)?.metadata;
    if (meta?.tier) return meta.tier;
    // Heuristic: check price nickname
    const nickname = item?.price?.nickname?.toLowerCase() || '';
    if (nickname.includes('pro')) return 'pro';
    if (nickname.includes('institutional')) return 'institutional';
    return 'basic';
  }
}
