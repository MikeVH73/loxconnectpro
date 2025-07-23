
# 🧠 Cursor AI Context File for LoxConnect PRO

This file provides an overview of the structure and dependencies of the LoxConnect PRO application so Cursor AI can work more effectively across the codebase.

---

## 🏗 Project Stack
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Authentication + Firestore)
- **Deployment**: Vercel
- **Languages**: TypeScript + React

---

## 🔐 Authentication & Setup Files
- `src/firebaseClient.ts` → Firebase config & exports: `auth`, `db`, `app`
- `src/app/AuthProvider.tsx` → Auth context provider using `firebase/auth`
- `.env.local` → Contains environment-specific Firebase credentials

---

## 📦 Firestore Collections
Used across components and pages:

| Collection     | Description                                      |
|----------------|--------------------------------------------------|
| `quoteRequests`| All customer quote requests                      |
| `messages`     | Chat messages (linked to `quoteRequestId`)       |
| `customers`    | Company data for dropdowns                       |
| `labels`       | Tags for status/urgency                          |
| `users`        | User profile info with countries, roles, etc.    |

---

## 🧩 Key Components & Pages

### 1. Dashboard (`src/app/dashboard/page.tsx`)
- Displays quote requests in a Kanban layout (Urgent, Waiting, Standard, Snoozed)
- Integrates with `DashboardMessaging` (panel opens per request)
- Filters by label, customer, country

### 2. Quote Request Edit (`src/app/quote-requests/[id]/edit/page.tsx`)
- 3-column layout: form in the middle, messaging panel right
- MessagingPanel must be max-height limited to prevent layout breaks
- saveChanges function tracks changes to:
  - Status, flags (urgent, waiting, problems)
  - Product details (Cat-Class/quantity)
  - Start and end dates
  - Notes (added/removed/modified)

### 3. Messaging Panel (`src/app/components/MessagingPanel.tsx`)
- Reused in both Dashboard and Quote Request pages
- Must behave like WhatsApp (scrollable messages, always visible input)
- Depends on `quoteRequestId` passed in via props

### 4. Archived Messaging (`src/app/components/ArchivedMessaging.tsx`)
- Renders previous discussions from archived quote requests

### 5. Shared Layout
- `src/app/layout.tsx` wraps the app in `ClientLayout`
- Tailwind used globally via `globals.css`

---

## 🔔 Notifications System

### Creation
- Implemented in: `src/app/quote-requests/[id]/edit/page.tsx`
- Located inside the `saveChanges` function
- Triggers notifications when the following properties change:
  - Status
  - Waiting for answer flag
  - Urgent flag
  - Problems flag
  - Products (Cat-Class and quantity)
  - Dates (Start/End)
  - Notes (added, removed, or modified with deep comparison)

### Notification Types & Styling
| Type              | Trigger                                 | Style (UI)     |
|-------------------|------------------------------------------|----------------|
| 💬 Message         | New chat message                         | Green background |
| 🔄 Status Change   | Change in status (e.g. In Progress)      | Yellow background |
| ✏️ Property Update | Any field/property updated (as above)    | Purple background |

### Display Locations
- **Dashboard** → `src/app/dashboard/page.tsx`
  - Unread notifications shown with distinct styling per type
- **Notifications Page** → `src/app/notifications/page.tsx`
  - All notifications with full details, sorted

### Example Notification
> ✏️ Property Update from [Country]: Updated 1 product (Cat-Class/quantity changes), Start date changed to [new date]

---

## ⚠️ Common Issues to Avoid
- ❌ Messaging panel overflowing edit layout (no max-height)
- ❌ Breaking dashboard layout by adding conflicting grid/flex rules
- ❌ Forgetting shared use of MessagingPanel in multiple routes

---

## ✅ Production Reference
- Last known good commit: `71a4863` (based on Vercel Production deployment)

---

## 🔄 Example Prompts for Cursor
```
Fix a messaging bug, but do not alter the 3-column layout in quote-request edit page.
Refer to how MessagingPanel is used in both dashboard and quote-request edit routes.
```
```
Add country selection to quote request form, using `userProfile.countries`.
Use the structure and style from existing label and customer dropdowns in the dashboard.
```
```
Before adding new chat features, check `MessagingPanel.tsx`, `DashboardMessaging.tsx` and `ArchivedMessaging.tsx`. Maintain layout consistency.
```

---

## 📌 Recent Additions & Fixes (June 25 Session)

### Notifications Panel in Quote Request Edit Page
- **Component**: `QuoteRequestNotifications.tsx`
- **Placement**: Below Labels section
- **Styling**:
  - Max height of 300px with scroll
  - Matches Dashboard notification styling (colors, badges, hover)
  - `mt-6` margin for spacing
- **Features**:
  - Client-side sorting of notifications
  - Safe handling of missing timestamps
  - Loading animation added
  - No need for Firebase composite index

### Notification Types Expanded
- **Product Changes**:
  - Differentiates between Cat-Class and Quantity changes
  - Tracks added products separately
  - Notification messages updated:
    - “Updated quantities for X products”
    - “Updated Cat-Class for X products”
    - “Added new products”

- **Date Changes**:
  - Added null checks and formatting improvements
  - Resilient against invalid dates

### Layout & UX Consistency
- Maintained strict 3-column layout in quote-request edit page
- Styling follows `Cursor_Context_LoxConnectPRO.md` guidelines
- Hover effects, badge colors, transitions consistent across all pages

### Google Maps Integration Fixes
- Root cause: `ChunkLoadError` from multiple script injections
- Fixes applied:
  - Centralized loading in `utils/maps.ts` with retry logic
  - Removed duplicate `<script>` inserts
  - Added cleanup for map scripts on component unmount
  - Retry mechanism: 3 attempts, 1-second delay
  - Updated Content Security Policy in `next.config.js`
  - Added type definitions: `types/google-maps.d.ts`
  - Switched loading to `"lazyOnload"` in `layout.tsx`

> ✅ The fix improves error handling, eliminates layout shifting, ensures type safety, and uses best practices for 3rd party scripts in Next.js.
