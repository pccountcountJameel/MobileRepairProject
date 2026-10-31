
import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";


type QuoteDecision = "approved" | "rejected";

class QuoteConflictError extends Error {}

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
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid request data." },
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

    const decision =
      typeof input.decision === "string"
        ? input.decision
        : "";

    if (!trackingNumber || trackingNumber.length > 100) {
      return NextResponse.json(
        { error: "A valid tracking number is required." },
        { status: 400 }
      );
    }

    if (!/^[a-f0-9]{64}$/i.test(trackingToken)) {
      return NextResponse.json(
        { error: "Tracking session is invalid or expired." },
        { status: 401 }
      );
    }

    if (decision !== "approved" && decision !== "rejected") {
      return NextResponse.json(
        { error: "Invalid quote decision." },
        { status: 400 }
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
        {
          error:
            "Tracking session is invalid or expired. Verify again by email.",
        },
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
        quoteStatus: true,
        quoteAmount: true,
      },
    });

    if (!service) {
      return NextResponse.json(
        { error: "Could not verify this request." },
        { status: 404 }
      );
    }

    if (
      service.quoteStatus !== "pending" ||
      service.quoteAmount == null
    ) {
      return NextResponse.json(
        {
          error: "No pending quotation is available for a decision.",
          quoteStatus: service.quoteStatus,
        },
        { status: 409 }
      );
    }

    const quoteDecision: QuoteDecision = decision;

    const result = await prisma.$transaction(
      async (tx) => {
        const decisionResult = await tx.service.updateMany({
          where: {
            id: service.id,
            quoteStatus: "pending",
            quoteAmount: service.quoteAmount,
          },
          data: {
            quoteStatus: quoteDecision,
          },
        });

        if (decisionResult.count !== 1) {
          throw new QuoteConflictError(
            "The quotation has already changed."
          );
        }

        let fullyReservedRequirements = 0;
        let partiallyReservedRequirements = 0;
        let unavailableRequirements = 0;

        if (quoteDecision === "approved") {
          const requirements =
            await tx.servicePartRequirement.findMany({
              where: { serviceId: service.id },
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                sparePartId: true,
                quantityRequired: true,
                quantityReserved: true,
              },
            });

          for (const requirement of requirements) {
            const required = requirement.quantityRequired;

            const alreadyReserved = Math.min(
              required,
              Math.max(0, requirement.quantityReserved)
            );

            const remainingRequired = Math.max(
              0,
              required - alreadyReserved
            );

            let additionalReserved = 0;

            if (
              requirement.sparePartId &&
              remainingRequired > 0
            ) {
              const part = await tx.sparePart.findUnique({
                where: { id: requirement.sparePartId },
                select: {
                  id: true,
                  isActive: true,
                  quantityOnHand: true,
                  quantityReserved: true,
                },
              });

              if (part?.isActive) {
                const available = Math.max(
                  0,
                  part.quantityOnHand - part.quantityReserved
                );

                additionalReserved = Math.min(
                  remainingRequired,
                  available
                );

                if (additionalReserved > 0) {
                  const stockUpdate =
                    await tx.sparePart.updateMany({
                      where: {
                        id: part.id,
                        isActive: true,
                        quantityOnHand: part.quantityOnHand,
                        quantityReserved: part.quantityReserved,
                      },
                      data: {
                        quantityReserved: {
                          increment: additionalReserved,
                        },
                      },
                    });

                  if (stockUpdate.count !== 1) {
                    throw new QuoteConflictError(
                      "Inventory changed while reserving parts."
                    );
                  }
                }
              }
            }

            const totalReserved =
              alreadyReserved + additionalReserved;

            const status =
              totalReserved >= required
                ? "reserved"
                : totalReserved > 0
                  ? "partially_reserved"
                  : "unavailable";

            await tx.servicePartRequirement.update({
              where: { id: requirement.id },
              data: {
                quantityReserved: totalReserved,
                status,
              },
            });

            if (status === "reserved") {
              fullyReservedRequirements++;
            } else if (status === "partially_reserved") {
              partiallyReservedRequirements++;
            } else {
              unavailableRequirements++;
            }
          }
        }

        return {
          quoteStatus: quoteDecision,
          quoteAmount: String(service.quoteAmount),
          inventory: {
            fullyReservedRequirements,
            partiallyReservedRequirements,
            unavailableRequirements,
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return NextResponse.json({
      success: true,
      message:
        quoteDecision === "approved"
          ? "Quotation approved successfully."
          : "Quotation rejected successfully.",
      service: {
        quoteStatus: result.quoteStatus,
        quoteAmount: result.quoteAmount,
      },
      ...(quoteDecision === "approved"
        ? { inventory: result.inventory }
        : {}),
    });
  } catch (error) {
    if (error instanceof QuoteConflictError) {
      return NextResponse.json(
        {
          error:
            "The quotation or inventory changed during this operation. Search again before retrying.",
        },
        { status: 409 }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        {
          error:
            "Another operation changed the inventory. Please search again and retry.",
        },
        { status: 409 }
      );
    }

    console.error(
      "Quote decision error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to save the quotation decision." },
      { status: 500 }
    );
  }
}
