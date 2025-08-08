# LoxConnect PRO Business Rules

## Quote Request Visibility Rules

### Basic Visibility
- A user can only see quote requests where their assigned country matches either:
  - The creator country OR
  - The involved country
- This rule applies to ALL users regardless of their role (superAdmin, admin, Employee)
- If a user has no countries assigned (rare case), they can see all quote requests

### Country Names
- Country names must match exactly (e.g., "Loxcall France", "Ramirent Finland")
- Some business units have different prefixes:
  - Loxcall units use "Loxcall" prefix (e.g., "Loxcall France")
  - Ramirent units have their own prefix
- The prefix is part of the country name and must match exactly

### Dashboard Filtering
- The country filter dropdown only shows countries that the user has access to
- When filtering by country, it uses exact matches against creator and involved countries
- Labels, customers, and other filters work independently of country visibility rules

## User Roles and Permissions

### Available Roles
- superAdmin: Can manage users and countries, but follows same quote request visibility rules
- admin: Can manage users within their assigned countries
- Employee: Can only view content, cannot create/edit

### Country Assignment
- Users must be assigned to specific countries
- A user can be assigned to multiple countries
- Country assignments determine which quote requests they can see
- Country assignments are managed by admins and superAdmins

## Quote Request States

### Status Types
- In Progress: Active quote requests
- Snoozed: Temporarily paused
- Won: Successfully completed
- Lost: Not successful
- Cancelled: Terminated before completion

### Dashboard Categories
1. Urgent & Problems
   - Quote requests with "urgent" or "problems" labels
2. Waiting
   - Quote requests with "waiting for answer" label
3. Standard
   - All other active quote requests
4. Snoozed
   - Quote requests marked as snoozed

## Messaging System

### Message Visibility
- Messages are tied to quote requests
- Users can only see messages in quote requests they have access to
- Both creator country and involved country users can see all messages

### Unread Messages
- Blue dot indicator shows unread messages
- Messages are marked as read when viewed
- "New message" text appears alongside blue dot

## File Attachments

### File Rules
- Maximum size: 3MB per file
- Supported formats: Images, PDF, Word, Excel, text files
- Files are stored in Firebase Storage
- Files inherit the same visibility rules as their parent quote request

## Data Consistency

### Country Management
- Countries are managed centrally
- Country names must be consistent across:
  - User profiles
  - Quote requests (both creator and involved)
  - Business units
- Changing a country name updates all references automatically

### Audit Trail
- All changes to quote requests are logged
- Status changes are tracked
- Message history is preserved
- File upload history includes uploader and timestamp 