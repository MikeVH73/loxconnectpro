# 🌍 LoxConnect Pro

**Professional Quote Request Management System with Real-time Messaging**

LoxConnect Pro is a comprehensive business management platform designed for international operations, enabling seamless quote request management, real-time messaging between countries, and efficient project tracking.

## ✨ Features

### 🎯 **Core Functionality**
- **Quote Request Management** - Create, edit, and track quote requests between countries
- **Real-time Messaging** - Instant communication within quote request contexts
- **File Sharing** - Upload and share documents, images, and files within conversations
- **User Management** - Role-based access control with country-specific permissions
- **Dashboard Analytics** - Visual overview with Kanban-style project organization

### 🔐 **Authentication & Security**
- **Firebase Authentication** - Secure user authentication with email/password
- **Role-based Access** - ReadOnly, Admin, and SuperAdmin roles
- **Country-based Filtering** - Users only see relevant data for their assigned countries
- **Password Management** - Users can change passwords with current password verification

### 💬 **Advanced Messaging**
- **Quote Request Conversations** - Organized messaging within specific projects
- **File Attachments** - Support for images, PDFs, Word docs, Excel files (5MB limit)
- **Read Receipts** - Track message status and unread counts
- **Real-time Notifications** - Instant updates with sound notifications
- **Message Archiving** - Preserve conversation history for completed projects

### 📊 **Project Management**
- **Kanban Board** - Organize projects by Urgent/Problems, Standard, Waiting, and Snoozed
- **Smart Filtering** - Filter by labels, customers, countries, and users
- **Status Tracking** - In Progress, Won, Lost, Cancelled, Snoozed statuses
- **Customer Management** - Centralized customer information and relationships

## 🛠️ Tech Stack

- **Frontend**: Next.js 15.3.3 with TypeScript
- **Styling**: Tailwind CSS 4.0 + Material-UI components
- **Database**: Firebase Firestore (NoSQL)
- **Authentication**: Firebase Auth
- **File Storage**: Base64 encoding (Firebase Storage ready)
- **Real-time**: Firebase real-time listeners
- **Deployment**: Vercel (automatic GitHub deployment)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Firebase project with Firestore and Authentication enabled
- Git for version control

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/MikeVH73/loxconnectpro.git
   cd loxconnectpro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file with your Firebase configuration:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Firebase Setup**
   - Enable Authentication with Email/Password provider
   - Create Firestore database
   - Set up the following collections: `users`, `quoteRequests`, `customers`, `labels`, `countries`

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
src/
├── app/
│   ├── components/          # Reusable UI components
│   │   ├── DashboardFileSharing.tsx
│   │   ├── MessagingWithFiles.tsx
│   │   └── ArchivedMessaging.tsx
│   ├── dashboard/           # Dashboard pages and components
│   │   ├── page.tsx         # Main dashboard with Kanban board
│   │   └── DashboardMessagingPanel.tsx
│   ├── users/               # User management
│   │   ├── page.tsx         # User management page
│   │   └── profile/         # User profile settings
│   ├── quote-requests/      # Quote request management
│   ├── customers/           # Customer management
│   ├── archived/            # Archived projects
│   ├── login/               # Authentication pages
│   ├── AuthProvider.tsx     # Authentication context
│   ├── Sidebar.tsx          # Navigation sidebar
│   └── layout.tsx           # Root layout
├── firebaseClient.ts        # Firebase configuration
└── globals.css              # Global styles
```

## 🎮 Usage Guide

### **For Administrators**

1. **User Management**
   - Navigate to Users page
   - Create new users with email, password, role, and country assignments
   - Users automatically get Firebase Authentication accounts

2. **System Configuration**
   - Manage countries in the Countries section
   - Create and organize labels for project categorization
   - Set up customer information

### **For Regular Users**

1. **Dashboard Overview**
   - View assigned quote requests in Kanban format
   - Use filters to find specific projects
   - Monitor urgent items and waiting projects

2. **Messaging**
   - Select a quote request to start messaging
   - Share files by dragging and dropping
   - Real-time communication with other countries

3. **Profile Management**
   - Access Profile from sidebar
   - Change password securely
   - View account information

## 🚀 Deployment

### **Automatic Deployment (Recommended)**
The project is configured for automatic deployment via GitHub + Vercel:

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```

2. **Vercel automatically deploys** - Monitor at [vercel.com](https://vercel.com)

### **Manual Deployment**
```bash
# Build the project
npm run build

# Deploy to Vercel
vercel --prod

# Or deploy to Firebase Hosting
firebase deploy
```

## 🔧 Configuration

### **Firebase Security Rules**

**Firestore Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Quote requests accessible by assigned countries
    match /quoteRequests/{requestId} {
      allow read, write: if request.auth != null;
      
      // Messages within quote requests
      match /messages/{messageId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

**Storage Rules:**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /quote-requests/{requestId}/files/{fileName} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API Key | ✅ |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | ✅ |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project ID | ✅ |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | ✅ |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Sender ID | ✅ |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase App ID | ✅ |

## 🐛 Troubleshooting

### **Common Issues**

1. **Authentication Errors**
   - Verify Firebase configuration
   - Check if Email/Password provider is enabled
   - Ensure environment variables are set correctly

2. **Permission Issues**
   - Verify user roles and country assignments
   - Check Firestore security rules
   - Ensure user is logged in properly

3. **Messaging Not Working**
   - Check Firestore connection
   - Verify quote request permissions
   - Ensure real-time listeners are properly configured

## 📊 System Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Browser**: Modern browsers with ES6+ support
- **Firebase**: Active project with Firestore and Auth enabled

## 🔒 Security Features

- **Input Validation**: All user inputs are sanitized and validated
- **Role-based Access**: Granular permissions based on user roles
- **Country Filtering**: Users only access data relevant to their assigned countries
- **Secure Authentication**: Firebase Auth with password requirements
- **File Upload Limits**: 5MB limit with type restrictions

## 📈 Performance

- **Real-time Updates**: Efficient Firebase listeners for instant updates
- **Optimized Queries**: Indexed Firestore queries for fast data retrieval
- **Lazy Loading**: Components loaded on demand
- **Caching**: Efficient data caching for improved performance

## 📞 Support

For technical support or feature requests:
- Create an issue on GitHub
- Contact the development team
- Review the troubleshooting guide above

## 📄 License

This project is proprietary software developed for LOXAM operations.

---

**Built with ❤️ for global business operations**

*Last updated: January 2025*
