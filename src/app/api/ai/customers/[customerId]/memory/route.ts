import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateCustomerMemory, CustomerMemoryContext } from "@/lib/ai";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { customerId } = await params;
    if (!customerId) {
      return NextResponse.json({ error: "Missing customerId" }, { status: 400 });
    }

    // Resolve authenticated business
    const business = await prisma.business.findUnique({
      where: { ownerEmail: session.user.email },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Fetch the customer ensuring it belongs to the authenticated business
    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId,
        businessId: business.id, // CRITICAL SECURITY CHECK
      },
      include: {
        tags: {
          include: { tag: true },
        },
        notes: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        conversations: {
          orderBy: { lastMessageAt: "desc" },
          take: 5,
          include: {
            channel: true,
            messages: {
              orderBy: { sentAt: "desc" },
              take: 5,
            },
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Prepare CustomerMemoryContext
    const context: CustomerMemoryContext = {
      customer: {
        name: customer.name,
        channel: customer.channelType,
      },
      tags: customer.tags.map((t) => t.tag.name),
      notes: customer.notes.map((n) => n.content),
      lead: customer.conversations.length > 0 ? {
        status: customer.conversations[0].status,
        priority: customer.conversations[0].priority,
        estimatedValue: customer.conversations[0].estimatedValue?.toString() || null,
        followUpAt: customer.conversations[0].followUpAt?.toISOString() || null,
        followUpCompleted: customer.conversations[0].followUpCompleted,
        aiLeadScore: customer.conversations[0].aiLeadScore,
        aiLeadTemperature: customer.conversations[0].aiLeadTemperature,
      } : {
        status: "new",
        priority: "normal",
        estimatedValue: null,
        followUpAt: null,
        followUpCompleted: false,
        aiLeadScore: null,
        aiLeadTemperature: null,
      },
      recentConversations: customer.conversations.map((conv) => {
        // Reverse to chronological order (oldest to newest) for AI comprehension
        const orderedMessages = [...conv.messages].reverse();

        return {
          conversationId: conv.id,
          channel: conv.channel.displayName,
          status: conv.status,
          lastMessageAt: conv.lastMessageAt.toISOString(),
          recentMessages: orderedMessages.map((msg) => ({
            sender: msg.sender === "business" || msg.sender === "ai_draft" ? "business" : "customer",
            content: msg.content,
            sentAt: msg.sentAt.toISOString(),
          })),
        };
      }),
    };

    // If there is absolute minimum data, we shouldn't fail, but let the AI generate a conservative memory
    const memory = await generateCustomerMemory(context);

    return NextResponse.json({ memory });
  } catch (error) {
    console.error("[Customer Memory API Error]:", error);
    // Return a safe error
    return NextResponse.json(
      { error: "AI customer memory is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
