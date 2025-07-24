# LoxConnect Pro - System Architecture and Functionality

## Quick Reference
When discussing improvements or changes with the AI assistant, reference this document by mentioning:
"Please refer to LOXCONNECT_PRO_ARCHITECTURE.md for context on [specific area]"

## Last Updated
July 2025

## Core Systems

### 1. Authentication & User Management
- **Firebase Authentication Integration**
- **User Profile Structure**
  - Storage: Firestore 'users' collection
  - Lookup Methods:
    - Primary: By UID
    - Fallback: By email
  - Required Fields:
    - id (string)
    - email (string)
    - role (string)
    - businessUnit? (string)
    - countries? (string[])
  - Profile Loading Protection
    - Prevents premature component rendering
    - Tracks loading status

### 2. Quote Request System
#### Core Features
- Quote Request Creation
- Status Management
  - In Progress
  - Won
  - Lost
  - Cancelled
  - Snoozed
- Cross-Country Communication
- File Attachments
- Product Catalog (catClass system)
- Jobsite Management with Coordinates
- Customer Management with Country-Specific Numbers

### 3. Label System
#### Special Labels (Boolean Flags)
- **waitingForAnswer**
  - Color: Yellow (bg-yellow-100)
  - Action: Moves to "Waiting" column
- **urgent**
  - Color: Red (bg-red-100)
  - Action: Moves to "Urgent" column
- **problems**
  - Color: Orange (bg-orange-100)
  - Action: Moves to "Problems" column
- **planned**
  - Color: Red (bg-red-100)
  - Action: Appears in Planning menu

#### Label Change Actions
1. Immediate Firestore updates
2. Notifications for involved countries
3. UI state updates
4. Dashboard column movements

### 4. Messaging & Notifications
#### Dashboard Notifications
- Real-time activity container
- Recent activity from other countries
- Unread indicators

#### Messaging Features
- Real-time chat functionality
  - Dashboard integration
  - Quote Request integration
- File attachment support
- Message history tracking
- Type-checked file handling
- Message styling (sent/received)
- Timestamp formatting

### 5. Database Structure
#### Quote Requests Collection
- **Key Fields**
  - creatorCountry (string)
  - involvedCountry (string)
  - products (array with catClass)
  - status (string)
  - labels (array)
  - attachments (array)

### 6. Business Unit & Country Management
#### User Profile Configuration
- **Option 1:** businessUnit field (string)
- **Option 2:** countries array
- Helper Function: getBusinessUnit
  - Primary: Uses businessUnit field
  - Fallback: First country from array

### 7. Cross-Country Communication
#### Notification Types
- Status changes
- Label changes
- Product modifications
- Date changes
- Notes/attachment updates

#### Target Country Logic
- Creator → Notify involved country
- Involved country → Notify creator
- Uses creatorCountry/involvedCountry fields

### 8. Technical Implementation
- **Framework:** Next.js with TypeScript
- **Backend:** Firebase/Firestore
- **Real-time Updates:** Firebase listeners
- **Rendering Strategy:**
  - Client-side for dynamic components
  - SSR protection for Firebase dependencies
- **Error Handling:** Comprehensive
- **Design:** Mobile-responsive
- **Deployment:** Production-optimized

### 9. Security Features
- Role-based access control
- Country-specific permissions
- Secure file storage
- Protected API endpoints
- Environment variable management
- Cross-country data isolation

### 10. UI/UX Features
- Modern responsive design
- Loading states
- Error handling
- Real-time updates
- File upload capabilities
- Form validation
- Dashboard organization
- Visual status indicators

## Architecture Principles
1. Separation of concerns
2. Secure data handling
3. Real-time communication
4. Scalable business logic
5. Cross-country collaboration
6. Efficient file management
7. User-friendly interface
8. Robust error handling
9. Performance optimization
10. Maintainable codebase

## Strengths
- Cross-country communication
- Document management
- Business unit separation
- Access control
- Real-time updates
- User experience

## Version History
- July 2025: Initial deployment with core functionality
  - Firebase integration
  - Quote request system
  - Messaging system
  - Label management
  - Cross-country communication

## How to Reference This Document
When working with the AI assistant:
1. Start your prompt with: "Referring to LOXCONNECT_PRO_ARCHITECTURE.md..."
2. Specify the section you're discussing: "...regarding [section name]..."
3. Describe your intended changes or questions

Example:
"Referring to LOXCONNECT_PRO_ARCHITECTURE.md regarding the Label System, I want to add a new label type for urgent requests..." 