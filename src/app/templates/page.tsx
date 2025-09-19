"use client";
import { useState } from 'react';
import { useAuth } from '../AuthProvider';
import { useTemplates } from '../hooks/useTemplates';
import { QuoteRequestTemplate } from '../../types';
import { FiPlus, FiEdit, FiTrash2, FiCopy, FiEye } from 'react-icons/fi';

export default function TemplatesPage() {
  const { userProfile } = useAuth();
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useTemplates();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuoteRequestTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    category: '',
    templateData: {
      title: '',
      description: '',
      products: [{ catClass: '', quantity: 1, description: '' }],
      defaultStartDate: 0,
      defaultEndDate: 30,
      defaultJobsiteAddress: '',
      defaultLatitude: 0,
      defaultLongitude: 0,
      defaultJobsiteContact: { name: '', phone: '' },
      defaultNotes: ''
    },
    isPublic: false
  });

  const categories = [
    'Construction',
    'Equipment Rental',
    'Maintenance',
    'Event',
    'General',
    'Other'
  ];

  const handleCreateTemplate = async () => {
    if (!userProfile || !newTemplate.name || !newTemplate.category) {
      alert('Please fill in template name and category');
      return;
    }

    try {
      await createTemplate({
        name: newTemplate.name,
        description: newTemplate.description,
        category: newTemplate.category,
        templateData: newTemplate.templateData,
        createdBy: userProfile.email,
        createdByRole: userProfile.role,
        isPublic: newTemplate.isPublic,
        isActive: true
      });

      setNewTemplate({
        name: '',
        description: '',
        category: '',
        templateData: {
          title: '',
          description: '',
          products: [{ catClass: '', quantity: 1, description: '' }],
          defaultStartDate: 0,
          defaultEndDate: 30,
          defaultJobsiteAddress: '',
          defaultLatitude: 0,
          defaultLongitude: 0,
          defaultJobsiteContact: { name: '', phone: '' },
          defaultNotes: ''
        },
        isPublic: false
      });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating template:', error);
      alert('Failed to create template. Please try again.');
    }
  };

  const handleEditTemplate = (template: QuoteRequestTemplate) => {
    setEditingTemplate(template);
    setNewTemplate({
      name: template.name,
      description: template.description,
      category: template.category,
      templateData: template.templateData,
      isPublic: template.isPublic
    });
    setShowEditModal(true);
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !newTemplate.name || !newTemplate.category) {
      alert('Please fill in template name and category');
      return;
    }

    try {
      await updateTemplate(editingTemplate.id, {
        name: newTemplate.name,
        description: newTemplate.description,
        category: newTemplate.category,
        templateData: newTemplate.templateData,
        isPublic: newTemplate.isPublic
      });

      setShowEditModal(false);
      setEditingTemplate(null);
    } catch (error) {
      console.error('Error updating template:', error);
      alert('Failed to update template. Please try again.');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await deleteTemplate(templateId);
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template. Please try again.');
    }
  };

  const addProduct = () => {
    setNewTemplate(prev => ({
      ...prev,
      templateData: {
        ...prev.templateData,
        products: [...prev.templateData.products, { catClass: '', quantity: 1, description: '' }]
      }
    }));
  };

  const removeProduct = (index: number) => {
    setNewTemplate(prev => ({
      ...prev,
      templateData: {
        ...prev.templateData,
        products: prev.templateData.products.filter((_, i) => i !== index)
      }
    }));
  };

  const updateProduct = (index: number, field: string, value: any) => {
    setNewTemplate(prev => ({
      ...prev,
      templateData: {
        ...prev.templateData,
        products: prev.templateData.products.map((product, i) => 
          i === index ? { ...product, [field]: value } : product
        )
      }
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Templates Management</h1>
              <p className="mt-2 text-gray-600">Create and manage reusable quote request templates</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <FiPlus className="w-4 h-4" />
              Create Template
            </button>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div key={template.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                  <p className="text-sm text-gray-500">{template.category}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditTemplate(template)}
                    className="text-gray-400 hover:text-blue-600"
                    title="Edit template"
                  >
                    <FiEdit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="text-gray-400 hover:text-red-600"
                    title="Delete template"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-4">{template.description}</p>

              <div className="space-y-2 mb-4">
                <div className="text-sm">
                  <span className="font-medium">Products:</span> {template.templateData.products.length}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Usage:</span> {template.usageCount} times
                </div>
                <div className="text-sm">
                  <span className="font-medium">Visibility:</span> 
                  <span className={`ml-1 px-2 py-1 rounded text-xs ${
                    template.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {template.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Created by {template.createdBy}
              </div>
            </div>
          ))}
        </div>

        {templates.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <FiCopy className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
            <p className="text-gray-600 mb-4">Create your first template to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Create Template
            </button>
          </div>
        )}
      </div>

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">Create New Template</h3>
            
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Standard Construction"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={newTemplate.category}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category...</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this template is for..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Template Data */}
              <div className="border-t pt-4">
                <h4 className="text-md font-medium text-gray-900 mb-3">Template Data</h4>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Title
                    </label>
                    <input
                      type="text"
                      value={newTemplate.templateData.title || ''}
                      onChange={(e) => setNewTemplate(prev => ({
                        ...prev,
                        templateData: { ...prev.templateData, title: e.target.value }
                      }))}
                      placeholder="Default quote request title"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Description
                    </label>
                    <input
                      type="text"
                      value={newTemplate.templateData.description || ''}
                      onChange={(e) => setNewTemplate(prev => ({
                        ...prev,
                        templateData: { ...prev.templateData, description: e.target.value }
                      }))}
                      placeholder="Default description"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Products */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Default Products
                    </label>
                    <button
                      onClick={addProduct}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      + Add Product
                    </button>
                  </div>
                  
                  {newTemplate.templateData.products.map((product, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={product.catClass}
                          onChange={(e) => updateProduct(index, 'catClass', e.target.value)}
                          placeholder="Cat. Class"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-6">
                        <input
                          type="text"
                          value={product.description}
                          onChange={(e) => updateProduct(index, 'description', e.target.value)}
                          placeholder="Description"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={product.quantity}
                          onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 1)}
                          min="1"
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-1">
                        <button
                          onClick={() => removeProduct(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Default Dates */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Start Date (days from today)
                    </label>
                    <input
                      type="number"
                      value={newTemplate.templateData.defaultStartDate || 0}
                      onChange={(e) => setNewTemplate(prev => ({
                        ...prev,
                        templateData: { ...prev.templateData, defaultStartDate: parseInt(e.target.value) || 0 }
                      }))}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default End Date (days from today)
                    </label>
                    <input
                      type="number"
                      value={newTemplate.templateData.defaultEndDate || 30}
                      onChange={(e) => setNewTemplate(prev => ({
                        ...prev,
                        templateData: { ...prev.templateData, defaultEndDate: parseInt(e.target.value) || 30 }
                      }))}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Default Jobsite */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Jobsite Address
                    </label>
                    <input
                      type="text"
                      value={newTemplate.templateData.defaultJobsiteAddress || ''}
                      onChange={(e) => setNewTemplate(prev => ({
                        ...prev,
                        templateData: { ...prev.templateData, defaultJobsiteAddress: e.target.value }
                      }))}
                      placeholder="Default jobsite address"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Notes
                    </label>
                    <input
                      type="text"
                      value={newTemplate.templateData.defaultNotes || ''}
                      onChange={(e) => setNewTemplate(prev => ({
                        ...prev,
                        templateData: { ...prev.templateData, defaultNotes: e.target.value }
                      }))}
                      placeholder="Default notes"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Visibility */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={newTemplate.isPublic}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, isPublic: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-900">
                    Make this template public (available to all users)
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">Edit Template</h3>
            
            {/* Same form as create modal */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={newTemplate.category}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category...</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isPublicEdit"
                  checked={newTemplate.isPublic}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, isPublic: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isPublicEdit" className="ml-2 block text-sm text-gray-900">
                  Make this template public (available to all users)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Update Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
