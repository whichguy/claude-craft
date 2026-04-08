# Plan: Add JWT Authentication with RBAC to Flask API

## Context

The Flask API currently has all endpoints unprotected. We need JWT-based authentication with refresh tokens, login/register endpoints, a route protection decorator, and role-based access control (admin vs regular user). The project already uses Flask-SQLAlchemy with a `users` table that has `email`, `password_hash`, and `role` columns, plus a `check_password()` method using bcrypt.

**Key files:**
- `app/__init__.py` — Flask app factory with SQLAlchemy init
- `app/models/user.py` — User model (email, password_hash, role, check_password())
- `app/routes/api.py` — unprotected routes: GET/POST /users, GET/PUT /users/<id>
- `app/config.py` — Config class, no JWT config yet
- `requirements.txt` — flask, flask-sqlalchemy, bcrypt, gunicorn
- `tests/test_api.py` — existing tests for unprotected endpoints

## Git Setup

```bash
git checkout -b feat/jwt-auth
```

## Implementation

### Phase 1: Dependencies and Configuration

> Intent: Get PyJWT and its config into the project before writing any auth code. This avoids mid-implementation config issues and gives us a clear foundation for token signing.

**Outputs:** Updated `requirements.txt`, JWT settings in `app/config.py`

1. Add `PyJWT>=2.8.0` to `requirements.txt` and install: `pip install PyJWT`

2. Update `app/config.py` — add JWT configuration to the Config class:
   - `JWT_SECRET_KEY` — separate from Flask's SECRET_KEY, loaded from env var `JWT_SECRET_KEY` with a dev fallback
   - `JWT_ACCESS_TOKEN_EXPIRES` — 15 minutes (timedelta)
   - `JWT_REFRESH_TOKEN_EXPIRES` — 30 days (timedelta)

3. Run existing tests to confirm nothing breaks: `pytest tests/test_api.py -v`

**Commit:** `git commit -m "feat: add PyJWT dependency and JWT config settings"`

### Phase 2: Token Utilities and Auth Decorator

> Intent: Build the core JWT machinery — token creation, validation, and the decorator that protects routes. Getting this right before touching any endpoints means we can test the decorator in isolation.

**Pre-check:** `app/config.py` has JWT settings from Phase 1
**Outputs:** `app/auth/__init__.py`, `app/auth/tokens.py`, `app/auth/decorators.py`

4. Create `app/auth/__init__.py` — empty package init

5. Create `app/auth/tokens.py`:
   - `create_access_token(user_id: int, role: str) -> str` — encode JWT with `sub` (user_id), `role`, `type: "access"`, `exp` (15 min), `iat` claims, signed with `JWT_SECRET_KEY` using HS256
   - `create_refresh_token(user_id: int) -> str` — encode JWT with `sub` (user_id), `type: "refresh"`, `exp` (30 days), `iat` claims
   - `decode_token(token: str) -> dict` — decode and validate, return payload; raise `jwt.ExpiredSignatureError` or `jwt.InvalidTokenError` on failure

6. Create `app/auth/decorators.py`:
   - `@jwt_required` decorator — extract `Authorization: Bearer <token>` header, call `decode_token()`, verify `type == "access"`, look up User by `sub` claim, attach to `g.current_user`, return `{"error": "..."}` with 401 if anything fails (missing header, expired, invalid, user not found)
   - `@role_required(role)` decorator — must be applied after `@jwt_required`, check `g.current_user.role` against required role, return 403 `{"error": "Insufficient permissions"}` if mismatch

**Commit:** `git commit -m "feat: add JWT token utilities and auth decorators"`

### Phase 3: Auth Endpoints (Register, Login, Refresh)

> Intent: Wire up the public-facing auth endpoints. Register creates users, login issues token pairs, refresh rotates access tokens. These use the token utilities from Phase 2 and the existing User model.

**Pre-check:** Token utilities work — `create_access_token()` returns a decodable JWT
**Outputs:** `app/auth/routes.py`, blueprint registered in app factory

7. Create `app/auth/routes.py` with blueprint `auth_bp` (url_prefix `/auth`):

   - `POST /auth/register`:
     - Accept `{ "email": str, "password": str }` JSON
     - Validate email format (basic regex), password length >= 8
     - Check for existing user with same email, return 409 if exists
     - Create User with `password_hash` from bcrypt, default `role = "user"`
     - Return `{ "id": int, "email": str, "role": str }` with 201

   - `POST /auth/login`:
     - Accept `{ "email": str, "password": str }` JSON
     - Query User by email, call `check_password()`, return 401 on failure
     - Generate access token and refresh token
     - Return `{ "access_token": str, "refresh_token": str, "token_type": "bearer" }`

   - `POST /auth/refresh`:
     - Accept `{ "refresh_token": str }` in JSON body
     - Decode token, verify `type == "refresh"`, look up user
     - Issue new access token (not a new refresh token)
     - Return `{ "access_token": str, "token_type": "bearer" }`

   - `GET /auth/me` (protected with `@jwt_required`):
     - Return current user profile: `{ "id", "email", "role" }`

8. Register `auth_bp` in `app/__init__.py` app factory: `app.register_blueprint(auth_bp)`

9. Smoke test manually or with curl:
   ```
   POST /auth/register → 201
   POST /auth/login → 200 with tokens
   GET /auth/me with Bearer token → 200
   ```

**Commit:** `git commit -m "feat: add register, login, refresh, and me auth endpoints"`

### Phase 4: Protect Existing Routes with RBAC

> Intent: Lock down the existing API routes. Regular users can read, only admins can create/modify. This is where the security boundary actually gets enforced.

**Pre-check:** Auth endpoints work — can register, login, and get a valid token
**Outputs:** Modified `app/routes/api.py` with auth and role decorators applied

10. Update `app/routes/api.py`:
    - Import `jwt_required` and `role_required` from `app.auth.decorators`
    - `GET /users` — add `@jwt_required` (any authenticated user)
    - `GET /users/<id>` — add `@jwt_required` (any authenticated user)
    - `POST /users` — add `@jwt_required` then `@role_required("admin")` (admin only)
    - `PUT /users/<id>` — add `@jwt_required` then `@role_required("admin")` (admin only)

11. Update existing tests in `tests/test_api.py`:
    - Add a test fixture that registers a user and logs in, stores the access token
    - Add an admin fixture that creates an admin user (set role directly in DB)
    - Update all existing test methods to include `Authorization: Bearer <token>` header
    - Add test cases for 401 (no token) and 403 (wrong role) responses

**Commit:** `git commit -m "feat: protect API routes with JWT auth and role-based access"`

### Phase 5: Auth Tests and Final Verification

> Intent: Dedicated auth test coverage. The existing tests were updated in Phase 4, but the auth module itself needs thorough testing — edge cases around tokens, expiry, malformed input.

**Pre-check:** All routes protected, existing tests pass with auth headers
**Outputs:** `tests/test_auth.py`

12. Create `tests/test_auth.py`:
    - **Registration tests:**
      - Valid registration returns 201 with user data
      - Duplicate email returns 409
      - Missing fields returns 400
      - Short password (< 8 chars) returns 400
      - Invalid email format returns 400
    - **Login tests:**
      - Valid credentials return access + refresh tokens
      - Wrong password returns 401
      - Nonexistent email returns 401
    - **Token tests:**
      - Valid access token passes `@jwt_required`
      - Expired access token returns 401 (mock `iat`/`exp` or use short-lived token)
      - Refresh token cannot be used as access token (type check)
      - Malformed token returns 401
    - **Refresh tests:**
      - Valid refresh token issues new access token
      - Expired refresh token returns 401
      - Access token cannot be used to refresh
    - **RBAC tests:**
      - Admin can access admin-only endpoint (POST /users)
      - Regular user gets 403 on admin-only endpoint
      - `/auth/me` returns correct role for each user type

13. Run full test suite: `pytest tests/ -v --tb=short`

14. Verify test coverage on auth module: `pytest tests/test_auth.py -v --cov=app/auth --cov-report=term-missing`

**Commit:** `git commit -m "test: add comprehensive auth and RBAC test coverage"`

## Verification Checklist

After all phases:

```bash
# Auth flow
curl -X POST /auth/register -d '{"email":"a@b.com","password":"securepass"}' → 201
curl -X POST /auth/login -d '{"email":"a@b.com","password":"securepass"}' → 200 + tokens
curl -X POST /auth/refresh -d '{"refresh_token":"..."}' → 200 + new access token
curl -X GET /auth/me -H "Authorization: Bearer <token>" → 200 + user profile

# Protection
curl -X GET /users → 401
curl -X GET /users -H "Authorization: Bearer <user_token>" → 200
curl -X POST /users -H "Authorization: Bearer <user_token>" → 403
curl -X POST /users -H "Authorization: Bearer <admin_token>" → 201

# Tests
pytest tests/ -v → all pass
```
