
# 🛡️ Cursor AI Safe Development Workflow for LoxConnect PRO

This guide defines a stable development strategy inside Cursor AI to prevent accidental regressions and allow easy rollbacks.

---

## ✅ 1. Reference Branch Setup (Git)

Create a persistent reference branch that reflects your last working production deployment.

```bash
git checkout -b main-stable
git push origin main-stable
```

Update it manually after stable releases:

```bash
git checkout main-stable
git merge main
git push origin main-stable
```

This branch will act as a safety fallback.

---

## ✅ 2. Snapshot Directory (Code-based backup)

Create a `snapshots/` folder inside `src/` for storing critical stable file versions.

Example files:
```
src/snapshots/dashboard-stable.tsx
src/snapshots/quote-request-edit-stable.tsx
src/snapshots/MessagingPanel-stable.tsx
```

> Use these files as direct fallbacks in Cursor:
> “Replace MessagingPanel with the version in `src/snapshots/MessagingPanel-stable.tsx`”

---

## ✅ 3. Document Known-Good Layouts

Use your `Cursor_Context_LoxConnectPRO.md` file to describe:
- Page layouts
- Shared components and limitations
- Styling expectations (e.g. "quote-request edit must be 3 columns")

Refer to this in every prompt:
> “Before making changes, check layout expectations in `Cursor_Context_LoxConnectPRO.md`.”

---

## ✅ 4. Pre-change Prompt for Cursor AI

When working on risky changes (e.g. Messaging, Firestore logic, Notification system), always start with:

```
Before making any changes, do the following:
- Save the current version of the affected file(s) in /src/snapshots/
- Compare planned changes against the structure in main-stable branch
- Maintain the layout and behavioral consistency described in Cursor_Context_LoxConnectPRO.md
Proceed only after confirming those references.
```

---

## 🧠 Example Prompts

```
I'm updating the MessagingPanel, but please check the version in main-stable and preserve the height constraint and reuse pattern in Dashboard and Quote Edit views.
```

```
Revert dashboard layout to the structure shown in src/snapshots/dashboard-stable.tsx. Then reapply only the styling changes needed for notifications.
```

```
Update saveChanges logic in quote-requests edit page, but DO NOT change the 3-column layout or MessagingPanel height.
```

---

## 🧯 Recovery Steps (if something breaks)
1. `git checkout main-stable` and compare changes
2. Copy from `/src/snapshots/...` to restore layout or logic
3. Reopen `Cursor_Context_LoxConnectPRO.md` and check layout specs
4. Redeploy only after local testing at `localhost:3000` confirms recovery

---

This file can be versioned or kept as `Cursor_SafeWorkflow_LoxConnectPRO.md` in the root directory.
