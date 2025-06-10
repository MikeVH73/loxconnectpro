"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../firebaseClient";
import Link from "next/link";

interface Customer {
  id: string;
  name: string;
  address: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const q = query(collection(db, "customers"), orderBy("name"));
      const snapshot = await getDocs(q);
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      setLoading(false);
    };
    fetchData();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#e40115] mb-4">Customers</h1>
      {loading ? (
        <div>Loading...</div>
      ) : customers.length === 0 ? (
        <div>No customers found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded shadow">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Address</th>
                <th className="px-4 py-2 text-left">View</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2">{c.address}</td>
                  <td className="px-4 py-2">
                    <Link href={`/customers/${c.id}`} className="text-[#e40115] underline">View</Link>
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