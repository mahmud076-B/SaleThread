import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

    const { tagId } = await req.json();
    if (!tagId || typeof tagId !== "string") {
      return NextResponse.json({ error: "Tag ID is required" }, { status: 400 });
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

    // Verify tag belongs to business
    const tag = await prisma.customerTag.findUnique({
      where: {
        id: tagId,
        businessId: business.id,
      },
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.customerTagAssignment.findUnique({
      where: {
        customerId_tagId: {
          customerId,
          tagId,
        },
      },
    });

    if (existingAssignment) {
      return NextResponse.json({ error: "Tag already assigned" }, { status: 400 });
    }

    const assignment = await prisma.customerTagAssignment.create({
      data: {
        customerId,
        tagId,
      },
      include: {
        tag: true,
      },
    });

    return NextResponse.json({ data: assignment });
  } catch (error) {
    console.error("POST /api/customers/[id]/tags error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
