import Link from "next/link";
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-gray-900 text-base">SaleThread</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              id="logout-btn"
              className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>

        {/* Bottom nav tabs */}
        <nav className="max-w-2xl mx-auto px-4 flex gap-1 pb-0">
          {[
            { href: "/today", label: "Today" },
            { href: "/threads", label: "Threads" },
            { href: "/this-week", label: "This Week" },
            { href: "/settings", label: "Settings" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-500 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Page content */}
      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
