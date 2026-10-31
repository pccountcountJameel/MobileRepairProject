import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/authorization";

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

// GET: جلب الفنيين وإحصائيات طلبات كل فني
export async function GET() {
  try {
    const auth = await checkAdmin();

    if (auth.response) {
      return auth.response;
    }

    const [technicians, serviceGroups] = await Promise.all([
      prisma.technician.findMany({
        orderBy: { createdAt: "desc" },
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
      }),

      prisma.service.groupBy({
        by: ["technicianId", "status"],
        where: {
          technicianId: {
            not: null,
          },
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const countsByTechnician = new Map<
      string,
      {
        inProgressServicesCount: number;
        readyForPickupServicesCount: number;
        completedServicesCount: number;
      }
    >();

    for (const group of serviceGroups) {
      if (!group.technicianId) {
        continue;
      }

      const counts = countsByTechnician.get(group.technicianId) ?? {
        inProgressServicesCount: 0,
        readyForPickupServicesCount: 0,
        completedServicesCount: 0,
      };

      if (group.status === "in_progress") {
        counts.inProgressServicesCount = group._count._all;
      } else if (group.status === "ready_for_pickup") {
        counts.readyForPickupServicesCount = group._count._all;
      } else if (group.status === "completed") {
        counts.completedServicesCount = group._count._all;
      }

      countsByTechnician.set(group.technicianId, counts);
    }

    const result = technicians.map((technician) => {
      const statusCounts = countsByTechnician.get(technician.id);

      return {
        id: technician.id,
        name: technician.name,
        phone: technician.phone,
        specialty: technician.specialty,
        isActive: technician.isActive,
        createdAt: technician.createdAt,
        updatedAt: technician.updatedAt,
        assignedServicesCount: technician._count.services,
        inProgressServicesCount:
          statusCounts?.inProgressServicesCount ?? 0,
        readyForPickupServicesCount:
          statusCounts?.readyForPickupServicesCount ?? 0,
        completedServicesCount:
          statusCounts?.completedServicesCount ?? 0,
      };
    });

    return NextResponse.json({ technicians: result });
  } catch (error) {
    console.error("Get technicians error:", error);

    return NextResponse.json(
      { error: "تعذر جلب بيانات الفنيين." },
      { status: 500 }
    );
  }
}

// POST: إضافة فني جديد
export async function POST(request: Request) {
  try {
    const auth = await checkAdmin();

    if (auth.response) {
      return auth.response;
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

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const phone =
      typeof body.phone === "string" ? body.phone.trim() : "";

    const specialty =
      typeof body.specialty === "string"
        ? body.specialty.trim()
        : "";

    if (!name) {
      return NextResponse.json(
        { error: "اسم الفني مطلوب." },
        { status: 400 }
      );
    }

    if (
      name.length > 100 ||
      phone.length > 30 ||
      specialty.length > 100
    ) {
      return NextResponse.json(
        { error: "تجاوز أحد الحقول الحد المسموح به." },
        { status: 400 }
      );
    }

    const technician = await prisma.technician.create({
      data: {
        name,
        phone: phone || null,
        specialty: specialty || null,
      },
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

    return NextResponse.json(
      {
        technician: {
          id: technician.id,
          name: technician.name,
          phone: technician.phone,
          specialty: technician.specialty,
          isActive: technician.isActive,
          createdAt: technician.createdAt,
          updatedAt: technician.updatedAt,
          assignedServicesCount: technician._count.services,
          inProgressServicesCount: 0,
          readyForPickupServicesCount: 0,
          completedServicesCount: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create technician error:", error);

    return NextResponse.json(
      { error: "تعذرت إضافة الفني." },
      { status: 500 }
    );
  }
}