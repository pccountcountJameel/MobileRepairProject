
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error("Stripe webhook configuration is missing.");
    return jsonError("Webhook is not configured.", 503);
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return jsonError("Missing Stripe signature.", 400);
  }

  const stripe = new Stripe(secretKey);

  let event: Stripe.Event;

  try {
    // Stripe signature verification requires the original raw body.
    const rawBody = await request.text();

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return jsonError("Invalid webhook signature.", 400);
  }

  const isCheckoutPaymentEvent =
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded";

  if (!isCheckoutPaymentEvent) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Do not register a checkout that has not actually been paid.
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const orderId = session.metadata?.orderId;
  const serviceId = session.metadata?.serviceId;

  if (
    !orderId ||
    !serviceId ||
    session.client_reference_id !== orderId
  ) {
    console.error("Stripe session is missing valid order metadata.");
    return jsonError("Invalid checkout metadata.", 400);
  }

  if (
    session.currency !== "sar" ||
    session.amount_total === null ||
    !Number.isSafeInteger(session.amount_total) ||
    session.amount_total <= 0 ||
    session.amount_total % 100 !== 0
  ) {
    console.error("Stripe session has an invalid amount or currency.");
    return jsonError("Invalid payment amount or currency.", 400);
  }

  // The database stores amounts in whole SAR, not halalas.
  const amountSar = session.amount_total / 100;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  try {
    await prisma.$transaction(
      async (tx) => {
        const existingPayment = await tx.payment.findUnique({
          where: { stripeSessionId: session.id },
          select: { id: true },
        });

        // Stripe can deliver the same event more than once.
        if (existingPayment) {
          return;
        }

        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            serviceId: true,
            totalAmount: true,
            isPaid: true,
            service: {
              select: {
                id: true,
                quoteAmount: true,
                quoteStatus: true,
              },
            },
          },
        });

        if (
          !order ||
          order.serviceId !== serviceId ||
          order.service.id !== serviceId
        ) {
          throw new Error("ORDER_SERVICE_MISMATCH");
        }

        if (
          order.totalAmount === null ||
          !Number.isSafeInteger(order.totalAmount) ||
          order.totalAmount <= 0 ||
          amountSar !== order.totalAmount ||
          order.service.quoteStatus !== "approved" ||
          order.service.quoteAmount !== order.totalAmount
        ) {
          throw new Error("PAYMENT_AMOUNT_OR_QUOTE_MISMATCH");
        }

        // Do not mark the order paid if another payment already
        // settled it. The unique Stripe session ID prevents duplicates.
        if (order.isPaid) {
          throw new Error("ORDER_ALREADY_PAID");
        }

        const previousPayments = await tx.payment.aggregate({
          where: { orderId: order.id },
          _sum: { amount: true },
        });

        const previouslyPaid = previousPayments._sum.amount ?? 0;

        // This checkout currently charges the full invoice amount.
        // Never silently accept a payment that would overpay the order.
        if (previouslyPaid + amountSar > order.totalAmount) {
          throw new Error("PAYMENT_WOULD_OVERPAY_ORDER");
        }

        await tx.payment.create({
          data: {
            orderId: order.id,
            amount: amountSar,
            method: "card",
            reference: paymentIntentId,
            stripeSessionId: session.id,
            note: "Verified Stripe Checkout payment",
          },
        });

        const totalPaid = previouslyPaid + amountSar;
        const isFullyPaid = totalPaid === order.totalAmount;

        await tx.order.update({
          where: { id: order.id },
          data: { isPaid: isFullyPaid },
        });

        await tx.service.update({
          where: { id: serviceId },
          data: { isPaid: isFullyPaid },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    // A concurrent delivery may have inserted this session already.
    // Confirm that in the database before acknowledging it as a duplicate.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existingPayment = await prisma.payment.findUnique({
        where: { stripeSessionId: session.id },
        select: { id: true },
      });

      if (existingPayment) {
        return NextResponse.json({ received: true });
      }
    }

    console.error("Stripe webhook processing failed:", error);

    // A non-2xx response allows Stripe to retry the event.
    return jsonError("Unable to process the payment event.", 500);
  }
}
