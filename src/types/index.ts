// LOXCONNECT PRO - TypeScript Type Definitions

export interface UserProfile {
  id: string;
  email: string;
  role: 'superAdmin' | 'admin' | 'user';
  countries?: string[];
  businessUnit?: string;
  name?: string;
}

export interface QuoteRequest {
  id: string;
  title: string;
  description: string;
  customer: string;
  involvedCountry: string;
  creatorCountry: string;
  status: 'New' | 'In Progress' | 'Snoozed' | 'Won' | 'Lost' | 'Cancelled';
  startDate: Date;
  endDate: Date;
  jobsiteAddress: string;
  latitude: number;
  longitude: number;
  jobsiteContact: {
    name: string;
    phone: string;
  };
  products: Array<{
    catClass: string;
    quantity: number;
    description: string;
  }>;
  attachments: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
    uploadedAt: Date;
    uploadedBy: string;
  }>;
  customerNumber: string;
  notes: Array<{
    text: string;
    author: string;
    dateTime: string;
  }>;
  labels: {
    waitingForAnswer: boolean;
    urgent: boolean;
    problems: boolean;
    planned: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  contact: string;
  phone: string;
  email: string;
  customerNumbers: Record<string, string>;
  ownerCountry: string;
  creatorCountry: string;
  countries?: string[];
}

// NEW FEATURES - Error Reports & Ideas System

export interface ErrorReport {
  id: string;
  userId: string;
  userEmail: string;
  userCountry: string;
  userRole: string;
  page: string; // Current page where error was reported
  category: 'Bug Report' | 'Improvement' | 'Design Issue' | 'Performance' | 'Other';
  title: string;
  description: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'New' | 'In Progress' | 'Resolved' | 'Closed';
  screenshot?: string; // Base64 or URL
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string; // SuperAdmin who resolved it
  superAdminResponse?: string;
  assignedTo?: string; // SuperAdmin assigned to handle
}

export interface Idea {
  id: string;
  userId: string;
  userEmail: string;
  userCountry: string;
  userRole: string;
  title: string;
  description: string;
  category: 'Bug Report' | 'Improvement' | 'New Feature' | 'Design Issue' | 'Performance';
  status: 'Pending Approval' | 'Approved' | 'Being Implemented' | 'Rejected' | 'Archived';
  likeCount: number; // Number of likes received
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  approvedBy?: string; // SuperAdmin who approved
  implementedAt?: Date;
  implementedBy?: string; // SuperAdmin who implemented
  rejectedAt?: Date;
  rejectedBy?: string; // SuperAdmin who rejected
  rejectionReason?: string; // Why it was rejected
  deletedAt?: Date;
  deletedBy?: string; // SuperAdmin who deleted/archived
}

export interface UserVote {
  id: string;
  userId: string;
  ideaId: string;
  points: number; // Points allocated to this idea
  month: number; // 1-12
  year: number; // 2025, 2026, etc.
  createdAt: Date;
}

export interface MonthlyPoints {
  id: string;
  userId: string;
  month: number; // 1-12
  year: number; // 2025, 2026, etc.
  totalPoints: number; // Points allocated for this month (10)
  usedPoints: number; // Points already used
  remainingPoints: number; // Points still available
  createdAt: Date;
  updatedAt: Date;
}

// Notification types for the new features
export interface ErrorReportNotification {
  id: string;
  type: 'error_report';
  targetCountry: string; // Always 'superAdmin' for error reports
  title: string;
  message: string;
  errorReportId: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  createdAt: Date;
  read: boolean;
}

export interface IdeaNotification {
  id: string;
  type: 'new_idea' | 'idea_implemented' | 'idea_rejected';
  targetCountry: string; // Always 'superAdmin' for new ideas
  title: string;
  message: string;
  ideaId: string;
  createdAt: Date;
  read: boolean;
}

export interface UserResponseNotification {
  id: string;
  type: 'error_resolved' | 'idea_response';
  targetCountry: string; // User's country
  title: string;
  message: string;
  relatedId: string; // Error report ID or Idea ID
  createdAt: Date;
  read: boolean;
}
