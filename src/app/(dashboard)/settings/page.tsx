import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage(
  props: { searchParams: Promise<{ meta?: string, reason?: string }> }
) {
  const searchParams = await props.searchParams;
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const business = await prisma.business.findUnique({
    where: { ownerEmail: session.user.email },
    include: { channels: true }
  });

  if (!business) {
    return <div>Business not found</div>;
  }

  const metaChannels = business.channels.filter(c => c.type === "messenger" || c.type === "instagram");

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage your integrations and account settings.
        </p>
      </div>
      
      {searchParams.meta === "connected" && (
        <div className="mb-4 rounded-md bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">Successfully connected to Meta!</p>
        </div>
      )}
      
      {searchParams.meta === "error" && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            Connection failed: {searchParams.reason || "Unknown error"}
          </p>
        </div>
      )}

      <div className="bg-white shadow sm:rounded-lg border border-gray-200">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-base font-semibold leading-6 text-gray-900">
            Social Connections
          </h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>
              Connect your Facebook Page and Instagram Professional account to receive messages in SaleThread.
            </p>
          </div>
          <div className="mt-5">
            <a
              href="/api/auth/meta/login"
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Connect Facebook & Instagram
            </a>
          </div>
          
          {metaChannels.length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h4 className="text-sm font-medium text-gray-900">Connected Channels</h4>
              <ul role="list" className="mt-3 divide-y divide-gray-100 border-t border-b border-gray-200">
                {metaChannels.map((channel) => (
                  <li key={channel.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center">
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{channel.displayName}</p>
                        <p className="text-xs text-gray-500">
                          {channel.type === "messenger" ? "Facebook Messenger" : "Instagram"}
                          {channel.pageId && channel.type === "messenger" && ` (ID: ${channel.pageId})`}
                          {channel.instagramId && channel.type === "instagram" && ` (IG ID: ${channel.instagramId})`}
                        </p>
                      </div>
                    </div>
                    <div>
                      {channel.connected ? (
                        <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                          Disconnected
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
