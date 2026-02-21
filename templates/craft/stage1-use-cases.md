# Use Cases: [Epic Name]

## Primary Use Cases (From Epic)

### UC-1: [Primary Use Case Name]
**Actor**: [Who performs this]

**Actor Profile & Interface:**
- **Actor Type**: [End User / Admin / API Caller / System Service / Scheduled Job]
- **Actor Role**: [Specific role - "Organization Admin", "Team Member", "External API Consumer", "Background Processor"]
- **Actor Capabilities**: [What this actor can do in the system - "Manage users", "View reports", "Process invoices"]
- **Actor Interface**: [How this actor interacts with system]
  - **UI Interface**: [If applicable - Admin dashboard, User portal, Mobile app]
  - **API Interface**: [If applicable - REST endpoints, GraphQL schema, Webhook receivers]
  - **CLI Interface**: [If applicable - Command-line tools, Scripts]
  - **System Interface**: [If applicable - Service-to-service APIs, Message queues]
- **Actor Permissions Model**: [How permissions are assigned - RBAC roles, Resource-based, Claims-based]
- **Actor Context**: [What information defines this actor's session - User ID, Organization, Tenant, API Key scope]

**Entry Point & Access Path**:
- **How User Gets Here**:
  - **UI Navigation**: [e.g., "Dashboard → Settings → User Management → Create User button"]
  - **Direct URL**: [e.g., "/admin/users/create"]
  - **External Trigger**: [e.g., "Webhook from external system", "Scheduled job", "Email link"]
  - **API Endpoint**: [e.g., "POST /api/v1/users"]
- **Discovery Method**: [How users learn this feature exists - menu, search, documentation, onboarding]

- **REQUIRED: Access Journey Illustration**

  **Document the complete step-by-step journey showing how this specific actor gained access to this scenario:**

  Example for UI access:
  ```
  1. Actor opens application → lands on login page
  2. Actor enters credentials → authenticates successfully
  3. Actor views dashboard → sees "Settings" in main navigation
  4. Actor clicks "Settings" → settings panel opens
  5. Actor selects "User Management" → user list loads
  6. Actor clicks "Create User" button → this use case begins
  ```

  Example for API access:
  ```
  1. External system administrator generates API key → receives key + secret
  2. System stores credentials → configures API client
  3. System initiates daily sync job → triggers at 2am UTC
  4. System authenticates to API → includes Bearer token in Authorization header
  5. System validates token → checks scopes and rate limits
  6. System calls POST /api/v1/users → this use case begins
  ```

  Example for scheduled/automated access:
  ```
  1. System administrator configures trigger → sets schedule in admin panel
  2. System registers trigger → stores configuration in database
  3. Scheduler daemon checks schedule → identifies job ready to run
  4. Scheduler acquires service account token → validates permissions
  5. Scheduler invokes function → this use case begins
  ```

  **This illustration must show:**
  - Starting point (where actor begins, what state they're in)
  - Each authentication/authorization step taken
  - Each navigation or system action performed
  - Any intermediate states or screens encountered
  - The exact trigger point where this use case begins

  **Purpose:** Makes explicit how actors actually reach this scenario, reveals hidden assumptions about navigation, authentication flows, and system states.

**Access Requirements**:
- **Authentication**: [Required auth level - logged in, anonymous, service account]
- **Authorization**: [Required permissions - "admin role", "user.create permission", "organization owner"]
- **Prerequisites**: [Must exist before this can run - "Account must be verified", "Payment method on file"]
- **Session State**: [Required session context - "Active workspace selected", "OAuth token valid"]
- **Data Context**: [Required data - "At least one project exists", "Form partially filled"]

**User Journey Context**:
- **Previous Step**: [What typically happens before this? - "User just completed onboarding", "User reviewed invoice list"]
- **User Goal**: [What is the user ultimately trying to achieve? - "Manage team", "Process monthly invoices"]
- **Workflow Position**: [Where this fits - "Step 2 of 5 in invoice processing workflow", "One-time setup", "Recurring daily task"]

**Runtime Lifecycle**:
- **Initialization**: [What loads/initializes when feature starts - "Fetch user list", "Load form schema", "Initialize state"]
- **Active State**: [What's maintained during execution - "Form validation state", "WebSocket connection", "Draft autosave"]
- **Cleanup**: [What happens on exit - "Close connections", "Clear temp files", "Save draft state"]
- **Timeout/Expiry**: [Session/state lifetime - "Form expires after 30 min", "Lock released after 5 min"]

**Trigger**: [What initiates this specific use case - "User clicks Submit button", "External event received"]
**Preconditions**: [System state before this starts]
**Main Flow**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Postconditions**: [System state after completion]
**Alternative Flows**: [Variations of this use case]
**Exception Flows**: [Error paths and recovery]

**Exit Points**:
- **Success Exit**: [Where user goes on success - "Redirected to user list", "Returns to dashboard"]
- **Cancel Exit**: [Where user goes if they cancel - "Returns to previous page", "Draft saved, returns to inbox"]
- **Error Exit**: [Where user goes on error - "Stays on form with errors highlighted", "Redirected to error page"]

[Repeat for each primary use case from initial extraction]

---

## Related Use Cases (Discovered Through Research)

### UC-[N]: [Related Use Case Name]
**Actor**: [Who performs this]

**Actor Profile & Interface:**
- **Actor Type**: [End User / Admin / API Caller / System Service / Scheduled Job]
- **Actor Role**: [Specific role - "Organization Admin", "Team Member", "External API Consumer", "Background Processor"]
- **Actor Capabilities**: [What this actor can do in the system - "Manage users", "View reports", "Process invoices"]
- **Actor Interface**: [How this actor interacts with system]
  - **UI Interface**: [If applicable - Admin dashboard, User portal, Mobile app]
  - **API Interface**: [If applicable - REST endpoints, GraphQL schema, Webhook receivers]
  - **CLI Interface**: [If applicable - Command-line tools, Scripts]
  - **System Interface**: [If applicable - Service-to-service APIs, Message queues]
- **Actor Permissions Model**: [How permissions are assigned - RBAC roles, Resource-based, Claims-based]
- **Actor Context**: [What information defines this actor's session - User ID, Organization, Tenant, API Key scope]

**Entry Point & Access Path**:
- **How User Gets Here**:
  - **UI Navigation**: [e.g., "Dashboard → Settings → User Management → Create User button"]
  - **Direct URL**: [e.g., "/admin/users/create"]
  - **External Trigger**: [e.g., "Webhook from external system", "Scheduled job", "Email link"]
  - **API Endpoint**: [e.g., "POST /api/v1/users"]
- **Discovery Method**: [How users learn this feature exists - menu, search, documentation, onboarding]

- **REQUIRED: Access Journey Illustration**

  **Document the complete step-by-step journey showing how this specific actor gained access to this scenario:**

  Example for UI access:
  ```
  1. Actor opens application → lands on login page
  2. Actor enters credentials → authenticates successfully
  3. Actor views dashboard → sees "Settings" in main navigation
  4. Actor clicks "Settings" → settings panel opens
  5. Actor selects "User Management" → user list loads
  6. Actor clicks "Create User" button → this use case begins
  ```

  Example for API access:
  ```
  1. External system administrator generates API key → receives key + secret
  2. System stores credentials → configures API client
  3. System initiates daily sync job → triggers at 2am UTC
  4. System authenticates to API → includes Bearer token in Authorization header
  5. System validates token → checks scopes and rate limits
  6. System calls POST /api/v1/users → this use case begins
  ```

  Example for scheduled/automated access:
  ```
  1. System administrator configures trigger → sets schedule in admin panel
  2. System registers trigger → stores configuration in database
  3. Scheduler daemon checks schedule → identifies job ready to run
  4. Scheduler acquires service account token → validates permissions
  5. Scheduler invokes function → this use case begins
  ```

  **This illustration must show:**
  - Starting point (where actor begins, what state they're in)
  - Each authentication/authorization step taken
  - Each navigation or system action performed
  - Any intermediate states or screens encountered
  - The exact trigger point where this use case begins

  **Purpose:** Makes explicit how actors actually reach this scenario, reveals hidden assumptions about navigation, authentication flows, and system states.

**Access Requirements**:
- **Authentication**: [Required auth level - logged in, anonymous, service account]
- **Authorization**: [Required permissions - "admin role", "user.create permission", "organization owner"]
- **Prerequisites**: [Must exist before this can run - "Account must be verified", "Payment method on file"]
- **Session State**: [Required session context - "Active workspace selected", "OAuth token valid"]
- **Data Context**: [Required data - "At least one project exists", "Form partially filled"]

**User Journey Context**:
- **Previous Step**: [What typically happens before this? - "User just completed onboarding", "User reviewed invoice list"]
- **User Goal**: [What is the user ultimately trying to achieve? - "Manage team", "Process monthly invoices"]
- **Workflow Position**: [Where this fits - "Step 2 of 5 in invoice processing workflow", "One-time setup", "Recurring daily task"]

**Runtime Lifecycle**:
- **Initialization**: [What loads/initializes when feature starts - "Fetch user list", "Load form schema", "Initialize state"]
- **Active State**: [What's maintained during execution - "Form validation state", "WebSocket connection", "Draft autosave"]
- **Cleanup**: [What happens on exit - "Close connections", "Clear temp files", "Save draft state"]
- **Timeout/Expiry**: [Session/state lifetime - "Form expires after 30 min", "Lock released after 5 min"]

**Trigger**: [What initiates this use case]

**Exit Points**:
- **Success Exit**: [Where user goes on success - "Redirected to user list", "Returns to dashboard"]
- **Cancel Exit**: [Where user goes if they cancel - "Returns to previous page", "Draft saved, returns to inbox"]
- **Error Exit**: [Where user goes on error - "Stays on form with errors highlighted", "Redirected to error page"]

**Relationship**: [How this relates to primary use cases]
  - **Prerequisite for**: [Which use cases need this to run first]
  - **Triggered by**: [Which use cases trigger this]
  - **Alternative to**: [Which use cases this substitutes]
**Rationale**: [Why this use case is necessary]
  - **Discovered via**: [Which research activity revealed this]
  - **Source**: [Codebase pattern, similar system, domain standard, etc.]
**Priority**: [Essential for MVP / Should-have / Nice-to-have]

[Repeat for each discovered related use case]

---

## Use Case Interactions & Dependencies

**Dependency Chains** (must execute in order):
- UC-X → UC-Y → UC-Z: [Description of workflow]

**Mutually Exclusive** (cannot both be active):
- UC-A ⊕ UC-B: [Reason for exclusion]

**Concurrent Execution** (can run in parallel):
- UC-M ∥ UC-N: [Concurrency considerations]

**Shared Sub-Flows** (common patterns):
- [Sub-flow name]: Used by UC-X, UC-Y, UC-Z
  * [Description of shared behavior]

**Interaction Diagram**:
[ASCII or description of how use cases interact]

---

## Anti-Cases (Prevention Scenarios)

### AC-1: [Anti-Case Name - What Should NOT Happen]
**Category**: [Security / Data Integrity / Business Rule / Resource Abuse / Misuse]
**Description**: [What malicious or erroneous behavior to prevent]
**Risk**: [What damage could occur if not prevented]
  - **Impact Severity**: [Critical / High / Medium / Low]
  - **Likelihood**: [High / Medium / Low]
**Prevention Strategy**:
  - **Validation**: [Input validation, business rules]
  - **Authorization**: [Permission checks required]
  - **Rate Limiting**: [Request throttling, quotas]
  - **Monitoring**: [What to log, alert on]
**Related Use Cases**: [Which use cases must implement this prevention]
**Test Strategy**: [How to verify prevention works]

[Repeat for each anti-case identified]

---

## Research Notes

**Sources Consulted**:
- **Codebase Analysis**: [Files examined, patterns found]
- **External Documentation**: [Standards, similar systems reviewed]
- **SaaS Service Capabilities**: [Relevant features from services in research.md]
- **Domain Research**: [Industry standards, best practices]

**Patterns Discovered**:
- [Common patterns in similar systems]
- [Standard workflows in this domain]
- [Reusable interaction patterns]

**Gaps Identified**:
[Areas where we lack information and need user input]
- **[Gap topic]**: [What we don't know, why it matters]
  * **Question for User**: [Specific question to resolve]
