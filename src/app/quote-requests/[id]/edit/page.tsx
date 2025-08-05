'use client';

import { useEffect, useState, Suspense, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, serverTimestamp, addDoc, Firestore } from 'firebase/firestore';
import { db } from '@/firebaseClient';
import { useAuth } from '../../../AuthProvider';
import FileUpload from '../../../components/FileUpload';

import ArchivedMessaging from '../../../components/ArchivedMessaging';
import CountrySelect from '../../../components/CountrySelect';
import MessagingPanel from '@/app/components/MessagingPanel';
import { useMessages } from '@/app/hooks/useMessages';
import { useCustomers } from '../../../hooks/useCustomers';
import Link from 'next/link';
import { debounce } from 'lodash';
import Script from 'next/script';
import { createNotification } from '../../../utils/notifications';
import dynamic from 'next/dynamic';
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

// Initialize dayjs plugins
dayjs.extend(relativeTime);

// Dynamically import components that might cause hydration issues
const QuoteRequestNotifications = dynamic(
  () => import('../../../components/QuoteRequestNotifications'),
  { ssr: false }
);

const LoadingSpinner = dynamic(() => import('../../../components/LoadingSpinner'), { ssr: false });

interface QuoteRequest {
  id: string;
  title: string;
  products: Array<{
    catClass: string;
    description: string;
    quantity: number;
  }>;
  creatorCountry: string;
  involvedCountry: string;
  startDate: string;
  endDate: string;
  status: string;
  customer: string;
  labels: string[];
  attachments: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
    uploadedAt: Date;
    uploadedBy: string;
  }>;
  jobsite?: {
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  jobsiteContact?: {
    name: string;
    phone: string;
  };
  notes?: Array<{
    text: string;
    user: string;
    dateTime: Date;
  }>;
  customerNumber?: string;
  customerDecidesEndDate?: boolean;
  latitude?: string;
  longitude?: string;
  updatedAt?: Date;
  updatedBy?: string;
  waitingForAnswer: boolean;
  urgent: boolean;
  problems: boolean;
  planned: boolean;
}

const statuses = ["New", "In Progress", "Snoozed", "Won", "Lost", "Cancelled"];

const labelTexts: Record<keyof Pick<QuoteRequest, 'waitingForAnswer' | 'urgent' | 'problems' | 'planned'>, string> = {
  waitingForAnswer: "Waiting for Answer",
  urgent: "Urgent",
  problems: "Problems",
  planned: "Planned"
};

interface QuoteRequestWithDynamicKeys extends QuoteRequest {
  [key: string]: any;
  updatedAt?: Date;
  updatedBy?: string;
  creatorCountry: string;
  involvedCountry: string;
  labels: string[];
}

export default function EditQuoteRequest() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { user, userProfile } = useAuth();
  const isReadOnly = userProfile?.role === "readOnly";
  const [quoteRequest, setQuoteRequest] = useState<QuoteRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const { messages, loading: messagesLoading, error: messagesError, sendMessage } = useMessages(id);
  const { customers } = useCustomers();

  // Helper function to get customer name from ID
  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer ? customer.name : customerId;
  };

  // Helper function to get customer ID from name (for migration)
  const getCustomerIdFromName = (customerName: string) => {
    // If it's already an ID (starts with a letter and contains only alphanumeric chars), return as is
    if (customerName && /^[a-zA-Z0-9]+$/.test(customerName) && customerName.length > 10) {
      return customerName;
    }
    // Otherwise, try to find the customer by name
    const customer = customers.find(c => c.name === customerName);
    return customer ? customer.id : customerName;
  };
  const [labels, setLabels] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch labels
  useEffect(() => {
    const fetchLabels = async () => {
      if (!db) return;
      try {
        const snap = await getDocs(collection(db, "labels"));
        const labelsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('[DEBUG] Labels loaded:', labelsData);
        setLabels(labelsData);
      } catch (err) {
        console.error('Error fetching labels:', err);
      }
    };
    fetchLabels();
  }, [db]);

  useEffect(() => {
    async function fetchQuoteRequest() {
      if (!user || !db) return;
      
      try {
        const quoteRef = doc(db as Firestore, 'quoteRequests', id);
        const quoteDoc = await getDoc(quoteRef);
        
        if (quoteDoc.exists()) {
          const data = quoteDoc.data();
          setQuoteRequest({
            id: quoteDoc.id,
            title: data.title || '',
            products: data.products || [],
            creatorCountry: data.creatorCountry || '',
            involvedCountry: data.involvedCountry || '',
            startDate: data.startDate || '',
            endDate: data.endDate || '',
            status: data.status || '',
            customer: getCustomerIdFromName(data.customer || ''),
            labels: data.labels || [],
            attachments: data.attachments || [],
            jobsite: data.jobsite || {},
            jobsiteContact: data.jobsiteContact || {},
            customerNumber: data.customerNumber || '',
            customerDecidesEndDate: data.customerDecidesEndDate || false,
            latitude: data.latitude || '',
            longitude: data.longitude || '',
            notes: data.notes || [],
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy,
            waitingForAnswer: data.waitingForAnswer || false,
            urgent: data.urgent || false,
            problems: data.problems || false,
            planned: data.planned || false
          } as QuoteRequest);
        } else {
          setError('Quote request not found');
        }
      } catch (err) {
        console.error('Error fetching quote request:', err);
        setError('Failed to load quote request');
      } finally {
        setLoading(false);
      }
    }

    fetchQuoteRequest();
  }, [id, user, db]);

  const saveChanges = useCallback(async (isAutoSave = false) => {
    if (!quoteRequest || isSaving || !db) {
      console.log('[SAVE] Skipping save - quoteRequest or isSaving check failed:', { 
        hasQuoteRequest: !!quoteRequest, 
        isSaving 
      });
      return;
    }

    // Skip auto-save on initial load to prevent false notifications
    if (isAutoSave && !quoteRequest.updatedAt) {
      console.log('[SAVE] Skipping auto-save on initial load');
      return;
    }

    console.log('[SAVE] Save triggered:', isAutoSave ? 'Auto-save' : 'Manual save');
    console.log('[SAVE] Current quote request:', quoteRequest);

    if (isAutoSave) {
      setIsAutoSaving(true);
    } else {
    setIsSaving(true);
    }
    
    setSaveSuccess(false);
    setError(null);
    
    let originalData: QuoteRequestWithDynamicKeys | null = null;
    
    try {
      const quoteRef = doc(db as Firestore, 'quoteRequests', id);
      
      // Get original data for comparison
      const docSnapshot = await getDoc(quoteRef);
      if (!docSnapshot.exists()) {
        throw new Error('Quote request no longer exists');
      }
      originalData = docSnapshot.data() as QuoteRequestWithDynamicKeys;
      
      console.log('[SAVE] Original data:', originalData);
      
      // Create update object with all fields
      const updateData = {
        ...quoteRequest,
        updatedAt: new Date(),
        updatedBy: user?.email || ''
      };

      // Ensure planned status is properly set
      if (originalData && quoteRequest.planned !== originalData.planned) {
        console.log('[SAVE] Updating planned status:', {
          old: originalData.planned,
          new: quoteRequest.planned
        });
      }

      // Log all changes before saving
      const changedFields = Object.keys(updateData).filter(key => 
        originalData && JSON.stringify(updateData[key as keyof QuoteRequestWithDynamicKeys]) !== JSON.stringify(originalData[key as keyof QuoteRequestWithDynamicKeys])
      );
      console.log('[SAVE] Changed fields:', changedFields);

      // Perform the update
      await updateDoc(quoteRef, updateData);

      console.log('[SAVE] Save successful!');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);

      // Create modification record for all changes except jobsiteContactId
      const modifications = [];
      const fieldsToTrack = [
        'title', 'status', 'involvedCountry', 'startDate', 'endDate', 
        'customer', 'waitingForAnswer', 'urgent', 'problems', 'planned',
        'products', 'notes', 'attachments', 'jobsite', 'customerNumber',
        'customerDecidesEndDate', 'latitude', 'longitude'
      ];

      for (const field of fieldsToTrack) {
        if (originalData && originalData[field] !== quoteRequest[field]) {
          modifications.push({
            field,
            from: originalData[field],
            to: quoteRequest[field]
          });
        }
      }

      // Create modification record if there are changes
      if (modifications.length > 0 && user?.email) {
        try {
          await addDoc(collection(db as Firestore, 'modifications'), {
            dateTime: serverTimestamp(),
            user: user.email,
            quoteRequestId: id,
            changes: modifications
          });
          console.log('[MODIFICATIONS] Created modification record with', modifications.length, 'changes');
        } catch (modError) {
          console.error('[MODIFICATIONS] Failed to create modification record:', modError);
        }
      }

      // Create notifications for changes
      const changes = [];
      
      // Check for status changes
      if (originalData && originalData.status !== quoteRequest.status) {
        changes.push(`Status changed to ${quoteRequest.status}`);
      }

      // Check for country changes
      if (originalData && originalData.involvedCountry !== quoteRequest.involvedCountry) {
        changes.push(`Involved country changed from ${originalData.involvedCountry} to ${quoteRequest.involvedCountry}`);
      }
      
      // Check for flag changes (labels) - only notify if there are actual changes
      const labelFields: (keyof Pick<QuoteRequest, 'waitingForAnswer' | 'urgent' | 'problems' | 'planned'>)[] = 
        ['waitingForAnswer', 'urgent', 'problems', 'planned'];
      
      for (const field of labelFields) {
        // Only create notifications for actual changes, not for initial loading
        if (originalData[field] !== quoteRequest[field] && 
            !(originalData[field] === false && quoteRequest[field] === false)) {
          changes.push(`${quoteRequest[field] ? 'Added' : 'Removed'} "${labelTexts[field]}" label`);
        }
      }
      
      // Check for product changes
      const originalProducts = originalData.products || [];
      const currentProducts = quoteRequest.products || [];
      
      if (originalProducts.length !== currentProducts.length) {
        if (currentProducts.length > originalProducts.length) {
          changes.push(`Added ${currentProducts.length - originalProducts.length} new product(s)`);
        } else {
          changes.push(`Removed ${originalProducts.length - currentProducts.length} product(s)`);
        }
      }
      
      // Check for product changes (catClass and quantity)
      const productChanges = [];
      for (let i = 0; i < Math.max(originalProducts.length, currentProducts.length); i++) {
        const original = originalProducts[i] || {};
        const current = currentProducts[i] || {};
        
        if (original.catClass !== current.catClass) {
          productChanges.push(`Cat-Class changed from '${original.catClass || 'empty'}' to '${current.catClass || 'empty'}'`);
        }
        if (original.quantity !== current.quantity) {
          productChanges.push(`Quantity changed from ${original.quantity || 0} to ${current.quantity || 0} for ${current.catClass || 'product'}`);
        }
      }
      
      if (productChanges.length > 0) {
        changes.push(`Product changes: ${productChanges.join(', ')}`);
      }
      
      // Check for date changes
      if (originalData.startDate !== quoteRequest.startDate) {
        changes.push(`Start date changed to ${quoteRequest.startDate || 'not set'}`);
      }
      if (originalData.endDate !== quoteRequest.endDate) {
        changes.push(`End date changed to ${quoteRequest.endDate || 'not set'}`);
      }
      
      // Check for notes changes
      const originalNotes = originalData.notes || [];
      const currentNotes = quoteRequest.notes || [];
      
      if (originalNotes.length !== currentNotes.length) {
        if (currentNotes.length > originalNotes.length) {
          const newNotes = currentNotes.slice(originalNotes.length);
          changes.push(`Added ${newNotes.length} new note(s)`);
        } else {
          changes.push(`Removed ${originalNotes.length - currentNotes.length} note(s)`);
        }
      }
      
      // Check for attachment changes
      const originalAttachments = originalData.attachments || [];
      const currentAttachments = quoteRequest.attachments || [];
      
      if (originalAttachments.length !== currentAttachments.length) {
        if (currentAttachments.length > originalAttachments.length) {
          changes.push(`Added ${currentAttachments.length - originalAttachments.length} new attachment(s)`);
        } else {
          changes.push(`Removed ${originalAttachments.length - currentAttachments.length} attachment(s)`);
        }
      }
      
      // Create notification if there are changes
      if (changes.length > 0 && userProfile?.businessUnit) {
        console.log('[NOTIFICATION DEBUG] Changes detected:', changes);
        console.log('[NOTIFICATION DEBUG] User profile:', {
          businessUnit: userProfile.businessUnit,
          email: user?.email,
          countries: userProfile.countries
        });
        console.log('[NOTIFICATION DEBUG] Quote request:', {
          id: quoteRequest.id,
          title: quoteRequest.title,
          creatorCountry: quoteRequest.creatorCountry,
          involvedCountry: quoteRequest.involvedCountry
        });
        
        // Fix target country logic: determine which country should receive the notification
        // If I'm the creator, notify the involved country. If I'm involved, notify the creator.
        const targetCountries = [];
        
        console.log('[NOTIFICATION DEBUG] Quote request countries:', {
          creatorCountry: quoteRequest.creatorCountry,
          involvedCountry: quoteRequest.involvedCountry,
          myCountry: userProfile.businessUnit
        });
        
        if (userProfile.businessUnit === quoteRequest.creatorCountry) {
          // I'm the creator, notify the involved country
          if (quoteRequest.involvedCountry && quoteRequest.involvedCountry !== userProfile.businessUnit) {
            targetCountries.push(quoteRequest.involvedCountry);
            console.log('[NOTIFICATION DEBUG] I am the creator, notifying involved country:', quoteRequest.involvedCountry);
          }
        } else if (userProfile.businessUnit === quoteRequest.involvedCountry) {
          // I'm the involved country, notify the creator
          if (quoteRequest.creatorCountry && quoteRequest.creatorCountry !== userProfile.businessUnit) {
            targetCountries.push(quoteRequest.creatorCountry);
            console.log('[NOTIFICATION DEBUG] I am involved, notifying creator:', quoteRequest.creatorCountry);
          }
        } else {
          console.log('[NOTIFICATION DEBUG] I am neither creator nor involved country - no notifications sent');
        }
        
        console.log('[NOTIFICATION DEBUG] Final target countries:', targetCountries);
        
        // Send notifications to all target countries
        for (const targetCountry of targetCountries) {
          if (targetCountry) {
            console.log('[NOTIFICATION DEBUG] Creating notification for:', {
              targetCountry,
              senderCountry: userProfile.businessUnit,
              content: changes.join(', ')
            });
            
            try {
              await createNotification({
                quoteRequestId: id,
                quoteRequestTitle: quoteRequest.title,
                sender: user?.email || '',
                senderCountry: userProfile.businessUnit,
                targetCountry: targetCountry,
                content: changes.join(', '),
                notificationType: 'property_change'
              });
              console.log('[NOTIFICATION DEBUG] Notification created successfully for:', targetCountry);
            } catch (notificationError) {
              console.error('[NOTIFICATION DEBUG] Failed to create notification for:', targetCountry, notificationError);
            }
          }
        }
        
        if (targetCountries.length === 0) {
          console.log('[NOTIFICATION DEBUG] No target countries found - no notifications sent');
        }
      } else {
        console.log('[NOTIFICATION DEBUG] No changes detected or missing user profile:', {
          changesLength: changes.length,
          hasUserProfile: !!userProfile?.businessUnit
        });
      }

    } catch (err) {
      console.error('[SAVE] Error saving quote request:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
      
      // Revert local state on error
      if (originalData) {
        setQuoteRequest(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            ...originalData
          } as QuoteRequestWithDynamicKeys;
        });
      }
    } finally {
      if (isAutoSave) {
        setIsAutoSaving(false);
      } else {
      setIsSaving(false);
    }
    }
  }, [quoteRequest, isSaving, db, id, user?.email]);

  // Create a ref to store the previous state for comparison
  const previousQuoteRequest = useRef<string | null>(null);
  
  // Create debounced save function with proper delay
  const debouncedSave = useMemo(
    () => debounce(
      () => saveChanges(true), 
      1000  // 1 second delay for normal fields
    ),
    [saveChanges]
  );

  // Auto-save effect
  useEffect(() => {
    if (!quoteRequest || !isMounted || loading || isReadOnly) return;

    // Initialize previous state
    if (previousQuoteRequest.current === null) {
      const initialState = JSON.stringify({
        title: quoteRequest.title || '',
        products: quoteRequest.products || [],
        creatorCountry: quoteRequest.creatorCountry || '',
        involvedCountry: quoteRequest.involvedCountry || '',
        startDate: quoteRequest.startDate || '',
        endDate: quoteRequest.endDate || '',
        status: quoteRequest.status || '',
        customer: quoteRequest.customer || '',
        waitingForAnswer: quoteRequest.waitingForAnswer || false,
        urgent: quoteRequest.urgent || false,
        problems: quoteRequest.problems || false,
        planned: quoteRequest.planned || false,
        jobsite: quoteRequest.jobsite || {},
        jobsiteContact: quoteRequest.jobsiteContact || {},
        customerNumber: quoteRequest.customerNumber || '',
        customerDecidesEndDate: quoteRequest.customerDecidesEndDate || false,
        latitude: quoteRequest.latitude || '',
        longitude: quoteRequest.longitude || '',
        notes: quoteRequest.notes || [],
        attachments: quoteRequest.attachments || []
      });
      previousQuoteRequest.current = initialState;
      return;
    }

    // Create current state string
    const currentState = JSON.stringify({
      title: quoteRequest.title || '',
      products: quoteRequest.products || [],
      creatorCountry: quoteRequest.creatorCountry || '',
      involvedCountry: quoteRequest.involvedCountry || '',
      startDate: quoteRequest.startDate || '',
      endDate: quoteRequest.endDate || '',
      status: quoteRequest.status || '',
      customer: quoteRequest.customer || '',
      waitingForAnswer: quoteRequest.waitingForAnswer || false,
      urgent: quoteRequest.urgent || false,
      problems: quoteRequest.problems || false,
      planned: quoteRequest.planned || false,
      jobsite: quoteRequest.jobsite || {},
      jobsiteContact: quoteRequest.jobsiteContact || {},
      customerNumber: quoteRequest.customerNumber || '',
      customerDecidesEndDate: quoteRequest.customerDecidesEndDate || false,
      latitude: quoteRequest.latitude || '',
      longitude: quoteRequest.longitude || '',
      notes: quoteRequest.notes || [],
      attachments: quoteRequest.attachments || []
    });

    // Only save if data changed
    if (previousQuoteRequest.current !== currentState) {
      console.log('Auto-save triggered - data changed');
      previousQuoteRequest.current = currentState;
      debouncedSave();
    }
  }, [quoteRequest, isMounted, loading, isReadOnly, debouncedSave]);

  // Cleanup debounced function
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  const handleInputChange = (field: keyof QuoteRequestWithDynamicKeys, value: any) => {
    if (!quoteRequest) return;

    // Handle nested fields (e.g., products.0.catClass)
    if (field.includes('.')) {
      const [parent, index, child] = field.split('.');
      setQuoteRequest(prev => {
        if (!prev) return prev;
        
        // Safely get the parent array
        const parentArray = prev[parent as keyof QuoteRequest];
        if (!Array.isArray(parentArray)) {
          console.error('Parent is not an array:', parent, parentArray);
          return prev;
        }
        
        // Create a new array with the updated value
        const newArray = [...parentArray];
        const idx = parseInt(index);
        
        // Ensure the index exists
        if (idx < 0 || idx >= newArray.length) {
          console.error('Invalid index:', idx, 'for array length:', newArray.length);
          return prev;
        }
        
        // Update the specific field
        if (typeof newArray[idx] === 'object' && newArray[idx] !== null) {
          newArray[idx] = {
            ...newArray[idx],
            [child]: value
          };
        } else {
          console.error('Array item is not an object:', newArray[idx]);
          return prev;
        }
        
        return {
          ...prev,
          [parent]: newArray
        } as QuoteRequestWithDynamicKeys;
      });
    } else {
      setQuoteRequest(prev => {
        if (!prev) return prev;
        const updatedRequest = {
        ...prev,
        [field]: value
        } as QuoteRequestWithDynamicKeys;
        
        // If we're updating the involved country, trigger a save
        if (field === 'involvedCountry') {
          saveChanges(true);
        }
        
        return updatedRequest;
      });
    }
  };

  const handleAddProduct = () => {
    setQuoteRequest(prev => prev ? {
      ...prev,
      products: [
        ...prev.products,
        { catClass: '', description: '', quantity: 1 }
      ]
    } : null);
  };

  const handleRemoveProduct = (index: number) => {
    setQuoteRequest(prev => prev ? {
      ...prev,
      products: prev.products.filter((_, i) => i !== index)
    } : null);
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !user?.email) return;
    
    setQuoteRequest(prev => {
      if (!prev) return prev;
      const newNotes = [...(prev.notes || []), {
        text: newNote.trim(),
        user: user.email!,
        dateTime: new Date()
      }];
      return {
        ...prev,
        notes: newNotes
      };
    });
    setNewNote('');
  };

  const handleSendMessage = async (text: string, files: any[] = []) => {
    if (!user?.email || !userProfile?.businessUnit || !quoteRequest) {
      throw new Error('Missing required data');
    }

    // Fix target country logic: determine which country should receive the message
    // If I'm the creator, notify the involved country. If I'm involved, notify the creator.
    const targetCountries = [];
    
    if (userProfile.businessUnit === quoteRequest.creatorCountry) {
      // I'm the creator, notify the involved country
      if (quoteRequest.involvedCountry && quoteRequest.involvedCountry !== userProfile.businessUnit) {
        targetCountries.push(quoteRequest.involvedCountry);
      }
    } else if (userProfile.businessUnit === quoteRequest.involvedCountry) {
      // I'm the involved country, notify the creator
      if (quoteRequest.creatorCountry && quoteRequest.creatorCountry !== userProfile.businessUnit) {
        targetCountries.push(quoteRequest.creatorCountry);
      }
    }

    // Send message to each target country
    for (const targetCountry of targetCountries) {
      await sendMessage(text, user.email, userProfile.businessUnit, targetCountry, files);
    }
  };

  // Function to handle label changes
  const handleLabelChange = async (key: keyof Pick<QuoteRequest, 'waitingForAnswer' | 'urgent' | 'problems' | 'planned'>) => {
    if (!quoteRequest || !db || isReadOnly || !userProfile?.businessUnit) return;

    let originalData: QuoteRequestWithDynamicKeys | null = null;

    try {
      const newValue = !quoteRequest[key];
      console.log(`[DEBUG] Changing ${key} to ${newValue}`);

      // Get the label ID for this key
      const labelId = labels.find(label => label.name.toLowerCase() === labelTexts[key].toLowerCase())?.id;
      
      console.log('[DEBUG] Label lookup:', {
        key,
        labelTexts: labelTexts[key],
        labels,
        foundLabelId: labelId
      });

      if (!labelId) {
        console.error(`[DEBUG] No label ID found for ${key}`);
        setError(`Failed to update ${labelTexts[key]} label - Label not found`);
        return;
      }

      // Update local state immediately for responsive UI
      const updatedQuoteRequest: QuoteRequestWithDynamicKeys = {
        ...quoteRequest,
        [key]: newValue,
        labels: newValue 
          ? [...new Set([...(quoteRequest.labels || []), labelId])]  // Use Set to ensure uniqueness
          : (quoteRequest.labels || []).filter(id => id !== labelId),
        updatedAt: new Date(),
        updatedBy: user?.email || ''
      };

      console.log('[DEBUG] Updated quote request:', {
        key,
        newValue,
        oldLabels: quoteRequest.labels,
        newLabels: updatedQuoteRequest.labels,
        oldFlags: {
          waitingForAnswer: quoteRequest.waitingForAnswer,
          urgent: quoteRequest.urgent,
          problems: quoteRequest.problems,
          planned: quoteRequest.planned
        },
        newFlags: {
          waitingForAnswer: updatedQuoteRequest.waitingForAnswer,
          urgent: updatedQuoteRequest.urgent,
          problems: updatedQuoteRequest.problems,
          planned: updatedQuoteRequest.planned
        }
      });

      setQuoteRequest(updatedQuoteRequest);

      // Update Firestore
      const quoteRef = doc(db as Firestore, 'quoteRequests', id);
      
      // Get original data for error handling
      const quoteDoc = await getDoc(quoteRef);
      if (quoteDoc.exists()) {
        originalData = quoteDoc.data() as QuoteRequestWithDynamicKeys;
      }

      // Important: Update both the boolean flag and the labels array
      const updateData: Record<string, any> = {
        [key]: newValue,
        labels: updatedQuoteRequest.labels,
        updatedAt: new Date(),
        updatedBy: user?.email || ''
      };
      
      console.log('[DEBUG] Updating Firestore with:', updateData);
      await updateDoc(quoteRef, updateData);

      // Create notification for the label change
      const labelText = labelTexts[key];
      const targetCountry = userProfile.businessUnit === quoteRequest.creatorCountry
        ? quoteRequest.involvedCountry
        : quoteRequest.creatorCountry;

      if (targetCountry && targetCountry !== userProfile.businessUnit) {
        await createNotification({
          quoteRequestId: id,
          quoteRequestTitle: quoteRequest.title,
          sender: user?.email || '',
          senderCountry: userProfile.businessUnit,
          targetCountry,
          content: `${newValue ? 'Added' : 'Removed'} "${labelText}" label`,
          notificationType: 'property_change'
        });
      }

      console.log(`[DEBUG] Label ${key} updated successfully to ${newValue}`);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('[DEBUG] Error updating label:', err);
      // Revert local state on error
      if (originalData) {
        setQuoteRequest(prevState => {
          if (!prevState) return prevState;
          const revertedState: QuoteRequestWithDynamicKeys = {
            ...prevState,
            [key]: originalData[key],
            labels: originalData.labels || []
          };
          return revertedState;
        });
      }
      setError(`Failed to update ${labelTexts[key]} label`);
    }
  };

  // Get the user's business unit for notifications
  const userCountry = userProfile?.businessUnit || (userProfile?.countries && userProfile.countries[0]) || '';

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error</h3>
          <p className="text-red-600 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!quoteRequest || !isMounted) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Fixed width */}
      <div className="w-80 min-w-[320px] bg-white border-r border-gray-200 p-6 overflow-y-auto">
        {/* Status Dropdown */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <select
            value={quoteRequest.status}
            onChange={(e) => handleInputChange("status", e.target.value)}
            className="w-full p-2 border border-gray-200 rounded-lg"
            disabled={isReadOnly}
          >
            {statuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        {/* Labels */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Labels</h3>
          <div className="space-y-2">
            {Object.entries(labelTexts).map(([key, label]) => (
            <button
                key={key}
                onClick={() => handleLabelChange(key as keyof Pick<QuoteRequest, 'waitingForAnswer' | 'urgent' | 'problems' | 'planned'>)}
                className={`w-full p-2 rounded-lg text-left transition-colors ${
                  quoteRequest[key as keyof QuoteRequest]
                    ? key === 'waitingForAnswer'
                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      : key === 'urgent'
                      ? 'bg-red-100 text-red-800 hover:bg-red-200'
                      : key === 'problems'
                      ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                      : key === 'planned'
                      ? 'bg-red-100 text-red-800 hover:bg-red-200'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              disabled={isReadOnly}
            >
                {label}
            </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Activity</h3>
          <QuoteRequestNotifications 
            quoteRequestId={id} 
            userCountry={userCountry}
          />
        </div>
      </div>

      {/* Main Content - Flexible width */}
      <div className="flex-1 flex overflow-hidden">
        {/* Form Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-semibold text-gray-900">
                  Quote Request / {quoteRequest.creatorCountry} → {quoteRequest.involvedCountry}
                </h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  quoteRequest.status === "New" ? "bg-purple-100 text-purple-800" :
                  quoteRequest.status === "In Progress" ? "bg-green-100 text-green-800" :
                  quoteRequest.status === "Snoozed" ? "bg-gray-100 text-gray-800" :
                  quoteRequest.status === "Won" ? "bg-blue-100 text-blue-800" :
                  quoteRequest.status === "Lost" ? "bg-red-100 text-red-800" :
                  "bg-yellow-100 text-yellow-800"
                }`}>
                  {quoteRequest.status}
                </span>
                </div>
              <div className="flex items-center space-x-4">
                <span className={`text-sm ${isAutoSaving ? 'text-blue-600' : isSaving ? 'text-yellow-600' : saveSuccess ? 'text-green-600' : 'text-gray-500'}`}>
                  {isAutoSaving ? 'Auto-saving...' : isSaving ? 'Saving...' : saveSuccess ? 'Successfully saved!' : 'Auto-save ON'}
                </span>
                <button 
                  onClick={() => saveChanges(false)}
                  disabled={isSaving || isAutoSaving || isReadOnly}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </div>

            {/* Form Grid - 2 columns */}
            <div className="grid grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={quoteRequest.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                    disabled={isReadOnly}
                  />
                </div>

                {/* Creator and Target Country */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Creator Country</label>
                    <CountrySelect
                      value={quoteRequest.creatorCountry}
                      onChange={(value) => handleInputChange("creatorCountry", value)}
                      disabled={isReadOnly}
                      required={true}
                      allowEmpty={false}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Involved Country</label>
                    <CountrySelect
                      value={quoteRequest.involvedCountry}
                      onChange={(value) => handleInputChange("involvedCountry", value)}
                      disabled={isReadOnly}
                      required={true}
                      allowEmpty={false}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                {/* Customer */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                  <select
                    value={quoteRequest.customer}
                    onChange={(e) => handleInputChange("customer", e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md"
                    disabled={isReadOnly}
                  >
                    <option value="">Select Customer</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                  {quoteRequest.customer && (
                    <div className="mt-1 text-sm text-gray-600">
                      Selected: {getCustomerName(quoteRequest.customer)}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={quoteRequest.status}
                    onChange={(e) => handleInputChange("status", e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md"
                    disabled={isReadOnly}
                  >
                    {statuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                {/* Products */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Products</label>
                  <div className="space-y-2">
                    {quoteRequest.products.map((product, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2">
                        <input
                          type="text"
                          value={product.catClass}
                          onChange={(e) => handleInputChange(`products.${index}.catClass`, e.target.value)}
                          placeholder="Product Code"
                          className="col-span-3 p-2 border border-gray-300 rounded"
                          disabled={isReadOnly}
                        />
                        <input
                          type="text"
                          value={product.description}
                          onChange={(e) => handleInputChange(`products.${index}.description`, e.target.value)}
                          placeholder="Description"
                          className="col-span-7 p-2 border border-gray-300 rounded"
                          disabled={isReadOnly}
                        />
                        <input
                          type="number"
                          value={product.quantity}
                          onChange={(e) => handleInputChange(`products.${index}.quantity`, parseInt(e.target.value))}
                          className="col-span-2 p-2 border border-gray-300 rounded"
                          disabled={isReadOnly}
                        />
                      </div>
                    ))}
                    {!isReadOnly && (
                      <button
                        onClick={handleAddProduct}
                        className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                      >
                        + Add Product
                      </button>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      className="flex-1 p-2 border border-gray-300 rounded"
                      disabled={isReadOnly}
                    />
                    <button
                      onClick={handleAddNote}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      disabled={isReadOnly || !newNote.trim()}
                    >
                      Add
                    </button>
                  </div>
                  {quoteRequest.notes && quoteRequest.notes.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {quoteRequest.notes.map((note, index) => (
                        <div key={index} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          {note.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Attachments */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                  <FileUpload
                    quoteRequestId={quoteRequest.id}
                    files={quoteRequest.attachments || []}
                    onFilesChange={(newFiles) => handleInputChange("attachments", newFiles)}
                    currentUser={user?.email || ""}
                    readOnly={isReadOnly}
                  />
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={quoteRequest.startDate}
                      onChange={(e) => handleInputChange("startDate", e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={quoteRequest.endDate}
                      onChange={(e) => handleInputChange("endDate", e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md"
                      disabled={isReadOnly || quoteRequest.customerDecidesEndDate}
                    />
                  </div>
                </div>

                {/* Customer decides end date checkbox */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={quoteRequest.customerDecidesEndDate || false}
                      onChange={(e) => handleInputChange("customerDecidesEndDate", e.target.checked)}
                      className="mr-2"
                      disabled={isReadOnly}
                    />
                    <span className="text-sm text-gray-700">Customer decides end date</span>
                  </label>
                </div>

                {/* Jobsite Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jobsite Address</label>
                  <input
                    type="text"
                    value={quoteRequest.jobsite?.address || ''}
                    onChange={(e) => handleInputChange("jobsite.address", e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md"
                    disabled={isReadOnly}
                  />
                </div>

                {/* Coordinates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      min="-90"
                      max="90"
                      value={quoteRequest.latitude || ''}
                      onChange={(e) => handleInputChange("latitude", e.target.value)}
                      placeholder="e.g., 51.9244"
                      className="w-full p-3 border border-gray-300 rounded-md"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      min="-180"
                      max="180"
                      value={quoteRequest.longitude || ''}
                      onChange={(e) => handleInputChange("longitude", e.target.value)}
                      placeholder="e.g., 4.4777"
                      className="w-full p-3 border border-gray-300 rounded-md"
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                {/* Jobsite Contact */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jobsite Contact</label>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={quoteRequest.jobsiteContact?.name || ''}
                      onChange={(e) => handleInputChange("jobsiteContact.name", e.target.value)}
                      placeholder="Contact Name"
                      className="p-3 border border-gray-300 rounded-md"
                      disabled={isReadOnly}
                    />
                    <input
                      type="text"
                      value={quoteRequest.jobsiteContact?.phone || ''}
                      onChange={(e) => handleInputChange("jobsiteContact.phone", e.target.value)}
                      placeholder="Phone Number"
                      className="p-3 border border-gray-300 rounded-md"
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                {/* Customer Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Number for {quoteRequest.involvedCountry}</label>
                  <input
                    type="text"
                    value={quoteRequest.customerNumber || ''}
                    onChange={(e) => handleInputChange("customerNumber", e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md"
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Fixed width */}
        <div className="w-96 min-w-[384px] border-l border-gray-200 bg-white">
            <MessagingPanel
            messages={messages || []}
              currentUser={user?.email || ''}
            currentCountry={userCountry}
              onSendMessage={handleSendMessage}
              quoteTitle={quoteRequest.title}
            loading={messagesLoading}
            error={messagesError}
              readOnly={isReadOnly}
            />
        </div>
      </div>
    </div>
  );
}