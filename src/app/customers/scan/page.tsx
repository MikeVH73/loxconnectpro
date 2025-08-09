"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, doc, Firestore, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebaseClient";
import { useAuth } from "../../AuthProvider";

type QuoteRequest = {
  id: string;
  title?: string;
  creatorCountry?: string;
  involvedCountry?: string;
  customer?: string | null;
  customerName?: string | null;
};

type Customer = {
  id: string;
  name: string;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function ScanMergeCustomersPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");

  const canManage = userProfile?.role === "admin" || userProfile?.role === "superAdmin";

  useEffect(() => {
    const load = async () => {
      if (!db) return;
      setLoading(true);
      const qrSnap = await getDocs(collection(db as Firestore, "quoteRequests"));
      const qrList = qrSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const custSnap = await getDocs(collection(db as Firestore, "customers"));
      const custList = custSnap.docs.map(d => ({ id: d.id, name: (d.data() as any).name || "" }));
      setQuoteRequests(qrList);
      setCustomers(custList);
      setLoading(false);
    };
    load();
  }, []);

  const orphanGroups = useMemo(() => {
    const map = new Map<string, { name: string; count: number; qrIds: string[]; countries: Set<string> }>();
    quoteRequests.forEach(qr => {
      const hasId = !!qr.customer;
      const name = (qr.customerName || "").trim();
      if (!hasId && name) {
        const key = normalizeName(name);
        if (!map.has(key)) map.set(key, { name, count: 0, qrIds: [], countries: new Set<string>() });
        const g = map.get(key)!;
        g.count += 1;
        g.qrIds.push(qr.id);
        if (qr.creatorCountry) g.countries.add(qr.creatorCountry);
        if (qr.involvedCountry) g.countries.add(qr.involvedCountry);
      }
    });
    // Suggested match by exact normalized name
    const custIndex = new Map(customers.map(c => [normalizeName(c.name), c] as const));
    return Array.from(map.entries()).map(([key, g]) => ({
      key,
      ...g,
      suggestion: custIndex.get(key) || null,
    })).sort((a,b)=>b.count-a.count);
  }, [quoteRequests, customers]);

  const allCustomersOptions = useMemo(() => customers.sort((a,b)=>a.name.localeCompare(b.name)), [customers]);

  const createCustomerAndAttach = async (groupKey: string) => {
    if (!db) return;
    const group = orphanGroups.find(g => g.key === groupKey);
    if (!group) return;
    try {
      setProcessing(groupKey);
      setResult("");
      const docRef = await addDoc(collection(db as Firestore, "customers"), {
        name: group.name,
        address: "",
        contact: "",
        phone: "",
        email: "",
        customerNumbers: {},
        countries: Array.from(group.countries),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      for (const id of group.qrIds) {
        await updateDoc(doc(db as Firestore, "quoteRequests", id), {
          customer: docRef.id,
          customerName: group.name,
        });
      }
      setResult(`Created customer and linked ${group.qrIds.length} quote requests.`);
    } catch (e:any) {
      setResult(`Error: ${e?.message || e}`);
    } finally {
      setProcessing(null);
    }
  };

  const mergeIntoExisting = async (groupKey: string, existingId: string) => {
    if (!db) return;
    const group = orphanGroups.find(g => g.key === groupKey);
    if (!group) return;
    try {
      setProcessing(groupKey);
      setResult("");
      for (const id of group.qrIds) {
        await updateDoc(doc(db as Firestore, "quoteRequests", id), {
          customer: existingId,
          customerName: group.name,
        });
      }
      setResult(`Merged ${group.qrIds.length} quote requests into selected customer.`);
    } catch (e:any) {
      setResult(`Error: ${e?.message || e}`);
    } finally {
      setProcessing(null);
    }
  };

  if (!canManage) {
    return <div className="p-6">You need Admin or SuperAdmin to use this tool.</div>;
  }

  if (loading) return <div className="p-6 text-gray-500">Scanning…</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Scan & Merge Customers</h1>
      <p className="text-sm text-gray-600">Find quote requests with a customer name but without a linked customer record. Create a new customer or merge these into an existing one. Updates will relink the quote requests.</p>
      {result && <div className="p-2 bg-green-50 text-green-700 border border-green-200 rounded">{result}</div>}
      <div className="bg-white rounded shadow overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 px-3">Customer name (from QRs)</th>
              <th className="py-2 px-3">Count</th>
              <th className="py-2 px-3">Countries</th>
              <th className="py-2 px-3">Suggestion</th>
              <th className="py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orphanGroups.map(g => (
              <tr key={g.key} className="border-b last:border-0">
                <td className="py-2 px-3">{g.name}</td>
                <td className="py-2 px-3">{g.count}</td>
                <td className="py-2 px-3">{Array.from(g.countries).join(", ")}</td>
                <td className="py-2 px-3">{g.suggestion?.name || '-'}</td>
                <td className="py-2 px-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    <button
                      disabled={!!processing}
                      onClick={() => createCustomerAndAttach(g.key)}
                      className="px-3 py-1 bg-[#e40115] text-white rounded disabled:opacity-50"
                    >
                      Create & Link
                    </button>
                    <span className="text-xs text-gray-400">or merge into:</span>
                    <select id={`sel-${g.key}`} className="border rounded px-2 py-1">
                      {allCustomersOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      disabled={!!processing}
                      onClick={() => {
                        const sel = document.getElementById(`sel-${g.key}`) as HTMLSelectElement | null;
                        if (sel?.value) mergeIntoExisting(g.key, sel.value);
                      }}
                      className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      Merge
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {orphanGroups.length === 0 && (
              <tr><td colSpan={5} className="py-3 text-gray-500">No orphaned customers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


