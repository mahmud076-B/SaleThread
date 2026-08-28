import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  props: { params: Promise<{ customerId: string; tagId: string }> }
) {
  try {
    const { customerId, tagId } = await props.params;
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

    // Attempt to delete assignment
    // (If the tagId is wrong or not assigned, deleteMany will just delete 0 records safely)
    await prisma.customerTagAssignment.deleteMany({
      where: {
        customerId,
        tagId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/customers/[id]/tags/[tagId] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
