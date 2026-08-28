import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateSalesBrief } from "@/lib/ai";

export async function POST() {
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

    // Get current Dhaka time boundaries for follow-up evaluation
    const dhakaStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric', month: 'numeric', day: 'numeric'
    }).format(new Date());
    
    const [m, d, y] = dhakaStr.split('/');
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    const todayIso = `${y}-${pad(+m)}-${pad(+d)}T00:00:00+06:00`;
    const startOfToday = new Date(todayIso);
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    // Fetch conversations matching priorities
    // Limit to top 25 conversations to control token usage and latency
    const conversations = await prisma.conversation.findMany({
      where: {
        businessId: business.id,
        OR: [
          { isUnread: true },
          { status: { in: ['interested', 'qualified'] } },
          { priority: { in: ['high', 'urgent'] } },
          { followUpAt: { lt: startOfTomorrow }, followUpCompleted: false } // Overdue or today
        ]
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 25,
      select: {
        id: true,
        status: true,
        priority: true,
        estimatedValue: true,
        lastMessageAt: true,
        isUnread: true,
        followUpAt: true,
        followUpCompleted: true,
        channel: { select: { type: true } },
        customer: { select: { name: true } },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 3, // Only last 3 messages to save tokens
          select: {
            sender: true,
            content: true,
            sentAt: true
          }
        }
      }
    });

    if (conversations.length === 0) {
      // Return a valid fallback brief if no active conversations fit the criteria
      return NextResponse.json({
        brief: {
          overview: "There are currently no high-priority conversations, unread messages, or due follow-ups.",
          priorityActions: [],
          followUps: [],
          opportunities: [],
          risks: [],
          finalSummary: "You are all caught up! Keep up the good work."
        }
      });
    }

    // Format the data for the AI to make it token-efficient
    const formattedData = conversations.map(c => ({
      conversationId: c.id,
      customerName: c.customer.name,
      channel: c.channel.type,
      status: c.status,
      priority: c.priority,
      estimatedValue: c.estimatedValue ? Number(c.estimatedValue) : null,
      isUnread: c.isUnread,
      followUpAt: c.followUpAt,
      followUpCompleted: c.followUpCompleted,
      lastMessageAt: c.lastMessageAt,
      messages: c.messages.reverse().map(m => ({
        sender: m.sender,
        content: m.content
      }))
    }));

    const brief = await generateSalesBrief(formattedData);

    return NextResponse.json({ brief });
  } catch (error) {
    console.error("[Sales Brief API] Error generating brief:", error);
    
    // Return a generic safe error to the client
    return NextResponse.json(
      { error: "AI sales brief is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
