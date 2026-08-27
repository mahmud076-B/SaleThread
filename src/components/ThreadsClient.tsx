"use client";

import { useState, useMemo, useEffect } from "react";
import type { ConversationStatus, ChannelType } from "@prisma/client";

type ConversationRow = {
  id: string;
  status: ConversationStatus;
  reason: string | null;
  estimatedValue: string | null;
  lastMessageAt: string;
  customer: { name: string };
  channel: { type: ChannelType; displayName: string };
  messages: { id: string; content: string; sender: string; sentAt: string }[];
};

const STATUS_STYLES: Record<ConversationStatus, string> = {
  sold: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
};

const CHANNEL_STYLES: Record<ChannelType, string> = {
  messenger: "bg-blue-100 text-blue-700",
  instagram: "bg-pink-100 text-pink-700",
};

const STATUS_TABS: Array<ConversationStatus | "all"> = ["all", "pending", "sold", "lost"];

function formatRelativeTime(isoString: string) {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ThreadsClient({ conversations: initialConversations }: { conversations: ConversationRow[] }) {
  const [conversations, setConversations] = useState<ConversationRow[]>(initialConversations);
  const [activeStatus, setActiveStatus] = useState<ConversationStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Composer state
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Sync state if props change (e.g. Next.js refresh)
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      const matchStatus = activeStatus === "all" || c.status === activeStatus;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        c.customer.name.toLowerCase().includes(q) ||
        (c.reason ?? "").toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [conversations, activeStatus, search]);

  const handleSendReply = async (conversationId: string) => {
    if (!replyText.trim() || isSending) return;

    setIsSending(true);
    setSendError(null);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      // Append message locally
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              lastMessageAt: data.data.sentAt,
              messages: [data.data, ...c.messages], // Insert at beginning since orderBy is desc
            };
          }
          return c;
        })
      );

      setReplyText("");
    } catch (err: any) {
      setSendError(err.message || "An unexpected error occurred");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        id="threads-search"
        type="search"
        placeholder="Search by customer or reason…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Status tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            id={`tab-${s}`}
            onClick={() => setActiveStatus(s)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors capitalize ${
              activeStatus === s
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="text-xs text-gray-500">{filtered.length} conversations</p>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">No conversations found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const isExpanded = expandedId === c.id;

            return (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Header (Click to expand) */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    if (isExpanded) {
                      setExpandedId(null);
                    } else {
                      setExpandedId(c.id);
                      setReplyText("");
                      setSendError(null);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {c.customer.name}
                      </p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[c.status]}`}
                        >
                          {c.status}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${CHANNEL_STYLES[c.channel.type]}`}
                        >
                          {c.channel.type}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {c.estimatedValue && (
                        <p className="text-sm font-semibold text-gray-900">
                          ৳{Number(c.estimatedValue).toLocaleString()}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatRelativeTime(c.lastMessageAt)}
                      </p>
                    </div>
                  </div>
                  {c.reason && (
                    <p className="text-xs text-gray-500 line-clamp-2 mt-2">{c.reason}</p>
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50 p-4 flex flex-col">
                    <div className="flex-1 overflow-y-auto max-h-64 space-y-3 mb-4 flex flex-col-reverse">
                      {c.messages.map((msg) => {
                        const isBusiness = msg.sender === "business" || msg.sender === "ai_draft";
                        return (
                          <div
                            key={msg.id}
                            className={`max-w-[80%] rounded-lg p-3 text-sm ${
                              isBusiness
                                ? "bg-blue-600 text-white self-end rounded-tr-none"
                                : "bg-white border border-gray-200 text-gray-900 self-start rounded-tl-none shadow-sm"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <p
                              className={`text-[10px] mt-1 ${
                                isBusiness ? "text-blue-200" : "text-gray-400"
                              }`}
                            >
                              {new Date(msg.sentAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Composer */}
                    {c.channel.type === "messenger" ? (
                      <div className="mt-auto bg-white rounded-lg border border-gray-200 p-2 shadow-sm">
                        <textarea
                          placeholder="Type a reply..."
                          className="w-full text-sm resize-none border-none focus:ring-0 p-2 text-gray-900 bg-transparent"
                          rows={2}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          disabled={isSending}
                        />
                        <div className="flex items-center justify-between mt-2 px-2">
                          <p className="text-xs text-red-500 font-medium">{sendError}</p>
                          <button
                            onClick={() => handleSendReply(c.id)}
                            disabled={!replyText.trim() || isSending}
                            className={`px-4 py-1.5 text-sm font-medium text-white rounded-md transition-colors ${
                              !replyText.trim() || isSending
                                ? "bg-blue-300 cursor-not-allowed"
                                : "bg-blue-600 hover:bg-blue-700"
                            }`}
                          >
                            {isSending ? "Sending..." : "Send Reply"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 text-center py-2">
                        Replies are currently only supported for Messenger channels.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
