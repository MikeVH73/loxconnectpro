'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Firestore } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import dynamic from 'next/dynamic';

const LoadingSpinner = dynamic(() => import('../components/LoadingSpinner'), { ssr: false });

interface Label {
  id: string;
  name: string;
  color?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

function LabelsPage() {
  const { userProfile } = useAuth();
  const [isClient, setIsClient] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [labelName, setLabelName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Check if user is superAdmin
  const isSuperAdmin = userProfile?.role === "superAdmin";

  // Fetch labels
  useEffect(() => {
    if (!isClient || !isSuperAdmin) return;
    
    const fetchLabels = async () => {
      try {
        setLoading(true);
        const snapshot = await getDocs(collection(db as Firestore, "labels"));
        const labelsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Label[];
        labelsData.sort((a, b) => a.name.localeCompare(b.name));
        setLabels(labelsData);
      } catch (error) {
        console.error("Error fetching labels:", error);
        setError("Failed to fetch labels");
      } finally {
        setLoading(false);
      }
    };

    fetchLabels();
  }, [isClient, isSuperAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labelName.trim()) {
      setError("Label name is required");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (editingLabel) {
        // Update existing label
        await updateDoc(doc(db as Firestore, "labels", editingLabel.id), {
          name: labelName.trim(),
          updatedAt: new Date()
        });
        setSuccess("Label updated successfully!");
      } else {
        // Create new label
        await addDoc(collection(db as Firestore, "labels"), {
          name: labelName.trim(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        setSuccess("Label created successfully!");
      }

      // Refresh labels list
      const snapshot = await getDocs(collection(db as Firestore, "labels"));
      const labelsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Label[];
      labelsData.sort((a, b) => a.name.localeCompare(b.name));
      setLabels(labelsData);

      // Reset form
      setLabelName("");
      setEditingLabel(null);
      setShowModal(false);
    } catch (error) {
      console.error("Error saving label:", error);
      setError("Failed to save label");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (label: Label) => {
    setEditingLabel(label);
    setLabelName(label.name);
    setShowModal(true);
  };

  const handleDelete = async (labelId: string, labelName: string) => {
    if (!confirm(`Are you sure you want to delete the label "${labelName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db as Firestore, "labels", labelId));
      setLabels(prev => prev.filter(label => label.id !== labelId));
      setSuccess("Label deleted successfully!");
    } catch (error) {
      console.error("Error deleting label:", error);
      setError("Failed to delete label");
    }
  };

  const handleCancel = () => {
    setLabelName("");
    setEditingLabel(null);
    setShowModal(false);
    setError("");
  };

  if (!isClient) {
    return <LoadingSpinner />;
  }

  if (!isSuperAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Access Denied:</strong> Only Super Administrators can access the Labels management page.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Labels Management</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[#e40115] text-white rounded hover:bg-red-700"
        >
          Add New Label
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Labels List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          {labels.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No labels found. Create your first label to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Label Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Updated
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {labels.map((label) => (
                    <tr key={label.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {label.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {label.createdAt ? new Date(label.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {label.updatedAt ? new Date(label.updatedAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(label)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(label.id, label.name)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">
              {editingLabel ? 'Edit Label' : 'Add New Label'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Label Name</label>
                <input
                  type="text"
                  value={labelName}
                  onChange={(e) => setLabelName(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Enter label name"
                  required
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#e40115] text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : (editingLabel ? "Update" : "Create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Export with no SSR
export default dynamic(() => Promise.resolve(LabelsPage), {
  ssr: false
}); 