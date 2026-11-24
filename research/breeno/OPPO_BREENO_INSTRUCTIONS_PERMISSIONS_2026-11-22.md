# OPPO Find X6 Pro — Breeno companion permissions evidence

Date: 2026-11-22
Device context: OPPO Find X6 Pro / PGEM10 / ColorOS 16.0.5 / Android 16 (user-supplied Settings screenshots).
Evidence source: three screenshots supplied by the device owner. This document records only visible settings; it does not infer hidden manifest permissions, package IDs or actual runtime behavior.

## App identity

The screenshots show **Инструкции Breeno** (Breeno Instructions), version:

`17.7.2_91aa93e_261102`

This is a distinct app identity from:
- Breeno: `13.4.3_08c04e4_261110`
- Breeno Memory: `16.11.5_008719b_260901`

Do not merge these three apps into one package or assume their permissions are interchangeable.

## Special access visible

| Setting | Observed state |
|---|---|
| Usage data access | Denied |
| Display over other apps | Allowed |
| Display pop-up windows while apps run in background | Allowed |
| Alarms and reminders | Allowed |

## Runtime / app permission screen visible

**Allowed:**
- Read clipboard
- Write clipboard (UI label is truncated after “Разрешено пр...” in the screenshot; exact scope wording is not fully visible)
- Device motion and orientation

**Denied:**
- Create home-screen shortcuts
- SMS
- Location
- Nearby devices
- Phone
- Notifications
- Read app list

The screen also shows automatic permission revocation for unused apps enabled. This is a setting state, not proof that any permission has already been revoked.

## “Other permissions” detail screen

| Permission | Observed state |
|---|---|
| Read phone status | Denied |
| Read SMS and MMS | Denied |
| Receive SMS | Denied |

## What can and cannot be concluded

Supported conclusions:
1. The visible Breeno Instructions companion is granted overlay and background pop-up capabilities, plus alarms/reminders.
2. Clipboard read/write and device motion/orientation are shown as allowed.
3. Usage access, notifications, app-list access, location, nearby devices, phone and SMS-related permissions are shown as denied.
4. Breeno Instructions is a separate versioned component and should be analyzed independently from Breeno chat and Breeno Memory.

Not established by these screenshots:
- Android package name, versionCode, signing certificate or APK hash.
- Full manifest permission list or privileged/system permissions.
- Whether the app actually uses clipboard data, overlays or motion sensors in every feature.
- Which app/service invokes Breeno Instructions or how requests are dispatched.
- Whether these permission states are identical for the main Breeno app or Breeno Memory.

## OGAM design implications

- Treat overlays as an optional, user-visible UI capability, not as proof of system-assistant integration. OGAM should first implement the public Android VoiceInteractionService/session route.
- Keep clipboard access feature-scoped: do not continuously poll or silently persist clipboard contents. Read only after an explicit user action, show what is being used, and avoid passwords/one-time codes.
- Do not request SMS, phone, location, nearby-device, notification, app-list or usage-access permissions at first launch. Add a narrowly scoped capability only when a concrete feature needs it and explain why.
- Alarms/reminders should use Android's supported alarm/scheduling APIs with explicit user intent; do not assume a companion app's special access is universally required.
- Motion/orientation is not required for the first assistant milestone; keep it optional for later contextual or gesture features.
- The exact permissions of Breeno 13.4.3 and Breeno Memory 16.11.5 remain separate evidence tasks.

## Next evidence needed

1. Main Breeno (13.4.3): its own app permissions and special access pages.
2. Breeno Memory (16.11.5): its own app permissions and special access pages.
3. If possible, app info details for each app showing package name/version metadata; do not install or modify anything.
