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
    include: {
      customer: true,
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
    messages: c.messages.map((m) => ({ ...m, sentAt: m.sentAt.toISOString() })),
  }));

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">All Threads</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {conversations.length} total conversations
        </p>
      </div>
      <ThreadsClient conversations={serialised} />
    </div>
  );
}
