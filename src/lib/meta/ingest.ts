import { prisma } from "@/lib/prisma";

export interface NormalizedMessage {
  channelType: "messenger" | "instagram";
  channelIdentifier: string; // pageId or instagramId
  senderId: string;
  messageId: string;
  text: string;
  timestamp: number;
}

export async function ingestIncomingMessage(event: NormalizedMessage) {
  try {
    // 1. Find the correct Channel
    const channel = await prisma.channel.findFirst({
      where: {
        type: event.channelType,
        ...(event.channelType === "messenger"
          ? { pageId: event.channelIdentifier }
          : { instagramId: event.channelIdentifier }),
        connected: true,
      },
    });

    if (!channel) {
      // Safely acknowledge if no matching channel
      console.log(`[Ingest] No connected channel found for ${event.channelType} ${event.channelIdentifier}`);
      return;
    }

    const businessId = channel.businessId;

    // 2. Find or create Customer
    const customer = await prisma.customer.upsert({
      where: {
        businessId_channelType_externalId: {
          businessId: businessId,
          channelType: event.channelType,
          externalId: event.senderId,
        },
      },
      update: {},
      create: {
        businessId: businessId,
        name: "Unknown Sender",
        channelType: event.channelType,
        externalId: event.senderId,
      },
    });

    // 3. Find an existing open/pending Conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        businessId,
        customerId: customer.id,
        channelId: channel.id,
        status: "pending",
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          businessId,
          customerId: customer.id,
          channelId: channel.id,
          status: "pending",
          lastMessageAt: new Date(event.timestamp),
        },
      });
    }

    // 4 & 5. Create Message (idempotent via externalId)
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: "customer",
        content: event.text,
        sentAt: new Date(event.timestamp),
        externalId: event.messageId,
      },
    });

    // 6. Update Conversation.lastMessageAt and isUnread
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { 
        lastMessageAt: new Date(event.timestamp),
        isUnread: true 
      },
    });
  } catch (error: any) {
    // Handle unique constraint violation on externalId (duplicate delivery)
    if (error.code === "P2002") {
      console.log(`[Ingest] Duplicate message ignored: ${event.messageId}`);
      return;
    }
    // Re-throw other unexpected errors
    throw error;
  }
}
