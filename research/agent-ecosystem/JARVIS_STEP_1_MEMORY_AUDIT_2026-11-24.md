# Jarvis Step 1 — persistent memory audit
Date: 2026-11-24
Repository: sokfrut-tech/OGAM
Inspected ref: feature/jarvis-step-2-storage-privacy
Research branch: research/jarvis-agent-ecosystem-2026-11-24
Status: read-only code audit; no production implementation changed.

## Executive finding
OGAM already has durable conversation history and a capable local document/RAG knowledge base. It does **not** yet provide a distinct, curated, user-controlled long-term personal memory for Jarvis (facts, preferences, project decisions, reminders, provenance and expiry). The word "memory" in much of the code/test tree refers to model RAM residency/admission, not remembered facts about the user.

## 1. What exists and is evidenced in source

### A. Conversation history
- `src/stores/chatStore.ts` persists `conversations` and `activeConversationId` under Zustand persist key `local-llm-chat-storage`.
- Persistence uses AsyncStorage through `createChunkedStorage` and `createHydrationGatedStorage`; chunking addresses Android row-size limits, while the hydration gate protects saved state from launch defaults and retries failed reads.
- `src/stores/chatPersistence.ts` defines persisted projection, schema version 2 and migrations for message UUIDs and attachment IDs.
- `deleteConversation` removes the chat, emits sync delete mutations for messages/conversation and triggers document garbage collection hooks.
- This is durable chat history, not semantic personal memory. Retrieval of old facts from arbitrary prior conversations is not evidenced by a dedicated memory index.

### B. Project knowledge base / document RAG
- `src/services/rag/database.ts` stores project-to-document membership in SQLite `rag.db`; document content/chunks/vectors live in shared `documents.db` via `src/services/documents/store.ts`.
- `documents.db` has document/page/chunk tables, vector BLOBs, optional FTS5 keyword index and per-conversation document exclusions.
- `src/services/rag/index.ts` adds files and pasted notes, hashes documents, resumes interrupted indexing, allows enable/disable and delete.
- `src/services/documents/models.ts` wires local llama.rn embedding inference; `src/services/rag/embedding.ts` manages the embedding model and RAM residency.
- `src/services/documents/chatTurn.ts` prepares scoped context and citations. The model can use `search_knowledge_base`; source scope is tied to the current project/conversation.
- `__tests__/integration/rag/retrievalBudgetAndScope.test.ts` explicitly guards against cross-project document leakage on both turn context and tool search.
- `__tests__/integration/knowledge-base/searchKnowledgeBaseRoundtrip.test.ts` tests an indexed passage returned as a page citation.
- `__tests__/integration/knowledge-base/knowledgeSearchVectorsAcrossRelaunch.rendered.test.tsx` tests semantic vector retrieval before and after relaunch.
- These are document knowledge systems, not an automatic personal fact memory.

### C. Privacy and storage
- `docs/jarvis/STEP_2_PRIVACY_AND_STORAGE.md` says remote analytics transport is replaced with a local no-op, chat content is not sent to telemetry, SAF is preferred, and all-files access is optional with explanation.
- Chat persistence uses app storage. The inspected code does not establish database encryption-at-rest, a user memory vault, per-record encryption keys, or biometric protection. Do not claim those protections.
- Cross-device knowledge sync code exists; the user must be able to distinguish local-only records from sync-enabled records. The audit did not validate the full sync transport/security end to end.

## 2. What is missing for Jarvis long-term memory
No dedicated source module was found for curated personal facts/preferences/decisions with explicit consent, provenance, confidence, expiry, review, correction, deletion and export. No separate retrieval policy was found to distinguish stable facts from temporary conversation context. No user-facing memory manager for these records was identified.

## 3. Proposed memory design — additive, do not replace OGAM RAG
Create a separate `jarvis_memory.db` SQLite store and typed service. Keep existing chat store and document RAG intact.

Record fields:
- `id`, `kind` (fact/preference/project_decision/routine/reminder), `subject`, `predicate`, `value`
- `scope` (global/project/conversation), `scope_id`
- `source_conversation_id`, `source_message_id`, `source_excerpt_hash`
- `created_at`, `updated_at`, optional `expires_at`
- `confidence`, `status` (proposed/confirmed/rejected/expired)
- `user_approved_at`, `sync_policy` (local_only/explicitly_synced)

Rules:
1. Conversation text is never silently promoted into long-term memory.
2. Model can suggest a candidate; deterministic code asks the user to save/confirm it.
3. Only confirmed, non-expired records can be injected into prompts.
4. Retrieval is scoped: project memory cannot leak into another project; conversation memory is local to that chat.
5. Contradictory facts are not silently overwritten. Present old/new values and ask which is current.
6. User can inspect, edit, reject, delete, export and disable memory.
7. Deleting a source chat must not silently orphan memory: keep source provenance as a tombstone/hash or ask user whether to delete dependent memories.
8. No raw secrets, credentials, payment data or sensitive personal data in automatic memory.
9. Local-only is default. Sync is a separate opt-in per memory scope.
10. Encryption-at-rest is a separate security requirement to design and test, not assumed from SQLite/app-private storage.

## 4. First implementation milestones
M1 — schema + migrations + repository unit tests; no UI, no model writes.
M2 — explicit "Save to Jarvis memory" proposal/confirmation flow and source provenance.
M3 — inspect/edit/delete/export screen and per-project scopes.
M4 — deterministic retrieval with hard scope filter, token budget and citations back to source.
M5 — conflict/expiry handling, backup/restore, optional sync controls and encryption threat model.

## 5. Acceptance tests before moving to Step 2
- A fact is not saved without user confirmation.
- Confirmed fact survives process death/relaunch.
- Rejected/expired/deleted fact is never retrieved.
- Project A memory never appears in project B.
- Local-only record never syncs.
- A conflicting new value cannot silently replace a confirmed old value.
- User can inspect source, correct value, delete record and export memory.
- Long chat persistence remains unaffected.
- Existing document RAG citations and cross-project isolation remain green.
- Android target test on PGEM10: cold start, migration, offline CRUD, relaunch and low-storage failure recovery.

## 6. Evidence limitations
This is a source-level audit of the named branch and selected tests/docs. No test suite was executed in this environment, no APK was built, and no OPPO device was accessed. Presence of test files is not proof that CI currently passes. PR #1 remains draft/unmerged; its private submodule gate still needs resolution before a reliable full build.

## Primary source paths
- `src/stores/chatStore.ts`
- `src/stores/chatPersistence.ts`
- `src/utils/hydrationGatedStorage.ts`
- `src/utils/chunkedStorage.ts`
- `src/services/rag/database.ts`
- `src/services/rag/index.ts`
- `src/services/documents/store.ts`
- `src/services/documents/models.ts`
- `src/services/documents/chatTurn.ts`
- `docs/jarvis/STEP_2_PRIVACY_AND_STORAGE.md`
- `__tests__/integration/rag/retrievalBudgetAndScope.test.ts`
- `__tests__/integration/knowledge-base/searchKnowledgeBaseRoundtrip.test.ts`
- `__tests__/integration/knowledge-base/knowledgeSearchVectorsAcrossRelaunch.rendered.test.tsx`
