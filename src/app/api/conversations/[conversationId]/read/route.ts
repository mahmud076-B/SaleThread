import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;

    // Verify ownership
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { business: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (conversation.business.ownerEmail !== session.user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { isUnread: false },
    });

    return NextResponse.json({ message: "Marked as read", data: updated });
  } catch (error) {
    console.error("Failed to mark as read:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
