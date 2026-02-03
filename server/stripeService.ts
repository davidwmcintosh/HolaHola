import { storage } from './storage';
import { getUncachableStripeClient } from './stripeClient';
import { usageService } from './services/usage-service';

// Default hour package configurations (can be overridden by database config)
export const DEFAULT_HOUR_PACKAGES = {
  try_it: { hours: 1, priceUsd: 12, name: 'Try It', productId: 'hour_pkg_try_it' },
  starter: { hours: 5, priceUsd: 50, name: 'Starter', productId: 'hour_pkg_starter' },
  regular: { hours: 10, priceUsd: 90, name: 'Regular', productId: 'hour_pkg_regular' },
  committed: { hours: 20, priceUsd: 160, name: 'Committed', productId: 'hour_pkg_committed' },
} as const;

export type HourPackageTier = keyof typeof DEFAULT_HOUR_PACKAGES;

// Default institutional class package configurations (can be overridden by database config)
export const DEFAULT_INSTITUTIONAL_PACKAGES = {
  basic: { hoursPerStudent: 10, pricePerStudentUsd: 50, name: 'Basic', productId: 'inst_pkg_basic' },
  standard: { hoursPerStudent: 20, pricePerStudentUsd: 100, name: 'Standard', productId: 'inst_pkg_standard' },
  premium: { hoursPerStudent: 30, pricePerStudentUsd: 150, name: 'Premium', productId: 'inst_pkg_premium' },
  full_year: { hoursPerStudent: 120, pricePerStudentUsd: 600, name: 'Full Year', productId: 'inst_pkg_full_year' },
} as const;

export type InstitutionalPackageTier = keyof typeof DEFAULT_INSTITUTIONAL_PACKAGES;

// Helper to get pricing config from database with fallbacks
async function getPricingConfig(): Promise<{
  hourRateCents: number;
  classPriceCents: number;
  pack5hrDiscount: number;
  pack10hrDiscount: number;
}> {
  try {
    const configs = await storage.getAllProductConfig();
    const configMap = configs.reduce((acc, c) => ({ ...acc, [c.key]: c.value }), {} as Record<string, string>);
    return {
      hourRateCents: parseInt(configMap.hour_rate_cents) || 580, // $5.80/hour default
      classPriceCents: parseInt(configMap.class_price_cents) || 4900, // $49/class default
      pack5hrDiscount: parseInt(configMap.pack_5hr_discount_percent) || 0,
      pack10hrDiscount: parseInt(configMap.pack_10hr_discount_percent) || 10,
    };
  } catch {
    return { hourRateCents: 580, classPriceCents: 4900, pack5hrDiscount: 0, pack10hrDiscount: 10 };
  }
}

export class StripeService {
  private async getStripeOrThrow() {
    const stripe = await getUncachableStripeClient();
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set up Stripe in the deployment settings.');
    }
    return stripe;
  }

  async createCustomer(email: string, userId: string) {
    const stripe = await this.getStripeOrThrow();
    return await stripe.customers.create({
      email,
      metadata: { userId },
    });
  }

  async createCheckoutSession(customerId: string, priceId: string, successUrl: string, cancelUrl: string) {
    const stripe = await this.getStripeOrThrow();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  async createHourPackageCheckoutSession(
    customerId: string, 
    userId: string,
    packageTier: HourPackageTier, 
    successUrl: string, 
    cancelUrl: string
  ) {
    const stripe = await this.getStripeOrThrow();
    const pkg = DEFAULT_HOUR_PACKAGES[packageTier];
    
    if (!pkg) {
      throw new Error(`Invalid package tier: ${packageTier}`);
    }
    
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${pkg.name} - ${pkg.hours} Hour${pkg.hours > 1 ? 's' : ''} of AI Tutoring`,
            description: `${pkg.hours} hours of personalized language tutoring with your AI tutor`,
            metadata: {
              tier: packageTier,
              hours: pkg.hours.toString(),
            },
          },
          unit_amount: pkg.priceUsd * 100, // Convert to cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        packageTier,
        hours: pkg.hours.toString(),
        type: 'hour_package',
      },
    });
  }
  
  async fulfillHourPackage(sessionId: string, requestingUserId?: string): Promise<{ success: boolean; hoursAdded?: number; error?: string; alreadyProcessed?: boolean }> {
    try {
      const stripe = await this.getStripeOrThrow();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status !== 'paid') {
        return { success: false, error: 'Payment not completed' };
      }
      
      const userId = session.metadata?.userId;
      const packageTier = session.metadata?.packageTier as HourPackageTier;
      const hours = parseInt(session.metadata?.hours || '0', 10);
      
      if (!userId || !packageTier || !hours) {
        return { success: false, error: 'Missing metadata in checkout session' };
      }
      
      // Security: Verify the requesting user matches the session owner
      if (requestingUserId && requestingUserId !== userId) {
        console.warn(`[Stripe] User ${requestingUserId} tried to fulfill session for user ${userId}`);
        return { success: false, error: 'Session does not belong to this user' };
      }
      
      // Idempotency: Check if this session has already been processed
      const existingEntry = await usageService.checkExistingPayment(sessionId);
      if (existingEntry) {
        console.log(`[Stripe] Session ${sessionId} already processed, skipping duplicate`);
        return { success: true, hoursAdded: 0, alreadyProcessed: true };
      }
      
      // Credit the hours to the user's balance
      await usageService.addCredits(
        userId,
        hours * 3600, // Convert hours to seconds
        'purchase',
        `Hour package purchase: ${DEFAULT_HOUR_PACKAGES[packageTier].name} (${hours}h, $${(session.amount_total || 0) / 100}, session: ${sessionId})`,
        {
          stripePaymentId: sessionId,
        }
      );
      
      console.log(`[Stripe] Successfully credited ${hours} hours for user ${userId} (session: ${sessionId})`);
      return { success: true, hoursAdded: hours };
    } catch (error: any) {
      console.error('[Stripe] Error fulfilling hour package:', error);
      return { success: false, error: error.message };
    }
  }
  
  getHourPackages() {
    return Object.entries(DEFAULT_HOUR_PACKAGES).map(([tier, config]) => ({
      tier,
      ...config,
      pricePerHour: Math.round(config.priceUsd / config.hours * 100) / 100,
    }));
  }

  getInstitutionalPackages() {
    return Object.entries(DEFAULT_INSTITUTIONAL_PACKAGES).map(([tier, config]) => ({
      tier,
      ...config,
      pricePerHour: Math.round(config.pricePerStudentUsd / config.hoursPerStudent * 100) / 100,
      costPerStudent: Math.round(config.hoursPerStudent * 2.47 * 100) / 100,
      profitPerStudent: Math.round((config.pricePerStudentUsd - config.hoursPerStudent * 2.47) * 100) / 100,
      marginPercent: Math.round(((config.pricePerStudentUsd - config.hoursPerStudent * 2.47) / (config.hoursPerStudent * 2.47)) * 100),
    }));
  }

  async createInstitutionalPackageCheckoutSession(
    customerId: string,
    userId: string,
    packageTier: InstitutionalPackageTier,
    studentCount: number,
    classId: string,
    successUrl: string,
    cancelUrl: string
  ) {
    const stripe = await this.getStripeOrThrow();
    const pkg = DEFAULT_INSTITUTIONAL_PACKAGES[packageTier];
    
    if (!pkg) {
      throw new Error(`Invalid institutional package tier: ${packageTier}`);
    }

    if (studentCount < 1 || studentCount > 500) {
      throw new Error('Student count must be between 1 and 500');
    }

    const totalPrice = pkg.pricePerStudentUsd * studentCount;
    const totalHours = pkg.hoursPerStudent * studentCount;
    
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${pkg.name} Class Package - ${studentCount} Students`,
            description: `${pkg.hoursPerStudent} hours per student (${totalHours} total hours) for your class`,
            metadata: {
              tier: packageTier,
              hoursPerStudent: pkg.hoursPerStudent.toString(),
              studentCount: studentCount.toString(),
              classId,
            },
          },
          unit_amount: Math.round(totalPrice * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: 'institutional_package',
        userId,
        tier: packageTier,
        hoursPerStudent: pkg.hoursPerStudent.toString(),
        studentCount: studentCount.toString(),
        classId,
      },
    });
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    const stripe = await this.getStripeOrThrow();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getProduct(productId: string) {
    return await storage.getProduct(productId);
  }

  async getSubscription(subscriptionId: string) {
    return await storage.getSubscription(subscriptionId);
  }
}

export const stripeService = new StripeService();
