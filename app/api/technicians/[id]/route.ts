import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/authorization";

type Props = {
  params: Promise<{ id: string }>;
};

type TechnicianUpdateData = {
  name?: string;
  phone?: string | null;
  specialty?: string | null;
  isActive?: boolean;
};

async function checkAdmin(): Promise<{
  response: NextResponse | null;
}> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      response: NextResponse.json(
        { error: "يجب تسجيل الدخول أولًا." },
        { status: 401 }
      ),
    };
  }

  if (user.role !== "admin" && user.role !== "super_admin") {
    return {
      response: NextResponse.json(
        { error: "ليس لديك صلاحية لتنفيذ هذا الإجراء." },
        { status: 403 }
      ),
    };
  }

  return { response: null };
}

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

// PATCH: تعديل بيانات الفني أو تفعيل الفني وتعطيله
export async function PATCH(request: Request, { params }: Props) {
  try {
    const auth = await checkAdmin();

    if (auth.response) {
      return auth.response;
    }

    const { id } = await params;

    if (!id || !id.trim()) {
      return NextResponse.json(
        { error: "معرّف الفني غير صحيح." },
        { status: 400 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "صيغة البيانات غير صحيحة." },
        { status: 400 }
      );
    }

    if (!isObject(body)) {
      return NextResponse.json(
        { error: "البيانات المرسلة غير صحيحة." },
        { status: 400 }
      );
    }

    const data = body;
    const updateData: TechnicianUpdateData = {};

    if ("name" in data) {
      if (typeof data.name !== "string" || !data.name.trim()) {
        return NextResponse.json(
          { error: "اسم الفني مطلوب." },
          { status: 400 }
        );
      }

      const name = data.name.trim();

      if (name.length > 100) {
        return NextResponse.json(
          { error: "يجب ألا يتجاوز اسم الفني 100 حرف." },
          { status: 400 }
        );
      }

      updateData.name = name;
    }

    if ("phone" in data) {
      if (
        data.phone !== null &&
        typeof data.phone !== "string"
      ) {
        return NextResponse.json(
          { error: "رقم الهاتف غير صحيح." },
          { status: 400 }
        );
      }

      const phone =
        typeof data.phone === "string" ? data.phone.trim() : "";

      if (phone.length > 30) {
        return NextResponse.json(
          { error: "يجب ألا يتجاوز رقم الهاتف 30 حرفًا." },
          { status: 400 }
        );
      }

      updateData.phone = phone || null;
    }

    if ("specialty" in data) {
      if (
        data.specialty !== null &&
        typeof data.specialty !== "string"
      ) {
        return NextResponse.json(
          { error: "التخصص غير صحيح." },
          { status: 400 }
        );
      }

      const specialty =
        typeof data.specialty === "string"
          ? data.specialty.trim()
          : "";

      if (specialty.length > 100) {
        return NextResponse.json(
          { error: "يجب ألا يتجاوز التخصص 100 حرف." },
          { status: 400 }
        );
      }

      updateData.specialty = specialty || null;
    }

    if ("isActive" in data) {
      if (typeof data.isActive !== "boolean") {
        return NextResponse.json(
          { error: "حالة الفني يجب أن تكون صحيحة أو خاطئة." },
          { status: 400 }
        );
      }

      updateData.isActive = data.isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "لم ترسل أي بيانات للتعديل." },
        { status: 400 }
      );
    }

    const existingTechnician = await prisma.technician.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingTechnician) {
      return NextResponse.json(
        { error: "الفني غير موجود." },
        { status: 404 }
      );
    }

    const technician = await prisma.technician.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        specialty: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            services: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "تم تحديث بيانات الفني بنجاح.",
      technician: {
        id: technician.id,
        name: technician.name,
        phone: technician.phone,
        specialty: technician.specialty,
        isActive: technician.isActive,
        createdAt: technician.createdAt,
        updatedAt: technician.updatedAt,
        assignedServicesCount: technician._count.services,
      },
    });
  } catch (error) {
    console.error("Update technician error:", error);

    return NextResponse.json(
      { error: "تعذر تحديث بيانات الفني." },
      { status: 500 }
    );
  }
}
