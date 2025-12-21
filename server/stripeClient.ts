import Stripe from 'stripe';

let connectionSettings: any;
let stripeAvailable: boolean | null = null;
let credentialsCache: { publishableKey: string; secretKey: string; webhookSecretKey: string } | null = null;

async function getCredentials(): Promise<{ publishableKey: string; secretKey: string; webhookSecretKey: string } | null> {
  if (credentialsCache) {
    return credentialsCache;
  }
  
  if (stripeAvailable === false) {
    return null;
  }

  // First, check for environment variables (direct secrets)
  const envPublishable = process.env.STRIPE_PUBLISHABLE_KEY;
  const envSecret = process.env.STRIPE_SECRET_KEY;
  const envWebhook = process.env.STRIPE_WEBHOOK_SECRET;

  if (envPublishable && envSecret && envWebhook) {
    console.log('[Stripe] Using credentials from environment variables');
    credentialsCache = {
      publishableKey: envPublishable,
      secretKey: envSecret,
      webhookSecretKey: envWebhook,
    };
    stripeAvailable = true;
    return credentialsCache;
  }

  // Fallback: Try Replit Connectors API
  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY
      ? 'repl ' + process.env.REPL_IDENTITY
      : process.env.WEB_REPL_RENEWAL
        ? 'depl ' + process.env.WEB_REPL_RENEWAL
        : null;

    if (!xReplitToken || !hostname) {
      console.warn('[Stripe] No credentials found - add STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, and STRIPE_WEBHOOK_SECRET to Secrets');
      stripeAvailable = false;
      return null;
    }

    const connectorName = 'stripe';
    const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
    const targetEnvironment = isProduction ? 'production' : 'development';

    const url = new URL(`https://${hostname}/api/v2/connection`);
    url.searchParams.set('include_secrets', 'true');
    url.searchParams.set('connector_names', connectorName);
    url.searchParams.set('environment', targetEnvironment);

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    });

    const data = await response.json();
    
    connectionSettings = data.items?.[0];

    if (!connectionSettings || (!connectionSettings.settings?.publishable || !connectionSettings.settings?.secret || !connectionSettings.settings?.webhook_secret)) {
      console.warn(`[Stripe] ${targetEnvironment} connector not configured - add STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, and STRIPE_WEBHOOK_SECRET to Secrets`);
      stripeAvailable = false;
      return null;
    }

    credentialsCache = {
      publishableKey: connectionSettings.settings.publishable,
      secretKey: connectionSettings.settings.secret,
      webhookSecretKey: connectionSettings.settings.webhook_secret,
    };
    
    stripeAvailable = true;
    console.log(`[Stripe] Successfully connected via ${targetEnvironment} connector`);
    return credentialsCache;
  } catch (error) {
    console.warn('[Stripe] Failed to fetch credentials - add STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, and STRIPE_WEBHOOK_SECRET to Secrets');
    stripeAvailable = false;
    return null;
  }
}

export async function getUncachableStripeClient(): Promise<Stripe | null> {
  const credentials = await getCredentials();
  if (!credentials) {
    return null;
  }
  return new Stripe(credentials.secretKey, {
    apiVersion: '2025-11-17.clover',
  });
}

export async function getStripePublishableKey(): Promise<string | null> {
  const credentials = await getCredentials();
  return credentials?.publishableKey ?? null;
}

export async function getStripeSecretKey(): Promise<string | null> {
  const credentials = await getCredentials();
  return credentials?.secretKey ?? null;
}

export async function getStripeWebhookSecret(): Promise<string | null> {
  const credentials = await getCredentials();
  return credentials?.webhookSecretKey ?? null;
}

export async function isStripeAvailable(): Promise<boolean> {
  if (stripeAvailable !== null) {
    return stripeAvailable;
  }
  await getCredentials();
  return stripeAvailable === true;
}
