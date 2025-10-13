# Use Cases: Personal Task Management Tool

## UC-001: Create New Task

**Actor**: User
**Goal**: Add a new task to the list
**Complexity Driver**: Simple CRUD operation, no backend required

**Preconditions**:
- Application is loaded in browser

**Main Flow**:
1. User clicks "Add Task" button
2. User enters task title
3. User optionally enters task description
4. User clicks "Save"
5. Task appears in task list
6. Task is saved to local storage

**Postconditions**:
- New task visible in list
- Task persisted in browser local storage

**Technical Implications**:
- Simple JavaScript event handling
- LocalStorage API for persistence
- Basic form validation

---

## UC-002: Mark Task as Complete

**Actor**: User
**Goal**: Mark a task as done
**Complexity Driver**: Simple state management, no real-time sync needed

**Preconditions**:
- At least one task exists in the list

**Main Flow**:
1. User clicks checkbox next to task
2. Task is marked as complete (visual indicator)
3. Completion state saved to local storage

**Postconditions**:
- Task shows as complete
- State persisted locally

**Technical Implications**:
- Simple state update
- LocalStorage write operation
- CSS for visual feedback

---

## UC-003: Filter Tasks by Status

**Actor**: User
**Goal**: View only complete or incomplete tasks
**Complexity Driver**: Client-side filtering, no complex queries

**Preconditions**:
- Tasks exist in the list

**Main Flow**:
1. User selects filter option (All / Active / Completed)
2. Task list updates to show filtered results
3. Filter preference saved for next session

**Postconditions**:
- Only relevant tasks visible
- Filter state persisted

**Technical Implications**:
- Array filtering operations
- Simple state management
- No database queries needed

---

## UC-004: Search Tasks

**Actor**: User
**Goal**: Find specific tasks by title
**Complexity Driver**: Simple text search, client-side only

**Preconditions**:
- Tasks exist in the list

**Main Flow**:
1. User types in search box
2. Task list updates in real-time to show matches
3. Search is case-insensitive

**Postconditions**:
- Matching tasks displayed
- Other tasks hidden

**Technical Implications**:
- String matching algorithm
- Real-time filtering
- No full-text search engine needed

---

## UC-005: Edit Task Details

**Actor**: User
**Goal**: Modify task title or description
**Complexity Driver**: Simple update operation, no version control

**Preconditions**:
- Task exists

**Main Flow**:
1. User clicks task to edit
2. Task details become editable
3. User modifies title or description
4. User saves changes
5. Updated task saved to local storage

**Postconditions**:
- Task reflects updated information
- Changes persisted locally

**Technical Implications**:
- Inline editing or modal dialog
- Form validation
- LocalStorage update

---

## UC-006: Delete Task

**Actor**: User
**Goal**: Remove a task from the list
**Complexity Driver**: Simple deletion, no soft deletes needed

**Preconditions**:
- Task exists

**Main Flow**:
1. User clicks delete button on task
2. Optional: Confirmation prompt
3. Task removed from list
4. Task removed from local storage

**Postconditions**:
- Task no longer visible
- Task data removed from storage

**Technical Implications**:
- Array removal operation
- LocalStorage update
- Optional confirmation dialog

---

## UC-007: Persist Data Across Sessions

**Actor**: System
**Goal**: Ensure tasks survive browser restarts
**Complexity Driver**: Simple persistence, no sync or backup needed

**Preconditions**:
- User has created tasks

**Main Flow**:
1. User closes browser
2. User reopens browser and navigates to application
3. All previously created tasks load from local storage
4. Application state restored

**Postconditions**:
- Tasks exactly as user left them
- No data loss

**Technical Implications**:
- LocalStorage API reliability
- JSON serialization/deserialization
- Data migration strategy for future versions

---

## UC-008: Use Application Offline

**Actor**: User
**Goal**: Access and manage tasks without internet connection
**Complexity Driver**: Pure client-side application, no server dependency

**Preconditions**:
- Application previously loaded
- Browser has cached application files

**Main Flow**:
1. User loses internet connection
2. User continues using application
3. All features work normally
4. Data saved to local storage

**Postconditions**:
- Full functionality maintained
- No error messages or degraded experience

**Technical Implications**:
- Service Worker for offline caching (optional)
- No API calls or network requests
- Self-contained application bundle

---

## Complexity Analysis Summary

**All use cases are Priority 0-2 complexity**:
- No multi-user features (Priority 0-1)
- No real-time sync (Priority 0-1)
- No backend server (Priority 0-1)
- No authentication (Priority 0)
- Simple CRUD operations (Priority 1)
- Local storage only (Priority 1)
- Basic UI framework acceptable (Priority 1-2)

**Expected Technology Priorities**:
- Execution Environment: Priority 0-1 (static files or basic dev server)
- Storage System: Priority 1 (LocalStorage)
- Storage Format: Priority 1 (JSON)
- User Interface: Priority 2-3 (Vanilla JS or simple framework)
- Authentication: Priority 0 (none)
- API Service: Priority 0 (no backend)
- Testing: Priority 1-2 (basic unit tests)
- Programming Language: Priority 1-2 (JavaScript/TypeScript)
- CI/CD: Priority 1-2 (basic GitHub Actions)

**Total Expected Complexity**: 8-15 (Green Zone)
