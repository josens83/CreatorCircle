import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed:`, err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(subscription);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const { circleId, tierId, referralCode } = session.metadata || {};

  if (!circleId) return;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: session.customer as string },
  });

  if (!user) return;

  // 멤버 생성 또는 업데이트
  const member = await prisma.member.upsert({
    where: {
      userId_circleId: {
        userId: user.id,
        circleId,
      },
    },
    update: {
      status: "ACTIVE",
      tierId,
      memberType: "PAID",
    },
    create: {
      userId: user.id,
      circleId,
      status: "ACTIVE",
      tierId,
      memberType: "PAID",
    },
  });

  // 서클 멤버 수 업데이트
  await prisma.circle.update({
    where: { id: circleId },
    data: {
      memberCount: { increment: 1 },
    },
  });

  // 제휴 처리
  if (referralCode) {
    const referral = await prisma.referral.findUnique({
      where: { code: referralCode },
    });

    if (referral) {
      await prisma.referral.update({
        where: { id: referral.id },
        data: {
          conversions: { increment: 1 },
        },
      });
    }
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const { circleId, tierId } = subscription.metadata || {};

  if (!circleId) return;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: subscription.customer as string },
  });

  if (!user) return;

  const member = await prisma.member.findUnique({
    where: {
      userId_circleId: {
        userId: user.id,
        circleId,
      },
    },
  });

  if (!member) return;

  await prisma.subscription.create({
    data: {
      memberId: member.id,
      circleId,
      userId: user.id,
      planType: subscription.items.data[0].price.recurring?.interval === "year" ? "YEARLY" : "MONTHLY",
      tierId,
      amount: subscription.items.data[0].price.unit_amount || 0,
      status: "ACTIVE",
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
    },
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: subscription.status === "active" ? "ACTIVE" :
              subscription.status === "past_due" ? "PAST_DUE" :
              subscription.status === "canceled" ? "CANCELLED" : "EXPIRED",
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    include: { member: true },
  });

  if (!sub) return;

  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  });

  await prisma.member.update({
    where: { id: sub.memberId },
    data: {
      status: "EXPIRED",
      memberType: "FREE",
    },
  });

  await prisma.circle.update({
    where: { id: sub.circleId },
    data: {
      memberCount: { decrement: 1 },
    },
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: invoice.subscription as string },
    include: {
      member: {
        include: { circle: { include: { creator: true } } },
      },
      referral: true,
    },
  });

  if (!subscription) return;

  // 크리에이터 수익 업데이트
  const amount = invoice.amount_paid;
  const platformFee = Math.floor(amount * 0.1); // 10%
  const creatorEarnings = amount - platformFee;

  await prisma.creator.update({
    where: { id: subscription.member.circle.creator.id },
    data: {
      totalRevenue: { increment: creatorEarnings },
      pendingPayout: { increment: creatorEarnings },
    },
  });

  // 제휴 커미션 처리
  if (subscription.referralId) {
    const referral = subscription.referral;
    if (referral) {
      const commissionAmount = Math.floor(
        creatorEarnings * Number(referral.commissionRate)
      );

      await prisma.referralConversion.create({
        data: {
          referralId: referral.id,
          referrerId: referral.referrerId,
          referredUserId: subscription.userId,
          subscriptionId: subscription.id,
          subscriptionAmount: amount,
          commissionAmount,
          commissionRate: referral.commissionRate,
        },
      });

      await prisma.referral.update({
        where: { id: referral.id },
        data: {
          totalEarnings: { increment: commissionAmount },
          pendingEarnings: { increment: commissionAmount },
        },
      });
    }
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: invoice.subscription as string },
    data: {
      status: "PAST_DUE",
    },
  });
}
