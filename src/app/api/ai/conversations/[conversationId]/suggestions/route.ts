import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateReplySuggestions } from "@/lib/ai";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;

    // Load user's business
    const business = await prisma.business.findUnique({
      where: { ownerEmail: session.user.email },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Load conversation and verify ownership
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
      return NextResponse.json({ error: "No messages in conversation to generate suggestions from." }, { status: 400 });
    }

    // Format messages for the AI helper (reverse to get oldest to newest)
    const formattedMessages = conversation.messages.reverse().map((msg) => ({
      sender: msg.sender,
      content: msg.content,
    }));

    // Call OpenAI
    const suggestions = await generateReplySuggestions(formattedMessages);

    return NextResponse.json({ data: { suggestions } });
  } catch (error: any) {
    console.error("[AI_SUGGESTIONS_ERROR]", error);
    const message = error.message === "OpenAI API key is not configured."
      ? "AI suggestions are temporarily unavailable because the AI service is not configured."
      : "AI suggestions are temporarily unavailable. Please try again.";
      
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
