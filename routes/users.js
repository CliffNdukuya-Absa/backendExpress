var express = require('express');
var router = express.Router();
var bcrypt = require('bcrypt');
var jwt = require('jsonwebtoken');
var db = require('../db');

const SALT_ROUNDS = 10; // matches BCryptPasswordEncoder default strength
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set. Using an insecure development fallback secret.');
}

function generateToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      surname: user.surname,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const token = authHeader.slice(7);
  try {
    req.authUser = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/* POST /users/register */
router.post('/register', async function (req, res) {
  const { name, email, password, surname } = req.body;

  // Basic validation
  if (!name || !surname || !email || !password) {
    return res.status(400).json({ error: 'name, surname, email, and password are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    // Check for existing email
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already in use.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert new user
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, surname)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, surname, email`,
      [name, email, hashedPassword, surname]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    return res.status(201).json({ user, token });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/* POST /users/subjects — select subjects after registration, identified by email */
router.post('/subjects', authenticateToken, async function (req, res) {
  const { email, subjects } = req.body;
  const tokenEmail = req.authUser.email;
  const requestedEmail = typeof email === 'string' ? email.trim() : '';

  if (requestedEmail && requestedEmail !== tokenEmail) {
    return res.status(403).json({ error: 'Token user does not match provided email.' });
  }

  if (!Array.isArray(subjects)) {
    return res.status(400).json({ error: 'subjects must be an array.' });
  }

  const client = await db.connect();
  try {
    // Verify user exists by email
    const userCheck = await client.query('SELECT id FROM users WHERE email = $1', [tokenEmail]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const userId = userCheck.rows[0].id;

    const normalizedSubjects = [...new Set(
      subjects
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter((s) => s.length > 0)
    )];
    await client.query('BEGIN');

    // Remove subjects no longer present in frontend array, then insert missing ones.
    await client.query(
      `DELETE FROM user_subjects
       WHERE user_id = $1
         AND NOT (subject_name = ANY($2::text[]))`,
      [userId, normalizedSubjects]
    );

    for (const subjectName of normalizedSubjects) {
      await client.query(
        `INSERT INTO user_subjects (user_id, subject_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, subjectName]
      );
    }

    await client.query('COMMIT');

    return res.status(200).json({ message: 'Subjects saved successfully.', subjects: normalizedSubjects });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Subjects error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
});

/* GET /users/subjectslist?email=... — fetch all subjects linked to a user */
router.get('/subjectslist', authenticateToken, async function (req, res) {
  const queryEmail = typeof req.query.email === 'string' ? req.query.email.trim() : '';
  const tokenEmail = req.authUser.email;

  if (queryEmail && queryEmail !== tokenEmail) {
    return res.status(403).json({ error: 'Token user does not match query email.' });
  }

  try {
    const userResult = await db.query(
      'SELECT id, name, surname, email FROM users WHERE email = $1',
      [tokenEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = userResult.rows[0];
    const subjectsResult = await db.query(
      'SELECT subject_name FROM user_subjects WHERE user_id = $1 ORDER BY subject_name ASC',
      [user.id]
    );

    return res.status(200).json({
      subjects: subjectsResult.rows.map((row) => row.subject_name),
    });
  } catch (err) {
    console.error('Subjects list error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/login', async function (req, res) {
  const{email,password}=req.body;
  console.log('Body received:', req.body);
try{
    const existing = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length <= 0) {
      return res.status(409).json({ error: 'User does not exist.' });
    }

    const isValidPassword = await bcrypt.compare(password, existing.rows[0].password_hash);
    if (!isValidPassword) {
        return res.status(409).json({ error: 'Incorrect password.' });
    }

    const user = {
      id: existing.rows[0].id,
      name: existing.rows[0].name,
      surname: existing.rows[0].surname,
      email: existing.rows[0].email,
    };
    const token = generateToken(user);

    return res.status(200).json({ user, token });
}
catch(err){
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
}

});

module.exports = router;
