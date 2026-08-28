import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ConversationStatus, ConversationPriority, Prisma } from "@prisma/client";

const leadUpdateSchema = z.object({
  status: z.nativeEnum(ConversationStatus).optional(),
  priority: z.nativeEnum(ConversationPriority).optional(),
  estimatedValue: z.number().min(0).optional().nullable(),
  followUpAt: z.string().datetime().optional().nullable(),
  followUpCompleted: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  props: { params: Promise<{ conversationId: string }> }
) {
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

    const { conversationId } = await props.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { businessId: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (conversation.businessId !== business.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const result = leadUpdateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid input", details: result.error }, { status: 400 });
    }

    const data = result.data;
    const updateData: Prisma.ConversationUpdateInput = {};

    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.estimatedValue !== undefined) updateData.estimatedValue = data.estimatedValue;
    if (data.followUpAt !== undefined) {
      updateData.followUpAt = data.followUpAt ? new Date(data.followUpAt) : null;
    }
    if (data.followUpCompleted !== undefined) updateData.followUpCompleted = data.followUpCompleted;

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });

    // Make sure we convert decimals and datetimes to safe strings for the response
    const serialised = {
      ...updated,
      estimatedValue: updated.estimatedValue ? updated.estimatedValue.toString() : null,
    };

    return NextResponse.json(serialised);
  } catch (error) {
    console.error("Error updating lead:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
