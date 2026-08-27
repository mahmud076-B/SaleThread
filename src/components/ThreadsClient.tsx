"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { ConversationStatus, ChannelType } from "@prisma/client";

type ConversationRow = {
  id: string;
  status: ConversationStatus;
  reason: string | null;
  estimatedValue: string | null;
  lastMessageAt: string;
  isUnread: boolean;
  customer: { name: string; externalId: string };
  channel: { type: ChannelType; displayName: string };
  messages: { id: string; content: string; sender: string; sentAt: string; isFailed?: boolean }[];
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
const CHANNEL_TABS: Array<ChannelType | "all"> = ["all", "messenger", "instagram"];
const READ_TABS: Array<"all" | "unread" | "read"> = ["all", "unread", "read"];

function formatRelativeTime(isoString: string) {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatFullTime(isoString: string) {
  return new Date(isoString).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ThreadsClientInner({ initialConversations }: { initialConversations: ConversationRow[] }) {
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");

  const [conversations, setConversations] = useState<ConversationRow[]>(initialConversations);
  const [activeStatus, setActiveStatus] = useState<ConversationStatus | "all">("all");
  const [channelFilter, setChannelFilter] = useState<ChannelType | "all">("all");
  const [readStatus, setReadStatus] = useState<"all" | "unread" | "read">("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(idParam);
  
  // Composer state
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Sync state if props change (e.g. Next.js refresh)
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  // Handle deep linking on mount
  useEffect(() => {
    if (idParam) {
      setExpandedId(idParam);
      // Scroll to the conversation if possible
      setTimeout(() => {
        document.getElementById(`conversation-${idParam}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
      
      // If it's unread, mark it as read
      const c = conversations.find(c => c.id === idParam);
      if (c && c.isUnread) {
        markAsRead(idParam);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam]);

  const filtered = useMemo(() => {
    const result = conversations.filter((c) => {
      const matchStatus = activeStatus === "all" || c.status === activeStatus;
      
      const matchChannel = channelFilter === "all" || c.channel.type === channelFilter;
      
      const matchRead = readStatus === "all" 
        ? true 
        : readStatus === "unread" ? c.isUnread : !c.isUnread;

      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        c.customer.name.toLowerCase().includes(q) ||
        (c.customer.externalId && c.customer.externalId.toLowerCase().includes(q)) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q));

      return matchStatus && matchChannel && matchRead && matchSearch;
    });

    // Explicit sorting: 1. Unread first, 2. Latest message first
    result.sort((a, b) => {
      if (a.isUnread && !b.isUnread) return -1;
      if (!a.isUnread && b.isUnread) return 1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    return result;
  }, [conversations, activeStatus, channelFilter, readStatus, search]);

  const markAsRead = async (conversationId: string) => {
    try {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, isUnread: false } : c))
      );
      await fetch(`/api/conversations/${conversationId}/read`, { method: "PATCH" });
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const handleSendReply = async (conversationId: string, textToSend: string, retryId?: string) => {
    if (!textToSend.trim() || isSending) return;

    setIsSending(true);

    if (retryId) {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            return { ...c, messages: c.messages.filter((m) => m.id !== retryId) };
          }
          return c;
        })
      );
    }

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSend.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              lastMessageAt: data.data.sentAt,
              messages: [data.data, ...c.messages],
            };
          }
          return c;
        })
      );

      if (!retryId || textToSend === replyText) {
        setReplyText("");
      }
    } catch (err: any) {
      const failedMessage = {
        id: `failed-${Date.now()}`,
        content: textToSend.trim(),
        sender: "business",
        sentAt: new Date().toISOString(),
        isFailed: true,
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              messages: [failedMessage, ...c.messages],
            };
          }
          return c;
        })
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters & Search Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <input
            id="threads-search"
            type="search"
            placeholder="Search name, ID, or messages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {search && (
            <button 
              onClick={() => setSearch("")}
              className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 hover:text-gray-600 rounded-full"
            >
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Channel Filter */}
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as any)}
          className="rounded-lg border border-gray-300 py-2.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm bg-white"
        >
          <option value="all">All Channels</option>
          <option value="messenger">Messenger</option>
          <option value="instagram">Instagram</option>
        </select>

        {/* Read Filter */}
        <select
          value={readStatus}
          onChange={(e) => setReadStatus(e.target.value as any)}
          className="rounded-lg border border-gray-300 py-2.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="unread">Unread Only</option>
          <option value="read">Read Only</option>
        </select>
      </div>

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
            {s === "all" ? "All Tags" : s}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="text-xs text-gray-500 font-medium">Showing {filtered.length} conversation{filtered.length !== 1 ? "s" : ""}</p>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-gray-600 font-medium text-sm">
            {conversations.length === 0 
              ? "You're all caught up! No conversations yet." 
              : "No conversations found matching your filters."}
          </p>
          {conversations.length > 0 && (
            <button 
              onClick={() => {
                setSearch("");
                setChannelFilter("all");
                setReadStatus("all");
                setActiveStatus("all");
              }}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const isExpanded = expandedId === c.id;

            return (
              <div
                key={c.id}
                id={`conversation-${c.id}`}
                className={`bg-white rounded-xl border overflow-hidden transition-shadow ${isExpanded ? 'border-blue-300 shadow-md' : 'border-gray-200'}`}
              >
                {/* Header (Click to expand) */}
                <div
                  className={`p-4 cursor-pointer transition-colors ${c.isUnread ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => {
                    if (isExpanded) {
                      setExpandedId(null);
                    } else {
                      setExpandedId(c.id);
                      setReplyText("");
                      if (c.isUnread) markAsRead(c.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                      {c.isUnread ? (
                        <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-transparent flex-shrink-0" />
                      )}
                      <div>
                        <p className={`text-sm truncate ${c.isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}>
                          {c.customer.name}
                        </p>
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[c.status]}`}
                          >
                            {c.status}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CHANNEL_STYLES[c.channel.type]}`}
                          >
                            {c.channel.type}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {c.estimatedValue && (
                        <p className={`text-sm ${c.isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-900'}`}>
                          ৳{Number(c.estimatedValue).toLocaleString()}
                        </p>
                      )}
                      <p className={`text-xs mt-0.5 ${c.isUnread ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                        {formatRelativeTime(c.lastMessageAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50 flex flex-col">
                    
                    {/* Customer Info Panel */}
                    <div className="bg-white px-4 py-3 border-b border-gray-200 flex justify-between items-center text-sm shadow-sm z-10">
                      <div>
                        <p className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">Customer</p>
                        <p className="font-medium text-gray-900">{c.customer.name}</p>
                      </div>
                      {c.customer.externalId && (
                        <div className="hidden sm:block text-center">
                          <p className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">External ID</p>
                          <p className="text-gray-600 text-xs font-mono">{c.customer.externalId}</p>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">Source</p>
                        <p className="font-medium text-gray-900">{c.channel.displayName}</p>
                      </div>
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto max-h-80 space-y-3 mb-4 flex flex-col-reverse">
                      {c.messages.length === 0 ? (
                        <div className="text-center py-10">
                          <p className="text-gray-400 text-sm">No messages in this conversation</p>
                        </div>
                      ) : (
                        c.messages.map((msg) => {
                          const isBusiness = msg.sender === "business" || msg.sender === "ai_draft";
                          return (
                            <div
                              key={msg.id}
                              className={`max-w-[85%] rounded-lg p-3 text-sm ${
                                isBusiness
                                  ? msg.isFailed 
                                    ? "bg-red-50 border border-red-200 text-red-900 self-end rounded-tr-none" 
                                    : "bg-blue-600 text-white self-end rounded-tr-none"
                                  : "bg-white border border-gray-200 text-gray-900 self-start rounded-tl-none shadow-sm"
                              }`}
                            >
                              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                              
                              <div className={`flex items-center justify-between mt-1.5 gap-4 ${isBusiness ? (msg.isFailed ? 'text-red-500' : 'text-blue-200') : 'text-gray-400'}`}>
                                <p className="text-[10px]">
                                  {formatFullTime(msg.sentAt)}
                                </p>
                                {msg.isFailed && (
                                  <button 
                                    onClick={() => handleSendReply(c.id, msg.content, msg.id)}
                                    disabled={isSending}
                                    className="text-[11px] font-bold underline hover:text-red-700 disabled:opacity-50"
                                  >
                                    Retry
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Composer */}
                    <div className="p-4 pt-0">
                      {c.channel.type === "messenger" ? (
                        <div className="bg-white rounded-lg border border-gray-200 p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 transition-shadow">
                          <textarea
                            placeholder="Type a reply..."
                            className="w-full text-sm resize-none border-none focus:ring-0 p-2 text-gray-900 bg-transparent placeholder-gray-400"
                            rows={2}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            disabled={isSending}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendReply(c.id, replyText);
                              }
                            }}
                          />
                          <div className="flex items-center justify-between mt-2 px-2">
                            <p className="text-xs text-gray-400 hidden sm:block">Press Enter to send, Shift+Enter for new line</p>
                            <p className="text-xs text-gray-400 sm:hidden"></p>
                            <button
                              onClick={() => handleSendReply(c.id, replyText)}
                              disabled={!replyText.trim() || isSending}
                              className={`px-4 py-1.5 text-sm font-medium text-white rounded-md transition-all flex items-center gap-2 ${
                                !replyText.trim() || isSending
                                  ? "bg-blue-300 cursor-not-allowed"
                                  : "bg-blue-600 hover:bg-blue-700 shadow-sm"
                              }`}
                            >
                              {isSending ? (
                                <>
                                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Sending...
                                </>
                              ) : "Send Reply"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 text-center py-3 bg-gray-100 rounded-lg border border-gray-200 font-medium">
                          Replies are currently only supported for Messenger channels.
                        </p>
                      )}
                    </div>
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

export function ThreadsClient({ conversations }: { conversations: ConversationRow[] }) {
  return (
    <Suspense fallback={<div className="text-sm text-gray-500 py-10 text-center animate-pulse">Loading threads...</div>}>
      <ThreadsClientInner initialConversations={conversations} />
    </Suspense>
  );
}
