# Project Plan: Microservice Migration (Monolith to Auth, Order, Inventory)

## Context
This project outlines the migration of a legacy Django monolith to a distributed microservices architecture. To minimize downtime and risk, we will employ the **Strangler Fig Pattern**, gradually replacing monolith components with new services. The target architecture includes a FastAPI-based Auth service, Spring Boot-based Order and Inventory services, and an API Gateway to manage traffic.

### Tech Stack
- **Monolith:** Django (Python)
- **Auth Service:** FastAPI + JWT (Python)
- **Order/Inventory Services:** Spring Boot (Java)
- **Inter-service Communication:** gRPC
- **API Gateway:** Kong
- **Infrastructure:** Docker Compose (local development)

## Git Setup
We will use a mono-repo approach for the migration to simplify gRPC schema sharing and shared development.

```bash
git init microservice-migration
cd microservice-migration
mkdir -p services/auth services/order services/inventory services/monolith proto gateway
touch docker-compose.yml
```

---

## Implementation Steps

### Phase 1: Gateway and gRPC Definitions
**Intent:** Establish the communication contract and the routing layer.

**Files:**
- `proto/auth.proto`
- `proto/inventory.proto`
- `gateway/kong.yml`

**Code Block (gRPC Definition):**
```proto
// proto/inventory.proto
syntax = "proto3";
package inventory;

service InventoryService {
  rpc CheckStock (StockRequest) returns (StockResponse) {}
  rpc ReserveStock (StockRequest) returns (StockResponse) {}
}

message StockRequest {
  string sku = 1;
  int32 quantity = 2;
}

message StockResponse {
  bool available = 1;
  string message = 2;
}
```

### Phase 2: Auth Service Extraction (FastAPI)
**Intent:** Move authentication out of the monolith to secure all subsequent services consistently.

**Files:**
- `services/auth/main.py`
- `services/auth/auth_handler.py`

**Code Block (FastAPI JWT):**
```python
# services/auth/main.py
from fastapi import FastAPI, Depends, HTTPException
from .auth_handler import signJWT, decodeJWT

app = FastAPI()

@app.post("/login")
async def user_login(user: UserSchema):
    if check_user(user):
        return signJWT(user.email)
    raise HTTPException(status_code=401, detail="Invalid credentials")
```

### Phase 3: Inventory & Order Services (Spring Boot)
**Intent:** Implement core business logic in Spring Boot and enable gRPC listeners for internal calls.

**Files:**
- `services/inventory/src/main/java/.../InventoryServiceImpl.java`
- `services/order/src/main/java/.../OrderController.java`

**Code Block (gRPC Service):**
```java
// InventoryServiceImpl.java
@GrpcService
public class InventoryServiceImpl extends InventoryServiceGrpc.InventoryServiceImplBase {
    @Override
    public void checkStock(StockRequest request, StreamObserver<StockResponse> responseObserver) {
        boolean isAvailable = repository.findBySku(request.getSku()).getQuantity() >= request.getQuantity();
        StockResponse response = StockResponse.newBuilder().setAvailable(isAvailable).build();
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}
```

### Phase 4: Strangler Fig - Proxying the Monolith
**Intent:** Route traffic through Kong. Initially, all traffic goes to Django. One by one, endpoints are shifted to the new services.

**Steps:**
1. Configure Kong to point `/api/v1/auth` to the FastAPI service.
2. Configure Kong to point `/api/v1/orders` to the Spring Boot service.
3. Keep `/api/v1/legacy` pointing to the Django monolith.

---

## Verification

### Automated Testing
- **Unit Tests:** Each service must have >80% coverage.
- **Contract Testing:** Use `buf` or similar tools to verify gRPC compatibility.
- **Integration Tests:** Execute a full checkout flow via the API Gateway.

### Manual Verification
1. Obtain a JWT from the Auth service.
2. Pass the JWT to the Order service via Kong.
3. Verify that the Order service successfully calls the Inventory service via gRPC.

---

## Risks and Mitigations

| Risk | Mitigation |
| :--- | :--- |
| **Data Inconsistency** | Use a Shared Database initially for the Inventory/Monolith split, then migrate to a dedicated DB with Change Data Capture (CDC). |
| **gRPC Overhead** | Implement client-side load balancing and keep-alive pings to manage persistent connections. |
| **Increased Latency** | Monitor network hops through the Gateway. Use gRPC for inter-service calls to keep internal latency low compared to REST. |
| **Auth Complexity** | Ensure the JWT secret is shared securely (e.g., via HashiCorp Vault) so all services can verify tokens independently. |
