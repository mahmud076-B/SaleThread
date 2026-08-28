"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import type { ChannelType } from "@prisma/client";

export type CustomerRow = {
  id: string;
  name: string;
  externalId: string;
  channelType: ChannelType;
  conversationCount: number;
  lastActivity: string | null;
  latestMessage: string | null;
  latestConversationStatus: string | null;
  isUnread: boolean;
  tags: { id: string; name: string }[];
};

const CHANNEL_STYLES: Record<ChannelType, string> = {
  messenger: "bg-blue-100 text-blue-700",
  instagram: "bg-pink-100 text-pink-700",
};

function formatRelativeTime(isoString: string) {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

import { useRouter, useSearchParams } from "next/navigation";

export function CustomersClient({ customers }: { customers: CustomerRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [search, setSearch] = useState(searchParams?.get("q") || "");
  const [channelFilter, setChannelFilter] = useState<ChannelType | "all">("all");

  const filtered = useMemo(() => {
    const result = customers.filter((c) => {
      const matchChannel = channelFilter === "all" || c.channelType === channelFilter;
      return matchChannel;
    });

    // Optional: Sort unread first, then by lastActivity
    result.sort((a, b) => {
      if (a.isUnread && !b.isUnread) return -1;
      if (!a.isUnread && b.isUnread) return 1;
      
      const timeA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const timeB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      return timeB - timeA;
    });

    return result;
  }, [customers, channelFilter]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      const current = new URLSearchParams(Array.from(searchParams?.entries() || []));
      if (search) {
        current.set("q", search);
      } else {
        current.delete("q");
      }
      const searchStr = current.toString();
      const query = searchStr ? `?${searchStr}` : "";
      router.push(`/customers${query}`);
    }, 400);

    return () => clearTimeout(handler);
  }, [search, router, searchParams]);

  return (
    <div className="space-y-4">
      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <input
            type="search"
            placeholder="Search by name or external ID…"
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
          onChange={(e) => setChannelFilter(e.target.value as "all" | "messenger" | "instagram")}
          className="rounded-lg border border-gray-300 py-2.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm bg-white"
        >
          <option value="all">All Platforms</option>
          <option value="messenger">Messenger</option>
          <option value="instagram">Instagram</option>
        </select>
      </div>

      <p className="text-xs text-gray-500 font-medium">Showing {filtered.length} customer{filtered.length !== 1 ? "s" : ""}</p>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p className="text-gray-600 font-medium text-sm">
            {customers.length === 0 
              ? "Your customers will appear here when people message your connected channels." 
              : "No customers found."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              className={`block bg-white rounded-xl border border-gray-200 p-4 transition-all hover:border-blue-300 hover:shadow-md ${c.isUnread ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex items-start gap-3">
                  {c.isUnread ? (
                    <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1.5" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-transparent flex-shrink-0 mt-1.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm truncate ${c.isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}>
                        {c.name || c.externalId}
                      </p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CHANNEL_STYLES[c.channelType]}`}>
                        {c.channelType}
                      </span>
                      {c.latestConversationStatus && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                          c.latestConversationStatus === 'sold' ? 'bg-green-100 text-green-700' :
                          c.latestConversationStatus === 'lost' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {c.latestConversationStatus}
                        </span>
                      )}
                    </div>
                    
                    <p className={`text-xs mt-1 line-clamp-1 ${c.isUnread ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                      {c.latestMessage || "No messages"}
                    </p>
                  </div>
                </div>
                
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-xs text-gray-500 font-medium mb-0.5">
                    {c.conversationCount} conversation{c.conversationCount !== 1 && 's'}
                  </p>
                  {c.lastActivity && (
                    <p className={`text-[11px] ${c.isUnread ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                      {formatRelativeTime(c.lastActivity)}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
