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
  const serialised = conversations.map((c) => ({
    ...c,
    estimatedValue: c.estimatedValue ? c.estimatedValue.toString() : null,
    lastMessageAt: c.lastMessageAt.toISOString(),
    isUnread: c.isUnread,
    followUpAt: c.followUpAt ? c.followUpAt.toISOString() : null,
    followUpCompleted: c.followUpCompleted,
    messages: c.messages.map((m) => ({ ...m, sentAt: m.sentAt.toISOString() })),
  }));

  return (
    <div className="w-full h-full bg-white">
      <ThreadsClient conversations={serialised} />
    </div>
  );
}
