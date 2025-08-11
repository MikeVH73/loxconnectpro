# LOXCONNECT PRO - SYSTEM REFERENCE GUIDE

## 🏗️ **ARCHITECTURE & TECHNICAL FOUNDATION**

### **Technology Stack**
- **Frontend**: Next.js 15.3.4 with App Router, TypeScript, Tailwind CSS
- **Backend**: Firebase (Authentication, Firestore Database, Storage)
- **Deployment**: Vercel with GitHub integration
- **State Management**: React Context API + useState hooks
- **Real-time Features**: Firebase real-time listeners

### **Core File Structure**
```
src/
├── app/
│   ├── AuthProvider.tsx          # Authentication context & user management
│   ├── layout.tsx                # Root layout with providers
│   ├── dashboard/page.tsx        # Main dashboard with quote requests
│   ├── quote-requests/
│   │   ├── page.tsx             # Quote requests listing
│   │   ├── new/page.tsx         # Create new quote request
│   │   └── [id]/edit/page.tsx   # Edit existing quote request
│   ├── components/               # Reusable UI components
│   ├── hooks/                   # Custom React hooks
│   └── utils/                   # Utility functions
├── firebaseClient.ts            # Firebase initialization & configuration
└── types/                       # TypeScript type definitions
```

## 🔐 **AUTHENTICATION & USER MANAGEMENT**

### **User Profile Structure**
```typescript
interface UserProfile {
  id: string;           // Firebase UID
  email: string;
  role: string;         // 'admin', 'superAdmin', 'user'
  countries?: string[]; // Array of country codes
  businessUnit?: string; // Primary business unit
  name?: string;
}
```

### **Authentication Flow**
1. **Firebase Initialization**: Client-side only, prevents SSR issues
2. **Bulletproof Profile Loading**: `ensureUserProfile()` function that never fails
3. **Three-Tier Resolution**: Primary by UID, fallback by email, create if missing
4. **Automatic Profile Creation**: Creates default profiles for new users
5. **Profile Migration**: Automatically migrates email-based profiles to UID-based
6. **Business Unit Resolution**: Uses `businessUnit` field or first country from `countries` array
7. **Loading State Management**: Components must wait for `authLoading` to complete before checking `userProfile`
8. **Error Handling**: Graceful error states with retry mechanisms
9. **Zero-Failure Guarantee**: Authentication always succeeds, never breaks

### **Bulletproof Authentication Features**
- **`ensureUserProfile()` Function**: Creates profiles if they don't exist
- **Automatic Profile Migration**: Email-based → UID-based storage
- **Default Profile Creation**: Sensible defaults for new users
- **Retry Mechanism**: Manual retry function for profile loading
- **Enhanced Error Display**: Retry and refresh buttons
- **Increased Retry Attempts**: 20 retries with 200ms delays
- **No Automatic Sign-Out**: Prevents login loops

### **Role-Based Access**
- **superAdmin**: Access to all countries and features
- **admin**: Access to assigned countries
- **user**: Standard user permissions

### **User Management System**
**Location**: `src/app/users/page.tsx`

**Core Features**:
- **User Creation**: Create new users with role and country assignments
- **User Editing**: Modify user profiles, roles, and country access
- **User Deletion**: Remove users from the system
- **Profile Fixing**: Utility to repair existing user profiles with missing fields
- **Temporary Password Creation**: Generate temporary passwords for users who forgot their password

**Authorization Rules**:
- **superAdmin**: Can see all users from all organizations, can reset passwords for any user
- **admin**: Can see users from their assigned countries, can reset passwords for users in same country
- **user**: No user management access

**Temporary Password System**:
- Generates secure 12-character temporary passwords
- Stores password reset information in user profile
- User must change password on next login
- Tracks who reset the password and when

## 📊 **DASHBOARD SYSTEM**

### **Main Dashboard Layout**
- **Top Section**: Real-time notifications container
- **Main Content**: Quote requests organized in columns
- **Sidebar**: Navigation and user controls

### **Quote Request Columns**
1. **Urgent/Problems** (Red/Orange): `urgent=true` OR `problems=true`
2. **Waiting** (Yellow): `waitingForAnswer=true`
3. **Standard**: No special flags
4. **Snoozed**: `status="Snoozed"`

### **Status System**
- **New** (Purple): Default status for new quote requests, shows purple background and border
- **In Progress** (Green): Active quote requests being worked on
- **Snoozed** (Gray): Temporarily paused quote requests
- **Won** (Blue): Successfully completed quote requests - only shown in Archived menu
- **Lost** (Red): Unsuccessful quote requests - only shown in Archived menu
- **Cancelled** (Yellow): Cancelled quote requests - only shown in Archived menu

### **Quote Request Card Features**
- **Visual Labels**: Color-coded badges (yellow, red, orange, red for planned)
- **Status Indicators**: Real-time status updates
- **Click Navigation**: Direct to edit page
- **Quick Actions**: Status changes, label toggles
- **Delete Functionality**: Delete button for creators only (red trash icon) - available on Dashboard, Quote Requests, and Archived pages
- **Status Filtering**: Quote Requests with 'Won', 'Lost', 'Cancelled' status only appear in Archived menu

## 📝 **QUOTE REQUEST SYSTEM**

### **Quote Request Data Structure**
```typescript
interface QuoteRequest {
  id: string;
  title: string;
  description: string;
  customer: string;        // Customer ID
  involvedCountry: string; // Target country
  creatorCountry: string;  // Creator's country
  status: string; // "New", "In Progress", "Snoozed", "Won", "Lost", "Cancelled"
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
    catClass: string;      // Product category/class
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
  customerNumber: string;  // Auto-generated based on country
  notes: string;
  labels: {
    waitingForAnswer: boolean;
    urgent: boolean;
    problems: boolean;
    planned: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### **New Quote Request Form**
**Layout**: 3-column responsive design
- **Left Sidebar** (320px): Status dropdown, Labels, Recent Activity
- **Main Content**: 2-column form layout
- **Right Panel** (384px): Messaging panel

**Required Fields**:
- Customer (dropdown with search)
- Involved Country (dropdown)
- Start Date (date picker)
- End Date (date picker with "Customer decides" checkbox)
- Jobsite Address (text input)
- Latitude/Longitude (number inputs)
- Jobsite Contact (name + phone)
- Products (dynamic list with catClass field)
- Attachments (file upload)
- Customer Number (auto-filled)

**Post-Creation Flow**:
- Success message displayed for 1.5 seconds
- Automatic redirect to dashboard (not edit page)
- No confusion about additional saving required

### **Edit Quote Request Page**
**Features**:
- **Auto-save**: Debounced changes to Firestore
- **Real-time Updates**: Live status and label changes
- **Product Management**: Add/remove products with catClass field
- **Product Layout**: Compact row — `Code | Lookup | Description | Qty | Delete` — with safe spacing at 100% zoom
- **File Attachments**: Upload/download with progress using FileUpload component
- **Customer Consistency**: Uses customer IDs throughout
- **Attachment Interface**: Proper FileData interface with id, uploadedAt, uploadedBy fields

## 💬 **MESSAGING & NOTIFICATIONS**

### **Real-time Messaging System**
- **Dashboard Messaging**: Global messaging panel
- **Quote Request Messaging**: Context-specific conversations
- **File Attachments**: Support for images, documents
- **Message History**: Persistent chat history
- **Cross-Country Communication**: Automatic targeting

### **Notification Types**
1. **message**: New messages in quote requests
2. **status_change**: Quote request status updates
3. **property_change**: Field modifications
4. **deletion**: Quote request deletion notifications

### **Notification Targeting Logic**
```typescript
// If user is creator: notify involved country
// If user is involved country: notify creator
const targetCountry = userCountry === creatorCountry 
  ? involvedCountry 
  : creatorCountry;
```

## 🏷️ **LABEL SYSTEM**

### **Label Types & Colors**
- **Waiting for Answer** (Yellow): `bg-yellow-100`
- **Urgent** (Red): `bg-red-100`
- **Problems** (Orange): `bg-orange-100`
- **Planned** (Red): `bg-red-100`

### **Label Behavior**
- **Immediate Save**: Changes saved to Firestore instantly
- **Column Movement**: Automatic column reassignment
- **Notifications**: Triggers notifications for involved countries (only for actual changes)
- **UI Updates**: Real-time visual feedback
- **False Notification Prevention**: No notifications for initial loading or default states

### **Labels Management System**
**Location**: `src/app/labels/page.tsx`

**Core Features**:
- **Full CRUD Operations**: Create, Read, Update, Delete labels
- **Access Control**: Only `superAdmin` users can access and manage labels
- **Duplicate Detection**: Automatic detection and removal of duplicate labels
- **Smart Duplicate Resolution**: Prioritizes correct label names (e.g., "snooze" over "Snoozed")
- **Real-time Updates**: Labels list refreshes automatically after changes
- **Sorting**: Labels displayed alphabetically by name

**Authorization Rules**:
- **superAdmin**: Full access to create, edit, delete, and fix duplicate labels
- **admin/user**: Access denied - see "Access Denied" message

**Duplicate Label Fix**:
- **`handleFixDuplicateLabels()` Function**: Automatically detects and removes duplicate labels
- **Smart Detection**: Finds labels with similar names (case-insensitive)
- **Special Handling**: Prioritizes the correct "snooze" label name that the system expects
- **"Fix Duplicate Labels" Button**: User-friendly interface to trigger duplicate removal
- **Success Feedback**: Shows detailed messages about what was fixed

**Label Naming Standards**:
- **System Expects**: "snooze" (lowercase) for snooze functionality
- **Special Labels**: "urgent", "problems", "waiting for answer", "planned", "snooze"
- **Consistency**: Ensures only one label per functionality exists
- **Case Handling**: System searches case-insensitive but maintains original case in database

## 🎨 **USER INTERFACE & UX**

### **Design Principles**
- **Modern & Clean**: Tailwind CSS with consistent spacing
- **Responsive**: Mobile-first design approach
- **Intuitive Navigation**: Clear hierarchy and breadcrumbs
- **Real-time Feedback**: Loading states, success/error messages
- **Accessibility**: Proper ARIA labels and keyboard navigation

### **Color Scheme**
- **Primary**: Blue tones for main actions
- **Success**: Green for positive actions
- **Warning**: Yellow for waiting states
- **Error**: Red for urgent/error states
- **Info**: Blue for informational elements

### **Component Library**
- **LoadingSpinner**: Consistent loading indicators
- **FileUpload**: Drag-and-drop file handling
- **CountrySelect**: Dropdown with search
- **MessagingPanel**: Real-time chat interface
- **NotificationBadge**: Unread count indicators

## 🔧 **DEVELOPMENT & DEPLOYMENT**

### **Environment Configuration**
```javascript
// next.config.js
module.exports = {
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env?.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  },
  experimental: {
    serverActions: true,
  },
  // Production optimizations
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  compress: true,
}
```

### **Firebase Configuration**
```typescript
// firebaseClient.ts
const firebaseConfig = {
  apiKey: "AIzaSyD3LGcmPieAnJuGrNUyIRTQw3bQ1Gzsjj0",
  authDomain: "loxconnect-pro.firebaseapp.com",
  projectId: "loxconnect-pro",
  storageBucket: "loxconnect-pro.firebasestorage.app",
  messagingSenderId: "767888928675",
  appId: "1:767888928675:web:e4c6bb3914fc97ecf4b416",
  measurementId: "G-5P1C1YTGQT"
};
```

### **Deployment Pipeline**
1. **Local Development**: `npm run dev` on localhost:3000
2. **GitHub Push**: Automatic trigger to Vercel
3. **Vercel Build**: Automatic deployment to production
4. **Environment Variables**: Properly configured in Vercel dashboard

### **Security Hardening (Current State)**
- **Session Cookies**: After login the client calls `POST /api/auth/session` to mint an HttpOnly `__session` cookie; logout uses `DELETE /api/auth/session` followed by Firebase `signOut`.
- **Edge Gating (feature‑flagged)**: `NEXT_PUBLIC_ENABLE_EDGE_AUTH=true` enables middleware redirects to `/login` when `__session` is missing (keep OFF until verified).
- **Firebase App Check**: Client initialized with reCAPTCHA Enterprise.
  - Env: `NEXT_PUBLIC_ENABLE_APP_CHECK=true`, `NEXT_PUBLIC_RECAPTCHA_KEY=<site_key>`
  - Optional debug: `NEXT_PUBLIC_ENABLE_APP_CHECK_DEBUG=true` logs token events in Console
  - Enforce in Firebase Console → App Check → APIs once Verified > 90% consistently
- **Auth Blocking Functions (planned/enabled per env)**:
  - `beforeCreate`: optional domain/allowlist gate
  - `beforeSignIn`: requires `emailVerified`; optional MFA enforcement flag
- **MFA (TOTP)**: Enrollment UI at `/users/security` (Authenticator app). Enforcement via blocking function when enabled.

## 🔄 **DATA FLOW & STATE MANAGEMENT**

### **Firebase Integration**
- **Real-time Listeners**: Quote requests, messages, notifications
- **Offline Persistence**: IndexedDB with unlimited cache
- **Optimistic Updates**: UI updates before server confirmation
- **Error Handling**: Graceful fallbacks and retry mechanisms

### **State Management Pattern**
```typescript
// Custom hooks for data management
const useCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch and manage customer data
  return { customers, loading, error, refetchCustomers };
};
```

## 🚀 **KEY FEATURES & FUNCTIONALITIES**

### **Core Capabilities**
1. **Multi-Country Collaboration**: Cross-border quote request management
2. **Real-time Communication**: Instant messaging and notifications
3. **File Management**: Secure file uploads and sharing with proper FileUpload component
4. **Status Tracking**: Comprehensive quote request lifecycle with proper filtering
5. **Label System**: Visual organization and prioritization with full CRUD management
6. **Customer Management**: Integrated customer database
7. **Product Catalog**: Dynamic product selection with categories
8. **Quote Request Deletion**: Creator-only deletion with notifications
9. **User Management**: Complete user lifecycle with temporary password creation
10. **Status Filtering**: Completed quote requests (Won/Lost/Cancelled) only appear in Archived menu
11. **Labels Management**: Full CRUD operations with duplicate detection and smart resolution
12. **Duplicate Label Prevention**: Automatic detection and removal of duplicate labels

### **Business Logic**
- **Customer Number Generation**: Automatic based on country
- **Cross-Country Notifications**: Smart targeting based on roles
- **Permission System**: Role-based access control
- **Data Validation**: Client and server-side validation
- **Audit Trail**: Complete change tracking and history

### **Performance Optimizations**
- **Dynamic Imports**: Code splitting for better load times
- **SSR Disabled**: Client-side rendering for Firebase components
- **Caching Strategy**: Aggressive caching with offline support
- **Bundle Optimization**: Tree shaking and minification

## 📱 **USER EXPERIENCE JOURNEY**

### **Typical User Flow**
1. **Login**: Firebase authentication with role-based redirect
2. **Dashboard**: View quote requests in organized columns
3. **Create Quote**: Comprehensive form with auto-save
4. **Collaborate**: Real-time messaging with file sharing
5. **Track Progress**: Status updates and label management
6. **Notifications**: Real-time updates across countries

### **Error Handling**
- **Graceful Degradation**: App works offline with sync
- **User-Friendly Messages**: Clear error descriptions
- **Retry Mechanisms**: Automatic retry for failed operations
- **Loading States**: Visual feedback during operations

## 🔑 **CRITICAL REMINDERS**

### **Database Field Names**
- **Products**: Use `catClass` field (NOT `code`)
- **Countries**: `creatorCountry` and `involvedCountry` (NOT `involvedCountries` or `targetCountry`)
- **Labels**: Boolean flags in quote request document
- **Attachments**: Use proper FileData interface with id, uploadedAt, uploadedBy fields

### **Authentication Rules**
- Firebase must be initialized before any auth/Firestore operations
- User profiles must contain required fields or user is signed out
- Business unit resolution: `businessUnit` field OR first country from `countries` array
- **CRITICAL**: Components must check `authLoading` before accessing `userProfile` to prevent timing issues
- **CRITICAL**: Firebase config uses hardcoded values to avoid `process.env` client-side issues
- **CRITICAL**: Components must show loading state when `authLoading` is true to prevent premature Firebase access
- **CRITICAL**: New quote requests redirect to dashboard, not edit page, to prevent save confusion
- **CRITICAL**: Auto-save skips initial load to prevent false notifications about label changes
- **CRITICAL**: Email fallback lookup uses Firestore query instead of document ID lookup
- **CRITICAL**: All pages must handle authLoading and userProfile null states properly
- **CRITICAL**: Database field mapping: displayName → name, uid → id, add businessUnit field
- **CRITICAL**: User profile fixer utility available in Users page to repair existing profiles

### **Notification Logic**
- Creator → Notify involved country
- Involved country → Notify creator
- Use correct database field names for targeting
- **CRITICAL**: Only notify for actual changes, not initial loading or default states
- **CRITICAL**: Prevent false notifications about label removal on new quote requests
- **CRITICAL**: Deletion notifications sent to involved country when creator deletes quote request

### **UI/UX Standards**
- Labels: Color-coded badges with immediate save
- Dashboard: Column-based organization with real-time updates
- Forms: Auto-save with debounced changes
- Messaging: Real-time with file attachments
- Status Colors: New (purple), In Progress (green), Snoozed (gray), Won (blue), Lost (red), Cancelled (yellow)
- New Status: Default status for new quote requests with purple card background and border
- Status Filtering: Completed statuses (Won/Lost/Cancelled) only appear in Archived menu
- File Upload: Proper FileUpload component with drag-and-drop and browse functionality
- Product Layout: 12-column grid ensuring quantity field visibility (Code: 3, Description: 6, Quantity: 2, Delete: 1)
- Labels Management: Full CRUD with duplicate detection and smart resolution
- Duplicate Label Prevention: Automatic detection and removal of duplicate labels, prioritizes correct system names

---

**This document serves as the definitive reference for LOXCONNECT PRO system architecture, functionality, and user experience patterns.** 