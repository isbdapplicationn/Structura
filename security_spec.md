# Security Specification — Universal Data Entry App Builder

## 1. Data Invariants
1. Every Application (`/apps/{appId}`) must have a valid `ownerId` matching the authenticated creator's `request.auth.uid`, a bounded `slug`, and a valid `status` (`draft | published | archived`).
2. Every Form, DatabaseTable, DataRecord, and FilterPreset inside `/apps/{appId}/...` must carry `appId == appId` and `appOwnerId` matching the parent application's `ownerId`.
3. Only the Bootstrapped Super Admin (`najmulislamn1990@gmail.com` verified) can promote or modify another user's platform role in `/users/{userId}` or list all platform users.
4. Users cannot escalate their own `role` during profile creation or profile updates.
5. Public anonymous submissions to `/apps/{appId}/records/{recordId}` are strictly permitted ONLY when `isPublicSubmission == true` AND `/publicApps/{publicSlug}` exists with matching `appId`. Public visitors cannot read, list, update, or delete records.
6. Audit logs in `/auditLogs/{logId}` are append-only (`update` and `delete` strictly forbidden).
7. All document IDs must satisfy `^[a-zA-Z0-9_\-]+$` with length `<= 128`.
8. All timestamps (`createdAt`, `updatedAt`) are strictly verified against `request.time`.
