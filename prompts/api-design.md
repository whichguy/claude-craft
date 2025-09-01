# API Design Template

Use this template when designing REST APIs or other service interfaces.

## API Specification Template

### Endpoint: [HTTP Method] /api/[resource]

**Purpose**: [Brief description of what this endpoint does]

**Authentication**: [Required auth level - none/basic/bearer/api-key]

**Parameters**:
- **Path**: [List path parameters]
- **Query**: [List query parameters with types and validation]
- **Body**: [Request body schema if applicable]

**Request Example**:
```json
{
  "example": "request payload"
}
```

**Response Format**:
```json
{
  "success": true,
  "data": {},
  "message": "Optional message",
  "meta": {
    "timestamp": "2023-12-01T00:00:00Z",
    "version": "1.0"
  }
}
```

**Status Codes**:
- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized  
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": []
  }
}
```

## Design Principles
- RESTful resource naming
- Consistent response format
- Proper HTTP status codes
- Input validation and sanitization
- Rate limiting considerations
- Versioning strategy
- Documentation and examples