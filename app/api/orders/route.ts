import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export const instant = false;

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json(
        { error: "You are not allowed to view invoices." },
        { status: 403 }
      );
    }

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        isPaid: true,
        createdAt: true,
        service: {
          select: {
            id: true,
            deviceType: true,
            status: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("GET /api/orders error:", error);

    return NextResponse.json(
      { error: "Unable to retrieve invoices." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (user.role !== "admin" && user.role !== "super_admin") {
      return NextResponse.json(
        { error: "You are not allowed to create invoices." },
        { status: 403 }
      );
    }

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
      Array.isArray(body) ||
      !("serviceId" in body) ||
      !("totalAmount" in body)
    ) {
      return NextResponse.json(
        { error: "Service ID and total amount are required." },
        { status: 400 }
      );
    }

    const { serviceId, totalAmount } = body;

    if (
      typeof serviceId !== "string" ||
      !serviceId.trim() ||
      typeof totalAmount !== "number" ||
      !Number.isSafeInteger(totalAmount) ||
      totalAmount < 0
    ) {
      return NextResponse.json(
        { error: "Invalid service ID or invoice amount." },
        { status: 400 }
      );
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        quoteStatus: true,
        quoteAmount: true,
      },
    });

    if (!service) {
      return NextResponse.json(
        { error: "Service request not found." },
        { status: 404 }
      );
    }

    if (
      service.quoteStatus !== "approved" ||
      service.quoteAmount === null
    ) {
      return NextResponse.json(
        {
          error:
            "An invoice can only be created after the customer approves a quotation.",
        },
        { status: 409 }
      );
    }

    if (totalAmount !== service.quoteAmount) {
      return NextResponse.json(
        {
          error:
            "The invoice amount must match the approved quotation.",
          approvedAmount: service.quoteAmount,
        },
        { status: 400 }
      );
    }

    const existingOrder = await prisma.order.findUnique({
      where: { serviceId: service.id },
      select: { id: true },
    });

    if (existingOrder) {
      return NextResponse.json(
        { error: "An invoice already exists for this service." },
        { status: 409 }
      );
    }

    const order = await prisma.order.create({
      data: {
        serviceId: service.id,
        totalAmount: service.quoteAmount,
        invoiceNumber: `INV-${randomUUID()}`,
        isPaid: false,
      },
      select: {
        id: true,
        invoiceNumber: true,
        serviceId: true,
        totalAmount: true,
        isPaid: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "Invoice created successfully.",
        order,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An invoice already exists for this service." },
        { status: 409 }
      );
    }

    console.error("POST /api/orders error:", error);

    return NextResponse.json(
      { error: "An error occurred while creating the invoice." },
      { status: 500 }
    );
  }
}