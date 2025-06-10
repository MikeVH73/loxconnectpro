# 🚀 Deployment Guide: GitHub → Vercel

## 📋 Pre-Deployment Checklist

### 1. **Storage Solution for Production**

#### **Option A: Firebase Storage (Recommended)**
Since we're using Vercel (serverless), Firebase Storage is the best choice:

```typescript
// src/lib/storage.ts
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebaseClient';

export const uploadFile = async (file: File, path: string): Promise<string> => {
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  return await getDownloadURL(snapshot.ref);
};

export const deleteFile = async (path: string): Promise<void> => {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
};
```

#### **Firebase Storage Rules (Production)**
```javascript
// Firebase Storage Security Rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Quote request files
    match /quote-requests/{quoteId}/messages/{messageId}/{fileName} {
      allow read, write: if request.auth != null;
    }
    
    // Quote request attachments
    match /quote-requests/{quoteId}/attachments/{fileName} {
      allow read, write: if request.auth != null;
    }
    
    // File size limit: 10MB
    allow write: if request.resource.size < 10 * 1024 * 1024;
  }
}
```

#### **Option B: Vercel Blob Storage**
```bash
npm install @vercel/blob
```

```typescript
// Alternative: Vercel Blob Storage
import { put, del } from '@vercel/blob';

export const uploadToVercelBlob = async (file: File): Promise<string> => {
  const blob = await put(file.name, file, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return blob.url;
};
```

## 🔧 **Environment Configuration**

### 1. **Firebase Setup for Production**
Create production Firebase project:
```bash
# Firebase CLI
npm install -g firebase-tools
firebase login
firebase init storage
```

### 2. **Environment Variables**
Create production environment variables in Vercel:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_production_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_production_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_production_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_production_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_production_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_production_app_id

# Optional: Vercel Blob
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

## 📤 **GitHub Deployment Steps**

### 1. **Prepare Repository**
```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit: LoxConnect Pro with messaging and file storage"

# Add GitHub remote
git remote add origin https://github.com/yourusername/loxconnect-pro.git
git push -u origin main
```

### 2. **Update .gitignore**
```gitignore
# Environment variables
.env
.env.local
.env.production

# Firebase
.firebase/
firebase-debug.log
firestore-debug.log

# Vercel
.vercel

# Dependencies
node_modules/
.next/

# Debug logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

### 3. **Production Configuration**

#### **Update Firebase Client for Production**
```typescript
// src/firebaseClient.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Only connect to emulators in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  // Connect to emulators if available
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099');
    connectStorageEmulator(storage, 'localhost', 9199);
  } catch (error) {
    // Emulators already connected or not available
  }
}
```

## 🌐 **Vercel Deployment Steps**

### 1. **Install Vercel CLI**
```bash
npm install -g vercel
```

### 2. **Deploy to Vercel**
```bash
# Login to Vercel
vercel login

# Deploy (first time)
vercel

# Follow prompts:
# - Set up and deploy: Y
# - Which scope: Select your account
# - Link to existing project: N
# - Project name: loxconnect-pro
# - Directory: ./
# - Override settings: N
```

### 3. **Configure Environment Variables in Vercel**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to Settings → Environment Variables
4. Add all Firebase configuration variables
5. Redeploy: `vercel --prod`

## 🔄 **Migration Strategy: Base64 → Firebase Storage**

### **Option 1: Gradual Migration**
Keep base64 for existing files, use Firebase Storage for new uploads:

```typescript
// src/components/FileUploadProduction.tsx
const handleFileUpload = async (file: File) => {
  try {
    // Use Firebase Storage for production
    if (process.env.NODE_ENV === 'production') {
      const storagePath = `quote-requests/${quoteRequestId}/messages/${Date.now()}_${file.name}`;
      const downloadURL = await uploadFile(file, storagePath);
      
      // Save message with Firebase Storage URL
      await addDoc(messagesRef, {
        // ... other message data
        file: {
          name: file.name,
          url: downloadURL,
          type: file.type,
          size: file.size,
          storagePath: storagePath
        }
      });
    } else {
      // Keep base64 for development
      const base64 = await convertToBase64(file);
      // ... existing base64 logic
    }
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

### **Option 2: Complete Migration**
Migrate all existing base64 files to Firebase Storage:

```typescript
// Migration script (run once)
const migrateBase64ToStorage = async () => {
  const messagesQuery = query(
    collectionGroup(db, 'messages'),
    where('file.url', '>=', 'data:')
  );
  
  const snapshot = await getDocs(messagesQuery);
  
  for (const doc of snapshot.docs) {
    const message = doc.data();
    if (message.file?.url?.startsWith('data:')) {
      // Convert base64 to blob and upload to Firebase Storage
      const blob = base64ToBlob(message.file.url);
      const file = new File([blob], message.file.name, { type: message.file.type });
      
      const storagePath = `migrated/${doc.id}/${message.file.name}`;
      const downloadURL = await uploadFile(file, storagePath);
      
      // Update document with new URL
      await updateDoc(doc.ref, {
        'file.url': downloadURL,
        'file.storagePath': storagePath
      });
    }
  }
};
```

## ⚡ **Performance Optimizations**

### 1. **File Upload Optimization**
```typescript
// Compress images before upload
import imageCompression from 'browser-image-compression';

const compressImage = async (file: File): Promise<File> => {
  if (file.type.startsWith('image/')) {
    return await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true
    });
  }
  return file;
};
```

### 2. **Lazy Loading**
```typescript
// Lazy load file components
const FilePreview = dynamic(() => import('./FilePreview'), {
  loading: () => <div>Loading...</div>
});
```

## 🔒 **Security Considerations**

### 1. **Firebase Security Rules**
```javascript
// Firestore Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their assigned countries' data
    match /quoteRequests/{requestId} {
      allow read, write: if request.auth != null && 
        resource.data.creatorCountry in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.countries ||
        resource.data.involvedCountry in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.countries;
    }
    
    // Messages within quote requests
    match /quoteRequests/{requestId}/messages/{messageId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 2. **CORS Configuration**
```json
// Firebase Storage CORS (cors.json)
[
  {
    "origin": ["https://your-domain.vercel.app"],
    "method": ["GET", "POST", "PUT", "DELETE"],
    "maxAgeSeconds": 3600
  }
]
```

Apply CORS:
```bash
gsutil cors set cors.json gs://your-firebase-storage-bucket
```

## 🎯 **Deployment Timeline Recommendation**

### **Phase 1: Basic Deployment (Week 1)**
1. ✅ Push to GitHub
2. ✅ Deploy to Vercel with current base64 storage
3. ✅ Configure environment variables
4. ✅ Test basic functionality

### **Phase 2: Storage Migration (Week 2)**
1. 🔄 Implement Firebase Storage
2. 🔄 Test file upload/download
3. 🔄 Deploy storage updates
4. 🔄 Monitor performance

### **Phase 3: Optimization (Week 3)**
1. ⚡ Add file compression
2. ⚡ Implement lazy loading
3. ⚡ Performance monitoring
4. ⚡ Security audit

## 🚨 **Monitoring & Maintenance**

### 1. **Error Monitoring**
```typescript
// Add error tracking
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
});
```

### 2. **Analytics**
```typescript
// Add usage analytics
import { analytics } from './firebaseClient';
import { logEvent } from 'firebase/analytics';

logEvent(analytics, 'file_upload', {
  file_type: file.type,
  file_size: file.size,
  quote_request_id: quoteRequestId
});
```

## 📊 **Cost Considerations**

### **Firebase Storage Pricing (Approximate)**
- Storage: $0.026/GB per month
- Downloads: $0.12/GB
- Operations: $0.05 per 100k operations

### **Vercel Blob Pricing**
- Free tier: 1GB storage + 100GB bandwidth
- Pro: $20/month for 100GB storage + 1TB bandwidth

**Recommendation**: Start with Firebase Storage for seamless integration with existing Firebase setup.

---

## 🎯 **Next Steps**

1. **Immediate**: Push to GitHub and deploy basic version to Vercel
2. **Short-term**: Implement Firebase Storage for new uploads
3. **Long-term**: Migrate existing base64 files and optimize performance

This approach ensures smooth deployment while maintaining all current functionality! 🚀 