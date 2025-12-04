/**
 * Stripe Mock
 * Complete mock for Stripe API with realistic responses
 */

import { vi } from 'vitest';

// =============================================================================
// Mock Data Store
// =============================================================================

interface StripeStore {
  customers: Map<string, MockCustomer>;
  subscriptions: Map<string, MockSubscription>;
  paymentIntents: Map<string, MockPaymentIntent>;
  invoices: Map<string, MockInvoice>;
  products: Map<string, MockProduct>;
  prices: Map<string, MockPrice>;
  accounts: Map<string, MockConnectAccount>;
}

const store: StripeStore = {
  customers: new Map(),
  subscriptions: new Map(),
  paymentIntents: new Map(),
  invoices: new Map(),
  products: new Map(),
  prices: new Map(),
  accounts: new Map(),
};

// =============================================================================
// Types
// =============================================================================

interface MockCustomer {
  id: string;
  object: 'customer';
  email: string;
  name: string | null;
  metadata: Record<string, string>;
  created: number;
}

interface MockSubscription {
  id: string;
  object: 'subscription';
  customer: string;
  status: 'active' | 'canceled' | 'incomplete' | 'past_due' | 'trialing';
  current_period_start: number;
  current_period_end: number;
  items: { data: Array<{ id: string; price: { id: string } }> };
  metadata: Record<string, string>;
  created: number;
}

interface MockPaymentIntent {
  id: string;
  object: 'payment_intent';
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'succeeded' | 'canceled';
  customer: string | null;
  metadata: Record<string, string>;
  created: number;
}

interface MockInvoice {
  id: string;
  object: 'invoice';
  customer: string;
  subscription: string | null;
  amount_due: number;
  amount_paid: number;
  status: 'draft' | 'open' | 'paid' | 'void';
  created: number;
}

interface MockProduct {
  id: string;
  object: 'product';
  name: string;
  active: boolean;
  metadata: Record<string, string>;
  created: number;
}

interface MockPrice {
  id: string;
  object: 'price';
  product: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: 'month' | 'year' } | null;
  active: boolean;
  created: number;
}

interface MockConnectAccount {
  id: string;
  object: 'account';
  type: 'express' | 'standard' | 'custom';
  email: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  metadata: Record<string, string>;
  created: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateId(prefix: string): string {
  return `${prefix}_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

function timestamp(): number {
  return Math.floor(Date.now() / 1000);
}

// =============================================================================
// Mock Stripe Client
// =============================================================================

export const mockStripe = {
  // Customers
  customers: {
    create: vi.fn().mockImplementation(async (params) => {
      const customer: MockCustomer = {
        id: generateId('cus'),
        object: 'customer',
        email: params.email,
        name: params.name || null,
        metadata: params.metadata || {},
        created: timestamp(),
      };
      store.customers.set(customer.id, customer);
      return customer;
    }),

    retrieve: vi.fn().mockImplementation(async (id: string) => {
      const customer = store.customers.get(id);
      if (!customer) {
        const error = new Error('No such customer') as Error & { code: string };
        error.code = 'resource_missing';
        throw error;
      }
      return customer;
    }),

    update: vi.fn().mockImplementation(async (id: string, params) => {
      const customer = store.customers.get(id);
      if (!customer) throw new Error('No such customer');
      const updated = { ...customer, ...params };
      store.customers.set(id, updated);
      return updated;
    }),

    del: vi.fn().mockImplementation(async (id: string) => {
      store.customers.delete(id);
      return { id, object: 'customer', deleted: true };
    }),

    list: vi.fn().mockImplementation(async () => ({
      object: 'list',
      data: Array.from(store.customers.values()),
      has_more: false,
    })),
  },

  // Subscriptions
  subscriptions: {
    create: vi.fn().mockImplementation(async (params) => {
      const subscription: MockSubscription = {
        id: generateId('sub'),
        object: 'subscription',
        customer: params.customer,
        status: 'active',
        current_period_start: timestamp(),
        current_period_end: timestamp() + 30 * 24 * 60 * 60,
        items: {
          data: params.items.map((item: { price: string }) => ({
            id: generateId('si'),
            price: { id: item.price },
          })),
        },
        metadata: params.metadata || {},
        created: timestamp(),
      };
      store.subscriptions.set(subscription.id, subscription);
      return subscription;
    }),

    retrieve: vi.fn().mockImplementation(async (id: string) => {
      const subscription = store.subscriptions.get(id);
      if (!subscription) throw new Error('No such subscription');
      return subscription;
    }),

    update: vi.fn().mockImplementation(async (id: string, params) => {
      const subscription = store.subscriptions.get(id);
      if (!subscription) throw new Error('No such subscription');
      const updated = { ...subscription, ...params };
      store.subscriptions.set(id, updated);
      return updated;
    }),

    cancel: vi.fn().mockImplementation(async (id: string) => {
      const subscription = store.subscriptions.get(id);
      if (!subscription) throw new Error('No such subscription');
      subscription.status = 'canceled';
      return subscription;
    }),

    list: vi.fn().mockImplementation(async (params) => ({
      object: 'list',
      data: Array.from(store.subscriptions.values()).filter(
        (sub) => !params?.customer || sub.customer === params.customer
      ),
      has_more: false,
    })),
  },

  // Payment Intents
  paymentIntents: {
    create: vi.fn().mockImplementation(async (params) => {
      const paymentIntent: MockPaymentIntent = {
        id: generateId('pi'),
        object: 'payment_intent',
        amount: params.amount,
        currency: params.currency || 'krw',
        status: 'requires_payment_method',
        customer: params.customer || null,
        metadata: params.metadata || {},
        created: timestamp(),
      };
      store.paymentIntents.set(paymentIntent.id, paymentIntent);
      return paymentIntent;
    }),

    retrieve: vi.fn().mockImplementation(async (id: string) => {
      const pi = store.paymentIntents.get(id);
      if (!pi) throw new Error('No such payment intent');
      return pi;
    }),

    confirm: vi.fn().mockImplementation(async (id: string) => {
      const pi = store.paymentIntents.get(id);
      if (!pi) throw new Error('No such payment intent');
      pi.status = 'succeeded';
      return pi;
    }),

    cancel: vi.fn().mockImplementation(async (id: string) => {
      const pi = store.paymentIntents.get(id);
      if (!pi) throw new Error('No such payment intent');
      pi.status = 'canceled';
      return pi;
    }),
  },

  // Products
  products: {
    create: vi.fn().mockImplementation(async (params) => {
      const product: MockProduct = {
        id: generateId('prod'),
        object: 'product',
        name: params.name,
        active: true,
        metadata: params.metadata || {},
        created: timestamp(),
      };
      store.products.set(product.id, product);
      return product;
    }),

    retrieve: vi.fn().mockImplementation(async (id: string) => {
      const product = store.products.get(id);
      if (!product) throw new Error('No such product');
      return product;
    }),

    update: vi.fn().mockImplementation(async (id: string, params) => {
      const product = store.products.get(id);
      if (!product) throw new Error('No such product');
      const updated = { ...product, ...params };
      store.products.set(id, updated);
      return updated;
    }),

    list: vi.fn().mockImplementation(async () => ({
      object: 'list',
      data: Array.from(store.products.values()),
      has_more: false,
    })),
  },

  // Prices
  prices: {
    create: vi.fn().mockImplementation(async (params) => {
      const price: MockPrice = {
        id: generateId('price'),
        object: 'price',
        product: params.product,
        unit_amount: params.unit_amount,
        currency: params.currency || 'krw',
        recurring: params.recurring || null,
        active: true,
        created: timestamp(),
      };
      store.prices.set(price.id, price);
      return price;
    }),

    retrieve: vi.fn().mockImplementation(async (id: string) => {
      const price = store.prices.get(id);
      if (!price) throw new Error('No such price');
      return price;
    }),

    list: vi.fn().mockImplementation(async (params) => ({
      object: 'list',
      data: Array.from(store.prices.values()).filter(
        (p) => !params?.product || p.product === params.product
      ),
      has_more: false,
    })),
  },

  // Connect Accounts
  accounts: {
    create: vi.fn().mockImplementation(async (params) => {
      const account: MockConnectAccount = {
        id: generateId('acct'),
        object: 'account',
        type: params.type || 'express',
        email: params.email,
        charges_enabled: false,
        payouts_enabled: false,
        metadata: params.metadata || {},
        created: timestamp(),
      };
      store.accounts.set(account.id, account);
      return account;
    }),

    retrieve: vi.fn().mockImplementation(async (id: string) => {
      const account = store.accounts.get(id);
      if (!account) throw new Error('No such account');
      return account;
    }),

    createLoginLink: vi.fn().mockImplementation(async () => ({
      object: 'login_link',
      url: 'https://connect.stripe.com/express/mock_login',
    })),
  },

  // Account Links (for onboarding)
  accountLinks: {
    create: vi.fn().mockImplementation(async () => ({
      object: 'account_link',
      url: 'https://connect.stripe.com/setup/mock_onboarding',
      expires_at: timestamp() + 300,
    })),
  },

  // Balance
  balance: {
    retrieve: vi.fn().mockImplementation(async () => ({
      object: 'balance',
      available: [{ amount: 100000, currency: 'krw' }],
      pending: [{ amount: 50000, currency: 'krw' }],
    })),
  },

  // Checkout Sessions
  checkout: {
    sessions: {
      create: vi.fn().mockImplementation(async (params) => ({
        id: generateId('cs'),
        object: 'checkout.session',
        url: 'https://checkout.stripe.com/c/pay/mock_session',
        mode: params.mode,
        customer: params.customer,
        metadata: params.metadata || {},
      })),

      retrieve: vi.fn().mockImplementation(async (id: string) => ({
        id,
        object: 'checkout.session',
        payment_status: 'paid',
        status: 'complete',
      })),
    },
  },

  // Webhooks
  webhooks: {
    constructEvent: vi.fn().mockImplementation((payload, signature, secret) => {
      // Return the parsed payload as an event
      const body = typeof payload === 'string' ? JSON.parse(payload) : payload;
      return {
        id: generateId('evt'),
        object: 'event',
        type: body.type || 'test.event',
        data: body.data || { object: {} },
        created: timestamp(),
      };
    }),
  },

  // Refunds
  refunds: {
    create: vi.fn().mockImplementation(async (params) => ({
      id: generateId('re'),
      object: 'refund',
      amount: params.amount,
      payment_intent: params.payment_intent,
      status: 'succeeded',
      created: timestamp(),
    })),
  },

  // Store access for testing
  _store: store,
  _reset: () => {
    store.customers.clear();
    store.subscriptions.clear();
    store.paymentIntents.clear();
    store.invoices.clear();
    store.products.clear();
    store.prices.clear();
    store.accounts.clear();
  },
};

// Mock the actual stripe module
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => mockStripe),
}));

export default mockStripe;
