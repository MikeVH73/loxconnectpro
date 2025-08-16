"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, query, where, orderBy, limit, onSnapshot, Firestore } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";
import Link from "next/link";

interface QuoteRequestLite {
  id: string;
  title: string;
  creatorCountry: string;
  involvedCountry: string;
  status: string;
  createdAt?: any;
}

export default function NewQrsBar() {
  const { userProfile } = useAuth();
  const [items, setItems] = useState<QuoteRequestLite[]>([]);
  const [open, setOpen] = useState(false);

  const country = userProfile?.businessUnit || "";
  const countryKey = useMemo(() => (country || "").toLowerCase().replace(/[^a-z0-9]/g, ""), [country]);

  useEffect(() => {
    if (!db || !country) return;
    const col = collection(db as Firestore, "quoteRequests");
    // Show new items where status == New and the involved or creator matches my BU
    const q = query(
      col,
      where("status", "==", "New"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((d) => d.creatorCountry === country || d.involvedCountry === country) as QuoteRequestLite[];
      setItems(list);
    });
    return () => unsub();
  }, [countryKey]);

  if (!items.length) return null;

  return (
    <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 mr-96">
      <div className="flex items-center justify-between">
        <div className="text-sm text-purple-900 font-medium">
          New quote requests ({items.length})
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-sm text-purple-800 hover:text-purple-900 underline"
          >
            {open ? "Hide" : "View"}
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-3 divide-y divide-purple-200 bg-white rounded border border-purple-100">
          {items.map((qr) => (
            <Link
              key={qr.id}
              href={`/quote-requests/${qr.id}/edit`}
              className="flex items-center justify-between px-4 py-2 hover:bg-purple-50"
            >
              <div className="truncate pr-4">
                <div className="text-sm font-medium text-gray-900 truncate">{qr.title}</div>
                <div className="text-xs text-gray-600">{qr.creatorCountry} → {qr.involvedCountry}</div>
              </div>
              <span className="ml-4 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">NEW</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}


