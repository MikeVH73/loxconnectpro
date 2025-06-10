"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../AuthProvider";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "../../firebaseClient";

export default function LabelsPage() {
  const { userProfile } = useAuth();
  console.log("[LabelsPage] userProfile:", userProfile);
  const [labels, setLabels] = useState<any[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchLabels = async () => {
      setLoading(true);
      const snap = await getDocs(collection(db, "labels"));
      setLabels(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    };
    fetchLabels();
  }, []);

  const handleAddLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!newLabel.trim()) return;
    try {
      await addDoc(collection(db, "labels"), { name: newLabel });
      setNewLabel("");
      // Refresh labels
      const snap = await getDocs(collection(db, "labels"));
      setLabels(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err: any) {
      setError(err.message || "Failed to add label");
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#e40115] mb-4">Labels</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-2 mb-6">
          {labels.length === 0 ? (
            <div className="text-gray-400">No labels found.</div>
          ) : (
            labels.map(label => (
              <div key={label.id} className="bg-gray-100 px-4 py-2 rounded text-gray-800 inline-block mr-2">
                {label.name}
              </div>
            ))
          )}
        </div>
      )}
      {userProfile?.role === "superAdmin" && (
        <form onSubmit={handleAddLabel} className="flex gap-2 items-center mt-4">
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="New label name"
            className="border px-3 py-1 rounded"
          />
          <button
            type="submit"
            className="bg-[#e40115] text-white px-4 py-1 rounded hover:bg-red-700 transition"
          >
            Add Label
          </button>
          {error && <span className="text-red-500 text-sm ml-2">{error}</span>}
        </form>
      )}
    </div>
  );
} 