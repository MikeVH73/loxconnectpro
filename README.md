# LoxConnect Pro

A comprehensive Quote Request management system built with Next.js, TypeScript, and Firebase, designed for seamless communication and file sharing between international business units.

## 🚀 Features Overview

### 📋 Quote Request Management
- **Create, Edit, and View** quote requests between countries
- **Status Management**: In Progress, Snoozed, Won, Lost, Cancelled
- **Country-based Permissions**: Only creator countries can change status
- **Product Management**: Multiple products per quote with categories, descriptions, and quantities
- **Customer & Contact Management**: Integrated customer database with jobsite contacts
- **Date Management**: Flexible start/end dates with customer decision options
- **Label System**: Urgent, Problems, Waiting for Answer, Snooze labels with visual indicators

### 💬 Real-Time Messaging System
- **Quote Request Messaging**: Country-to-country communication within specific quote requests
- **Real-Time Updates**: Instant message delivery using Firestore onSnapshot
- **File Sharing**: Upload and share images, PDFs, Word docs, Excel files up to 5MB
- **Message History**: Complete conversation timeline preserved
- **Country Identification**: Clear sender country indicators with flags
- **Delivery Status**: Message delivery confirmation

### 📁 File Management & Storage
- **Base64 Storage**: Secure file storage in Firestore (solved Firebase Storage CORS issues)
- **Multiple File Types**: Support for images, PDFs, Word documents, Excel spreadsheets
- **File Previews**: Image thumbnails and document icons
- **Download Functionality**: One-click file downloads from message history
- **Size Limits**: 5MB per file for optimal performance
- **Drag & Drop Interface**: Intuitive file upload experience

### 📊 Dashboard
- **Kanban Board**: Visual quote request organization by status and labels
- **Country Filtering**: View quote requests by user's assigned countries
- **Real-Time Messaging Panel**: Full-height messaging interface
- **Unread Message Tracking**: Notification system for new messages
- **Quote Request Statistics**: Overview cards showing counts and metrics
- **Country-based Bar Charts**: Visual representation of quote request distribution

### 🗄️ Archive System
- **Automatic Archiving**: Quote requests archived when status changes to Won/Lost/Cancelled
- **Message History Preservation**: Complete conversation history maintained in archives
- **File Access Retention**: All shared files remain downloadable in archived requests
- **Archive Indicators**: Visual cues showing message count for archived requests
- **Read-Only Mode**: Archived messaging displayed but no new messages allowed

### 🔐 User Management & Permissions
- **Role-Based Access**: Admin, SuperAdmin, ReadOnly user roles
- **Country Assignment**: Users assigned to specific countries
- **Permission Controls**: Edit restrictions based on user role and country
- **Authentication**: Firebase Authentication integration

## 🏗️ Technical Architecture

### Frontend Stack
- **Next.js 15.3.3** - React framework with server-side rendering
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Material-UI** - Component library for forms and inputs

### Backend & Database
- **Firebase Firestore** - NoSQL database for real-time data
- **Firebase Authentication** - User authentication and authorization
- **Base64 File Storage** - Files stored as base64 strings in Firestore documents

### Key Components

#### Messaging Components
- `DashboardMessagingPanel.tsx` - Main messaging interface in dashboard
- `ArchivedMessaging.tsx` - Read-only message history for archived requests
- `DashboardFileSharing.tsx` - File upload component with drag & drop
- `MessageHistoryIndicator.tsx` - Shows message count for archived requests

#### File Management
- `FileUploadSimple.tsx` - Base64 file upload for quote request attachments
- File preview and download functionality integrated throughout

#### Data Structure
```
quoteRequests/{id}/
├── messages/{messageId}     # Real-time messaging
├── attachments[]            # Quote request file attachments
├── products[]               # Product specifications
├── notes[]                  # Internal notes
└── labels[]                 # Status and priority labels
```

## 🎯 Key Workflows

### 1. Quote Request Lifecycle
1. **Creation** → New quote request with customer/country details
2. **Active Communication** → Real-time messaging with file sharing in Dashboard
3. **Status Updates** → Progress tracking with permission controls
4. **Archival** → Automatic archiving with message history preservation

### 2. Messaging Flow
1. **Dashboard Access** → Users navigate to Dashboard messaging panel
2. **Quote Selection** → Choose specific quote request conversation
3. **Real-Time Chat** → Send messages with optional file attachments
4. **File Sharing** → Drag & drop files with instant preview and download
5. **History Preservation** → All messages archived when quote request closes

### 3. File Sharing Process
1. **Upload Interface** → Drag & drop or click to browse files
2. **Type Validation** → Support for images, PDFs, Word, Excel documents
3. **Size Check** → 5MB limit with user feedback
4. **Base64 Conversion** → Files converted and stored securely
5. **Message Integration** → Files attached to messages with previews

## 🔧 Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase project with Firestore and Authentication enabled

### Environment Configuration
Create `.env.local` with Firebase configuration:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Installation
```bash
npm install
npm run dev
```

## 📱 User Interface

### Dashboard Layout
- **Left Panel**: Kanban board with quote request cards
- **Right Panel**: Full-height messaging interface
- **Top Navigation**: User profile and navigation menu
- **Filtering**: Country, label, customer, and user filters

### Messaging Interface
- **Quote Request List**: Conversation selector with unread indicators
- **Chat Window**: Real-time messaging with file attachments
- **File Upload**: Drag & drop area with type-specific buttons
- **Message History**: Scrollable timeline with sender identification

### Quote Request Management
- **Form Layout**: Three-column grid (details, products/notes, messaging)
- **Status Controls**: Dropdown with permission-based editing
- **Label System**: Visual tags for priority and status
- **Archive View**: Read-only access with preserved message history

## 🔄 Recent Updates

### Archive System Implementation
- Added `ArchivedMessaging.tsx` component for viewing historical conversations
- Implemented message preservation for Won/Lost/Cancelled quote requests
- Created `MessageHistoryIndicator.tsx` for archive overview
- Enhanced quote request detail pages with archive-aware messaging

### Messaging System Refinement
- Removed General Communication (per user request)
- Focused messaging on quote request-specific conversations
- Improved full-height dashboard layout
- Enhanced file sharing with better UI/UX

### File Storage Solution
- Resolved Firebase Storage CORS issues by implementing base64 storage
- Maintained all file sharing functionality with Firestore integration
- Ensured file preservation in archived message history

## 🎨 Design Principles

- **Country-Centric**: All functionality organized around country-to-country communication
- **Real-Time First**: Immediate updates and live collaboration
- **Archive Preservation**: Complete audit trail maintenance
- **Permission-Aware**: Role and country-based access controls
- **File-Friendly**: Seamless document and image sharing
- **Mobile-Responsive**: Optimized for various screen sizes

## 🚀 Future Enhancements

- Email notifications for new messages
- Advanced file management with folders
- Export functionality for archived conversations
- Enhanced reporting and analytics
- Mobile application development
- Integration with external CRM systems

## 📞 Support

For technical support or feature requests, please refer to the project documentation or contact the development team.

---

**LoxConnect Pro** - Connecting countries, streamlining quotes, preserving communications.
