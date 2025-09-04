"use client";
import { useMemo, useState } from "react";

type FaqItem = { q: string; a: JSX.Element };
type FaqSection = { title: string; items: FaqItem[] };

const sections: FaqSection[] = [
  {
    title: "Getting started: sign‑in, email verification, MFA",
    items: [
      {
        q: "How do I verify my email?",
        a: (
          <>
            Go to <b>Users ▸ Security</b> and click <b>Send verification email</b>. Open the link in the
            email. If you see "domain not allowlisted", the app uses a safe continueUrl – try again from
            Security. After verifying, the Security page will show your verified status.
          </>
        ),
      },
      {
        q: "How do I enable MFA (Authenticator app)?",
        a: (
          <>
            Go to <b>Users ▸ Security</b> and follow <b>Step 2 – Enroll Authenticator App</b>. Scan the QR
            code in your authenticator and enter the 6‑digit code. SuperAdmins can send an enrollment link
            from <b>Users</b> via <b>Send MFA Reminder</b>.
          </>
        ),
      },
      {
        q: "I can’t continue after verifying – what should I do?",
        a: (
          <>
            Sign out and sign back in. Then revisit <b>Users ▸ Security</b>. The app merges your current
            Auth status after profile fixes.
          </>
        ),
      },
    ],
  },
  {
    title: "Quote Requests: create, edit, products & labels",
    items: [
      {
        q: "How do I create a new Quote Request?",
        a: (
          <>
            Go to <b>Quote Requests ▸ New</b>. Fill <b>Title</b>, select <b>Involved Country</b>, choose a
            <b> Customer</b>, and enter <b>Start/End date</b> using the segmented inputs or calendar. Add at
            least one product with a valid <b>Cat‑Class</b> (use <b>Lookup</b> to pull the description).
            Optionally toggle <b>Mark as Urgent</b>. After creation, you’re redirected to the dashboard.
          </>
        ),
      },
      {
        q: "How do I keep product descriptions consistent?",
        a: (
          <>
            Use the <b>Lookup</b> button in the edit page to sync from the catalog. For unknown codes,
            you’ll be prompted to add the product (Cat‑Class + description) to the catalog before saving.
          </>
        ),
      },
      {
        q: "Why do I see empty product rows?",
        a: (
          <>
            The edit page normalizes products and filters empty rows on save. If you add a row by mistake,
            simply remove it before leaving. Unsaved changes trigger a navigation prompt to avoid loss.
          </>
        ),
      },
      {
        q: "How do labels work (Urgent, Problems, Waiting, Planned)?",
        a: (
          <>
            In the edit page, toggle labels in the left sidebar. Label changes save immediately, move the
            card between dashboard columns, and notify the other country when applicable.
          </>
        ),
      },
      {
        q: "Why are notifications created when I edit fields?",
        a: (
          <>
            Field changes generate a <b>property_change</b> notification and an entry in <b>Recent
            Activity</b>. Duplicates are de‑duplicated in a short window. Clicking notifications opens the
            edit page.
          </>
        ),
      },
    ],
  },
  {
    title: "Messaging & notifications",
    items: [
      {
        q: "Who gets my message?",
        a: (
          <>
            If you’re the <b>creator country</b>, messages target the <b>involved country</b>. If you’re
            the involved country, messages target the creator. The dashboard header shows live
            notifications; the Notifications page aggregates all.
          </>
        ),
      },
      {
        q: "Why doesn’t the messaging list autoscroll sometimes?",
        a: (
          <>
            The messaging panel scrolls to newest using an internal sentinel. If you switch between cards
            with few vs. many messages, it recalculates on mount. This was hardened to be consistent.
          </>
        ),
      },
    ],
  },
  {
    title: "Customers & ownership",
    items: [
      {
        q: "Who can see or edit a customer?",
        a: (
          <>
            Customers are grouped by <b>ownerCountry</b>. The owner country can edit or delete; other
            countries see them as read‑only but can add <b>their own customer number</b>. SuperAdmins can
            set the owner for legacy entries.
          </>
        ),
      },
      {
        q: "Why do Customer dropdowns only show my country’s customers?",
        a: (
          <>
            For new QRs the customer selector is filtered to your business unit/creator country to keep
            selection relevant and prevent cross‑country edits.
          </>
        ),
      },
    ],
  },
  {
    title: "Users & access",
    items: [
      {
        q: "What is the Monthly Access Review?",
        a: (
          <>
            Admins review active staff per country each month. Disabled users show a green <b>Reactivate</b>
            button for SuperAdmins. The review is stored in Firestore and mirrored to Firebase Auth.
          </>
        ),
      },
      {
        q: "How do I set a temporary password for someone?",
        a: (
          <>
            In <b>Users</b>, choose <b>Set Temp Password</b>. Share the generated password securely; the
            user must change it on next login.
          </>
        ),
      },
    ],
  },
  {
    title: "Files & attachments",
    items: [
      {
        q: "How do I add files to a QR?",
        a: (
          <>
            Use the <b>Attachments</b> section in the edit page. Files upload to Firebase Storage and are
            saved in the QR document with metadata (uploadedBy, uploadedAt). Progress is shown per file.
          </>
        ),
      },
    ],
  },
  {
    title: "Analytics & reporting",
    items: [
      {
        q: "What do the Analytics numbers mean?",
        a: (
          <>
            <b>Created</b> counts all QRs for the selected year and filters. <b>In Progress</b> and <b>New</b>
            show active pipeline. <b>Won/Lost/Cancelled</b> are outcomes; EUR tiles sum totalValueEUR.
            Country‑pair tables compute totals per creator→involved pair.
          </>
        ),
      },
    ],
  },
  {
    title: "Archiving & cost controls",
    items: [
      {
        q: "What gets archived and when?",
        a: (
          <>
            Messages older than the retention window are moved to GCS as JSONL. Older notifications are
            removed. An admin endpoint supports on‑demand archiving; BigQuery can be used for analytics.
          </>
        ),
      },
    ],
  },
  {
    title: "Troubleshooting",
    items: [
      {
        q: "Unauthorized continue URL when sending verification email",
        a: (
          <>
            Security uses the configured <code>NEXT_PUBLIC_APP_BASE_URL</code> for a safe continueUrl. Use
            the Security page action rather than raw Firebase links.
          </>
        ),
      },
      {
        q: "Why don’t I receive notifications?",
        a: (
          <>
            Ensure your user profile has the correct <b>businessUnit</b>. Notification targeting depends on
            creator vs. involved country; the app also uses a normalized <b>targetCountryKey</b> field for
            reliable querying.
          </>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return sections;
    const q = query.toLowerCase();
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter((it) => (it.q + " " + (typeof it.a === "string" ? it.a : "")).toLowerCase().includes(q)),
      }))
      .filter((s) => s.items.length > 0);
  }, [query]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#e40115] mb-4">FAQs</h1>

      <div className="mb-4 max-w-2xl">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions..."
          className="w-full rounded border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#e40115]"
        />
      </div>

      <div className="space-y-4">
        {filtered.map((section) => {
          const key = section.title;
          const isOpen = open[key] ?? true;
          return (
            <div key={key} className="bg-white rounded shadow">
              <button
                onClick={() => setOpen((p) => ({ ...p, [key]: !isOpen }))}
                className="w-full text-left px-4 py-3 border-b border-gray-200 flex items-center justify-between"
              >
                <span className="font-semibold text-gray-800">{section.title}</span>
                <span className="text-gray-500 text-xl leading-none">{isOpen ? "–" : "+"}</span>
              </button>
              {isOpen && (
                <div className="divide-y divide-gray-100">
                  {section.items.map((item, idx) => (
                    <div key={idx} className="p-4">
                      <div className="font-medium text-gray-900 mb-1">{item.q}</div>
                      <div className="text-gray-700 text-sm leading-relaxed">{item.a}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


