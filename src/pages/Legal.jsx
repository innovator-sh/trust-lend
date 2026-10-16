import React from 'react';
import { Link } from 'react-router-dom';

const Section = ({ title, children }) => (
  <section className="mb-10">
    <h2 className="font-cabinet font-black text-xl text-[#FAFAF8] mb-3">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-[#B8B8B8]">{children}</div>
  </section>
);

/**
 * Plain-language terms and privacy notice for the prototype.
 * This is not legal advice. A lawyer must review it before any real launch.
 */
export default function Legal() {
  return (
    <div className="min-h-screen bg-[#0A0F1E] px-6 py-16 font-satoshi">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="text-[11px] font-black uppercase tracking-widest text-[#F5A623]">
          ← Back
        </Link>
        <h1 className="mt-6 mb-2 font-cabinet text-4xl font-black text-[#FAFAF8]">Terms &amp; Privacy</h1>
        <p className="mb-10 text-xs text-[#8C8C8C]">
          Plain-language summary for the TrustLend prototype. Last updated: October 2026.
        </p>

        <Section title="1. What TrustLend is today">
          <p>
            TrustLend is a hackathon prototype. It runs on a test network with test tokens that
            have no value. It is not a bank, not a licensed lender, and not a licensed
            peer-to-peer lending platform.
          </p>
          <p>
            Do not send real money. Do not treat anything here as financial, legal or tax advice.
          </p>
        </Section>

        <Section title="2. No guarantees">
          <p>
            Lending carries risk. A borrower can fail to repay, and a lender can lose some or all
            of the capital. The platform does not guarantee principal or returns. Rates and limits
            shown are rules of the prototype, not promises.
          </p>
          <p>
            Trust scores come from fixed rules in the smart contract. They are not a measured
            credit model. See <code>docs/risk-model.md</code> in the project repository.
          </p>
        </Section>

        <Section title="3. Data we collect">
          <p>
            Your wallet address, a display name (an alias is fine) and your role. We also store
            your loan records and a read-only snapshot of public chain data. This data is stored in
            a Supabase database. In this prototype the database rules are open, so treat every
            value as <strong>not private</strong>. The app does not collect phone numbers, email
            addresses, home addresses, income or ID numbers (such as Aadhaar or PAN). Do not enter
            real personal data in the display name.
          </p>
          <p>
            Blockchain records (loans, repayments, scores) are public and cannot be deleted.
          </p>
        </Section>

        <Section title="4. Your choices">
          <p>
            You can use the app with test data only. To ask for removal of off-chain data, open an
            issue in the project repository.
          </p>
        </Section>

        <Section title="5. Before a real launch">
          <p>
            A production service would need the correct licence or a licensed partner, verified
            identity checks, protected storage of personal data, and a legal review of these terms.
            See <code>docs/regulatory-position.md</code> in the repository.
          </p>
        </Section>
      </div>
    </div>
  );
}
