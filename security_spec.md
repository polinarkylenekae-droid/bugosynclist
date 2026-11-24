# Firestore Security Specification (FCM & Push Dispatch)

## 1. Data Invariants
- Every document in `/fcm_tokens/{tokenId}` belongs strictly to the authenticated user (`uid == request.auth.uid`) with a verified email (`request.auth.token.email_verified == true`), valid PH mobile number (`^(\+?63|0)9[0-9]{9}$`), bounded token length (`20..512`), and server-enforced timestamps (`request.time`).
- Every document in `/fcm_dispatches/{dispatchId}` can only be created by an admin (`isAdmin()`) with strict key/size/status checks and server timestamps, and read only by the recipient (`recipientUid == request.auth.uid`) or an admin.
- `/admins/{uid}` is read-only for the admin user themselves and writable only by an existing bootstrapped admin.
- `/test/connection` allows read-only connection checks (`getDocFromServer`) with zero writes allowed.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated write to `/fcm_tokens/tok1`
2. Unverified email (`email_verified: false`) attempting create on `/fcm_tokens/tok1`
3. Spoofed `uid` (`uid: "other-user"`) on `/fcm_tokens/tok1` create
4. Ghost field (`isAdmin: true`) injected in `/fcm_tokens/tok1`
5. Oversized ID (`tokenId` > 128 chars or invalid chars) on `/fcm_tokens/{tokenId}`
6. Non-PH phone number (`contactNumber: "12345"`) in `/fcm_tokens/tok1`
7. Client-forged `createdAt` timestamp not equal to `request.time`
8. Owner attempting to mutate immutable `uid` or `createdAt` on `/fcm_tokens/tok1` update
9. Non-owner resident attempting `get` or `list` on another resident's `/fcm_tokens` PII
10. Non-admin resident attempting to create `/fcm_dispatches/disp1`
11. Status transition bypass / terminal status overwrite (`Sent` -> `Queued`) by non-admin on `/fcm_dispatches/disp1`
12. Privilege escalation attempt creating `/admins/{uid}` by non-admin user
