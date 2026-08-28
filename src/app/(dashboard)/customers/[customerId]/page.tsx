import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ChannelType, ConversationStatus } from "@prisma/client";
import { CustomerNotes } from "@/components/CustomerNotes";
import { CustomerTags } from "@/components/CustomerTags";
import { CustomerMemoryClient } from "./CustomerMemoryClient";

export const metadata = {
  title: "Customer Details | SaleThread",
};

const CHANNEL_STYLES: Record<ChannelType, string> = {
  messenger: "bg-blue-100 text-blue-700",
  instagram: "bg-pink-100 text-pink-700",
};

const STATUS_STYLES: Record<ConversationStatus, string> = {
  sold: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
  new: "bg-gray-100 text-gray-800",
  contacted: "bg-yellow-100 text-yellow-700",
  interested: "bg-blue-100 text-blue-700",
  qualified: "bg-purple-100 text-purple-800",
  won: "bg-green-100 text-green-800"
};

function formatRelativeTime(isoString: string | Date) {
  const d = typeof isoString === 'string' ? new Date(isoString) : isoString;
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatFullDate(isoString: string | Date) {
  const d = typeof isoString === 'string' ? new Date(isoString) : isoString;
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const business = await prisma.business.findUnique({
    where: { ownerEmail: session.user.email },
  });

  if (!business) redirect("/login");

  // Fetch the customer AND verify ownership
  const customer = await prisma.customer.findUnique({
    where: { 
      id: customerId,
      businessId: business.id 
    },
    include: {
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        include: {
          channel: true,
          messages: {
            orderBy: { sentAt: "desc" },
            take: 1,
            select: { content: true }
          }
        }
      },
      tags: {
        include: {
          tag: true,
        },
      }
    }
  });

  if (!customer) {
    redirect("/customers");
  }

  // Derive first seen date from earliest conversation
  const firstSeen = customer.conversations.length > 0
    ? new Date(
        Math.min(
          ...customer.conversations.map(c => c.lastMessageAt.getTime()) // Approximation for first seen since we don't store createdAt on conversation yet
        )
      )
    : null;

  const lastActivity = customer.conversations.length > 0 
    ? customer.conversations[0].lastMessageAt 
    : null;

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-3">
          <Link 
            href="/customers"
            className="p-2 -ml-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {customer.name || customer.externalId}
            </h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CHANNEL_STYLES[customer.channelType]}`}>
                {customer.channelType}
              </span>
              {customer.externalId && (
                <span className="font-mono text-xs">{customer.externalId}</span>
              )}
            </p>
          </div>
        </div>

        {/* Customer Meta */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">First Seen</p>
              <p className="font-medium text-gray-900 text-sm mt-0.5">
                {firstSeen ? formatFullDate(firstSeen) : "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Last Activity</p>
              <p className="font-medium text-gray-900 text-sm mt-0.5">
                {lastActivity ? formatRelativeTime(lastActivity) : "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Conversations</p>
              <p className="font-medium text-gray-900 text-sm mt-0.5">
                {customer.conversations.length}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Platform</p>
              <p className="font-medium text-gray-900 text-sm mt-0.5 capitalize">
                {customer.channelType}
              </p>
            </div>
          </div>
        </div>

        <CustomerMemoryClient customerId={customer.id} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tags */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Tags</h2>
            <CustomerTags 
              customerId={customer.id} 
              initialAssignedTags={customer.tags.map(t => t.tag)} 
            />
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Internal Notes</h2>
            <CustomerNotes customerId={customer.id} />
          </div>
        </div>

        {/* Conversation History */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Conversation History</h2>
          
          {customer.conversations.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <p className="text-gray-500 text-sm">No conversations found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customer.conversations.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/threads?id=${conv.id}`}
                  className={`block bg-white rounded-xl border border-gray-200 p-4 transition-all hover:border-blue-300 hover:shadow-md ${conv.isUnread ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex items-start gap-3">
                      {conv.isUnread ? (
                        <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1.5" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-transparent flex-shrink-0 mt-1.5" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[conv.status]}`}>
                            {conv.status}
                          </span>
                          <span className="text-xs text-gray-500 font-medium">
                            via {conv.channel.displayName}
                          </span>
                        </div>
                        
                        <p className={`text-sm mt-1.5 line-clamp-2 ${conv.isUnread ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                          {conv.messages[0]?.content || "No messages"}
                        </p>
                        
                        {(conv.estimatedValue || conv.reason) && (
                          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                            {conv.estimatedValue && (
                              <span className="font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                                ৳{Number(conv.estimatedValue).toLocaleString()}
                              </span>
                            )}
                            {conv.reason && (
                              <span className="truncate max-w-[200px] sm:max-w-md">
                                {conv.reason}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className={`text-xs ${conv.isUnread ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                        {formatRelativeTime(conv.lastMessageAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
