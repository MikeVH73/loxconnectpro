"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Firestore, orderBy } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";

type Role = "Employee" | "admin" | "superAdmin";
type FaqDoc = {
  id: string;
  subject: string;
  question: string;
  answer: string;
  roles?: Role[]; // who can see
  createdAt?: any;
  updatedAt?: any;
};

// Simple, non‑technical seed used only if the collection is empty (optional for preview)
const seedExamples: Omit<FaqDoc, "id">[] = [
  { subject: "Getting started", question: "How do I verify my email?", answer: "Open Users ▸ Security and click Send verification email. Open the link and return to the Security page to see the green check.", roles: ["Employee", "admin", "superAdmin"] },
  { subject: "Quote Requests", question: "How do I create a new quote request?", answer: "Go to Quote Requests ▸ New. Fill the title, choose the countries, pick a customer, add the dates and at least one product. Save to finish.", roles: ["Employee", "admin", "superAdmin"] },
  { subject: "Permissions", question: "Who can edit customers?", answer: "The owner country can edit. Other countries can view and add their own customer number. A superAdmin can change the owner if needed.", roles: ["Employee", "admin", "superAdmin"] },
];

export default function FaqPage() {
  const { userProfile } = useAuth();
  const role: Role = (userProfile?.role as any) || "Employee";
  const canManage = role === "superAdmin";

  const [faqs, setFaqs] = useState<FaqDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({}); // all closed by default

  const [editing, setEditing] = useState<Partial<FaqDoc> | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!db) return;
      setLoading(true);
      const snap = await getDocs(collection(db as Firestore, "faqs"));
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as FaqDoc[];
      if (list.length === 0 && canManage) {
        // Optional: provide seed button instead of auto‑seeding; keep minimal to avoid surprise writes
      }
      setFaqs(list);
      setLoading(false);
    };
    load();
  }, [db, canManage]);

  const visibleFaqs = useMemo(() => {
    const allowed = (roles?: Role[]) => !roles || roles.length === 0 || roles.includes(role);
    const list = faqs.filter((f) => allowed(f.roles));
    const q = query.trim().toLowerCase();
    const bySubject = new Map<string, FaqDoc[]>();
    (q ? list.filter((f) => (f.subject + " " + f.question + " " + f.answer).toLowerCase().includes(q)) : list).forEach((f) => {
      const key = f.subject || "General";
      if (!bySubject.has(key)) bySubject.set(key, []);
      bySubject.get(key)!.push(f);
    });
    // also show seeds if no docs
    if (list.length === 0) {
      seedExamples.forEach((s, i) => {
        if (!allowed(s.roles)) return;
        const key = s.subject;
        if (!bySubject.has(key)) bySubject.set(key, []);
        bySubject.get(key)!.push({ id: `seed-${i}`, ...s });
      });
    }
    return Array.from(bySubject.entries()).map(([subject, items]) => ({ subject, items }));
  }, [faqs, role, query]);

  const upsertFaq = async () => {
    if (!db || !editing?.question || !editing?.answer || !editing?.subject) return;
    const payload = {
      subject: editing.subject.trim(),
      question: editing.question.trim(),
      answer: editing.answer.trim(),
      roles: (editing.roles || []) as Role[],
      updatedAt: new Date(),
    };
    if (editing.id && !String(editing.id).startsWith("seed-")) {
      await updateDoc(doc(db as Firestore, "faqs", editing.id), payload as any);
      setFaqs((prev) => prev.map((f) => (f.id === editing.id ? ({ ...f, ...(payload as any) }) : f)));
    } else {
      const ref = await addDoc(collection(db as Firestore, "faqs"), { ...payload, createdAt: new Date() } as any);
      setFaqs((prev) => [...prev, { id: ref.id, ...(payload as any) }]);
    }
    setShowForm(false);
    setEditing(null);
  };

  const removeFaq = async (id: string) => {
    if (!db) return;
    if (String(id).startsWith("seed-")) {
      setFaqs((prev) => prev.filter((f) => f.id !== id));
      return;
    }
    await deleteDoc(doc(db as Firestore, "faqs", id));
    setFaqs((prev) => prev.filter((f) => f.id !== id));
  };

  const rolesOptions: Role[] = ["Employee", "admin", "superAdmin"];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#e40115] mb-4">FAQs</h1>

      <div className="mb-4 max-w-2xl flex items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions..."
          className="flex-1 rounded border border-gray-300 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#e40115]"
        />
        {canManage && (
          <button
            onClick={() => { setEditing({ subject: "General", roles: ["Employee", "admin", "superAdmin"] }); setShowForm(true); }}
            className="px-3 py-2 bg-[#e40115] text-white rounded hover:bg-red-700"
          >
            + Add Q&A
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-4">
          {visibleFaqs.map(({ subject, items }) => {
            const isOpen = open[subject] ?? false; // closed by default
            return (
              <div key={subject} className="bg-white rounded shadow">
                <button
                  onClick={() => setOpen((p) => ({ ...p, [subject]: !isOpen }))}
                  className="w-full text-left px-4 py-3 border-b border-gray-200 flex items-center justify-between"
                >
                  <span className="font-semibold text-gray-800">{subject}</span>
                  <span className="text-gray-500 text-xl leading-none">{isOpen ? "–" : "+"}</span>
                </button>
                {isOpen && (
                  <div className="divide-y divide-gray-100">
                    {items.map((it) => (
                      <div key={it.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-gray-900 mb-1">{it.question}</div>
                            <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{it.answer}</div>
                            {canManage && (
                              <div className="text-xs text-gray-500 mt-1">Visible to: {(it.roles && it.roles.length>0 ? it.roles.join(", ") : "Everyone")}</div>
                            )}
                          </div>
                          {canManage && (
                            <div className="shrink-0 flex gap-2">
                              <button
                                onClick={() => { setEditing(it); setShowForm(true); }}
                                className="px-2 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
                              >Edit</button>
                              <button
                                onClick={() => removeFaq(it.id)}
                                className="px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                              >Remove</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && canManage && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded p-4 w-full max-w-lg space-y-3">
            <h3 className="text-lg font-semibold">{editing?.id ? "Edit Q&A" : "Add Q&A"}</h3>
            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm">Subject
                <input
                  value={editing?.subject || ""}
                  onChange={(e) => setEditing((p) => ({ ...(p || {}), subject: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </label>
              <label className="text-sm">Question
                <input
                  value={editing?.question || ""}
                  onChange={(e) => setEditing((p) => ({ ...(p || {}), question: e.target.value }))}
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </label>
              <label className="text-sm">Answer
                <textarea
                  value={editing?.answer || ""}
                  onChange={(e) => setEditing((p) => ({ ...(p || {}), answer: e.target.value }))}
                  rows={6}
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </label>
              <label className="text-sm">Visible to (roles)
                <select multiple value={(editing?.roles as Role[] | undefined) || []} onChange={(e) => {
                  const vals = Array.from(e.target.selectedOptions).map((o) => o.value as Role);
                  setEditing((p) => ({ ...(p || {}), roles: vals }));
                }} className="mt-1 w-full border rounded px-3 py-2 h-28">
                  {rolesOptions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-3 py-2 border rounded">Cancel</button>
              <button onClick={upsertFaq} className="px-3 py-2 bg-[#e40115] text-white rounded hover:bg-red-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


