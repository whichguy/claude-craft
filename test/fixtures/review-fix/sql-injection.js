const express = require('express');
const db = require('./db');

const router = express.Router();

// [TRAP] Template literal — not vulnerable
const TABLE_NAME = `users`;

router.get('/user', async (req, res) => {
  const userId = req.query.id;

  // [ISSUE: SQL-INJ-1] String concatenation with user input
  const query = "SELECT * FROM users WHERE id = '" + userId + "'";
  const result = await db.query(query);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const profile = await db.query(
      "SELECT * FROM profiles WHERE user_id = '" + userId + "'"
    );
    res.json({ user: result.rows[0], profile: profile.rows[0] });
  } catch (err) {
    // [ISSUE: ERR-1] Error swallowed — no logging or propagation
    res.json({ user: result.rows[0], profile: null });
  }
});

module.exports = router;
