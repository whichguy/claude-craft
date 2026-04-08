# Plan: Add Authentication and Security Improvements

## Context

This plan addresses the following requirements from the user's request:
- Add authentication to the application
- Improve the login page design and UX
- Implement rate limiting for API endpoints
- Add API key support for partner integrations
- Extend session timeout duration

Current stack: Express.js backend with React frontend, Passport.js for authentication, MongoDB for data persistence.

## Git Setup

Ensure we're on a clean branch:
```bash
git checkout -b feature/auth-and-security-improvements
git pull origin main
```

## Phase 1: Update Authentication Strategy

### Step 1: Configure Passport.js Strategy
Update the Passport.js configuration to use JWT tokens instead of sessions:

**File: `/Users/jwiese/src/backend/config/passport.js`**
```javascript
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../models/User');

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET
};

passport.use(new JwtStrategy(opts, async (jwt_payload, done) => {
  try {
    const user = await User.findById(jwt_payload.id);
    if (user) {
      return done(null, user);
    }
    return done(null, false);
  } catch (error) {
    return done(error, false);
  }
}));
```

### Step 2: Create Authentication Middleware
**File: `/Users/jwiese/src/backend/middleware/auth.js`**
```javascript
const passport = require('passport');

exports.requireAuth = passport.authenticate('jwt', { session: false });

exports.optionalAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (user) req.user = user;
    next();
  })(req, res, next);
};
```

### Step 3: Update User Model
Add fields for password hashing and JWT token management:

**File: `/Users/jwiese/src/backend/models/User.js`**
```javascript
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  refreshToken: String,
  tokenVersion: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};
```

### Step 4: Commit Phase 1
```bash
git add backend/config/passport.js backend/middleware/auth.js backend/models/User.js
git commit -m "feat: update authentication strategy to JWT"
```

## Phase 2: Implement Login and Registration Endpoints

### Step 1: Create Auth Controller
**File: `/Users/jwiese/src/backend/controllers/authController.js`**
```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    const user = new User({ email, password });
    await user.save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### Step 2: Create Auth Routes
**File: `/Users/jwiese/src/backend/routes/auth.js`**
```javascript
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);

module.exports = router;
```

### Step 3: Commit Phase 2
```bash
git add backend/controllers/authController.js backend/routes/auth.js
git commit -m "feat: add login and registration endpoints"
```

## Phase 3: Redesign Login Page UI

### Step 1: Create New Login Component
**File: `/Users/jwiese/src/frontend/components/Login/Login.jsx`**
```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.token);
        navigate('/dashboard');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Welcome Back</h1>
        <p className="subtitle">Sign in to your account</p>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="login-button">Sign In</button>
        </form>
        <div className="login-footer">
          <a href="/forgot-password">Forgot password?</a>
          <span>·</span>
          <a href="/register">Create account</a>
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Add Login Styles
**File: `/Users/jwiese/src/frontend/components/Login/Login.css`**
```css
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  background: white;
  border-radius: 12px;
  padding: 48px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 420px;
}

.login-card h1 {
  font-size: 32px;
  margin-bottom: 8px;
  color: #1a202c;
}

.subtitle {
  color: #718096;
  margin-bottom: 32px;
}

.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #2d3748;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.login-button {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.login-button:hover {
  transform: translateY(-2px);
}

.error-message {
  padding: 12px;
  background: #fed7d7;
  color: #c53030;
  border-radius: 8px;
  margin-bottom: 24px;
}

.login-footer {
  margin-top: 24px;
  text-align: center;
  color: #718096;
}

.login-footer a {
  color: #667eea;
  text-decoration: none;
}

.login-footer span {
  margin: 0 8px;
}
```

### Step 3: Commit Phase 3
```bash
git add frontend/components/Login/
git commit -m "feat: redesign login page with modern UI"
```

## Phase 4: Implement Rate Limiting

### Step 1: Install and Configure Redis Rate Limiter
**File: `/Users/jwiese/src/backend/middleware/rateLimiter.js`**
```javascript
const redis = require('redis');
const { RateLimiterRedis } = require('rate-limiter-flexible');

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  enable_offline_queue: false
});

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rate_limit',
  points: 100,
  duration: 60,
});

const rateLimiterStrict = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rate_limit_strict',
  points: 5,
  duration: 60,
});

exports.rateLimitMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (error) {
    res.status(429).json({ error: 'Too many requests' });
  }
};

exports.rateLimitAuthMiddleware = async (req, res, next) => {
  try {
    await rateLimiterStrict.consume(req.ip);
    next();
  } catch (error) {
    res.status(429).json({ error: 'Too many login attempts' });
  }
};
```

### Step 2: Apply Rate Limiting to Routes
**File: `/Users/jwiese/src/backend/app.js`**
```javascript
const { rateLimitMiddleware, rateLimitAuthMiddleware } = require('./middleware/rateLimiter');

// Apply general rate limiting to all routes
app.use('/api', rateLimitMiddleware);

// Apply strict rate limiting to auth routes
app.use('/api/auth/login', rateLimitAuthMiddleware);
app.use('/api/auth/register', rateLimitAuthMiddleware);
```

### Step 3: Commit Phase 4
```bash
git add backend/middleware/rateLimiter.js backend/app.js
git commit -m "feat: add Redis-based rate limiting"
```

## Phase 5: Add API Key Support for Partners

### Step 1: Create API Key Model
**File: `/Users/jwiese/src/backend/models/ApiKey.js`**
```javascript
const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  partner: { type: String, required: true },
  permissions: [String],
  isActive: { type: Boolean, default: true },
  lastUsed: Date,
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date
});

apiKeySchema.statics.generate = function(partner, permissions) {
  const key = 'pk_' + crypto.randomBytes(32).toString('hex');
  return this.create({ key, partner, permissions });
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
```

### Step 2: Create API Key Middleware
**File: `/Users/jwiese/src/backend/middleware/apiKey.js`**
```javascript
const ApiKey = require('../models/ApiKey');

exports.requireApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }
    
    const keyDoc = await ApiKey.findOne({ key: apiKey, isActive: true });
    if (!keyDoc) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    if (keyDoc.expiresAt && keyDoc.expiresAt < new Date()) {
      return res.status(401).json({ error: 'API key expired' });
    }
    
    keyDoc.lastUsed = new Date();
    await keyDoc.save();
    
    req.apiKey = keyDoc;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.apiKey || !req.apiKey.permissions.includes(permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
```

### Step 3: Create Partner API Routes
**File: `/Users/jwiese/src/backend/routes/partner.js`**
```javascript
const express = require('express');
const router = express.Router();
const { requireApiKey, requirePermission } = require('../middleware/apiKey');

router.use(requireApiKey);

router.get('/data', requirePermission('read'), async (req, res) => {
  // Partner data endpoint
  res.json({ message: 'Partner data access granted' });
});

router.post('/webhook', requirePermission('webhook'), async (req, res) => {
  // Partner webhook endpoint
  res.json({ message: 'Webhook received' });
});

module.exports = router;
```

### Step 4: Commit Phase 5
```bash
git add backend/models/ApiKey.js backend/middleware/apiKey.js backend/routes/partner.js
git commit -m "feat: add API key authentication for partner integrations"
```

## Phase 6: Extend Session Timeout

### Step 1: Update JWT Expiration
**File: `/Users/jwiese/src/backend/controllers/authController.js`**
```javascript
// Update token generation to use 30 days instead of 7 days
const token = jwt.sign(
  { id: user._id }, 
  process.env.JWT_SECRET, 
  { expiresIn: '30d' }
);

const refreshToken = jwt.sign(
  { id: user._id, version: user.tokenVersion },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: '90d' }
);
```

### Step 2: Update Frontend Token Storage
**File: `/Users/jwiese/src/frontend/utils/auth.js`**
```javascript
export const TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

export function setAuthToken(token) {
  localStorage.setItem('token', token);
  localStorage.setItem('tokenSetAt', Date.now().toString());
}

export function isTokenValid() {
  const token = localStorage.getItem('token');
  const tokenSetAt = parseInt(localStorage.getItem('tokenSetAt'));
  
  if (!token || !tokenSetAt) return false;
  
  const now = Date.now();
  return (now - tokenSetAt) < TOKEN_EXPIRY;
}
```

### Step 3: Add Token Refresh Logic
**File: `/Users/jwiese/src/frontend/hooks/useAuth.js`**
```javascript
import { useEffect } from 'react';
import { isTokenValid, setAuthToken } from '../utils/auth';

export function useAuth() {
  useEffect(() => {
    const checkToken = async () => {
      if (!isTokenValid()) {
        try {
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include'
          });
          const data = await response.json();
          if (response.ok) {
            setAuthToken(data.token);
          } else {
            window.location.href = '/login';
          }
        } catch (error) {
          window.location.href = '/login';
        }
      }
    };
    
    checkToken();
    const interval = setInterval(checkToken, 60 * 60 * 1000); // Check every hour
    
    return () => clearInterval(interval);
  }, []);
}
```

### Step 4: Commit Phase 6
```bash
git add backend/controllers/authController.js frontend/utils/auth.js frontend/hooks/useAuth.js
git commit -m "feat: extend session timeout to 30 days with refresh token support"
```

## Phase 7: Update Environment Configuration

### Step 1: Update .env.example
**File: `/Users/jwiese/src/.env.example`**
```
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-jwt-refresh-secret-here
REDIS_HOST=localhost
REDIS_PORT=6379
MONGODB_URI=mongodb://localhost:27017/myapp
```

### Step 2: Update Documentation
**File: `/Users/jwiese/src/docs/AUTH.md`**
```markdown
# Authentication & Security

## Overview
The application now supports:
- JWT-based authentication with 30-day sessions
- Rate limiting on all API endpoints
- Partner API key authentication
- Modern login UI

## Setup
1. Set environment variables in .env
2. Ensure Redis is running for rate limiting
3. Generate API keys for partners using the admin panel

## API Key Management
Partners can use API keys by including the `X-API-Key` header in requests.
```

### Step 3: Commit Phase 7
```bash
git add .env.example docs/AUTH.md
git commit -m "docs: update configuration and authentication documentation"
```
