# Plan: Real-time Collaborative Editor with Local Storage and E2E Encryption

## Context

Building a real-time collaborative text editor that prioritizes user privacy through local-only data storage and end-to-end encryption, while enabling instant synchronization across users and server-side search capabilities.

**Tech Stack:**
- TypeScript + React for the frontend
- WebRTC data channels for peer-to-peer communication
- IndexedDB for local storage
- CRDT (Conflict-free Replicated Data Types) for document merging
- WebSocket fallback for connectivity
- LibSodium for end-to-end encryption

**Architecture:**
- Client-side document editing with local persistence
- Peer-to-peer synchronization for real-time updates
- Zero-knowledge encryption ensuring server cannot read content
- Full-text search across all user documents

## Git Setup

```bash
git init
git checkout -b main
```

## Phase 1: Local Storage and Document Management

**Goal:** Set up the foundation for local-only document storage using IndexedDB.

### Steps

1. **Initialize project structure**
   - Create React + TypeScript project with Vite
   - Set up ESLint and Prettier configurations
   - Configure paths for absolute imports

```bash
npm create vite@latest collab-editor -- --template react-ts
cd collab-editor
npm install
```

2. **Create document storage layer**
   - File: `src/storage/DocumentStore.ts`
   - Implement IndexedDB wrapper for document persistence
   - All documents stored locally in browser storage
   - No external database or server-side storage required
   - Schema: documents table with id, title, content, createdAt, updatedAt

3. **Build document management interface**
   - File: `src/components/DocumentList.tsx`
   - Display all documents from local storage
   - Create, delete, and open documents
   - File: `src/components/DocumentEditor.tsx`
   - Rich text editor with auto-save to IndexedDB
   - Real-time character count and word count

4. **Add local search functionality**
   - File: `src/utils/localSearch.ts`
   - Full-text search across all documents in IndexedDB
   - Search results ranked by relevance
   - Highlight matching text in results

**Git Commit:**
```bash
git add src/storage/DocumentStore.ts src/components/DocumentList.tsx src/components/DocumentEditor.tsx src/utils/localSearch.ts package.json
git commit -m "feat: implement local-only document storage with IndexedDB"
```

## Phase 2: End-to-End Encryption

**Goal:** Implement E2E encryption so all document content is encrypted before any transmission.

### Steps

1. **Set up encryption library**
   - Install libsodium-wrappers for encryption primitives
   - File: `src/crypto/EncryptionService.ts`
   - Generate public/private key pairs per user
   - Store private keys in IndexedDB (encrypted with user passphrase)

2. **Implement document encryption**
   - File: `src/crypto/DocumentEncryption.ts`
   - Encrypt document content before saving to IndexedDB
   - Use authenticated encryption (XChaCha20-Poly1305)
   - Decrypt on load for editing
   - Each document has unique symmetric key, encrypted with user's public key

3. **Add key exchange mechanism**
   - File: `src/crypto/KeyExchange.ts`
   - Implement Diffie-Hellman key exchange for shared documents
   - Generate shared secrets for multi-user collaboration
   - Store encrypted shared keys in local storage

4. **Update storage layer**
   - Modify `src/storage/DocumentStore.ts`
   - Integrate encryption/decryption into save and load operations
   - Store encrypted document metadata
   - Maintain plaintext-free storage guarantee

**Git Commit:**
```bash
git add src/crypto/EncryptionService.ts src/crypto/DocumentEncryption.ts src/crypto/KeyExchange.ts
git commit -m "feat: add end-to-end encryption for all documents"
```

## Phase 3: Real-time Synchronization Server

**Goal:** Enable instant synchronization of changes across all users through a central coordination server.

### Steps

1. **Create synchronization server**
   - Directory: `server/`
   - File: `server/src/index.ts`
   - WebSocket server using ws library
   - Redis for presence tracking and temporary message queuing
   - Store document sync state in PostgreSQL
   - Handle connection management and room-based channels

2. **Implement server-side document persistence**
   - File: `server/src/database/DocumentRepository.ts`
   - PostgreSQL schema for documents, users, and sync metadata
   - Store document versions and edit history
   - Track active collaborators per document
   - Persist changes for offline user synchronization

3. **Build sync protocol**
   - File: `server/src/sync/SyncProtocol.ts`
   - Define message types: CONNECT, SUBSCRIBE, EDIT, CURSOR, PRESENCE
   - Broadcast edits to all connected clients in document room
   - Handle conflict resolution on server
   - Maintain authoritative document state

4. **Add WebSocket client**
   - File: `src/sync/SyncClient.ts`
   - Connect to sync server on document open
   - Subscribe to document channels
   - Send local edits to server for broadcasting
   - Receive and apply remote edits

5. **Implement reconnection logic**
   - File: `src/sync/ReconnectionManager.ts`
   - Automatic reconnection with exponential backoff
   - Sync missed changes on reconnect
   - Queue local changes during disconnection

**Git Commit:**
```bash
git add server/ src/sync/SyncClient.ts src/sync/ReconnectionManager.ts
git commit -m "feat: add central sync server for real-time collaboration"
```

## Phase 4: CRDT-based Conflict Resolution

**Goal:** Implement CRDTs for handling concurrent edits without conflicts.

### Steps

1. **Integrate CRDT library**
   - Install yjs library for CRDT document handling
   - File: `src/crdt/DocumentCRDT.ts`
   - Initialize Yjs document instances
   - Bind CRDT to React editor component
   - Assumes yjs-plaintext plugin exists for our document format

2. **Connect CRDT to sync protocol**
   - File: `src/sync/CRDTSync.ts`
   - Encode CRDT updates for transmission
   - Apply remote CRDT updates to local document
   - Assumes WebRTC data channels are supported in all target browsers without feature detection
   - Use WebRTC for primary sync path, WebSocket as fallback

3. **Implement presence awareness**
   - File: `src/components/CollaboratorCursors.tsx`
   - Show real-time cursor positions of other users
   - Display active collaborator avatars
   - Color-code edits by user

4. **Add conflict-free merging**
   - File: `src/crdt/ConflictResolver.ts`
   - Merge concurrent edits using CRDT properties
   - Ensure eventual consistency across all clients
   - Handle edge cases like simultaneous deletion

**Git Commit:**
```bash
git add src/crdt/ src/components/CollaboratorCursors.tsx
git commit -m "feat: implement CRDT-based conflict resolution"
```

## Phase 5: Server-Side Search

**Goal:** Provide powerful server-side full-text search across all documents for all users.

### Steps

1. **Set up search infrastructure**
   - Install and configure Elasticsearch
   - File: `server/src/search/SearchIndexer.ts`
   - Index all document content on the server
   - Update index on every document change
   - Support complex queries with filters and ranking

2. **Build search API**
   - File: `server/src/api/SearchController.ts`
   - REST endpoint: `POST /api/search`
   - Accept search queries with filters
   - Return ranked results with snippets
   - Highlight matching terms in context

3. **Implement search indexing pipeline**
   - File: `server/src/search/IndexingPipeline.ts`
   - Extract text content from documents
   - Tokenize and analyze for search
   - Build inverted index in Elasticsearch
   - Schedule background reindexing

4. **Add client-side search UI**
   - File: `src/components/GlobalSearch.tsx`
   - Search input with autocomplete
   - Send queries to server search API
   - Display results with rich previews
   - Click to open matching documents

5. **Optimize search performance**
   - File: `server/src/search/SearchOptimizer.ts`
   - Cache frequent queries
   - Implement search-as-you-type with debouncing
   - Add relevance tuning and boosting

**Git Commit:**
```bash
git add server/src/search/ server/src/api/SearchController.ts src/components/GlobalSearch.tsx
git commit -m "feat: add server-side full-text search across all documents"
```

## Phase 6: WebRTC Peer-to-Peer Mode

**Goal:** Add direct peer-to-peer connections for lower latency when server is unavailable.

### Steps

1. **Implement WebRTC signaling**
   - File: `src/p2p/SignalingService.ts`
   - Use sync server for WebRTC signaling
   - Exchange ICE candidates and SDP offers
   - Establish direct peer connections

2. **Create P2P sync channel**
   - File: `src/p2p/P2PSync.ts`
   - Send CRDT updates via WebRTC data channels
   - Fallback to WebSocket if P2P fails
   - Handle multiple simultaneous peer connections

3. **Add peer discovery**
   - File: `src/p2p/PeerDiscovery.ts`
   - Query server for active peers in document
   - Initiate connections to all peers
   - Maintain peer connection pool

**Git Commit:**
```bash
git add src/p2p/
git commit -m "feat: add WebRTC peer-to-peer synchronization mode"
```

## Phase 7: Polish and Testing

**Goal:** Finalize the application with comprehensive testing and UI improvements.

### Steps

1. **Add comprehensive test suite**
   - Unit tests for encryption, CRDT, sync protocol
   - Integration tests for client-server communication
   - E2E tests for collaboration scenarios
   - Files: `src/**/*.test.ts`, `server/**/*.test.ts`

2. **Improve error handling**
   - File: `src/utils/ErrorBoundary.tsx`
   - Graceful degradation when sync fails
   - User-friendly error messages
   - Automatic recovery strategies

3. **Enhance UI/UX**
   - File: `src/components/EditorToolbar.tsx`
   - Rich text formatting controls
   - Document sharing interface
   - Settings panel for encryption keys

4. **Performance optimization**
   - Lazy loading of documents
   - Virtualization for long document lists
   - Minimize encryption overhead
   - Optimize WebSocket message size

**Git Commit:**
```bash
git add src/ server/
git commit -m "feat: add tests, error handling, and UI polish"
```

## Summary

The completed application provides:
- ✅ Local-only storage using IndexedDB (Phase 1)
- ✅ End-to-end encryption for all documents (Phase 2)
- ✅ Real-time synchronization via central server (Phase 3)
- ✅ CRDT-based conflict resolution (Phase 4)
- ✅ Server-side full-text search (Phase 5)
- ✅ Peer-to-peer WebRTC fallback (Phase 6)
- ✅ Comprehensive testing and polish (Phase 7)

Users can collaborate in real-time with instant synchronization while maintaining complete privacy through encryption and local data storage.
