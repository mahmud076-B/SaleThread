import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { ownerEmail: session.user.email },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const tags = await prisma.customerTag.findMany({
      where: { businessId: business.id },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: tags });
  } catch (error) {
    console.error("GET /api/tags error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, color } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Tag name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();

    if (trimmedName.length > 50) {
      return NextResponse.json({ error: "Tag name too long" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { ownerEmail: session.user.email },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Check for duplicate
    const existingTag = await prisma.customerTag.findUnique({
      where: {
        businessId_name: {
          businessId: business.id,
          name: trimmedName,
        }
      }
    });

    if (existingTag) {
      return NextResponse.json({ error: "Tag already exists" }, { status: 400 });
    }

    const tag = await prisma.customerTag.create({
      data: {
        name: trimmedName,
        color: color || null,
        businessId: business.id,
      },
    });

    return NextResponse.json({ data: tag });
  } catch (error) {
    console.error("POST /api/tags error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
