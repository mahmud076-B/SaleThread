import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TodayActions } from "@/components/TodayActions";
import type { ComplianceState } from "@prisma/client";

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

export default async function TodayPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const business = await prisma.business.findUnique({
    where: { ownerEmail: session.user.email },
  });
  if (!business) redirect("/login");

  const drafts = await prisma.followUpDraft.findMany({
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
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Today&apos;s Follow-ups</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {drafts.length} conversation{drafts.length !== 1 ? "s" : ""} need attention
        </p>
      </div>

      {drafts.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          No follow-ups for today. 🎉
        </div>
      ) : (
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
                className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
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
      )}
    </div>
  );
}
