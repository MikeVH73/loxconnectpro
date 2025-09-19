'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import { db } from '../../firebaseClient';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  orderBy,
  where,
  onSnapshot 
} from 'firebase/firestore';
import { CustomerJobsite, Customer } from '../../types';
import { FiMapPin, FiEdit, FiTrash2, FiPlus, FiSearch, FiFilter } from 'react-icons/fi';

export default function JobsitesPage() {
  const { userProfile, loading } = useAuth();
  const [jobsites, setJobsites] = useState<CustomerJobsite[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingJobsites, setLoadingJobsites] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingJobsite, setEditingJobsite] = useState<CustomerJobsite | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    customerId: '',
    jobsiteName: '',
    address: '',
    latitude: 0,
    longitude: 0,
    contactName: '',
    contactPhone: ''
  });

  // Load customers and jobsites
  useEffect(() => {
    if (!db || !userProfile) return;

    const loadData = async () => {
      try {
        // Load customers
        const customersSnap = await getDocs(collection(db, 'customers'));
        const customersData = customersSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Customer[];
        setCustomers(customersData);

        // Load jobsites with real-time listener
        const jobsitesQuery = query(
          collection(db, 'customerJobsites'),
          orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(jobsitesQuery, (snapshot) => {
          const jobsitesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as CustomerJobsite[];
          setJobsites(jobsitesData);
          setLoadingJobsites(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading data:', error);
        setLoadingJobsites(false);
      }
    };

    loadData();
  }, [userProfile]);

  // Filter jobsites
  const filteredJobsites = jobsites.filter(jobsite => {
    const matchesSearch = jobsite.jobsiteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         jobsite.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         jobsite.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCustomer = !customerFilter || jobsite.customerId === customerFilter;
    return matchesSearch && matchesCustomer && jobsite.isActive;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !userProfile || saving) return;

    setSaving(true);
    try {
      const customer = customers.find(c => c.id === formData.customerId);
      const jobsiteData = {
        customerId: formData.customerId,
        customerName: customer?.name || 'Unknown Customer',
        jobsiteName: formData.jobsiteName,
        address: formData.address,
        latitude: formData.latitude,
        longitude: formData.longitude,
        contact: {
          name: formData.contactName,
          phone: formData.contactPhone
        },
        isActive: true,
        createdBy: userProfile.email,
        createdByRole: userProfile.role,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (editingJobsite) {
        await updateDoc(doc(db, 'customerJobsites', editingJobsite.id), {
          ...jobsiteData,
          updatedAt: new Date()
        });
      } else {
        await addDoc(collection(db, 'customerJobsites'), jobsiteData);
      }

      // Reset form
      setFormData({
        customerId: '',
        jobsiteName: '',
        address: '',
        latitude: 0,
        longitude: 0,
        contactName: '',
        contactPhone: ''
      });
      setShowCreateModal(false);
      setEditingJobsite(null);
    } catch (error) {
      console.error('Error saving jobsite:', error);
      alert('Failed to save jobsite. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (jobsite: CustomerJobsite) => {
    setFormData({
      customerId: jobsite.customerId,
      jobsiteName: jobsite.jobsiteName,
      address: jobsite.address,
      latitude: jobsite.latitude,
      longitude: jobsite.longitude,
      contactName: jobsite.contact.name,
      contactPhone: jobsite.contact.phone
    });
    setEditingJobsite(jobsite);
    setShowCreateModal(true);
  };

  const handleDelete = async (jobsite: CustomerJobsite) => {
    if (!db) return;
    
    if (!confirm(`Are you sure you want to delete "${jobsite.jobsiteName}"?`)) return;

    try {
      await updateDoc(doc(db, 'customerJobsites', jobsite.id), {
        isActive: false,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error deleting jobsite:', error);
      alert('Failed to delete jobsite. Please try again.');
    }
  };

  const canManageJobsite = (jobsite: CustomerJobsite) => {
    if (userProfile?.role === 'superAdmin' || userProfile?.role === 'admin') {
      return true;
    }
    return jobsite.createdBy === userProfile?.email;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <FiMapPin className="mr-3 text-blue-600" />
                Jobsites Management
              </h1>
              <p className="mt-2 text-gray-600">
                Manage jobsites for customers. All users can create and use jobsites.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
            >
              <FiPlus className="mr-2" />
              Add Jobsite
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiSearch className="inline mr-2" />
                Search Jobsites
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, address, or customer..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiFilter className="inline mr-2" />
                Filter by Customer
              </label>
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Customers</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Jobsites List */}
        <div className="bg-white rounded-lg shadow-sm">
          {loadingJobsites ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading jobsites...</p>
            </div>
          ) : filteredJobsites.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FiMapPin className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p>No jobsites found.</p>
              {searchTerm || customerFilter ? (
                <p className="text-sm">Try adjusting your search criteria.</p>
              ) : (
                <p className="text-sm">Create your first jobsite to get started.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Jobsite Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredJobsites.map((jobsite) => (
                    <tr key={jobsite.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {jobsite.jobsiteName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {jobsite.customerName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {jobsite.address}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {jobsite.contact.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {jobsite.contact.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {jobsite.createdBy}
                        </div>
                        <div className="text-sm text-gray-500">
                          {jobsite.createdByRole}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {canManageJobsite(jobsite) && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(jobsite)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <FiEdit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(jobsite)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">
                {editingJobsite ? 'Edit Jobsite' : 'Create New Jobsite'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer *
                  </label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Customer</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jobsite Name *
                  </label>
                  <input
                    type="text"
                    value={formData.jobsiteName}
                    onChange={(e) => setFormData({ ...formData, jobsiteName: e.target.value })}
                    required
                    placeholder="e.g., Main Construction Site"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address *
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                    rows={3}
                    placeholder="Full jobsite address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Latitude
                    </label>
                    <input
                      type="text"
                      value={formData.latitude}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow pasting coordinates like "51.9244, 4.4777" or "51.9244,4.4777"
                        if (value.includes(',')) {
                          const parts = value.split(',').map(p => p.trim());
                          if (parts.length === 2) {
                            setFormData(prev => ({
                              ...prev,
                              latitude: parseFloat(parts[0]) || 0,
                              longitude: parseFloat(parts[1]) || 0
                            }));
                            return;
                          }
                        }
                        setFormData(prev => ({ ...prev, latitude: parseFloat(value) || 0 }));
                      }}
                      placeholder="51.9244 or paste: 51.9244, 4.4777"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Longitude
                    </label>
                    <input
                      type="text"
                      value={formData.longitude}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow pasting coordinates like "51.9244, 4.4777" or "51.9244,4.4777"
                        if (value.includes(',')) {
                          const parts = value.split(',').map(p => p.trim());
                          if (parts.length === 2) {
                            setFormData(prev => ({
                              ...prev,
                              latitude: parseFloat(parts[0]) || 0,
                              longitude: parseFloat(parts[1]) || 0
                            }));
                            return;
                          }
                        }
                        setFormData(prev => ({ ...prev, longitude: parseFloat(value) || 0 }));
                      }}
                      placeholder="4.4777 or paste: 51.9244, 4.4777"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Name *
                    </label>
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      required
                      placeholder="Contact person name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Phone *
                    </label>
                    <input
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      required
                      placeholder="Phone number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingJobsite(null);
                      setFormData({
                        customerId: '',
                        jobsiteName: '',
                        address: '',
                        latitude: 0,
                        longitude: 0,
                        contactName: '',
                        contactPhone: ''
                      });
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : (editingJobsite ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
