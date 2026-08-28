import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  props: { params: Promise<{ customerId: string; noteId: string }> }
) {
  try {
    const { customerId, noteId } = await props.params;
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

    // Verify note belongs to business and customer
    const existingNote = await prisma.customerNote.findUnique({
      where: {
        id: noteId,
        customerId,
        businessId: business.id,
      },
    });

    if (!existingNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const updatedNote = await prisma.customerNote.update({
      where: { id: noteId },
      data: { content: content.trim() },
    });

    return NextResponse.json({ data: updatedNote });
  } catch (error) {
    console.error("PUT /api/customers/[id]/notes/[noteId] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ customerId: string; noteId: string }> }
) {
  try {
    const { customerId, noteId } = await props.params;
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

    // Verify note belongs to business and customer
    const existingNote = await prisma.customerNote.findUnique({
      where: {
        id: noteId,
        customerId,
        businessId: business.id,
      },
    });

    if (!existingNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    await prisma.customerNote.delete({
      where: { id: noteId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/customers/[id]/notes/[noteId] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
