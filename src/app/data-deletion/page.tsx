export const metadata = {
  title: "Data Deletion Instructions | SaleThread",
  description: "Instructions on how to request deletion of your data from SaleThread.",
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Data Deletion Instructions</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: August 28, 2026</p>
        </div>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <p>
              SaleThread is a customer messaging platform that helps businesses manage their Facebook Messenger and Instagram Direct messages. We are committed to protecting your privacy and complying with Meta&apos;s Platform Terms regarding user data deletion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">What Data We Store</h2>
            <p>
              Depending on how you interact with SaleThread, we may store the following data:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>For Businesses:</strong> Business account information, authentication credentials, and connected Facebook Page or Instagram Business Account metadata.</li>
              <li><strong>For End-Users (Customers):</strong> If you message a business that uses SaleThread, we store the transcript of your conversation (messages, timestamps, and basic public profile information) on behalf of that business to allow them to reply to you.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">How to Request Data Deletion</h2>
            <p>
              If you wish to have your data permanently deleted from SaleThread&apos;s servers, please follow the steps below based on your user type.
            </p>

            <div className="mt-4 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-2">If you are a Business Owner (SaleThread Account Holder):</h3>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Send an email to <strong>support@salethread.com</strong> from the email address associated with your SaleThread account.</li>
                  <li>Use the subject line: <strong>&quot;Account Deletion Request&quot;</strong>.</li>
                  <li>Include your business name and confirmation that you wish to delete your account and all associated messaging data.</li>
                  <li>We will process your request and permanently delete your account and all stored records within 7 business days.</li>
                </ol>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-2">If you are an End-User (Customer messaging a business):</h3>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Because SaleThread acts as a service provider for the business you messaged, we recommend first contacting the business directly on Facebook or Instagram to request data deletion.</li>
                  <li>Alternatively, you can send an email directly to <strong>support@salethread.com</strong>.</li>
                  <li>Use the subject line: <strong>&quot;Customer Data Deletion Request&quot;</strong>.</li>
                  <li>Include the name of the Business/Facebook Page you messaged and a link to your public Facebook/Instagram profile so we can identify your records.</li>
                  <li>We will verify and permanently delete your conversation data from our database within 7 business days.</li>
                </ol>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Facebook App Connection Removal</h2>
            <p>
              If you are a business owner and simply wish to disconnect SaleThread from your Facebook account without deleting your entire SaleThread account, you can remove the app integration directly through Facebook:
            </p>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>Go to your Facebook account&apos;s <strong>Settings & Privacy</strong>.</li>
              <li>Click on <strong>Settings</strong>, then <strong>Business Integrations</strong>.</li>
              <li>Find <strong>SaleThread</strong> in the list of active integrations.</li>
              <li>Click <strong>Remove</strong> to disconnect the app and revoke its permissions.</li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
