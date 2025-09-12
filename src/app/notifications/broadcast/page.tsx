"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, serverTimestamp, Firestore } from "firebase/firestore";
import { db } from "../../../firebaseClient";
import { useAuth } from "../../AuthProvider";

export default function BroadcastNotificationsPage() {
  const { userProfile } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [severity, setSeverity] = useState<"info"|"success"|"warning"|"error">("info");
  const [allCountries, setAllCountries] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const isSuperAdmin = userProfile?.role === "superAdmin";

  useEffect(() => {
    const load = async () => {
      if (!db) return;
      // Get unique countries from actual users instead of countries collection
      const usersSnap = await getDocs(collection(db as Firestore, "users"));
      const countries = new Set<string>();
      
      usersSnap.docs.forEach(doc => {
        const userData = doc.data() as any;
        
        // Add businessUnit if it exists
        if (userData.businessUnit && typeof userData.businessUnit === 'string') {
          countries.add(userData.businessUnit);
        }
        
        // Add all countries from countries array
        if (Array.isArray(userData.countries)) {
          userData.countries.forEach((country: any) => {
            if (country && typeof country === 'string') {
              countries.add(country);
            }
          });
        }
      });
      
      setAllCountries(Array.from(countries).sort());
    };
    load();
  }, []);

  if (!isSuperAdmin) {
    return <div className="p-6">Only SuperAdmin can broadcast notifications.</div>;
  }

  const handleSend = async () => {
    if (!db) return;
    if (!title.trim() && !message.trim()) return;
    if (!confirm("Send this broadcast to all countries?")) return;

    try {
      setSending(true);
      // Audit entry
      await addDoc(collection(db as Firestore, "broadcasts"), {
        title, message, link, severity, createdAt: serverTimestamp(), senderRole: userProfile?.role, sender: userProfile?.email || "superAdmin"
      });

      // Create one notification per country
      const notificationsRef = collection(db as Firestore, "notifications");
      const promises = allCountries.map(c => addDoc(notificationsRef, {
        quoteRequestId: null,
        quoteRequestTitle: null,
        sender: userProfile?.email || "superAdmin",
        senderCountry: userProfile?.businessUnit || "Global",
        targetCountry: c,
        content: `${title ? title + " — " : ""}${message}`.slice(0, 2000),
        link: link || null,
        severity,
        notificationType: 'broadcast',
        createdAt: serverTimestamp(),
        isRead: false,
      }));
      await Promise.all(promises);
      alert("Broadcast sent to all countries.");
      setTitle(""); setMessage(""); setLink(""); setSeverity("info");
    } catch (e) {
      console.error(e);
      alert("Failed to send broadcast.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-4">Broadcast notification</h1>
      <div className="space-y-4 bg-white p-4 rounded shadow">
        <div>
          <label className="block text-sm font-medium mb-1">Title (optional)</label>
          <input className="w-full border rounded px-3 py-2" value={title} onChange={e=>setTitle(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea className="w-full border rounded px-3 py-2 h-32" value={message} onChange={e=>setMessage(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Link (optional)</label>
            <input className="w-full border rounded px-3 py-2" placeholder="https://…" value={link} onChange={e=>setLink(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Severity</label>
            <select className="w-full border rounded px-3 py-2" value={severity} onChange={e=>setSeverity(e.target.value as any)}>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Recipients</label>
            <div className="text-sm text-gray-600">All countries ({allCountries.length})</div>
          </div>
        </div>
        <div className="flex justify-end">
          <button disabled={sending} onClick={handleSend} className="px-4 py-2 bg-[#e40115] text-white rounded disabled:opacity-50">{sending? 'Sending…' : 'Send broadcast'}</button>
        </div>
      </div>
    </div>
  );
}



