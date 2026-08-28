import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  props: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await props.params;
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

    // Verify customer belongs to business
    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId,
        businessId: business.id,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const notes = await prisma.customerNote.findMany({
      where: {
        customerId,
        businessId: business.id,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: notes });
  } catch (error) {
    console.error("GET /api/customers/[id]/notes error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  props: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await props.params;
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content } = await req.json();
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Note content is required" }, { status: 400 });
    }
    
    if (content.length > 5000) {
      return NextResponse.json({ error: "Note content is too long" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { ownerEmail: session.user.email },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Verify customer belongs to business
    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId,
        businessId: business.id,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const note = await prisma.customerNote.create({
      data: {
        content: content.trim(),
        customerId,
        businessId: business.id,
      },
    });

    return NextResponse.json({ data: note });
  } catch (error) {
    console.error("POST /api/customers/[id]/notes error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
