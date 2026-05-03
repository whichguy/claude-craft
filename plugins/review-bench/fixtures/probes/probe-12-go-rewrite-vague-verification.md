# Claude Gate — Go Rewrite Migration Plan

## Project Overview
Migrate Claude Auth Bridge from Python to Go with npm distribution, creating a
high-performance OAuth proxy server named "claude-gate".

## Phase 1: Core Go Implementation (Week 1)

### Project Setup
- Create new GitHub repository: `claude-gate`
- Initialize Go module: `go mod init github.com/yourusername/claude-gate`
- Set up project structure:
  ```
  claude-gate/
  ├── cmd/claude-gate/
  ├── internal/
  │   ├── auth/
  │   │   ├── oauth.go
  │   │   └── storage.go
  │   ├── proxy/
  │   │   ├── server.go
  │   │   ├── handler.go
  │   │   └── middleware.go
  │   └── config/config.go
  ├── go.mod
  └── go.sum
  ```

### OAuth Authentication
- Implement PKCE generation (base64url encoded 32-byte verifier)
- Create OAuth flow with Claude's client ID: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`
- Build authorization URL with required parameters
- Implement token exchange endpoint
- Add token refresh mechanism
- Create secure token storage (`~/.claude-gate/auth.json`)
- Implement token encryption using system keychain

### HTTP Proxy Server
- Create base HTTP server using standard library
- Implement request forwarding to Anthropic API
- Add OAuth header injection (`Authorization`, `anthropic-beta`, `anthropic-version`)
- Handle streaming responses (SSE)
- Implement request/response logging
- Add error handling and retry logic

### CLI Interface
- Implement CLI using cobra
- Commands: `start`, `auth login`, `auth logout`, `auth status`, `test`, `status`
- Flags: `--host`, `--port`, `--auth-token`, `--log-level`

## Phase 2: NPM Distribution Setup (Week 2)

### Package Structure
- Create npm package with optionalDependencies for platform packages:
  - `claude-gate-darwin-x64`
  - `claude-gate-darwin-arm64`
  - `claude-gate-linux-x64`
  - `claude-gate-linux-arm64`
  - `claude-gate-windows-x64`
- Write `cli.js` wrapper to detect platform and run binary
- Add fallback download mechanism

### Build Automation
- Create cross-platform build script (Go cross-compilation)
- Set up GitHub Actions for automated builds
- Configure release workflow and npm publish automation

## Phase 3: Feature Parity (Week 3)

### Core Features
- Port all OAuth endpoints from Python
- Implement health check endpoint
- Add proxy authentication middleware
- Create request size limits
- Implement timeout handling
- Add graceful shutdown

### Testing
- Unit tests for OAuth flow
- Integration tests for proxy
- End-to-end tests with real API
- Cross-platform installation tests
- Performance benchmarks
- Load testing

## Phase 4: Release & Migration (Week 4)

### Pre-release
- Security audit
- Performance profiling
- Memory leak testing
- Cross-platform testing
- Documentation review

### Release Process
- Tag v1.0.0-beta
- Publish to npm as `@next`
- Create GitHub release
- Announce in relevant communities

### Migration Support
- Create migration script from Python version
- Transfer existing auth tokens
- Update documentation references
- Support both versions temporarily

## Technical Specifications

### Performance Targets
- Binary size: < 10MB
- Memory usage: < 50MB idle
- Startup time: < 100ms
- Request latency: < 5ms overhead
- Concurrent connections: 1000+

### Dependencies
```go
require (
    golang.org/x/oauth2 v0.27.0
    github.com/spf13/cobra v1.8.0
    github.com/joho/godotenv v1.5.1
    github.com/zalando/go-keyring v0.2.3
)
```

## Success Metrics
- All Python features ported
- Performance improvement verified (>50% memory reduction)
- npm installation works on all platforms
- Zero security vulnerabilities
- User migration completed
