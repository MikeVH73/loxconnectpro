"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../AuthProvider";
import { collection, getDocs, addDoc, query, where } from "firebase/firestore";
import { db } from "../../firebaseClient";

// Define required labels
const REQUIRED_LABELS = [
  "Urgent",
  "Problems",
  "Waiting for Answer",
  "Planned",
  "Snooze"
];

interface Label {
  id: string;
  name: string;
}

export default function LabelsPage() {
  const { userProfile } = useAuth();
  console.log("[LabelsPage] userProfile:", userProfile);
  const [labels, setLabels] = useState<Label[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchLabels = async () => {
      setLoading(true);
      try {
        // First fetch all existing labels
        const snap = await getDocs(collection(db, "labels"));
        const existingLabels = snap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data()
        } as Label));
        setLabels(existingLabels);

        // Check which required labels are missing
        const existingLabelNames = new Set(existingLabels.map(l => l.name.toLowerCase()));
        const missingLabels = REQUIRED_LABELS.filter(label => 
          !existingLabelNames.has(label.toLowerCase())
        );

        console.log('[DEBUG] Labels check:', {
          existing: existingLabelNames,
          missing: missingLabels
        });

        // Add any missing required labels
        if (missingLabels.length > 0) {
          console.log('[DEBUG] Adding missing labels:', missingLabels);
          const labelsRef = collection(db, "labels");
          const addPromises = missingLabels.map(name => 
            addDoc(labelsRef, { name })
          );
          await Promise.all(addPromises);

          // Refresh labels after adding missing ones
          const newSnap = await getDocs(collection(db, "labels"));
          const updatedLabels = newSnap.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
          } as Label));
          setLabels(updatedLabels);
        }
      } catch (err) {
        console.error('Error managing labels:', err);
        setError('Failed to manage labels');
      } finally {
        setLoading(false);
      }
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
      setLabels(snap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Label)));
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