import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ThreadsClient } from "@/components/ThreadsClient";

export default async function ThreadsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const business = await prisma.business.findUnique({
    where: { ownerEmail: session.user.email },
  });
  if (!business) redirect("/login");

  const conversations = await prisma.conversation.findMany({
    where: { businessId: business.id },
    select: {
      id: true,
      status: true,
      priority: true,
      reason: true,
      estimatedValue: true,
      lastMessageAt: true,
      isUnread: true,
      followUpAt: true,
      followUpCompleted: true,
      aiLeadScore: true,
      aiLeadTemperature: true,
      aiLeadIntent: true,
      aiLeadConfidence: true,
      aiLeadReasons: true,
      aiLeadScoredAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          externalId: true,
          tags: {
            select: {
              tag: true
            }
          }
        }
      },
      channel: true,
      messages: {
        orderBy: { sentAt: "desc" },
        take: 50,
      },
    },
    orderBy: [
      { isUnread: "desc" },
      { lastMessageAt: "desc" },
    ],
  });

  // Serialise Decimal → string for client component
  const formattedConversations = conversations.map((c) => ({
    ...c,
    estimatedValue: c.estimatedValue ? c.estimatedValue.toString() : null,
    followUpAt: c.followUpAt ? c.followUpAt.toISOString() : null,
    lastMessageAt: c.messages[0]?.sentAt?.toISOString() || new Date().toISOString(),
    messages: c.messages.map((m) => ({
      ...m,
      sentAt: m.sentAt.toISOString(),
    })),
    aiLeadScoredAt: c.aiLeadScoredAt ? c.aiLeadScoredAt.toISOString() : null,
  }));

  return (
    <div className="w-full h-full bg-white">
      <ThreadsClient conversations={formattedConversations as any} />
    </div>
  );
}
