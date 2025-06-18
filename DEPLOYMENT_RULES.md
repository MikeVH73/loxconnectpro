# 🚀 LoxConnect Pro Deployment Rules

## Client/Server Component Rules

1. **Error Boundaries Must Be Client Components**
   - Always mark error boundary components with `'use client'`
   - Never use error boundaries directly in server components
   - Create a client wrapper component (e.g., `ClientLayout`) to use error boundaries

2. **Component Architecture**
   ```
   Root Layout (Server) 
   └── ClientLayout ('use client')
       └── ErrorBoundary
           └── AuthProvider ('use client')
               └── ConditionalLayout ('use client')
                   └── Page Content
   ```

3. **Firebase Initialization**
   ```typescript
   // Always initialize Firebase only on the client side
   let app;
   let db;
   let auth;
   let storage;

   if (typeof window !== 'undefined') {
     app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
     db = getFirestore(app);
     auth = getAuth(app);
     storage = getStorage(app);
   }
   ```

## Deployment Process

1. **Code Changes**
   ```bash
   # 1. Make code changes
   # 2. Add changes to git
   git add .
   
   # 3. Commit with descriptive message
   git commit -m "descriptive message"
   
   # 4. Push to main branch
   git push origin main
   ```

2. **Vercel Deployment**
   - Automatic deployment triggers when pushing to main
   - No need to run manual Vercel commands
   - Check build logs in Vercel dashboard for errors

## Common Issues & Solutions

1. **Server Component Errors**
   - Error: "'ssr: false' is not allowed with 'next/dynamic' in Server Components"
   - Solution: Move dynamic imports to client components

2. **Firebase Errors**
   - Error: "FirebaseError: Firebase: Error (auth/invalid-api-key)"
   - Solution: Check environment variables in Vercel dashboard

3. **Build Errors**
   - Error: "You're importing a class component. It only works in a Client Component"
   - Solution: Create a client wrapper component and move class components there

## Environment Setup

1. **Required Environment Variables**
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   NEXT_PUBLIC_FIREBASE_APP_ID=
   ```

2. **File Structure**
   ```
   src/
   ├── app/
   │   ├── components/
   │   │   ├── ErrorBoundary.tsx ('use client')
   │   │   └── ClientLayout.tsx ('use client')
   │   ├── AuthProvider.tsx ('use client')
   │   ├── ConditionalLayout.tsx ('use client')
   │   └── layout.tsx (server)
   └── firebaseClient.ts
   ```

## Best Practices

1. **Component Organization**
   - Keep client/server component separation clear
   - Use wrapper components for client-side functionality
   - Place shared components in `components` directory

2. **Error Handling**
   - Always wrap app with error boundary
   - Handle Firebase errors gracefully
   - Provide user-friendly error messages

3. **Performance**
   - Use client components only when necessary
   - Keep server components for static/non-interactive UI
   - Properly handle loading states

## Deployment Checklist

✅ All client components marked with 'use client'
✅ Firebase initialization in client-side only
✅ Error boundaries wrapped in client components
✅ Environment variables set in Vercel
✅ Git changes committed and pushed
✅ Build logs checked for errors

## Quick Fix Commands

```bash
# Fix and deploy
git add .
git commit -m "Fix: description of the fix"
git push origin main

# Check build status
# Go to Vercel dashboard -> Project -> Deployments
```

Remember: Always check the Vercel build logs for errors before making additional changes! 