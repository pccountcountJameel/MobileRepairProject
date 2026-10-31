
import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";


function hashTrackingToken(token: string): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET is missing or too short.");
  }

  return createHmac("sha256", secret)
    .update(`tracking-session:${token}`)
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø±Ø³Ù„Ø© ØºÙŠØ± ØµØ§Ù„Ø­Ø©." },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø±Ø³Ù„Ø© ØºÙŠØ± ØµØ§Ù„Ø­Ø©." },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;
    const trackingNumber =
      typeof input.trackingNumber === "string"
        ? input.trackingNumber.trim().toUpperCase()
        : "";
    const trackingToken =
      typeof input.trackingToken === "string"
        ? input.trackingToken.trim()
        : "";

    if (
      !trackingNumber ||
      trackingNumber.length > 100 ||
      !/^[a-f0-9]{64}$/i.test(trackingToken)
    ) {
      return NextResponse.json(
        { error: "Ø¬Ù„Ø³Ø© Ø§Ù„ØªØªØ¨Ø¹ ØºÙŠØ± ØµØ§Ù„Ø­Ø©. ØªØ­Ù‚Ù‘Ù‚ Ù…Ù† Ø§Ù„Ø·Ù„Ø¨ Ù…Ø¬Ø¯Ø¯Ù‹Ø§." },
        { status: 401 }
      );
    }

    if (!redis.isOpen) {
      await redis.connect();
    }

    const tokenHash = hashTrackingToken(trackingToken);
    const trackingSessionKey = `track:session:${tokenHash}`;
    const sessionServiceId = await redis.get(trackingSessionKey);

    if (!sessionServiceId) {
      return NextResponse.json(
        { error: "Ø§Ù†ØªÙ‡Øª ØµÙ„Ø§Ø­ÙŠØ© Ø¬Ù„Ø³Ø© Ø§Ù„ØªØªØ¨Ø¹. ØªØ­Ù‚Ù‘Ù‚ Ù…Ø¬Ø¯Ø¯Ù‹Ø§ Ø¹Ø¨Ø± Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ." },
        { status: 401 }
      );
    }

    const service = await prisma.service.findFirst({
      where: {
        id: sessionServiceId,
        trackingNumber,
      },
      select: {
        id: true,
        trackingNumber: true,
        deviceType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        estimated_completion_time: true,
        pickup_date: true,
        quoteAmount: true,
        quoteStatus: true,
        statusHistory: {
          orderBy: { createdAt: "desc" },
          select: {
            status: true,
            note: true,
            createdAt: true,
          },
        },
      },
    });

    if (!service) {
      return NextResponse.json(
        { error: "ØªØ¹Ø°Ù‘Ø± Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ø§Ù„Ø·Ù„Ø¨ Ø¶Ù…Ù† Ø¬Ù„Ø³Ø© Ø§Ù„ØªØªØ¨Ø¹ Ù‡Ø°Ù‡." },
        { status: 404 }
      );
    }

    const partRequirements =
      await prisma.servicePartRequirement.findMany({
        where: { serviceId: service.id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          requestedPartName: true,
          requestedCode: true,
          quantityRequired: true,
          quantityReserved: true,
          status: true,
          sparePart: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      });

    return NextResponse.json({
      service: {
        trackingNumber: service.trackingNumber,
        deviceType: service.deviceType,
        status: service.status,
        createdAt: service.createdAt,
        updatedAt: service.updatedAt,
        estimatedCompletionTime: service.estimated_completion_time,
        pickupDate: service.pickup_date,
        quoteAmount:
          service.quoteAmount == null
            ? null
            : String(service.quoteAmount),
        quoteStatus: service.quoteStatus,
        statusHistory: service.statusHistory,
        partRequirements: partRequirements.map((requirement) => ({
          id: requirement.id,
          name:
            requirement.sparePart?.name ??
            requirement.requestedPartName,
          code:
            requirement.sparePart?.code ??
            requirement.requestedCode,
          quantityRequired: requirement.quantityRequired,
          quantityReserved: requirement.quantityReserved,
          status: requirement.status,
        })),
      },
    });
  } catch (error) {
    console.error(
      "Track service error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "ØªØ¹Ø°Ù‘Ø± Ø§Ù„Ø§Ø³ØªØ¹Ù„Ø§Ù… Ø¹Ù† Ø­Ø§Ù„Ø© Ø·Ù„Ø¨ Ø§Ù„ØµÙŠØ§Ù†Ø© Ø­Ø§Ù„ÙŠÙ‹Ø§." },
      { status: 500 }
    );
  }
}
