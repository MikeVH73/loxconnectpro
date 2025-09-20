import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { QuoteRequestTemplate } from '../../types';

export function useTemplates(userCountry?: string) {
  const [templates, setTemplates] = useState<QuoteRequestTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    const fetchTemplates = async () => {
      try {
        // Fetch templates filtered by country
        const templatesQuery = collection(db, 'quoteRequestTemplates');
        const snapshot = await getDocs(templatesQuery);
        
        let templatesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as QuoteRequestTemplate[];
        
        // Filter for active templates only
        templatesData = templatesData.filter(template => template.isActive === true);
        
        // Filter by country: only show templates from user's country
        if (userCountry) {
          templatesData = templatesData.filter(template => 
            template.createdByCountry === userCountry
          );
        }
        
        // Sort by usage count (most used first), then by name
        templatesData.sort((a, b) => {
          if (b.usageCount !== a.usageCount) {
            return b.usageCount - a.usageCount;
          }
          return a.name.localeCompare(b.name);
        });
        
        setTemplates(templatesData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching templates:', error);
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [userCountry]);

  const createTemplate = async (templateData: Omit<QuoteRequestTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
    if (!db) throw new Error('Database not available');

    const newTemplate = {
      ...templateData,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(collection(db, 'quoteRequestTemplates'), newTemplate);
    return { id: docRef.id, ...newTemplate };
  };

  const updateTemplate = async (templateId: string, updates: Partial<QuoteRequestTemplate>) => {
    if (!db) throw new Error('Database not available');

    await updateDoc(doc(db, 'quoteRequestTemplates', templateId), {
      ...updates,
      updatedAt: new Date()
    });
  };

  const incrementUsageCount = async (templateId: string) => {
    if (!db) throw new Error('Database not available');

    const template = templates.find(t => t.id === templateId);
    if (template) {
      await updateDoc(doc(db, 'quoteRequestTemplates', templateId), {
        usageCount: template.usageCount + 1,
        updatedAt: new Date()
      });
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!db) throw new Error('Database not available');

    // Soft delete by setting isActive to false
    await updateDoc(doc(db, 'quoteRequestTemplates', templateId), {
      isActive: false,
      updatedAt: new Date()
    });
  };

  return {
    templates,
    loading,
    createTemplate,
    updateTemplate,
    incrementUsageCount,
    deleteTemplate
  };
}
