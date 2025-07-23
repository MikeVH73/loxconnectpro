"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../AuthProvider';
import MessageHistoryIndicator from './MessageHistoryIndicator';
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

// Initialize dayjs plugins
dayjs.extend(relativeTime);

interface Jobsite {
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

interface QuoteRequest {
  id: string;
  title: string;
  creatorCountry: string;
  involvedCountry: string;
  customer: string;
  customerNumber?: string;
  status: string;
  labels: string[];
  products?: any[];
  notes?: any[];
  updatedAt?: any;
  waitingForAnswer: boolean;
  urgent: boolean;
  problems: boolean;
  planned: boolean;
  hasUnreadMessages?: boolean;
  lastMessageAt?: any;
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
}

interface QuoteRequestCardProps {
  qr: QuoteRequest;
  customers: { id: string; name: string; }[];
  labels: { id: string; name: string; }[];
  onCardClick: (id: string) => void;
  getCustomerName: (id: string | undefined) => string;
  getLabelName: (id: string | undefined) => string;
}

interface QuoteRequestWithDynamicKeys extends QuoteRequest {
  [key: string]: any;
}

export default function QuoteRequestCard({ qr, customers, labels, onCardClick, getCustomerName, getLabelName }: QuoteRequestCardProps) {
  const { userProfile } = useAuth();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  // Find special label IDs
  const urgentLabelId = labels.find(l => l.name.toLowerCase() === 'urgent')?.id || '';
  const problemsLabelId = labels.find(l => l.name.toLowerCase() === 'problems')?.id || '';
  const waitingLabelId = labels.find(l => l.name.toLowerCase() === 'waiting for answer')?.id || '';
  const plannedLabelId = labels.find(l => l.name.toLowerCase() === 'planned')?.id || '';
  const snoozeLabelId = labels.find(l => l.name.toLowerCase() === 'snooze')?.id || '';

  // Check both boolean flags and label IDs
  const hasUrgentLabel = qr.urgent || (qr.labels || []).includes(urgentLabelId);
  const hasProblemsLabel = qr.problems || (qr.labels || []).includes(problemsLabelId);
  const hasWaitingLabel = qr.waitingForAnswer || (qr.labels || []).includes(waitingLabelId);
  const hasPlannedLabel = qr.planned || (qr.labels || []).includes(plannedLabelId);
  const hasSnoozeLabel = qr.status === "Snoozed" || (qr.labels || []).includes(snoozeLabelId);

  // Filter out special labels for regular labels display
  const specialLabelIds = [urgentLabelId, problemsLabelId, waitingLabelId, plannedLabelId, snoozeLabelId].filter(id => id !== '');
  const regularLabels = (qr.labels || []).filter(labelId => !specialLabelIds.includes(labelId));

  // Helper function to format date
  const formatDate = (date: any) => {
    if (!date) return null;
    try {
      // If it's a Firestore Timestamp
      if (typeof date.toDate === 'function') {
        return dayjs(date.toDate()).fromNow();
      }
      // If it's a Date object or string
      return dayjs(date).fromNow();
    } catch (err) {
      console.error('Error formatting date:', err);
      return null;
    }
  };

  return (
    <div
      onClick={() => onCardClick(qr.id)}
      className="bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow duration-200"
    >
      {/* Title and Customer */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 truncate">{qr.title}</h3>
          <p className="text-sm text-gray-600">{getCustomerName(qr.customer)}</p>
        </div>
        {qr.hasUnreadMessages && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            New Messages
          </span>
        )}
      </div>

      {/* Countries */}
      <div className="text-sm text-gray-600 mb-2">
        {qr.creatorCountry} → {qr.involvedCountry}
      </div>

      {/* Status Indicators and Special Labels */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          qr.status === "In Progress" ? "bg-green-100 text-green-800" :
          qr.status === "Snoozed" ? "bg-gray-100 text-gray-800" :
          qr.status === "Won" ? "bg-blue-100 text-blue-800" :
          qr.status === "Lost" ? "bg-red-100 text-red-800" :
          "bg-yellow-100 text-yellow-800"
        }`}>
          {qr.status}
        </span>

        {hasUrgentLabel && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Urgent
          </span>
        )}
        {hasProblemsLabel && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            Problems
          </span>
        )}
        {hasWaitingLabel && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Waiting
          </span>
        )}
        {hasPlannedLabel && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Planned
          </span>
        )}
      </div>

      {/* Regular Labels */}
      {regularLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {regularLabels.map((labelId) => (
            <span
              key={labelId}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
            >
              {getLabelName(labelId)}
            </span>
          ))}
        </div>
      )}

      {/* Message History */}
      {qr.lastMessageAt && formatDate(qr.lastMessageAt) && (
        <div className="mt-2 text-xs text-gray-500">
          Last message: {formatDate(qr.lastMessageAt)}
        </div>
      )}
    </div>
  );
} 