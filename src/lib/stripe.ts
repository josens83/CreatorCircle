import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
  typescript: true,
});

export const PLATFORM_FEE_PERCENT = 10; // 10% 플랫폼 수수료

export async function createStripeCustomer(email: string, name: string) {
  return await stripe.customers.create({
    email,
    name,
    metadata: {
      platform: "creatorcircle",
    },
  });
}

export async function createStripeConnectAccount(
  email: string,
  country: string = "KR"
) {
  return await stripe.accounts.create({
    type: "express",
    country,
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: "individual",
    metadata: {
      platform: "creatorcircle",
    },
  });
}

export async function createConnectAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
) {
  return await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
}

export async function createCheckoutSession({
  customerId,
  priceId,
  circleId,
  tierId,
  creatorConnectId,
  successUrl,
  cancelUrl,
  referralCode,
}: {
  customerId: string;
  priceId: string;
  circleId: string;
  tierId: string;
  creatorConnectId: string;
  successUrl: string;
  cancelUrl: string;
  referralCode?: string;
}) {
  const applicationFeePercent = PLATFORM_FEE_PERCENT;

  return await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      application_fee_percent: applicationFeePercent,
      transfer_data: {
        destination: creatorConnectId,
      },
      metadata: {
        circleId,
        tierId,
        referralCode: referralCode || "",
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      circleId,
      tierId,
      referralCode: referralCode || "",
    },
  });
}

export async function createProductCheckoutSession({
  customerId,
  productId,
  amount,
  creatorConnectId,
  successUrl,
  cancelUrl,
}: {
  customerId: string;
  productId: string;
  amount: number;
  creatorConnectId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const applicationFeeAmount = Math.floor(amount * (PLATFORM_FEE_PERCENT / 100));

  return await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "krw",
          product_data: {
            name: "디지털 상품",
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: creatorConnectId,
      },
      metadata: {
        productId,
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      productId,
    },
  });
}

export async function createStripePrice({
  amount,
  currency = "krw",
  interval,
  productName,
  stripeConnectId,
}: {
  amount: number;
  currency?: string;
  interval: "month" | "year";
  productName: string;
  stripeConnectId: string;
}) {
  const product = await stripe.products.create(
    {
      name: productName,
    },
    {
      stripeAccount: stripeConnectId,
    }
  );

  const price = await stripe.prices.create(
    {
      product: product.id,
      unit_amount: amount,
      currency,
      recurring: {
        interval,
      },
    },
    {
      stripeAccount: stripeConnectId,
    }
  );

  return { product, price };
}

export async function cancelSubscription(subscriptionId: string) {
  return await stripe.subscriptions.cancel(subscriptionId);
}

export async function getSubscription(subscriptionId: string) {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

export async function createPayout(
  stripeConnectId: string,
  amount: number,
  currency: string = "krw"
) {
  return await stripe.transfers.create({
    amount,
    currency,
    destination: stripeConnectId,
  });
}
