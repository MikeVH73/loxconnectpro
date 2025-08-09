'use client';

import { useEffect, useState, Suspense, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, serverTimestamp, addDoc, Firestore, deleteField } from 'firebase/firestore';
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
import { createNotification, createRecentActivity } from "../../../utils/notifications";
import dynamic from 'next/dynamic';
import { getProductByCode, normalizeCode } from '../../../utils/products';
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
  customerDecidesEnd?: boolean;
  latitude?: string;
  longitude?: string;
  updatedAt?: Date;
  updatedBy?: string;
  waitingForAnswer: boolean;
  urgent: boolean;
  problems: boolean;
  planned: boolean;
  assignedUserId?: string;
  assignedUserName?: string;
  totalValueEUR?: number;
  totalValueLocal?: number;
  totalValueCurrency?: string; // ISO like EUR, DKK
  totalValueRateToEUR?: number; // multiplier from local to EUR
  rateSource?: string;
  rateDate?: string; // YYYY-MM-DD
  usedLocalCurrency?: boolean;
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

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  type: 'first' | 'jobsite';
}

interface Customer {
  id: string;
  name: string;
  address: string;
  contact?: string;
  phone?: string;
  email?: string;
  customerNumbers?: { [country: string]: string };
}

export default function EditQuoteRequest() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { user, userProfile } = useAuth();
  const isReadOnly = userProfile?.role === "Employee";
  const [quoteRequest, setQuoteRequest] = useState<QuoteRequestWithDynamicKeys>({} as QuoteRequestWithDynamicKeys);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [labels, setLabels] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [jobsiteContactId, setJobsiteContactId] = useState("");
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [customerDetails, setCustomerDetails] = useState<Customer | null>(null);
  // Team assignment state
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; displayName: string; email?: string }>>([]);
  const [assignedUserId, setAssignedUserId] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);
  const [newNote, setNewNote] = useState("");
  const { messages, loading: messagesLoading, error: messagesError, sendMessage } = useMessages(id);
  const { customers: fetchedCustomers } = useCustomers();
  const [originalData, setOriginalData] = useState<QuoteRequestWithDynamicKeys | null>(null);
  const [showTotalValueModal, setShowTotalValueModal] = useState(false);
  const [rateDirection, setRateDirection] = useState<'LOCAL_TO_EUR' | 'EUR_TO_LOCAL'>('LOCAL_TO_EUR');
  const [calculatorDirty, setCalculatorDirty] = useState(false);
  // Quick Add product modal state
  const [quickAdd, setQuickAdd] = useState<{ index: number; code: string } | null>(null);
  const [quickAddDesc, setQuickAddDesc] = useState<string>("");

  // Helper function to get customer name from ID
  const getCustomerName = (customerId: string) => {
    const customer = fetchedCustomers.find(c => c.id === customerId);
    return customer ? customer.name : customerId;
  };

  // Helper function to get customer ID from name (for migration)
  const getCustomerIdFromName = (customerName: string) => {
    // If it's already an ID (starts with a letter and contains only alphanumeric chars), return as is
    if (customerName && /^[a-zA-Z0-9]+$/.test(customerName) && customerName.length > 10) {
      return customerName;
    }
    // Otherwise, try to find the customer by name
    const customer = fetchedCustomers.find(c => c.name === customerName);
    return customer ? customer.id : customerName;
  };

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
            customerDecidesEnd: data.customerDecidesEnd || false,
            latitude: data.latitude || '',
            longitude: data.longitude || '',
            notes: data.notes || [],
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy,
            waitingForAnswer: data.waitingForAnswer || false,
            urgent: data.urgent || false,
            problems: data.problems || false,
            planned: data.planned || false,
            assignedUserId: data.assignedUserId || '',
            assignedUserName: data.assignedUserName || '',
            totalValueEUR: typeof data.totalValueEUR === 'number' ? data.totalValueEUR : undefined,
            totalValueLocal: typeof data.totalValueLocal === 'number' ? data.totalValueLocal : undefined,
            totalValueCurrency: data.totalValueCurrency || undefined,
            totalValueRateToEUR: typeof data.totalValueRateToEUR === 'number' ? data.totalValueRateToEUR : undefined,
            rateSource: data.rateSource || undefined,
            rateDate: data.rateDate || undefined,
            usedLocalCurrency: data.usedLocalCurrency || false
          } as QuoteRequestWithDynamicKeys);
          setOriginalData(data as QuoteRequestWithDynamicKeys); // Store original data for comparison
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
    if (!quoteRequest || saving || !db) {
      console.log('[SAVE] Skipping save - quoteRequest or saving check failed:', { 
        hasQuoteRequest: !!quoteRequest, 
        isSaving: saving, 
        hasDb: !!db 
      });
      return;
    }

    if (isAutoSave) {
      setSaving(true);
    } else {
      setSaving(true);
    }
    
    setError("");
    
    try {
      const quoteRequestRef = doc(db as Firestore, "quoteRequests", id);
      const canAssign = (userProfile?.role === 'superAdmin' || userProfile?.role === 'admin' || userProfile?.businessUnit === quoteRequest.involvedCountry || (userProfile?.countries || []).includes(quoteRequest.involvedCountry));
      const updateData: any = {
        ...quoteRequest,
        // If user cannot assign, strip any local assignment changes from update
        ...(canAssign ? {} : { assignedUserId: originalData?.assignedUserId, assignedUserName: originalData?.assignedUserName }),
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || ""
      };

      // Remove undefined values so Firestore doesn't reject
      const stripUndefined = (val: any): any => {
        if (val === undefined) return undefined;
        if (Array.isArray(val)) {
          const arr = val.map(stripUndefined).filter((v) => v !== undefined);
          return arr;
        }
        if (val && typeof val === 'object' && !(val instanceof Date)) {
          const out: any = {};
          Object.keys(val).forEach((k) => {
            const v = stripUndefined((val as any)[k]);
            if (v !== undefined) out[k] = v;
          });
          return out;
        }
        return val;
      };
      const sanitizedUpdateData = stripUndefined(updateData);
      // Convert nulls for calculator fields into deleteField() so previous values are removed
      const nullableFields = ['totalValueLocal','totalValueRateToEUR','rateSource','rateDate','totalValueEUR'];
      nullableFields.forEach((key) => {
        if ((quoteRequest as any)[key] === null) {
          (sanitizedUpdateData as any)[key] = deleteField();
        }
      });

      await updateDoc(quoteRequestRef, sanitizedUpdateData);
      console.log('[SAVE] Save successful!');
      if (!isAutoSave) {
        setCalculatorDirty(false);
      }

      // Create modification record for all changes except jobsiteContactId
      if (originalData) {
      const changes = [];
      
      // Check for status changes
        if (originalData.status !== quoteRequest.status) {
        changes.push(`Status changed to ${quoteRequest.status}`);
      }
      // Check for total value changes
      if (originalData.totalValueEUR !== quoteRequest.totalValueEUR) {
        changes.push(`Total value (EUR) set to ${quoteRequest.totalValueEUR ?? 'Not set'}`);
      }
      if (originalData.totalValueCurrency !== quoteRequest.totalValueCurrency) {
        changes.push(`Total value currency set to ${quoteRequest.totalValueCurrency || 'Not set'}`);
      }

        // Check for title changes
        if (originalData.title !== quoteRequest.title) {
          changes.push(`Title changed from "${originalData.title}" to "${quoteRequest.title}"`);
      }

      // Check for country changes
        if (originalData.involvedCountry !== quoteRequest.involvedCountry) {
        changes.push(`Involved country changed from ${originalData.involvedCountry} to ${quoteRequest.involvedCountry}`);
      }
      
        // Check for flag changes (labels) - only notify if they were actually changed
        const labelFields = ['waitingForAnswer', 'urgent', 'problems', 'planned'] as const;
        labelFields.forEach(field => {
          if (originalData && (originalData as any)[field] !== (quoteRequest as any)[field]) {
            const labelName = field === 'waitingForAnswer' ? 'Waiting for Answer' : 
                            field === 'urgent' ? 'Urgent' : 
                            field === 'problems' ? 'Problems' : 'Planned';
            changes.push(`${labelName} label ${(quoteRequest as any)[field] ? 'added' : 'removed'}`);
          }
        });
      
      // Check for product changes
        if (JSON.stringify(originalData.products) !== JSON.stringify(quoteRequest.products)) {
          changes.push('Products updated');
      }
      
      // Check for date changes
      if (originalData.startDate !== quoteRequest.startDate) {
          changes.push(`Start date changed from ${originalData.startDate} to ${quoteRequest.startDate}`);
      }
      if (originalData.endDate !== quoteRequest.endDate) {
          const oldEndDate = originalData.endDate || 'Not set';
          const newEndDate = quoteRequest.endDate || 'Not set';
          changes.push(`End date changed from ${oldEndDate} to ${newEndDate}`);
        }

        // Check for jobsite address changes
        if (originalData.jobsite?.address !== quoteRequest.jobsite?.address) {
          changes.push(`Jobsite address changed from "${originalData.jobsite?.address || 'Not set'}" to "${quoteRequest.jobsite?.address || 'Not set'}"`);
        }

        // Check for jobsite contact changes
        if (originalData.jobsiteContact?.name !== quoteRequest.jobsiteContact?.name || 
            originalData.jobsiteContact?.phone !== quoteRequest.jobsiteContact?.phone) {
          changes.push(`Jobsite contact changed from "${originalData.jobsiteContact?.name || 'Not set'}" to "${quoteRequest.jobsiteContact?.name || 'Not set'}"`);
        }

        // Check for handler assignment changes
        if (canAssign && (originalData.assignedUserId || '') !== (quoteRequest as any).assignedUserId) {
          const newAssignee = (quoteRequest as any).assignedUserName || 'Unassigned';
          changes.push(`Handler changed to ${newAssignee}`);
        }

        // Check for notes changes
        if (JSON.stringify(originalData.notes) !== JSON.stringify(quoteRequest.notes)) {
          changes.push('Notes updated');
        }

        // Check for attachments changes
        if (JSON.stringify(originalData.attachments) !== JSON.stringify(quoteRequest.attachments)) {
          changes.push('Attachments updated');
        }

        // Create notifications for changes
        if (changes.length > 0) {
          const targetCountry = userProfile?.businessUnit === quoteRequest.creatorCountry 
            ? quoteRequest.involvedCountry 
            : quoteRequest.creatorCountry;

              await createNotification({
                quoteRequestId: id,
                quoteRequestTitle: quoteRequest.title,
                sender: user?.email || '',
            senderCountry: userProfile?.businessUnit || '',
            targetCountry,
                content: changes.join(', '),
                notificationType: 'property_change'
              });

          // Create recent activity entry
          await createRecentActivity({
            quoteRequestId: id,
            quoteRequestTitle: quoteRequest.title,
            sender: user?.email || '',
            senderCountry: userProfile?.businessUnit || '',
            targetCountry,
            content: changes.join(', '),
            activityType: 'property_change'
          });
        }
      }
    } catch (err) {
      console.error('[SAVE] Error saving quote request:', err);
      setError(err instanceof Error ? err.message : "Failed to save quote request");
    } finally {
      if (isAutoSave) {
        setSaving(false);
      } else {
        setSaving(false);
    }
    }
  }, [quoteRequest, saving, db, id, user?.email, userProfile?.businessUnit]);

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
        customerDecidesEnd: quoteRequest.customerDecidesEnd || false,
        latitude: quoteRequest.latitude || '',
        longitude: quoteRequest.longitude || '',
        notes: quoteRequest.notes || [],
        attachments: quoteRequest.attachments || [],
        assignedUserId: quoteRequest.assignedUserId || '',
        assignedUserName: quoteRequest.assignedUserName || '',
        totalValueEUR: quoteRequest.totalValueEUR ?? null,
        totalValueLocal: quoteRequest.totalValueLocal ?? null,
        totalValueCurrency: quoteRequest.totalValueCurrency || '',
        totalValueRateToEUR: quoteRequest.totalValueRateToEUR ?? null
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
      customerDecidesEnd: quoteRequest.customerDecidesEnd || false,
      latitude: quoteRequest.latitude || '',
      longitude: quoteRequest.longitude || '',
      notes: quoteRequest.notes || [],
      attachments: quoteRequest.attachments || [],
      assignedUserId: quoteRequest.assignedUserId || '',
      assignedUserName: quoteRequest.assignedUserName || '',
      totalValueEUR: quoteRequest.totalValueEUR ?? null,
      totalValueLocal: quoteRequest.totalValueLocal ?? null,
      totalValueCurrency: quoteRequest.totalValueCurrency || '',
      totalValueRateToEUR: quoteRequest.totalValueRateToEUR ?? null
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

  const handleInputChange = (field: string, value: any) => {
    // Prevent final statuses without EUR total
    const finalStatuses = ["Won", "Lost", "Cancelled"];
    if (field === 'status' && finalStatuses.includes(value)) {
      const hasEUR = !!(quoteRequest.totalValueEUR && quoteRequest.totalValueEUR > 0);
      if (!hasEUR) {
        setShowTotalValueModal(true);
        return; // do not update status
      }
    }

    setQuoteRequest(prev => ({
        ...prev,
        [field]: value
    }));

    // Mark calculator changes as dirty to prompt manual save
    if ([
      'totalValueEUR',
      'totalValueLocal',
      'totalValueCurrency',
      'totalValueRateToEUR',
      'rateSource',
      'rateDate',
      'usedLocalCurrency'
    ].includes(field)) {
      setCalculatorDirty(true);
    }

    // Smart direction switching
    if (field === 'totalValueLocal' && value !== undefined && value !== null) {
      setRateDirection('LOCAL_TO_EUR');
    }
    if (field === 'totalValueEUR' && (quoteRequest.totalValueCurrency || 'EUR') !== 'EUR') {
      setRateDirection('EUR_TO_LOCAL');
    }
    if (field === 'totalValueCurrency') {
      const newCur = value as string;
      if (newCur && newCur !== 'EUR') {
        const hasLocal = !!quoteRequest.totalValueLocal;
        const hasEur = !!quoteRequest.totalValueEUR;
        if (hasEur && !hasLocal) setRateDirection('EUR_TO_LOCAL');
        if (hasLocal && !hasEur) setRateDirection('LOCAL_TO_EUR');
      }
    }
  };

  const handleAddProduct = () => {
    setQuoteRequest(prev => ({
      ...prev,
      products: [...(prev.products || []), { catClass: "", description: "", quantity: 1 }]
    }));
  };

  const handleRemoveProduct = (index: number) => {
    setQuoteRequest(prev => ({
      ...prev,
      products: (prev.products || []).filter((_, i) => i !== index)
    }));
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    
    const note = {
      text: newNote,
      user: user?.email || "",
        dateTime: new Date()
    };
    
    setQuoteRequest(prev => ({
        ...prev,
      notes: [...(prev.notes || []), note]
    }));
    
    setNewNote("");
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
      // setSaveSuccess(true); // This state was removed, so this line is removed
      // setTimeout(() => setSaveSuccess(false), 2000); // This state was removed, so this line is removed
    } catch (err) {
      console.error('[DEBUG] Error updating label:', err);
      // Revert local state on error
      if (originalData) {
        setQuoteRequest(prevState => {
          if (!prevState) return prevState;
          const revertedState: QuoteRequestWithDynamicKeys = {
            ...prevState,
            [key]: originalData ? (originalData as any)[key] : prevState[key],
            labels: originalData?.labels || prevState.labels || []
          };
          return revertedState;
        });
      }
      setError(`Failed to update ${labelTexts[key]} label`);
    }
  };

  // Fetch customer contacts when customer changes
  const fetchCustomerContacts = useCallback(async (customerId: string) => {
    if (!customerId || !db) return;

    try {
      const customerDoc = await getDoc(doc(db as Firestore, "customers", customerId));
      if (customerDoc.exists()) {
        const customerData = customerDoc.data() as Customer;
        setCustomerDetails(customerData);
        
        let allContacts: Contact[] = [];
        
        // Add first contact if it exists
        if (customerData.contact && customerData.phone) {
          allContacts.push({
            id: 'main',
            name: customerData.contact,
            phone: customerData.phone,
            email: customerData.email || '',
            type: 'first'
          });
        }
        
        // Fetch jobsite contacts from subcollection
        const contactsRef = collection(db as Firestore, `customers/${customerId}/contacts`);
        const contactsSnapshot = await getDocs(contactsRef);
        const jobsiteContacts = contactsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          phone: doc.data().phone,
          email: doc.data().email || '',
          type: 'jobsite' as const
        }));
        
        allContacts = [...allContacts, ...jobsiteContacts];
        setContacts(allContacts);
        
        // Set the current jobsite contact if it exists
        if (quoteRequest.jobsiteContact?.name) {
          const existingContact = allContacts.find(c => c.name === quoteRequest.jobsiteContact?.name);
          if (existingContact) {
            setJobsiteContactId(existingContact.id);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching customer contacts:", err);
      setError("Failed to fetch customer contacts");
    }
  }, [db, quoteRequest.jobsiteContact?.name]);

  // Fetch contacts when customer changes
  useEffect(() => {
    if (quoteRequest.customer) {
      fetchCustomerContacts(quoteRequest.customer);
    }
  }, [quoteRequest.customer, fetchCustomerContacts]);

  // Load team members (users belonging to involvedCountry)
  useEffect(() => {
    const loadTeam = async () => {
      try {
        if (!db || !quoteRequest.involvedCountry) return;
        const usersSnap = await getDocs(collection(db as Firestore, 'users'));
        const allUsers = usersSnap.docs.map(u => ({ id: u.id, ...(u.data() as any) }));
        const involved = quoteRequest.involvedCountry;
        const filtered = allUsers.filter((u: any) => (
          (Array.isArray(u.countries) && u.countries.includes(involved)) || u.businessUnit === involved
        ));
        const normalized = filtered.map((u: any) => ({ id: u.id, displayName: u.displayName || u.name || u.email || 'Unknown' , email: u.email }));
        setTeamMembers(normalized);
        if (quoteRequest.assignedUserId) {
          setAssignedUserId(quoteRequest.assignedUserId);
        }
      } catch (err) {
        console.error('Failed to load team members:', err);
      }
    };
    loadTeam();
  }, [db, quoteRequest.involvedCountry, quoteRequest.assignedUserId]);

  // Get the user's business unit for notifications
  const userCountry = userProfile?.businessUnit || (userProfile?.countries && userProfile.countries[0]) || '';
  const defaultCurrencyByCountry: Record<string, string> = {
    Denmark: 'DKK',
    'Loxcall Denmark': 'DKK',
    Sweden: 'SEK',
    'Loxcall Sweden': 'SEK',
    Norway: 'NOK',
    'Loxcall Norway': 'NOK',
    Switzerland: 'CHF',
    'Loxcall Switzerland': 'CHF',
    UK: 'GBP',
    'Loxcall UK': 'GBP',
    Poland: 'PLN',
    'Loxcall Poland': 'PLN',
    Netherlands: 'EUR',
    'Loxcall Netherlands': 'EUR',
    France: 'EUR',
    'Loxcall France': 'EUR',
    Germany: 'EUR',
    'Loxcall Germany': 'EUR',
    Spain: 'EUR',
    'Loxcall Spain': 'EUR',
    Italy: 'EUR',
    'Loxcall Italy': 'EUR',
    Austria: 'EUR',
    'Loxcall Austria': 'EUR',
    Belgium: 'EUR',
    'Loxcall Belgium': 'EUR',
  };

  // If currency not set, derive from involved country
  useEffect(() => {
    if (!quoteRequest.totalValueCurrency && quoteRequest.involvedCountry) {
      const cur = defaultCurrencyByCountry[quoteRequest.involvedCountry] || 'EUR';
      setQuoteRequest(prev => ({ ...prev, totalValueCurrency: cur }));
    }
  }, [quoteRequest.involvedCountry, quoteRequest.totalValueCurrency]);

  // Auto-calc EUR from local when both local and rate are provided
  useEffect(() => {
    if (rateDirection !== 'LOCAL_TO_EUR') return;
    const local = quoteRequest.totalValueLocal;
    const rate = quoteRequest.totalValueRateToEUR;
    if (typeof local === 'number' && local >= 0 && typeof rate === 'number' && rate > 0) {
      const eur = parseFloat((local * rate).toFixed(2));
      if (quoteRequest.totalValueEUR !== eur) {
        setQuoteRequest(prev => ({ ...prev, totalValueEUR: eur }));
      }
    }
  }, [quoteRequest.totalValueLocal, quoteRequest.totalValueRateToEUR, rateDirection]);

  // Auto-calc Local from EUR when we have EUR and a rate (stored as Local->EUR)
  useEffect(() => {
    if (rateDirection !== 'EUR_TO_LOCAL') return;
    const eur = quoteRequest.totalValueEUR;
    const rate = quoteRequest.totalValueRateToEUR;
    const currency = quoteRequest.totalValueCurrency || 'EUR';
    if (currency !== 'EUR' && typeof eur === 'number' && eur >= 0 && typeof rate === 'number' && rate > 0) {
      const local = parseFloat((eur / rate).toFixed(2));
      if (quoteRequest.totalValueLocal !== local) {
        setQuoteRequest(prev => ({ ...prev, totalValueLocal: local }));
      }
    }
  }, [quoteRequest.totalValueEUR, quoteRequest.totalValueRateToEUR, quoteRequest.totalValueCurrency, rateDirection]);

  // Track whether local currency is actually used for Analytics filters later
  useEffect(() => {
    const used = !!(quoteRequest.totalValueLocal && quoteRequest.totalValueLocal > 0 && (quoteRequest.totalValueCurrency || 'EUR') !== 'EUR');
    setQuoteRequest(prev => ({ ...prev, usedLocalCurrency: used }));
  }, [quoteRequest.totalValueLocal, quoteRequest.totalValueCurrency]);

  // Warn when leaving page with unsaved calculator changes and keep flag in sync
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__calculatorDirty = calculatorDirty;
    const handler = (e: BeforeUnloadEvent) => {
      try {
        const hasDirty = (window as any).__calculatorDirty;
        if (hasDirty) {
          e.preventDefault();
          e.returnValue = '';
        }
      } catch {}
    };
    window.addEventListener('beforeunload', handler as any);
    return () => window.removeEventListener('beforeunload', handler as any);
  }, [calculatorDirty]);

  // Helper to set currency quickly
  const useInvolvedCurrency = () => {
    const cur = defaultCurrencyByCountry[quoteRequest.involvedCountry] || 'EUR';
    handleInputChange('totalValueCurrency', cur);
  };
  const useCreatorCurrency = () => {
    const cur = defaultCurrencyByCountry[quoteRequest.creatorCountry] || 'EUR';
    handleInputChange('totalValueCurrency', cur);
  };

  // Reset calculator to allow plain EUR entry
  const resetCalculator = () => {
    setRateDirection('LOCAL_TO_EUR');
    handleInputChange('totalValueCurrency', 'EUR');
    // Use nulls so saveChanges deletes these fields in Firestore
    handleInputChange('totalValueLocal', null);
    handleInputChange('totalValueRateToEUR', null);
    handleInputChange('rateSource', null);
    handleInputChange('rateDate', null);
    handleInputChange('totalValueEUR', null);
    handleInputChange('usedLocalCurrency', false);
    setCalculatorDirty(true);
  };

  // Fetch rate from API (daily cached)
  const fetchRate = async () => {
    try {
      const from = rateDirection === 'LOCAL_TO_EUR' ? (quoteRequest.totalValueCurrency || 'EUR') : 'EUR';
      const to = rateDirection === 'LOCAL_TO_EUR' ? 'EUR' : (quoteRequest.totalValueCurrency || 'EUR');
      const res = await fetch(`/api/fx?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const data = await res.json();
      if (res.ok && data?.rate) {
        const rate = Number(data.rate);
        if (rateDirection === 'LOCAL_TO_EUR') {
          handleInputChange('totalValueRateToEUR', rate);
        } else {
          // Convert to canonical Local->EUR
          handleInputChange('totalValueRateToEUR', rate > 0 ? 1 / rate : undefined);
        }
        handleInputChange('rateSource', data.source || 'exchangerate.host');
        handleInputChange('rateDate', data.date || undefined);

        // If EUR is present and currency is non-EUR, compute local amount
        const eur = quoteRequest.totalValueEUR;
        const storedRate = rateDirection === 'LOCAL_TO_EUR' ? rate : (rate > 0 ? 1 / rate : undefined);
        if (rateDirection === 'EUR_TO_LOCAL' && (quoteRequest.totalValueCurrency || 'EUR') !== 'EUR' && typeof eur === 'number' && storedRate && storedRate > 0) {
          const local = parseFloat((eur / storedRate).toFixed(2));
          handleInputChange('totalValueLocal', local);
        }
        setCalculatorDirty(true);
      }
    } catch (e) {
      console.error('Failed to fetch rate', e);
    }
  };

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
                <span className={`text-sm ${saving ? 'text-blue-600' : saving ? 'text-yellow-600' : 'text-gray-500'}`}>
                  {saving ? 'Saving...' : 'Auto-save ON'}
                </span>
                <button 
                  onClick={() => saveChanges(false)}
                  disabled={saving || isReadOnly}
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
                    {fetchedCustomers.map(customer => (
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
                      <div key={index} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          value={product.catClass}
                          onChange={(e) => handleInputChange(`products.${index}.catClass`, e.target.value)}
                          placeholder="Product Code"
                          className="col-span-3 p-2 border border-gray-300 rounded"
                          disabled={isReadOnly}
                        />
                        {!isReadOnly && (
                          <button
                            onClick={async () => {
                              const code = normalizeCode(quoteRequest.products[index].catClass);
                              if (!code) return;
                              const p = await getProductByCode(code);
                              if (p) {
                                handleInputChange(`products.${index}.catClass`, p.catClass);
                                handleInputChange(`products.${index}.description`, p.description);
                              } else {
                                const confirmAdd = confirm('Product not found. Add to catalog?');
                                if (!confirmAdd) return;
                                // Open Quick Add inline modal
                                setQuickAdd({ index, code });
                              }
                            }}
                            className="col-span-1 text-blue-600 underline text-xs"
                            title="Lookup description"
                          >
                            Lookup
                          </button>
                        )}
                        <input
                          type="text"
                          value={product.description}
                          onChange={(e) => handleInputChange(`products.${index}.description`, e.target.value)}
                          placeholder="Description"
                          className="col-span-5 p-2 border border-gray-300 rounded"
                          disabled={isReadOnly}
                        />
                        <input
                          type="number"
                          value={product.quantity}
                          onChange={(e) => handleInputChange(`products.${index}.quantity`, parseInt(e.target.value))}
                          placeholder="Qty"
                          className="col-span-3 p-2 border border-gray-300 rounded"
                          disabled={isReadOnly}
                          min="1"
                        />
                        {!isReadOnly && (
                          <button
                            onClick={() => handleRemoveProduct(index)}
                            className="col-span-1 text-red-500 hover:text-red-700 p-2"
                            title="Remove product"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
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
                      disabled={isReadOnly || quoteRequest.customerDecidesEnd}
                    />
                  </div>
                </div>

                {/* Customer decides end date checkbox */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={quoteRequest.customerDecidesEnd || false}
                      onChange={(e) => handleInputChange("customerDecidesEnd", e.target.checked)}
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
                  <select
                    value={jobsiteContactId}
                    onChange={(e) => {
                      const selectedContact = contacts.find(c => c.id === e.target.value);
                      if (selectedContact) {
                        setJobsiteContactId(e.target.value);
                        setQuoteRequest(prev => ({
                          ...prev,
                          jobsiteContact: {
                            name: selectedContact.name,
                            phone: selectedContact.phone
                          }
                        }));
                      }
                    }}
                    className="w-full p-3 border border-gray-300 rounded-md"
                      disabled={isReadOnly}
                  >
                    <option value="">Select Contact</option>
                    {contacts.map(contact => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} ({contact.phone}){contact.type === 'first' ? ' (First Contact)' : ''}
                      </option>
                    ))}
                  </select>
                  {jobsiteContactId && (
                    <div className="mt-1 text-sm text-gray-600">
                      Selected: {contacts.find(c => c.id === jobsiteContactId)?.name || ''}
                  </div>
                  )}
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

                {/* Handled By (Team Assignment) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Handled by</label>
                  {(() => {
                    const canAssign = !isReadOnly && (
                      userProfile?.role === 'superAdmin' ||
                      userProfile?.role === 'admin' ||
                      userProfile?.businessUnit === quoteRequest.involvedCountry ||
                      (userProfile?.countries || []).includes(quoteRequest.involvedCountry)
                    );
                    return (
                  <div className="space-y-2 p-3 border border-gray-200 rounded-md bg-gray-50">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="assignedUser"
                        checked={!assignedUserId}
                        onChange={() => {
                          setAssignedUserId("");
                          handleInputChange('assignedUserId', '');
                          handleInputChange('assignedUserName', '');
                        }}
                        disabled={!canAssign}
                      />
                      <span className="text-gray-600">Unassigned</span>
                    </label>
                    {teamMembers.map((member) => (
                      <label key={member.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="assignedUser"
                          checked={assignedUserId === member.id}
                          onChange={() => {
                            setAssignedUserId(member.id);
                            handleInputChange('assignedUserId', member.id);
                            handleInputChange('assignedUserName', member.displayName);
                          }}
                          disabled={!canAssign}
                        />
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-300 text-xs text-gray-800">
                            {member.displayName?.slice(0,1).toUpperCase()}
                          </span>
                          {member.displayName}
                        </span>
                      </label>
                    ))}
              </div>
                    );
                  })()}
            </div>

                {/* Total Value */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Value</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Total Value (EUR)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={quoteRequest.totalValueEUR ?? ''}
                        onChange={(e) => handleInputChange('totalValueEUR', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                        className="w-full p-3 border border-gray-300 rounded-md"
                        placeholder="e.g. 12500.00"
                        disabled={isReadOnly}
                      />
                      {calculatorDirty && (
                        <div className="mt-2 p-2 rounded bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs flex items-center justify-between">
                          <span>Calculator changed. Click "Save Changes" to persist.</span>
                          <button onClick={() => saveChanges(false)} disabled={saving} className="ml-3 px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50">Save now</button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Local Currency Amount</label>
                      <div className="flex gap-2">
                        <select
                          value={quoteRequest.totalValueCurrency || 'EUR'}
                          onChange={(e) => handleInputChange('totalValueCurrency', e.target.value)}
                          className="p-3 border border-gray-300 rounded-md w-28"
                          disabled={isReadOnly}
                        >
                          {['EUR','DKK','SEK','NOK','CHF','GBP','PLN'].map(cur => (
                            <option key={cur} value={cur}>{cur}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={quoteRequest.totalValueLocal ?? ''}
                          onChange={(e) => handleInputChange('totalValueLocal', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                          className="flex-1 p-3 border border-gray-300 rounded-md"
                          placeholder="e.g. 93000.00"
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={useInvolvedCurrency} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200" disabled={isReadOnly}>Use Involved</button>
                        <button type="button" onClick={useCreatorCurrency} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200" disabled={isReadOnly}>Use Creator</button>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-gray-600">Rate</label>
                          <div className="flex items-center gap-2 text-xs">
                            <label className="inline-flex items-center gap-1">
                              <input type="radio" className="accent-[#e40115]" checked={rateDirection==='LOCAL_TO_EUR'} onChange={() => setRateDirection('LOCAL_TO_EUR')} />
                              Local → EUR
                            </label>
                            <label className="inline-flex items-center gap-1">
                              <input type="radio" className="accent-[#e40115]" checked={rateDirection==='EUR_TO_LOCAL'} onChange={() => setRateDirection('EUR_TO_LOCAL')} />
                              EUR → Local
                            </label>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.0001"
                            value={(() => {
                              const r = quoteRequest.totalValueRateToEUR;
                              if (!r) return '' as any;
                              return rateDirection==='LOCAL_TO_EUR' ? r : (r>0 ? (1/r).toFixed(6) : '');
                            })()}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                              if (val === undefined) { handleInputChange('totalValueRateToEUR', undefined); return; }
                              if (rateDirection==='LOCAL_TO_EUR') {
                                handleInputChange('totalValueRateToEUR', val);
                              } else {
                                handleInputChange('totalValueRateToEUR', val>0 ? 1/val : undefined);
                              }
                              // If EUR exists and currency non-EUR, update local too
                              const eur = quoteRequest.totalValueEUR;
                              const stored = rateDirection==='LOCAL_TO_EUR' ? val : (val && val>0 ? 1/val : undefined);
                              if (rateDirection==='EUR_TO_LOCAL' && (quoteRequest.totalValueCurrency||'EUR')!=='EUR' && typeof eur === 'number' && stored && stored>0) {
                                const local = parseFloat((eur / stored).toFixed(2));
                                handleInputChange('totalValueLocal', local);
                              }
                            }}
                            className="w-full p-3 border border-gray-300 rounded-md"
                            placeholder="e.g. 0.1339 or 7.4682"
                            disabled={isReadOnly}
                          />
                          <button type="button" onClick={fetchRate} className="px-3 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200 whitespace-nowrap" disabled={isReadOnly}>Fetch rate</button>
                          <button type="button" onClick={resetCalculator} className="px-3 py-2 text-sm bg-[#e40115] text-white rounded hover:bg-red-700 whitespace-nowrap" disabled={isReadOnly}>Reset</button>
                        </div>
                        {quoteRequest.rateDate && (
                          <p className="mt-1 text-[11px] text-gray-500">Source: {quoteRequest.rateSource || 'exchangerate.host'} • {quoteRequest.rateDate}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">Fill EUR directly or provide local amount and the conversion rate (any direction). EUR is required when setting status to Won/Lost/Cancelled.</p>
                      </div>
                    </div>
                  </div>
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
      {/* Modal */}
      <TotalValueRequiredModal open={showTotalValueModal} onClose={() => setShowTotalValueModal(false)} />
      {/* Quick Add Product Modal */}
      {quickAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded p-4 w-full max-w-md space-y-3">
            <h3 className="text-lg font-semibold">Add product to catalog</h3>
            <div>
              <label className="block text-sm mb-1">Cat-Class</label>
              <input value={quickAdd.code} disabled className="w-full border rounded px-3 py-2 bg-gray-100" />
            </div>
            <div>
              <label className="block text-sm mb-1">Description</label>
              <input value={quickAddDesc} onChange={e=>setQuickAddDesc(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=>{ setQuickAdd(null); setQuickAddDesc(''); }} className="px-3 py-2 border rounded">Cancel</button>
              <button onClick={async()=>{
                try {
                  const code = normalizeCode(quickAdd.code);
                  if (!code || !quickAddDesc.trim()) return;
                  const { upsertProduct } = await import('../../../utils/products');
                  await upsertProduct({ catClass: code, description: quickAddDesc.trim(), active: true });
                  handleInputChange(`products.${quickAdd.index}.catClass`, code);
                  handleInputChange(`products.${quickAdd.index}.description`, quickAddDesc.trim());
                  setQuickAdd(null);
                  setQuickAddDesc('');
                } catch (e:any) {
                  alert(e?.message || 'Failed to add product');
                }
              }} className="px-3 py-2 bg-[#e40115] text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple modal requiring total value
function TotalValueRequiredModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Value required</h3>
        <p className="text-sm text-gray-700 mb-4">Please fill in the Total Value in EUR before setting the status to Won, Lost, or Cancelled.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-[#e40115] text-white rounded hover:bg-red-700">OK</button>
        </div>
      </div>
    </div>
  );
}