# Initial Research: [Epic Name]

## Dependencies Discovered
- **Existing**: [Current dependencies that will be leveraged]
  * **[Library/Framework]** v[X.Y.Z]: [How it's used, why it fits]
- **Required**: [New dependencies needed]
  * **[Library/Framework]**: [Purpose, evaluation criteria, alternatives considered]
- **Conflicts**: [Dependencies that conflict with existing code]
  * **[Conflict]**: [Description, resolution strategy]

## External Services & SaaS Integrations
- **[Service Name]** ([Provider]):
  * **Role**: [What this service provides]
  * **API Type**: [REST, GraphQL, gRPC, etc.]
  * **Authentication**: [API keys, OAuth 2.0, etc.]
  * **Rate Limits**: [Requests/minute, monthly quotas]
  * **Pricing Tier**: [Free tier limits, paid tier considerations]
  * **Integration Points**: [Where/how system interacts]
  * **Failure Handling**: [What happens if service unavailable]

## Current Implementation Analysis
- **Related Code**: [Existing functionality that relates to epic]
  * **File**: `[path/to/file.js:line]` - [What it does]
- **Conflicts Identified**: [Code that will break or need refactoring]
  * **[Component/Pattern]**: [Why it conflicts, refactor approach]
- **Reusable Components**: [Existing code that can be leveraged]
  * **[Component]**: [How it fits into new implementation]
- **Migration Needs**: [Changes required to existing implementation]
  * **[Change]**: [Scope, risk, timeline consideration]

## Actors & Roles in System (Software Defined)

### Human Actors
- **[Actor Name]** ([Role]):
  * **Responsibilities**: [What they do in the system]
  * **Permissions**: [What they can access/modify]
  * **Access Patterns**: [How they interact - UI, API, mobile]
  * **Authentication**: [Login method, MFA requirements]

### System Actors
- **[Service Name]**:
  * **Role**: [Purpose in system architecture]
  * **Interfaces**: [APIs exposed, protocols used]
  * **Triggers**: [What causes this system to act]
  * **Dependencies**: [What this system depends on]
  * **Communication**: [Sync/async, message formats]

### External Actors
- **[Third-party System]**:
  * **Integration Type**: [Webhook, API polling, event stream]
  * **Contract**: [Expected request/response formats]
  * **Reliability**: [SLA, fallback if unavailable]

### Actor Interaction Patterns
[Diagram or description of how actors communicate]
- **[Actor A]** → **[Actor B]**: [Interaction type, data flow, frequency]

## Implied Technical Requirements
- **Security**:
  * **Authentication**: [Method, factors, session management]
  * **Authorization**: [Model - RBAC, ABAC, resource-based]
  * **Data Protection**: [Encryption at rest/transit, PII handling]
  * **Compliance**: [Regulations that apply - GDPR, HIPAA, etc.]

- **Performance**:
  * **Response Time**: [Expected latency - <200ms, <1s, etc.]
  * **Throughput**: [Requests/second, concurrent users]
  * **Resource Usage**: [Memory, CPU, storage constraints]

- **Scalability**:
  * **User Growth**: [Current vs. projected users]
  * **Data Volume**: [Current vs. projected data size]
  * **Traffic Patterns**: [Peak times, seasonal variations]

- **Reliability**:
  * **Uptime Requirements**: [Target availability - 99%, 99.9%, etc.]
  * **Fault Tolerance**: [Single point of failure analysis]
  * **Disaster Recovery**: [RPO, RTO targets]

## Research Sources
- **Codebase Files**: [Files examined - path:line references]
- **Documentation**: [Internal docs, wikis, API specs reviewed]
- **External Resources**: [URLs, papers, standards consulted]
- **Similar Systems**: [Reference implementations studied]
