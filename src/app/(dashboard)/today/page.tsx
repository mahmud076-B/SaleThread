import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

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

function getDhakaBoundaries() {
  const dhakaStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric', month: 'numeric', day: 'numeric'
  }).format(new Date());
  
  const [m, d, y] = dhakaStr.split('/');
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  const todayIso = `${y}-${pad(+m)}-${pad(+d)}T00:00:00+06:00`;
  const startOfToday = new Date(todayIso);
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  
  return { startOfToday, startOfTomorrow };
}

export default async function TodayPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const business = await prisma.business.findUnique({
    where: { ownerEmail: session.user.email },
  });
  if (!business) redirect("/login");

  const { startOfToday, startOfTomorrow } = getDhakaBoundaries();

  // Parallel database queries for performance
  const [
    ,
    ,
    activePipeline, // For pipeline value
    statusCounts, // Group by status
    recentConversations,
    activeFollowUps,
    attentionNeeded,
  ] = await Promise.all([
    prisma.conversation.count({ where: { businessId: business.id } }),
    prisma.conversation.count({ where: { businessId: business.id, isUnread: true } }),
    prisma.conversation.aggregate({
      where: { 
        businessId: business.id,
        status: { in: ['new', 'contacted', 'interested', 'qualified'] } 
      },
      _sum: { estimatedValue: true }
    }),
    prisma.conversation.groupBy({
      by: ['status'],
      where: { businessId: business.id },
      _count: { _all: true }
    }),
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
    prisma.conversation.findMany({
      where: {
        businessId: business.id,
        followUpAt: { not: null },
        followUpCompleted: false,
      },
      include: {
        customer: true,
        channel: true,
      },
      orderBy: { followUpAt: "asc" },
    }),
    prisma.conversation.findMany({
      where: {
        businessId: business.id,
        OR: [
          { isUnread: true },
          { priority: { in: ['high', 'urgent'] } },
          { status: { in: ['interested', 'qualified'] } },
          { followUpAt: { lt: startOfToday }, followUpCompleted: false }
        ]
      },
      orderBy: { lastMessageAt: "desc" },
      take: 10,
      include: {
        customer: true,
        channel: true,
      },
    }),
  ]);

  const pipelineValue = activePipeline._sum.estimatedValue || 0;

  let newLeads = 0;
  let interestedLeads = 0;
  let qualifiedLeads = 0;
  let wonLeads = 0;

  statusCounts.forEach((s) => {
    if (s.status === 'new') newLeads += s._count._all;
    if (s.status === 'interested') interestedLeads += s._count._all;
    if (s.status === 'qualified') qualifiedLeads += s._count._all;
    if (s.status === 'won') wonLeads += s._count._all;
    // Include legacy mapping if desired, but user said treat legacy separate.
    if (s.status === 'pending') newLeads += s._count._all; // Count pending as new pipeline optionally
    if (s.status === 'sold') wonLeads += s._count._all;
  });

  const overdueFollowUps = activeFollowUps.filter(f => f.followUpAt! < startOfToday);
  const todayFollowUps = activeFollowUps.filter(f => f.followUpAt! >= startOfToday && f.followUpAt! < startOfTomorrow);
  const upcomingFollowUps = activeFollowUps.filter(f => f.followUpAt! >= startOfTomorrow);

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        
        {/* 1. DASHBOARD METRICS */}
        <section>
          <h1 className="text-xl font-bold text-gray-900 mb-4">Pipeline Overview</h1>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">New Leads</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{newLeads.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Interested</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{interestedLeads.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Qualified</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{qualifiedLeads.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Won Leads</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{wonLeads.toLocaleString()}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm col-span-1 sm:col-span-2 flex flex-col justify-center">
              <p className="text-sm font-medium text-gray-500">Total Pipeline Value (Active)</p>
              <p className="text-4xl font-bold text-gray-900 mt-1">৳{Number(pipelineValue).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col justify-center gap-3">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Follow-ups Today</p>
                <p className={`text-xl font-bold mt-0.5 ${todayFollowUps.length > 0 ? "text-blue-600" : "text-gray-900"}`}>{todayFollowUps.length}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Overdue</p>
                <p className={`text-xl font-bold mt-0.5 ${overdueFollowUps.length > 0 ? "text-red-600" : "text-gray-900"}`}>{overdueFollowUps.length}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 1.5. AI ATTENTION NEEDED */}
        {attentionNeeded.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>✨</span> AI Attention Needed
              </h2>
            </div>
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 shadow-sm overflow-hidden flex flex-col">
              {attentionNeeded.map((c, index) => {
                const channel = CHANNEL_BADGES[c.channel.type] ?? {
                  label: c.channel.type,
                  className: "bg-gray-100 text-gray-700",
                };
                
                return (
                  <Link
                    key={c.id}
                    href={`/threads?id=${c.id}`}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-white/50 transition-colors gap-3 ${
                      index !== attentionNeeded.length - 1 ? "border-b border-emerald-100/50" : ""
                    }`}
                  >
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900">
                          {c.customer.name}
                        </p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${channel.className}`}>
                          {channel.label}
                        </span>
                        {c.isUnread && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-blue-100 text-blue-700">
                            Unread
                          </span>
                        )}
                        {c.priority !== 'normal' && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border ${
                            c.priority === 'urgent' ? 'bg-red-50 text-red-600 border-red-200' :
                            'bg-orange-50 text-orange-600 border-orange-200'
                          }`}>
                            {c.priority}
                          </span>
                        )}
                        {['interested', 'qualified'].includes(c.status) && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700">
                            {c.status}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-semibold text-emerald-700 bg-white px-3 py-1 rounded-full shadow-sm border border-emerald-100">
                        Analyze Lead →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* 2. SALES FOLLOW-UPS */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Follow-ups</h2>
          </div>

          {activeFollowUps.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-12 text-center shadow-sm">
              <p className="text-gray-500 text-sm font-medium">No active follow-ups scheduled.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {[
                { title: "Overdue", items: overdueFollowUps, color: "text-red-600" },
                { title: "Today", items: todayFollowUps, color: "text-blue-600" },
                { title: "Upcoming", items: upcomingFollowUps, color: "text-gray-600" }
              ].map(group => group.items.length > 0 && (
                <div key={group.title}>
                  <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${group.color}`}>{group.title}</h3>
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                    {group.items.map((f, index) => {
                      const channel = CHANNEL_BADGES[f.channel.type] ?? {
                        label: f.channel.type,
                        className: "bg-gray-100 text-gray-700",
                      };
                      
                      return (
                        <Link
                          key={f.id}
                          href={`/threads?id=${f.id}`}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-gray-50 transition-colors gap-3 ${
                            index !== group.items.length - 1 ? "border-b border-gray-200" : ""
                          }`}
                        >
                          <div className="flex-1 flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-gray-900">
                                {f.customer.name}
                              </p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${channel.className}`}>
                                {channel.label}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-gray-100 text-gray-700 border border-gray-200">
                                {f.status}
                              </span>
                              {f.priority !== 'normal' && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border ${
                                  f.priority === 'urgent' ? 'bg-red-50 text-red-600 border-red-200' :
                                  'bg-orange-50 text-orange-600 border-orange-200'
                                }`}>
                                  {f.priority}
                                </span>
                              )}
                            </div>
                            {f.estimatedValue && (
                              <p className="text-xs font-medium text-gray-500">
                                Deal Value: <span className="text-gray-900 font-bold">৳{Number(f.estimatedValue).toLocaleString()}</span>
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-sm font-bold ${group.title === 'Overdue' ? 'text-red-600' : 'text-gray-900'}`}>
                              {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(f.followUpAt!)}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. RECENT CONVERSATIONS */}
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

      </div>
    </div>
  );
}
