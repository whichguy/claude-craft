# Infrastructure Identifiers

**Purpose:** Central registry of all infrastructure IDs, endpoints, and configuration references needed during implementation.

**Security Note:** This file contains REFERENCES to credentials, not actual secrets. Actual secrets go in environment variables or secure vaults.

## Service Identifiers
- **Script ID**: [Google Apps Script project ID, if applicable]
- **Project ID**: [GCP project ID, AWS account, etc.]
- **API Endpoints**: [Base URLs for external services]

## Authentication References
- **Environment Variables Needed**:
  - `API_KEY` - [Description of what this authorizes]
  - `SERVICE_ACCOUNT_EMAIL` - [For GCP service accounts]
  - `DATABASE_URL` - [Connection string pattern]

## Resource Identifiers
- **Database IDs**: [Database names, table names]
- **Storage Buckets**: [Cloud storage bucket names]
- **Queue Names**: [Message queue identifiers]

## Configuration Values
- **Timeouts**: [Default timeout values for various operations]
- **Rate Limits**: [API rate limits to respect]
- **Retry Policies**: [How many retries, backoff strategy]

## References
- See `architecture.md` for architectural context
- See `.env.template` for environment variable format
