export const metadata = {
  title: "Privacy Policy | SaleThread",
  description: "Privacy Policy for SaleThread and its Meta integrations.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: August 28, 2026</p>
        </div>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              Welcome to SaleThread. This Privacy Policy explains how we collect, use, store, and protect your information when you use our web application to manage sales conversations across Meta platforms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Meta Integration & API Usage</h2>
            <p>
              SaleThread integrates with Facebook and Instagram via the Meta Graph API and Webhooks to help business owners manage their messages in one place. By connecting your Meta Business accounts, you authorize SaleThread to:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Receive and read incoming customer messages from your connected Facebook Pages and Instagram Business accounts.</li>
              <li>Send replies back to customers on your behalf through the SaleThread dashboard.</li>
              <li>Access basic public profile information of the users interacting with your connected pages, strictly for displaying conversation context.</li>
            </ul>
            <p className="mt-2">
              Our use of information received from Meta APIs adheres to Meta's Platform Terms and Developer Policies. We do not use this data for targeted advertising or sell it to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Data Collection and Storage</h2>
            <p>
              We collect and securely store the following data in our database to provide our service:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Business Data:</strong> Information you provide during registration, such as your email address and business name.</li>
              <li><strong>Authentication Data:</strong> Securely hashed passwords used for logging into the SaleThread dashboard.</li>
              <li><strong>Customer Messages:</strong> Chat transcripts, threads, and related metadata retrieved via Meta Webhooks, which are securely stored to allow you to view and respond to your customers over time.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Protection and Security</h2>
            <p>
              All customer messages, business information, and authentication credentials are encrypted in transit and stored in a secure, access-controlled PostgreSQL database. Access to your dashboard is protected by authentication protocols, and Meta access tokens are stored securely on our servers and never exposed to the frontend browser.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Retention and Deletion</h2>
            <p>
              We retain your data only for as long as necessary to provide the SaleThread service. 
            </p>
            <p className="mt-2">
              <strong>Account Deletion:</strong> If you are a business owner using SaleThread and wish to delete your account, you can request the permanent deletion of your account and all associated Meta messaging data by contacting us. Upon verifying your request, your database records will be erased.
            </p>
            <p className="mt-2">
              <strong>Customer Data Deletion:</strong> If you are an end-user (customer) who has messaged a business using SaleThread, you have the right to request the deletion of your conversation data. Please contact the business you messaged directly, or contact us using the information below, and we will assist in fulfilling the data deletion request in compliance with Meta's data deletion requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, or if you would like to exercise your right to access, modify, or delete your data, please contact us at:
            </p>
            <p className="mt-2 font-medium">
              Email: support@salethread.com
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Note: This is an active compliance contact specifically designated for privacy and data deletion inquiries.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
