
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/authorization";
import { redis } from "@/lib/redis";

const allowedStatuses = [
  "scheduled",
  "in_progress",
  "awaiting_parts",
  "on_hold",
  "ready_for_pickup",
  "completed",
  "fixed",
  "payment_pending",
  "dispatched",
  "assignToTechnican",
] as const;

type AllowedStatus = (typeof allowedStatuses)[number];

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ServiceUpdateData = {
  status?: AllowedStatus;
  technician?: string | null;
  technicianId?: string | null;
  isFixed?: boolean;
  isReady?: boolean;
};

const statusLabels: Record<string, string> = {
  scheduled: "تمت الجدولة",
  in_progress: "بدأت الصيانة",
  awaiting_parts: "بانتظار قطع الغيار",
  on_hold: "الصيانة معلّقة",
  ready_for_pickup: "الجهاز جاهز للاستلام",
  completed: "اكتملت الصيانة",
  fixed: "تم إصلاح الجهاز",
  payment_pending: "بانتظار الدفع",
  dispatched: "تم تسليم الجهاز",
  assignToTechnican: "بانتظار تعيين فني",
};

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً." },
        { status: 401 }
      );
    }

    if (
      user.role !== "admin" &&
      user.role !== "super_admin"
    ) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية لتحديث طلبات الصيانة." },
        { status: 403 }
      );
    }

    const { id } = await params;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "صيغة البيانات غير صحيحة." },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "بيانات الطلب غير صالحة." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;
    const updateData: ServiceUpdateData = {};

    const existingService = await prisma.service.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        technicianId: true,
        technician: true,
      },
    });

    if (!existingService) {
      return NextResponse.json(
        { error: "طلب الصيانة غير موجود." },
        { status: 404 }
      );
    }

    if ("status" in data) {
      if (
        typeof data.status !== "string" ||
        !allowedStatuses.includes(data.status as AllowedStatus)
      ) {
        return NextResponse.json(
          { error: "حالة الطلب غير صالحة." },
          { status: 400 }
        );
      }

      const status = data.status as AllowedStatus;
      updateData.status = status;

      if (status === "fixed" || status === "completed") {
        updateData.isFixed = true;
      } else if (
        status === "scheduled" ||
        status === "in_progress" ||
        status === "awaiting_parts" ||
        status === "on_hold" ||
        status === "assignToTechnican"
      ) {
        updateData.isFixed = false;
      }

      if (status === "ready_for_pickup") {
        updateData.isReady = true;
      } else if (
        status === "dispatched" ||
        status === "completed"
      ) {
        updateData.isReady = false;
      }
    }

    if ("technicianId" in data) {
      if (
        data.technicianId !== null &&
        typeof data.technicianId !== "string"
      ) {
        return NextResponse.json(
          { error: "معرّف الفني غير صالح." },
          { status: 400 }
        );
      }

      const technicianId =
        typeof data.technicianId === "string"
          ? data.technicianId.trim()
          : null;

      if (technicianId) {
        const technician = await prisma.technician.findUnique({
          where: { id: technicianId },
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        });

        if (!technician) {
          return NextResponse.json(
            { error: "الفني المحدد غير موجود." },
            { status: 404 }
          );
        }

        if (
          !technician.isActive &&
          technician.id !== existingService.technicianId
        ) {
          return NextResponse.json(
            { error: "لا يمكن تعيين فني غير نشط." },
            { status: 400 }
          );
        }

        updateData.technicianId = technician.id;
        updateData.technician = technician.name;
      } else {
        updateData.technicianId = null;
        updateData.technician = null;
      }
    } else if ("technician" in data) {
      if (
        data.technician !== null &&
        typeof data.technician !== "string"
      ) {
        return NextResponse.json(
          { error: "اسم الفني غير صالح." },
          { status: 400 }
        );
      }

      const technicianName =
        typeof data.technician === "string"
          ? data.technician.trim()
          : "";

      if (technicianName.length > 200) {
        return NextResponse.json(
          { error: "اسم الفني يجب ألا يتجاوز 200 حرف." },
          { status: 400 }
        );
      }

      if (!technicianName) {
        updateData.technician = null;
        updateData.technicianId = null;
      } else {
        const technician = await prisma.technician.findFirst({
          where: {
            name: {
              equals: technicianName,
              mode: "insensitive",
            },
          },
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        });

        if (!technician) {
          return NextResponse.json(
            {
              error:
                "الفني غير موجود. اختر فنيًا مسجلًا في النظام.",
            },
            { status: 404 }
          );
        }

        if (
          !technician.isActive &&
          technician.id !== existingService.technicianId
        ) {
          return NextResponse.json(
            { error: "لا يمكن تعيين فني غير نشط." },
            { status: 400 }
          );
        }

        updateData.technicianId = technician.id;
        updateData.technician = technician.name;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "لم يتم إرسال أي تعديلات." },
        { status: 400 }
      );
    }

    const statusChanged =
      updateData.status !== undefined &&
      updateData.status !== existingService.status;

    // حفظ تعديل الطلب وسجل الحالة ضمن معاملة واحدة.
    const service = await prisma.$transaction(async (tx) => {
      const updatedService = await tx.service.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          status: true,
          technician: true,
          technicianId: true,
          isFixed: true,
          isReady: true,
          updatedAt: true,
        },
      });

      if (statusChanged && updateData.status) {
        await tx.serviceStatusHistory.create({
          data: {
            serviceId: id,
            status: updateData.status,
            note: `تم تغيير الحالة إلى: ${
              statusLabels[updateData.status] ??
              updateData.status
            }`,
          },
        });
      }

      return updatedService;
    });

    try {
      if (!redis.isOpen) {
        await redis.connect();
      }

      await redis.del("admin:services:latest100");
    } catch (cacheError) {
      console.error(
        "Redis cache invalidation error:",
        cacheError instanceof Error
          ? cacheError.message
          : cacheError
      );
    }

    return NextResponse.json({ service });
  } catch (error) {
    console.error("Update service error:", error);

    return NextResponse.json(
      { error: "تعذر تحديث طلب الصيانة." },
      { status: 500 }
    );
  }
}
