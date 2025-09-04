"use client";
import { useAuth } from "../../AuthProvider";

export default function ITOverviewPage() {
  const { userProfile } = useAuth();

  const isSuperAdmin = userProfile?.role === "superAdmin";

  if (!isSuperAdmin) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-[#e40115] mb-2">IT Overview</h1>
        <p className="text-gray-600">Access denied – this page is only available to superAdmin users.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-3xl font-bold text-[#e40115] mb-6">LoxConnect PRO – IT Overview</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Stack</h2>
        <ul className="list-disc ml-6 text-gray-800">
          <li>Frontend: Next.js (App Router), TypeScript, Tailwind CSS</li>
          <li>Realtime & Data: Firebase (Auth, Firestore, Storage)</li>
          <li>Deployment: Vercel (GitHub CI/CD)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Core capabilities</h2>
        <ul className="list-disc ml-6 text-gray-800">
          <li>Multi‑country quote requests with status, labels, attachments and messaging</li>
          <li>Role‑based access (Employee, admin, superAdmin) and per‑country scoping</li>
          <li>Notifications (messages, status, property change) and Recent Activity</li>
          <li>Customers directory with owner country & country‑specific customer numbers</li>
          <li>Analytics with yearly filters, pipeline (New/In Progress), and EUR totals</li>
          <li>Monthly Access Review with per‑country audit</li>
          <li>Archiving of old messages/notifications with optional analytics backends</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Security</h2>
        <ul className="list-disc ml-6 text-gray-800">
          <li>Authentication: Firebase Auth (email/password + optional MFA TOTP)</li>
          <li>App Check: reCAPTCHA Enterprise tokens (enforced in production)</li>
          <li>Blocking Functions (per environment): optional domain allowlist & email‑verified requirement</li>
          <li>Session: HttpOnly cookie flow (server endpoints mint/clear cookie)</li>
          <li>Authorization:
            <ul className="list-disc ml-6">
              <li>superAdmin: global access, admin tools, archiving, IT/overview page</li>
              <li>admin: scoped to their countries (Users, Customers, QRs)</li>
              <li>Employee: day‑to‑day features only</li>
            </ul>
          </li>
          <li>Data targeting: normalized <code>targetCountryKey</code> for notifications for consistent querying</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Data model (high level)</h2>
        <ul className="list-disc ml-6 text-gray-800">
          <li>Quote Requests: countries, status/labels, products (catClass/qty/description), attachments, notes</li>
          <li>Customers: ownerCountry, customerNumbers per country, contacts subcollection</li>
          <li>Notifications: country‑targeted, single source for property change + Recent Activity</li>
          <li>Access Review: <code>accessReviews/&lt;YYYY‑MM&gt;/countries/&lt;Country&gt;</code> audit</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Operational details</h2>
        <ul className="list-disc ml-6 text-gray-800">
          <li>Autosave with debounce; explicit Save for certain flows; leave‑page warnings when dirty</li>
          <li>Role‑aware filtering re‑applied after critical actions (e.g., Monthly Access Review)</li>
          <li>Customers: superAdmin can change owner country via Countries dropdown</li>
          <li>FAQs: role‑based visibility and superAdmin management (create/edit/remove)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Deployment</h2>
        <ul className="list-disc ml-6 text-gray-800">
          <li>Push to main → Vercel production deploy</li>
          <li>Preview branches → Vercel preview URLs for validation</li>
          <li>Environment variables configured in Vercel dashboard</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Contact & escalation</h2>
        <p className="text-gray-800">For incidents or security concerns, escalate to the superAdmin group and IT owner. Rollback via GitHub revert → auto‑deploy on Vercel.</p>
      </section>
    </div>
  );
}


