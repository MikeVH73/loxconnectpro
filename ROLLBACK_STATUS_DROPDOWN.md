# ROLLBACK DOCUMENTATION: Status Dropdown in New QR Form

## Current Implementation (Before Change)

### File: `src/app/quote-requests/new/page.tsx`

**Current Status Dropdown Implementation:**
```typescript
// Line 96: Status state initialization
const [status, setStatus] = useState<StatusType>("New");

// Line 81: Available statuses
type StatusType = "New" | "In Progress" | "Snoozed" | "Won" | "Lost" | "Cancelled";
const statuses: StatusType[] = ["New", "In Progress", "Won", "Lost", "Cancelled"];

// Lines 360-373: Status dropdown in form
<div>
  <label className="block text-sm font-medium text-gray-700">Status</label>
  <select
    value={status}
    onChange={(e) => setStatus(e.target.value as StatusType)}
    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
  >
    {statuses.map((s) => (
      <option key={s} value={s}>
        {s}
      </option>
    ))}
  </select>
</div>

// Line 294: Status saved in quoteRequestData
const quoteRequestData = {
  // ... other fields
  status,
  // ... other fields
};
```

### Current Behavior:
- ✅ Creator can select any status when creating QR
- ✅ Default status is "New"
- ✅ Status is saved to Firestore
- ✅ Dashboard shows "NEW" pill for status="New" QRs
- ✅ Analytics counts "New" QRs correctly

### Issue Identified:
- ❌ Creator can change status from "New" to other statuses
- ❌ This removes the "NEW" visual indicator for involved country
- ❌ Involved country loses the signal that this is a fresh request

## Proposed Change: Lock Status to "New"

### Implementation Plan:
1. Remove status dropdown from new QR form
2. Set status to "New" automatically
3. Add informational text about status locking
4. Allow status changes only in edit page after creation

### Rollback Instructions:
If rollback is needed, restore the status dropdown by:
1. Re-add the status dropdown HTML (lines 360-373)
2. Keep the status state management (line 96)
3. Keep the statuses array (line 81)
4. Keep the status in quoteRequestData (line 294)

### Files to Modify:
- `src/app/quote-requests/new/page.tsx` - Remove status dropdown
- `SYSTEM_REFERENCE.md` - Update documentation

### Testing Checklist:
- [ ] New QR creation sets status to "New" automatically
- [ ] No status dropdown visible in new QR form
- [ ] Dashboard shows "NEW" pill for new QRs
- [ ] Edit page still allows status changes
- [ ] Analytics correctly counts "New" QRs
- [ ] All existing functionality preserved

## Commit Hash Before Change:
Current HEAD: bf889de91513b7e6d8bf44d49ca52b583b87828b
