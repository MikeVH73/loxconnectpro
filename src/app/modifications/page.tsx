'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, Firestore } from 'firebase/firestore';
import { db } from '../../../src/firebaseClient';
import dayjs from 'dayjs';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';

export default function ModificationsPage() {
  const [mods, setMods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [labelsMap, setLabelsMap] = useState<any>({});
  const [contactsMap, setContactsMap] = useState<any>({});
  const [customersMap, setCustomersMap] = useState<any>({});
  const [quoteRequestToCustomer, setQuoteRequestToCustomer] = useState<any>({});
  const [quoteRequestsMap, setQuoteRequestsMap] = useState<any>({});

  useEffect(() => {
    const fetchMods = async () => {
      setLoading(true);
      const q = query(collection(db, 'modifications'), orderBy('dateTime', 'desc'));
      const snapshot = await getDocs(q);
      setMods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    };
    fetchMods();
  }, []);

  useEffect(() => {
    const fetchExtraData = async () => {
      if (!db) return;
      
      // Fetch all labels
      const labelsSnap = await getDocs(collection(db as Firestore, 'labels'));
      const labelsObj: any = {};
      labelsSnap.forEach(doc => { labelsObj[doc.id] = doc.data(); });
      setLabelsMap(labelsObj);
      
      // Fetch all contacts
      const contactsSnap = await getDocs(collection(db as Firestore, 'contacts'));
      const contactsObj: any = {};
      contactsSnap.forEach(doc => { 
        contactsObj[doc.id] = { 
          ...doc.data(),
          name: doc.data().name || 'Unknown Contact'  // Ensure name exists
        }; 
      });
      setContactsMap(contactsObj);
      
      // Fetch all customers
      const customersSnap = await getDocs(collection(db as Firestore, 'customers'));
      const customersObj: any = {};
      customersSnap.forEach(doc => { customersObj[doc.id] = doc.data(); });
      setCustomersMap(customersObj);
    };
    fetchExtraData();
  }, []);

  useEffect(() => {
    const fetchQuoteRequests = async () => {
      if (!db) return;
      
      const snap = await getDocs(collection(db as Firestore, 'quoteRequests'));
      const map: any = {};
      snap.forEach(doc => {
        const data = doc.data();
        map[doc.id] = {
          title: data.title || 'Untitled Quote Request',
          customer: data.customer
        };
      });
      setQuoteRequestsMap(map);
    };
    fetchQuoteRequests();
  }, []);

  const filteredMods = mods
    .map(mod => {
      let customerName = '';
      let quoteRequestTitle = '';
      // Try to get customer from changes or from quoteRequestId
      const customerChange = mod.changes?.find((chg: any) => chg.field === 'customer');
      let customerId = customerChange ? customerChange.to : undefined;
      if (!customerId && mod.quoteRequestId && quoteRequestToCustomer) {
        customerId = quoteRequestToCustomer[mod.quoteRequestId];
      }
      if (customerId && customersMap[customerId]) {
        customerName = customersMap[customerId].name;
      }
      // Get quote request title
      if (mod.quoteRequestId && quoteRequestsMap[mod.quoteRequestId]) {
        quoteRequestTitle = quoteRequestsMap[mod.quoteRequestId].title;
      }
      return { ...mod, customerName, quoteRequestTitle };
    })
    .filter(mod => {
      const s = search.toLowerCase();
      return (
        !search ||
        (mod.user && mod.user.toLowerCase().includes(s)) ||
        (mod.quoteRequestId && mod.quoteRequestId.toLowerCase().includes(s)) ||
        (mod.customerName && mod.customerName.toLowerCase().includes(s)) ||
        (mod.dateTime?.toDate && dayjs(mod.dateTime.toDate()).format('YYYY-MM-DD HH:mm').includes(s))
      );
    });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#e40115] mb-4">Modifications</h1>
      <div className="relative mb-4 w-full max-w-md">
        <input
          className="border rounded px-3 py-2 w-full pr-8"
          placeholder="Search by user, quote request, or date..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-200 hover:bg-gray-300 rounded-full w-6 h-6 flex items-center justify-center text-gray-600"
            tabIndex={-1}
            aria-label="Clear search"
            style={{ padding: 0, border: 'none' }}
          >
            ×
          </button>
        )}
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : filteredMods.length === 0 ? (
        <div>No modifications found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded shadow">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Date/Time</th>
                <th className="px-4 py-2 text-left">User</th>
                <th className="px-4 py-2 text-left">Customer (Company)</th>
                <th className="px-4 py-2 text-left">Quote Request</th>
                <th className="px-4 py-2 text-left">Changes</th>
              </tr>
            </thead>
            <tbody>
              {filteredMods.map(mod => (
                <tr key={mod.id} className="border-t align-top">
                  <td className="px-4 py-2 whitespace-nowrap">{mod.dateTime?.toDate ? dayjs(mod.dateTime.toDate()).format('YYYY-MM-DD HH:mm') : ''}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{mod.user}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{mod.customerName || ''}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Link href={`/quote-requests/${mod.quoteRequestId}/edit`} className="text-[#e40115] hover:underline">
                      {mod.quoteRequestTitle || mod.quoteRequestId}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <ul className="list-disc ml-4">
                      {mod.changes?.map((chg: any, idx: number) => {
                        let from = chg.from, to = chg.to;
                        // Render user-friendly values
                        if (chg.field === 'products') {
                          from = Array.isArray(from) ? from.map((p: any) => `${p.catClass || ''} ${p.description || ''} x${p.quantity || 1}`).join('; ') : String(from);
                          to = Array.isArray(to) ? to.map((p: any) => `${p.catClass || ''} ${p.description || ''} x${p.quantity || 1}`).join('; ') : String(to);
                        } else if (chg.field === 'jobsite') {
                          from = from?.address || '(none)';
                          to = to?.address || '(none)';
                        } else if (chg.field === 'labels') {
                          from = Array.isArray(from) ? from.map((id: string) => labelsMap[id]?.name || id).join(', ') : String(from);
                          to = Array.isArray(to) ? to.map((id: string) => labelsMap[id]?.name || id).join(', ') : String(to);
                        } else if (chg.field === 'jobsiteContactId') {
                          from = from ? (contactsMap[from]?.name || from) : '(none)';
                          to = to ? (contactsMap[to]?.name || to) : '(none)';
                        } else if (chg.field === 'customer') {
                          from = from ? (customersMap[from]?.name || from) : '(none)';
                          to = to ? (customersMap[to]?.name || to) : '(none)';
                        } else if (typeof from === 'object' || typeof to === 'object') {
                          from = JSON.stringify(from);
                          to = JSON.stringify(to);
                        }
                        return (
                          <li key={idx}><b>{chg.field}</b>: <span className="text-gray-500 line-through">{from}</span> → <span className="text-[#e40115]">{to}</span></li>
                        );
                      })}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 