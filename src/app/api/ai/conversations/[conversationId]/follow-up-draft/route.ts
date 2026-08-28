import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateFollowUpDraft, generateFollowUpRecommendation } from "@/lib/ai";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const conversationId = resolvedParams.conversationId;

    const business = await prisma.business.findUnique({
      where: { ownerEmail: session.user.email },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        customer: true,
        messages: {
          orderBy: { sentAt: "asc" },
          take: 30, // Get the latest 30 messages
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (conversation.businessId !== business.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (conversation.messages.length === 0) {
      return NextResponse.json({ error: "Not enough conversation data to recommend a follow-up." }, { status: 400 });
    }

    const leadContext = {
      status: conversation.status,
      priority: conversation.priority,
      estimatedValue: conversation.estimatedValue,
      followUpAt: conversation.followUpAt,
      followUpCompleted: conversation.followUpCompleted,
      aiLeadScore: conversation.aiLeadScore,
      aiLeadTemperature: conversation.aiLeadTemperature,
      aiLeadIntent: conversation.aiLeadIntent,
      aiLeadConfidence: conversation.aiLeadConfidence,
      aiLeadReasons: conversation.aiLeadReasons,
    };

    // Note: To remain secure and strictly server-side, we should re-run the recommendation
    // rather than trusting the client. But generating two LLM calls sequentially is slow.
    // However, the instructions say:
    // "obtain/accept recommendation context safely"
    // "Prefer generating recommendation server-side when necessary."
    // Let's generate it server-side if not explicitly passed securely, or just generate it.
    // Re-generating is safer and ensures it's fresh.
    const recommendation = await generateFollowUpRecommendation(
      conversation.messages,
      leadContext
    );

    const draftResult = await generateFollowUpDraft(
      conversation.messages,
      leadContext,
      recommendation
    );

    return NextResponse.json({ data: draftResult });
  } catch (error) {
    console.error("Follow-up Draft Error:", error);
    return NextResponse.json(
      { error: "AI follow-up draft is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
