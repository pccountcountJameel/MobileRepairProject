import { requireRole } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import ServiceSearch, {
  type ServiceSearchRecord,
} from "./ServiceSearch";

export const instant = false;

const CACHE_KEY = "admin:services:latest100";
const CACHE_TTL_SECONDS = 60;

async function getServices(): Promise<ServiceSearchRecord[]> {
  try {
    if (!redis.isOpen) {
      await redis.connect();
    }

    const cached = await redis.get(CACHE_KEY);

    if (cached) {
      try {
        const parsed: unknown = JSON.parse(cached);

        if (Array.isArray(parsed)) {
          return parsed as ServiceSearchRecord[];
        }

        console.error("Redis cache contains invalid services data.");
      } catch (error) {
        console.error(
          "Redis cache JSON parse error:",
          error instanceof Error ? error.message : error
        );
      }
    }
  } catch (error) {
    console.error(
      "Redis cache read error:",
      error instanceof Error ? error.message : error
    );
  }

  const services = await prisma.service.findMany({
    select: {
      id: true,
      deviceType: true,
      issueDescription: true,
      status: true,
      technician: true,
      technicianId: true,
      appointment_date: true,
      createdAt: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      assignedTechnician: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  const serializableServices: ServiceSearchRecord[] =
    services.map((service) => ({
      id: service.id,
      deviceType: service.deviceType,
      issueDescription: service.issueDescription,
      status: service.status,
      technician:
        service.assignedTechnician?.name ??
        service.technician ??
        null,
      technicianId: service.technicianId,
      technicianIsActive:
        service.assignedTechnician?.isActive ?? null,
      appointment_date: service.appointment_date.toISOString(),
      createdAt: service.createdAt.toISOString(),
      user: service.user,
    }));

  try {
    if (!redis.isOpen) {
      await redis.connect();
    }

    await redis.set(
      CACHE_KEY,
      JSON.stringify(serializableServices),
      {
        EX: CACHE_TTL_SECONDS,
      }
    );
  } catch (error) {
    console.error(
      "Redis cache write error:",
      error instanceof Error ? error.message : error
    );
  }

  return serializableServices;
}

export default async function AdminServicesPage() {
  await requireRole(["admin", "super_admin"]);

  const services = await getServices();

  const stats = {
    total: services.length,
    unassigned: services.filter(
      (service) => !service.technicianId
    ).length,
    inProgress: services.filter(
      (service) => service.status === "in_progress"
    ).length,
    ready: services.filter(
      (service) => service.status === "ready_for_pickup"
    ).length,
    completed: services.filter(
      (service) => service.status === "completed"
    ).length,
  };

  const cards = [
    {
      title: "إجمالي الطلبات",
      value: stats.total,
      description: "أحدث 100 طلب",
      color: "border-blue-500",
    },
    {
      title: "طلبات بلا فني",
      value: stats.unassigned,
      description: "تحتاج إلى إسناد",
      color: "border-amber-500",
    },
    {
      title: "قيد التنفيذ",
      value: stats.inProgress,
      description: "تتم صيانتها حاليًا",
      color: "border-indigo-500",
    },
    {
      title: "جاهزة للاستلام",
      value: stats.ready,
      description: "بانتظار العميل",
      color: "border-emerald-500",
    },
    {
      title: "طلبات مكتملة",
      value: stats.completed,
      description: "حالتها مكتمل",
      color: "border-gray-500",
    },
  ];

  return (
    <main
      dir="rtl"
      className="mx-auto my-10 max-w-[1500px] p-6"
      style={{ fontFamily: "Arial, sans-serif" }}
    >
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          إدارة طلبات الصيانة
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          عرض أحدث 100 طلب صيانة، مع إحصائيات سريعة وإمكانية البحث
          وتغيير الحالة وإسناد الطلبات إلى الفنيين.
        </p>
      </header>

      <section
        aria-label="إحصائيات طلبات الصيانة"
        className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        {cards.map((card) => (
          <article
            key={card.title}
            className={`rounded-xl border border-gray-200 border-r-4 ${card.color} bg-white p-5 shadow-sm`}
          >
            <h2 className="text-sm font-medium text-gray-600">
              {card.title}
            </h2>

            <p className="mt-3 text-3xl font-bold text-gray-900">
              {card.value}
            </p>

            <p className="mt-2 text-xs text-gray-500">
              {card.description}
            </p>
          </article>
        ))}
      </section>

      {services.length === 0 ? (
        <section className="rounded-xl border border-gray-200 bg-white p-6 text-gray-600">
          لا توجد طلبات صيانة حتى الآن.
        </section>
      ) : (
        <ServiceSearch services={services} />
      )}
    </main>
  );
}