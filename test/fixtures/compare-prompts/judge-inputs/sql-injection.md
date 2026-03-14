<GROUND_TRUTH_ISSUES>
[
  {"id": "GT-1", "line": 8, "class": "sql-injection", "description": "User input concatenated directly into SQL query"},
  {"id": "GT-2", "line": 15, "class": "missing-auth", "description": "Admin endpoint lacks authentication check"},
  {"id": "GT-3", "line": 22, "class": "path-traversal", "description": "File path constructed from user input without sanitization"}
]
</GROUND_TRUTH_ISSUES>

<SOURCE_CODE>
// user-api.js
const express = require('express');
const db = require('./db');
const fs = require('fs');
const router = express.Router();

router.get('/search', async (req, res) => {
  const query = `SELECT * FROM users WHERE name = '${req.query.name}'`;  // line 8
  const results = await db.query(query);
  res.json(results);
});

router.post('/admin/reset', async (req, res) => {
  // TODO: add auth
  await db.query('DELETE FROM sessions');  // line 15
  res.json({ ok: true });
});

router.get('/file', async (req, res) => {
  const filePath = './uploads/' + req.query.filename;  // line 22
  res.sendFile(filePath);
});

// helper - intentionally looks suspicious but is safe (parametrized)
router.get('/user/:id', async (req, res) => {
  const result = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  res.json(result);
});
</SOURCE_CODE>

<REVIEW_OUTPUT>
CRITICAL: Line 8 — SQL injection vulnerability. The user-supplied `req.query.name` is interpolated directly into the SQL string. An attacker can inject arbitrary SQL. Fix: use parameterized queries.

CRITICAL: Line 23 — potential SQL injection in /user/:id route. The `req.params.id` value is passed to the query.

ADVISORY: Line 15 — DELETE FROM sessions has no WHERE clause; could be a logic bug.

CRITICAL: Line 20 — path traversal risk. The filename parameter is appended to a base path without validation, allowing directory traversal via `../` sequences.
</REVIEW_OUTPUT>
