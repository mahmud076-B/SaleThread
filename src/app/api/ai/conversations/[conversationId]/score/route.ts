import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateLeadScore } from "@/lib/ai";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
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

    const { conversationId } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { sentAt: "desc" },
          take: 30,
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
      return NextResponse.json({ error: "Empty conversation" }, { status: 400 });
    }

    // Sort messages chronologically
    const chronologicalMessages = [...conversation.messages].reverse();

    const formattedMessages = chronologicalMessages.map((msg) => ({
      sender: msg.sender as "business" | "customer" | "ai_draft",
      content: msg.content,
    }));

    // Generate score
    const leadScoreResult = await generateLeadScore(formattedMessages);

    // Persist score
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        aiLeadScore: leadScoreResult.score,
        aiLeadTemperature: leadScoreResult.temperature,
        aiLeadIntent: leadScoreResult.buyingIntent,
        aiLeadConfidence: leadScoreResult.confidence,
        aiLeadReasons: leadScoreResult.reasons,
        aiLeadScoredAt: new Date(),
      },
    });

    return NextResponse.json({
      data: {
        score: updatedConversation.aiLeadScore,
        temperature: updatedConversation.aiLeadTemperature,
        buyingIntent: updatedConversation.aiLeadIntent,
        confidence: updatedConversation.aiLeadConfidence,
        reasons: updatedConversation.aiLeadReasons,
        recommendedPriority: leadScoreResult.recommendedPriority,
        scoredAt: updatedConversation.aiLeadScoredAt,
      },
    });
  } catch (error) {
    console.error("Lead scoring error:", error);
    return NextResponse.json(
      { error: "AI scoring is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
