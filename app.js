require('dotenv').config();

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var db = require('./db');

// Verify database connection and initialize tables on startup
db.connect()
  .then(async (client) => {
    console.log('Connected to PostgreSQL database:', process.env.DB_NAME);
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          surname VARCHAR(100) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Users table ready.');

      await client.query(`
        CREATE TABLE IF NOT EXISTS user_subjects (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          subject_name VARCHAR(100) NOT NULL,
          PRIMARY KEY (user_id, subject_name)
        )
      `);
      console.log('User_subjects table ready.');
    } finally {
      client.release();
    }
  })
  .catch((err) => {
    console.error('Failed to connect to PostgreSQL:', err.message);
  });

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
// app.use(function(req, res, next) {
//   next(createError(404));
// });

// error handler
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.json({
    error: err.message || 'Internal server error.'
  });
});

module.exports = app;
