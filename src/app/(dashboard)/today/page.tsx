import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TodayActions } from "@/components/TodayActions";
import type { ComplianceState } from "@prisma/client";
import Link from "next/link";

const COMPLIANCE_BADGES: Record<ComplianceState, { label: string; className: string }> = {
  send_now: { label: "Ready to send", className: "bg-green-100 text-green-800" },
  needs_human_agent_tag: { label: "Needs agent tag", className: "bg-yellow-100 text-yellow-800" },
  needs_template: { label: "Needs template", className: "bg-orange-100 text-orange-800" },
  blocked: { label: "Blocked", className: "bg-red-100 text-red-800" },
};

const CHANNEL_BADGES: Record<string, { label: string; className: string }> = {
  messenger: { label: "Messenger", className: "bg-blue-100 text-blue-700" },
  instagram: { label: "Instagram", className: "bg-pink-100 text-pink-700" },
};

function formatRelativeTime(isoString: string) {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function TodayPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const business = await prisma.business.findUnique({
    where: { ownerEmail: session.user.email },
  });
  if (!business) redirect("/login");

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Parallel database queries for performance
  const [
    totalConversations,
    unreadConversations,
    totalCustomers,
    conversationsToday,
    recentConversations,
    drafts,
  ] = await Promise.all([
    prisma.conversation.count({ where: { businessId: business.id } }),
    prisma.conversation.count({ where: { businessId: business.id, isUnread: true } }),
    prisma.customer.count({ where: { businessId: business.id } }),
    prisma.conversation.count({ where: { businessId: business.id, lastMessageAt: { gte: startOfToday } } }),
    prisma.conversation.findMany({
      where: { businessId: business.id },
      orderBy: { lastMessageAt: "desc" },
      take: 5,
      include: {
        customer: true,
        channel: true,
        messages: {
          orderBy: { sentAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.followUpDraft.findMany({
      where: {
        conversation: { businessId: business.id },
      },
      include: {
        conversation: {
          include: {
            customer: true,
            channel: true,
            messages: {
              orderBy: { sentAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      {/* 1. DASHBOARD METRICS */}
      <section>
        <h1 className="text-xl font-bold text-gray-900 mb-4">Dashboard Overview</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Conversations</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{totalConversations.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Unread Conversations</p>
            <p className={`text-3xl font-bold mt-2 ${unreadConversations > 0 ? "text-blue-600" : "text-gray-900"}`}>
              {unreadConversations.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Total Customers</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{totalCustomers.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Active Today</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{conversationsToday.toLocaleString()}</p>
          </div>
        </div>
      </section>

      {/* 2. RECENT CONVERSATIONS */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Recent Conversations</h2>
          <Link href="/threads" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            View All →
          </Link>
        </div>
        
        {recentConversations.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-12 text-center shadow-sm">
            <p className="text-gray-500 text-sm font-medium">No conversations yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            {recentConversations.map((c, index) => {
              const lastMsg = c.messages[0];
              const channel = CHANNEL_BADGES[c.channel.type] ?? {
                label: c.channel.type,
                className: "bg-gray-100 text-gray-700",
              };
              
              return (
                <Link
                  key={c.id}
                  href={`/threads?id=${c.id}`}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-gray-50 transition-colors gap-3 ${
                    index !== recentConversations.length - 1 ? "border-b border-gray-200" : ""
                  } ${c.isUnread ? "bg-blue-50/30" : ""}`}
                >
                  <div className="min-w-0 flex-1 flex items-start gap-3">
                    {c.isUnread ? (
                      <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1.5" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-transparent flex-shrink-0 mt-1.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm truncate ${c.isUnread ? "font-bold text-gray-900" : "font-medium text-gray-900"}`}>
                          {c.customer.name}
                        </p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${channel.className}`}>
                          {channel.label}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 line-clamp-1 ${c.isUnread ? "text-gray-700 font-medium" : "text-gray-500"}`}>
                        {lastMsg ? lastMsg.content : "No messages"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-5 sm:ml-0">
                    <p className={`text-xs ${c.isUnread ? "text-blue-600 font-medium" : "text-gray-400"}`}>
                      {formatRelativeTime(c.lastMessageAt.toISOString())}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. TODAY'S FOLLOW-UPS (Existing) */}
      {drafts.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">Today&apos;s Follow-ups</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {drafts.length} conversation{drafts.length !== 1 ? "s" : ""} need attention
            </p>
          </div>

          <div className="space-y-4">
            {drafts.map((draft) => {
              const { conversation } = draft;
              const lastMsg = conversation.messages[0];
              const compliance = COMPLIANCE_BADGES[draft.complianceState];
              const channel = CHANNEL_BADGES[conversation.channel.type] ?? {
                label: conversation.channel.type,
                className: "bg-gray-100 text-gray-700",
              };

              return (
                <div
                  key={draft.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 shadow-sm"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {conversation.customer.name}
                      </p>
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${channel.className}`}
                      >
                        {channel.label}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${compliance.className}`}
                    >
                      {compliance.label}
                    </span>
                  </div>

                  {/* Last message snippet */}
                  {lastMsg && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 mb-1">
                        Last message ({lastMsg.sender === "customer" ? "them" : "you"}):
                      </p>
                      <p className="text-sm text-gray-700 line-clamp-2">{lastMsg.content}</p>
                    </div>
                  )}

                  {/* Draft */}
                  <div className="border-l-2 border-blue-300 pl-3">
                    <p className="text-xs text-gray-500 mb-1">Suggested reply:</p>
                    <p className="text-sm text-gray-800">{draft.draftText}</p>
                  </div>

                  {/* Actions */}
                  <TodayActions draftId={draft.id} conversationId={conversation.id} />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
