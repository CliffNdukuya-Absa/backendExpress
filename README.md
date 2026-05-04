# backendexpress

Backend API for user registration, login, JWT authentication, and per-user subject selection.

## Required Tools and Versions

Use the following tools to run the project:

- Node.js: 20.x LTS (tested with v20.20.1)
- npm: 10.x (comes with Node.js 20)
- PostgreSQL: 13+ (recommended 14/15/16)

## Project Dependencies

Installed npm packages from package.json:

- bcrypt: ^6.0.0
- cookie-parser: ~1.4.4
- debug: ~2.6.9
- dotenv: ^17.4.2
- express: ~4.16.1
- http-errors: ~1.6.3
- jade: ~1.11.0
- jsonwebtoken: ^9.0.3
- morgan: ~1.9.1
- pg: ^8.20.0

Note: The app currently runs as API-only. Jade remains in dependencies but is not required for API behavior.

## Environment Variables

Create a .env file in the project root with:

DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password
PORT=3000
JWT_SECRET=your_strong_secret_here
JWT_EXPIRES_IN=1h

Notes:

- JWT_SECRET should always be set in real environments.
- If JWT_SECRET is missing, the app uses an insecure fallback secret for development only.

## Setup and Run

1. Install dependencies:

npm install

2. Ensure PostgreSQL is running and database credentials in .env are valid.

3. Start the server:

npm start

4. API base URL:

http://localhost:3000

## Database Tables Created on Startup

The app auto-creates these tables when it starts:

- users
  - id (SERIAL PRIMARY KEY)
  - name
  - surname
  - email (UNIQUE)
  - password_hash
  - created_at

- user_subjects
  - user_id (FK -> users.id)
  - subject_name
  - PRIMARY KEY (user_id, subject_name)

## API Endpoints

### Health

- GET /
  - Response: { "message": "Backend API is running." }

### Auth

- POST /users/register
  - Body:
    {
      "name": "John",
      "surname": "Doe",
      "email": "john@example.com",
      "password": "password123"
    }
  - Response: user object + JWT token

- POST /users/login
  - Body:
    {
      "email": "john@example.com",
      "password": "password123"
    }
  - Response: user object + JWT token

### Subjects (JWT Protected)

For protected endpoints, send:

Authorization: Bearer <token>

- POST /users/subjects
  - Purpose: Sync user subjects with frontend list (removes missing entries, inserts new entries)
  - Body:
    {
      "email": "john@example.com",
      "subjects": ["Mathematics", "English", "History"]
    }
  - Notes:
    - subjects must be an array
    - If email is provided, it must match token email

- GET /users/subjectslist?email=john@example.com
  - Purpose: Return all subjects linked to authenticated user
  - Notes:
    - Query email is optional
    - If provided, it must match token email

## Quick Test Flow

1. Register a user via POST /users/register
2. Copy token from response
3. Call POST /users/subjects with Authorization header and subjects array
4. Call GET /users/subjectslist with same Authorization header

## Troubleshooting

- Cannot connect to database:
  - Re-check DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
  - Confirm PostgreSQL service is running

- 401 Invalid or expired token:
  - Ensure Authorization header is present and valid
  - Re-login to get a fresh token

- 403 Token user does not match email:
  - Use the same email as encoded in the JWT
