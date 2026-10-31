
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/authorization";

async function checkSuperAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً." },
        { status: 401 }
      ),
    };
  }

  if (user.role !== "super_admin") {
    return {
      user: null,
      response: NextResponse.json(
        { error: "هذه العملية متاحة لمدير النظام فقط." },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}

// GET: عرض حسابات المسؤولين
export async function GET() {
  try {
    const auth = await checkSuperAdmin();

    if (auth.response) return auth.response;

    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ["admin", "super_admin"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Get admin users error:", error);

    return NextResponse.json(
      { error: "تعذر جلب حسابات المسؤولين." },
      { status: 500 }
    );
  }
}

// POST: إنشاء مسؤول جديد
export async function POST(request: Request) {
  try {
    const auth = await checkSuperAdmin();

    if (auth.response) return auth.response;

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
        { error: "البيانات المرسلة غير صحيحة." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    const name =
      typeof data.name === "string" ? data.name.trim() : "";

    const email =
      typeof data.email === "string"
        ? data.email.trim().toLowerCase()
        : "";

    const password =
      typeof data.password === "string" ? data.password : "";

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "الاسم والبريد الإلكتروني وكلمة المرور مطلوبة." },
        { status: 400 }
      );
    }

    if (name.length > 100 || email.length > 254) {
      return NextResponse.json(
        { error: "تجاوز الاسم أو البريد الإلكتروني الحد المسموح." },
        { status: 400 }
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { error: "البريد الإلكتروني غير صحيح." },
        { status: 400 }
      );
    }

    if (password.length < 12) {
      return NextResponse.json(
        { error: "يجب ألا تقل كلمة المرور عن 12 حرفاً." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "هذا البريد الإلكتروني مسجل بالفعل." },
        { status: 409 }
      );
    }

    const hashedPassword = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "admin",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "تم إنشاء حساب المسؤول بنجاح.",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create admin user error:", error);

    return NextResponse.json(
      { error: "تعذر إنشاء حساب المسؤول." },
      { status: 500 }
    );
  }
}