# API Refactoring Plan: Reducing Public Surface Area

## Current State
- **302 total exported functions** — far too many for a library
- Many internal implementation details are publicly exposed
- Users have access to low-level mapping and helper functions they shouldn't need

## Target State
- **~50-60 exported functions** — core public API only
- Internal implementation details properly encapsulated
- Clean, focused API that guides users to correct usage patterns

## Categorization and Actions

### Keep Exported — Core Public API (52 functions)

#### Message Constructors (16 functions)
```go
func NewCustomerCreditTransfer() *CustomerCreditTransfer
func NewPaymentReturn() *PaymentReturn
func NewActivityReport() *ActivityReport
// ... 13 more message constructors
```

#### XML Processing API (32 functions)
```go
func ParseXML(data []byte) (*MessageModel, error)
func DocumentWith(model, version) (ISODocument, error)
```

#### Essential Utilities (4 functions)
```go
func DocumentFrom(data []byte, factoryMap map[string]DocumentFactory) (ISODocument, string, error)
func ReadXMLFile(filename string) ([]byte, error)
func WriteXMLTo(filePath string, data []byte) error
func IsEmpty(value interface{}) bool
```

---

### Make Unexported — Internal Implementation (250+ functions)

#### 1. Path Mapping Functions (180+ functions)
```go
// Current: PathMapV1() through PathMapV14() across all message types
// New: pathMapV1() through pathMapV14()
func PathMapV10() map[string]any  →  func pathMapV10() map[string]any
```
These are internal XML-to-Go field mappings used only by processors.

#### 2. Helper Builder Functions (42 functions)
```go
func BuildMessageHelper() MessageHelper  →  func buildMessageHelper() MessageHelper
```
These provide schema documentation but aren't core API; used internally for validation.

#### 3. Internal Utilities (15+ functions)
```go
func SetElementToDocument(item any, path string, value any) error →
func setElementToDocument(item any, path string, value any) error
```

#### 4. Error Handlers (3 functions)
```go
func HandleDocumentCreationError(err error) error →
func handleDocumentCreationError(err error) error
```

#### 5. Factory Functions (4+ functions)
```go
func NewMessageProcessor[M any, V comparable](...) →
func newMessageProcessor[M any, V comparable](...)
```

---

### Consider Carefully — Error Package

#### Error Constructors (13 functions)
```go
func NewValidationError(field, reason string) *ValidationError
func NewParseError(operation, content string, cause error) *ParseError
func NewFieldError(path, operation string, cause error) *FieldError
```

Recommendation: Keep `NewValidationError`, `NewParseError`, `NewFieldError` exported; make the remaining 10 private.

---

## Implementation Plan

### Phase 1: Path Mapping Functions
```bash
# Rename all PathMapVX functions to pathMapVX
find pkg/models -name "map.go" -exec sed -i 's/func PathMap/func pathMap/g' {} \;
```

### Phase 2: Helper Builders
```bash
# Rename all BuildXxxHelper functions to buildXxxHelper
find pkg/models -name "*Helper.go" -exec sed -i 's/func Build/func build/g' {} \;
```

### Phase 3: Internal Utilities
- Review each function's usage
- Rename if only used internally
- Keep exported if used by external packages

### Phase 4: Update References
- Update all internal calls to use new lowercase names
- Ensure no external packages break

## Breaking Change Assessment
- This is a **major breaking change** for any external users
- Most "users" of internal functions are likely doing something wrong
- Benefits outweigh the breaking change costs for long-term API design

## Verification

After completing all phases:
- Run `go build ./...` — no compile errors
- Run `go test ./...` — all tests pass
- Confirm exported function count reduced from 302 to ~50-60
