import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Decimal } from "@prisma/client/runtime/library";

export default async function ThisWeekPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const business = await prisma.business.findUnique({
    where: { ownerEmail: session.user.email },
  });
  if (!business) redirect("/login");

  // ── Aggregate queries ──────────────────────────────────────────────────
  const [statusCounts, soldValueAgg, allConversations] = await Promise.all([
    // Count by status
    prisma.conversation.groupBy({
      by: ["status"],
      where: { businessId: business.id },
      _count: { status: true },
    }),

    // Sum estimated value for sold
    prisma.conversation.aggregate({
      where: { businessId: business.id, status: "sold" },
      _sum: { estimatedValue: true },
    }),

    // All conversations for reason grouping
    prisma.conversation.findMany({
      where: { businessId: business.id, status: { not: "sold" } },
      select: { status: true, reason: true, customer: { select: { name: true } } },
    }),
  ]);

  const countMap: Record<string, number> = {};
  for (const row of statusCounts) {
    countMap[row.status] = row._count.status;
  }

  const soldTotal = soldValueAgg._sum.estimatedValue
    ? Number(soldValueAgg._sum.estimatedValue as Decimal)
    : 0;

  // Group "went quiet" conversations by their reason keyword
  const wentQuiet = allConversations
    .filter((c) => c.reason && c.reason.length > 0)
    .slice(0, 8)
    .map((c) => ({
      customerName: c.customer.name,
      status: c.status,
      reason: c.reason!,
    }));

  const total = (countMap.sold ?? 0) + (countMap.lost ?? 0) + (countMap.pending ?? 0);

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">This Week</h1>
          <p className="text-sm text-gray-500 mt-0.5">Summary across all conversations</p>
        </div>

        {/* Status counts */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Conversation Status
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Sold", key: "sold", className: "border-green-200 bg-green-50", valueClass: "text-green-700" },
              { label: "Pending", key: "pending", className: "border-yellow-200 bg-yellow-50", valueClass: "text-yellow-700" },
              { label: "Lost", key: "lost", className: "border-red-200 bg-red-50", valueClass: "text-red-700" },
            ].map(({ label, key, className, valueClass }) => (
              <div
                key={key}
                className={`rounded-xl border p-4 text-center ${className}`}
              >
                <p className={`text-3xl font-bold ${valueClass}`}>
                  {countMap[key] ?? 0}
                </p>
                <p className="text-xs text-gray-600 mt-1">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">{total} total conversations</p>
        </section>

        {/* Sold value */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total estimated value — Sold</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            ৳{soldTotal.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Across {countMap.sold ?? 0} sold conversation{(countMap.sold ?? 0) !== 1 ? "s" : ""}
          </p>
        </section>

        {/* Went quiet groupings */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Went Quiet After…
          </h2>
          {wentQuiet.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing to show yet.</p>
          ) : (
            <div className="space-y-2">
              {wentQuiet.map((item, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-start gap-3"
                >
                  <span
                    className={`mt-0.5 flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                      item.status === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {item.status}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.customerName}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
