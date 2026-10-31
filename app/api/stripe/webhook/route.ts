
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";


export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");

  if (!secretKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 503 }
    );
  }

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  const stripe = new Stripe(secretKey);

  let event: Stripe.Event;

  try {
    // Stripe requires the original, unmodified request body.
    const rawBody = await request.text();

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);

    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 400 }
    );
  }

  // Ignore events that do not confirm a completed payment.
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // A completed Checkout session is not necessarily paid.
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const orderId = session.metadata?.orderId;
  const serviceId = session.metadata?.serviceId;

  if (
    !orderId ||
    !serviceId ||
    session.client_reference_id !== orderId ||
    session.currency?.toLowerCase() !== "sar" ||
    session.amount_total === null ||
    session.amount_total === undefined ||
    !Number.isSafeInteger(session.amount_total) ||
    session.amount_total <= 0 ||
    session.amount_total % 100 !== 0
  ) {
    console.error("Stripe session failed payment validation:", session.id);

    return NextResponse.json(
      { error: "Invalid payment session data." },
      { status: 400 }
    );
  }

  // The database stores whole SAR; Stripe reports halalas.
  const paidAmount = session.amount_total / 100;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Idempotency: Stripe may deliver the same event more than once.
        const existingPayment = await tx.payment.findUnique({
          where: { stripeSessionId: session.id },
          select: { id: true },
        });

        if (existingPayment) {
          return { duplicate: true };
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
                isPaid: true,
              },
            },
          },
        });

        if (
          !order ||
          order.serviceId !== serviceId ||
          order.service.id !== serviceId ||
          order.service.quoteStatus !== "approved" ||
          order.service.quoteAmount === null ||
          order.totalAmount === null ||
          order.totalAmount !== order.service.quoteAmount ||
          !Number.isSafeInteger(order.totalAmount) ||
          order.totalAmount <= 0
        ) {
          throw new Error("ORDER_VALIDATION_FAILED");
        }

        const paymentSummary = await tx.payment.aggregate({
          where: { orderId },
          _sum: { amount: true },
        });

        const totalPaidBefore = paymentSummary._sum.amount ?? 0;

        if (
          !Number.isSafeInteger(totalPaidBefore) ||
          totalPaidBefore < 0 ||
          totalPaidBefore > order.totalAmount
        ) {
          throw new Error("INVALID_EXISTING_PAYMENT_TOTAL");
        }

        const remainingBefore = order.totalAmount - totalPaidBefore;

        // Reject stale Checkout sessions if another payment changed
        // the outstanding balance after the session was created.
        if (
          remainingBefore <= 0 ||
          paidAmount !== remainingBefore
        ) {
          throw new Error("PAYMENT_AMOUNT_MISMATCH");
        }

        if (order.isPaid || order.service.isPaid) {
          throw new Error("PAYMENT_STATUS_MISMATCH");
        }

        await tx.payment.create({
          data: {
            orderId,
            amount: paidAmount,
            method: "card",
            reference:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : null,
            stripeSessionId: session.id,
            note: "Stripe Checkout payment",
          },
        });

        const totalPaid = totalPaidBefore + paidAmount;
        const isPaid = totalPaid === order.totalAmount;

        await tx.order.update({
          where: { id: orderId },
          data: { isPaid },
        });

        await tx.service.update({
          where: { id: serviceId },
          data: { isPaid },
        });

        return { duplicate: false };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
    });
  } catch (error) {
    // A concurrent transaction may have inserted this session first.
    // Return success for that duplicate, so Stripe does not retry forever.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.payment.findUnique({
        where: { stripeSessionId: session.id },
        select: { id: true },
      });

      if (existing) {
        return NextResponse.json({
          received: true,
          duplicate: true,
        });
      }
    }

    console.error("Stripe webhook processing failed:", error);

    // A server error lets Stripe retry transient failures.
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 }
    );
  }
}
