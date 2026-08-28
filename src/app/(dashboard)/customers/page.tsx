import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CustomersClient } from "@/components/CustomersClient";
import type { CustomerRow } from "@/components/CustomersClient";
import { Prisma } from "@prisma/client";

export const metadata = {
  title: "Customers | SaleThread",
};

export default async function CustomersPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const q = typeof searchParams?.q === 'string' ? searchParams.q : "";
  
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const business = await prisma.business.findUnique({
    where: { ownerEmail: session.user.email },
  });

  if (!business) redirect("/login");
  
  const whereClause: Prisma.CustomerWhereInput = { businessId: business.id };
  if (q) {
    whereClause.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { externalId: { contains: q, mode: "insensitive" } }
    ];
  }

  // Fetch customers with their basic stats
  const customersData = await prisma.customer.findMany({
    where: whereClause,
    include: {
      tags: {
        include: { tag: true },
      },
      _count: {
        select: { conversations: true },
      },
      conversations: {
        select: {
          isUnread: true,
          status: true,
          lastMessageAt: true,
          messages: {
            orderBy: { sentAt: "desc" },
            take: 1,
            select: { content: true },
          },
        },
      },
    },
    orderBy: {
      id: "desc", // Default sort before processing
    },
  });

  // Transform data into flat rows for the client
  const customers: CustomerRow[] = customersData.map((c) => {
    // Determine the latest conversation by lastMessageAt
    const sortedConvs = c.conversations.sort(
      (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
    );
    const latestConv = sortedConvs[0];
    
    // Unread if ANY conversation is unread
    const isUnread = c.conversations.some((conv) => conv.isUnread);

    return {
      id: c.id,
      name: c.name,
      externalId: c.externalId,
      channelType: c.channelType,
      conversationCount: c._count.conversations,
      lastActivity: latestConv ? latestConv.lastMessageAt.toISOString() : null,
      latestMessage: latestConv?.messages[0]?.content || null,
      latestConversationStatus: latestConv?.status || null,
      isUnread,
      tags: c.tags.map(t => ({ id: t.tag.id, name: t.tag.name })),
    };
  });

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your audience across platforms.</p>
        </div>

        <CustomersClient customers={customers} />
      </div>
    </div>
  );
}
