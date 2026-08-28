export const metadata = {
  title: "Terms of Service | SaleThread",
  description: "Terms of Service and Acceptable Use Policy for SaleThread.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Terms of Service</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: August 28, 2026</p>
        </div>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using SaleThread (&quot;the Service&quot;), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
            <p>
              SaleThread provides a dashboard for businesses to consolidate, view, and reply to customer conversations originating from Meta platforms, including Facebook Messenger and Instagram Direct Messages. The Service connects to your Meta business accounts via official APIs to synchronize these communications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. User Responsibilities & Account Security</h2>
            <p>
              You are responsible for maintaining the confidentiality of your SaleThread account credentials and for all activities that occur under your account. You agree to:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Provide accurate and complete registration information.</li>
              <li>Notify us immediately of any unauthorized use of your account.</li>
              <li>Use the Service only for lawful business purposes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Acceptable Use Policy</h2>
            <p>
              When using SaleThread to communicate with your customers, you agree you will not:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Send spam, unsolicited promotions, or harassing messages.</li>
              <li>Violate Meta&apos;s Platform Terms, Commerce Policies, or Community Standards.</li>
              <li>Attempt to disrupt or compromise the integrity or security of the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Third-Party Services (Meta)</h2>
            <p>
              SaleThread relies on APIs provided by Meta Platforms, Inc. (Facebook and Instagram). Your use of SaleThread is also subject to Meta&apos;s Terms of Service. We are not responsible for any changes in Meta&apos;s API availability, policy updates, or service interruptions that may affect SaleThread&apos;s functionality.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Limitation of Liability</h2>
            <p>
              SaleThread is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the maximum extent permitted by law, SaleThread and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising from your use or inability to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to the Service at our sole discretion, without notice, for conduct that we believe violates these Terms of Service or is harmful to other users, us, or third parties (including Meta).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Contact Information</h2>
            <p>
              For any questions regarding these Terms of Service, please contact us at:
            </p>
            <p className="mt-2 font-medium">
              Email: support@salethread.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
