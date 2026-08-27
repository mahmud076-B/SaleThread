import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendMessengerReply } from "@/lib/meta";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;

    const body = await req.json();
    if (!body.text || typeof body.text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Verify ownership and load relations
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        business: true,
        channel: true,
        customer: true,
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Ensure logged-in user owns the business this conversation belongs to
    if (conversation.business.ownerEmail !== session.user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only allow messenger for now
    if (conversation.channel.type !== "messenger") {
      return NextResponse.json({ error: "Only messenger channels are supported currently" }, { status: 400 });
    }

    const pageId = conversation.channel.pageId;
    const pageAccessToken = conversation.channel.accessToken;
    const recipientPsid = conversation.customer.externalId;

    if (!pageId || !pageAccessToken) {
      return NextResponse.json({ error: "Channel is not fully configured (missing pageId or accessToken)" }, { status: 400 });
    }

    // Send through Meta Graph API
    let metaMessageId: string | null = null;
    try {
      const metaRes = await sendMessengerReply(pageId, pageAccessToken, recipientPsid, body.text);
      metaMessageId = metaRes.message_id || null;
    } catch (error: any) {
      // Safe error logging without exposing token
      console.error("Meta API Error:", error.message || "Unknown error");
      return NextResponse.json({ error: "Failed to deliver message via Meta" }, { status: 502 });
    }

    // Save to database only after successful delivery
    const message = await prisma.message.create({
      data: {
        conversationId,
        sender: "business",
        content: body.text,
        sentAt: new Date(),
        externalId: metaMessageId,
      },
    });

    // Update conversation lastMessageAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.sentAt },
    });

    return NextResponse.json({ message: "Sent successfully", data: message });
  } catch (error) {
    console.error("Failed to send message:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
