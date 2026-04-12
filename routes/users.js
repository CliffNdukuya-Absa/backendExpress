var express = require('express');
var router = express.Router();
var bcrypt = require('bcrypt');
var db = require('../db');

// BCrypt is fully compatible with Java's Spring Security BCryptPasswordEncoder.
// Hashes produced here ($2b$) are verifiable by BCryptPasswordEncoder.matches()
// and vice versa — both sides share the same database column.
const SALT_ROUNDS = 10; // matches BCryptPasswordEncoder default strength

/* POST /users/register */
router.post('/register', async function (req, res) {
  const { username, email, password, displayName } = req.body;

  // Basic validation
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    // Check for existing username or email
    const existing = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already in use.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert new user
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, display_name AS "displayName", created_at AS "createdAt"`,
      [username, email, hashedPassword, displayName || null]
    );

    return res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/login', async function (req, res) {
  const{username,password}=req.body;

try{
    const existing = await db.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (existing.rows.length <= 0) {
      return res.status(409).json({ error: 'Username does not exist.' });
    }

    if(!bcrypt.compare(password, existing.rows[0].password_hash)){
        return res.status(409).json({ error: 'Incorrect password.' });
    }

    return res.status(200).json({ user: existing.rows[0].username +" is logged in" });
}
catch(err){
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
}

});

module.exports = router;
