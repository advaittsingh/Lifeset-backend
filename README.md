# LifeSet Backend

Standalone backend API for the LifeSet Platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Set up the database:
```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

4. Start the development server:
```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server with watch mode
- `npm run build` - Build for production
- `npm run start:prod` - Start production server
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio
- `npm run test` - Run tests

## Project Structure

- `src/` - Source code
  - `shared/` - Shared types and interfaces (formerly @lifeset/shared)
  - `auth/` - Authentication module
  - `users/` - User management
  - `feeds/` - Feed management
  - And other feature modules...

## Authentication & Session Management

The backend supports persistent user sessions with long-lived refresh tokens:

### Token Expiration
- **Access Tokens**: Valid for 7 days (configurable via `JWT_EXPIRES_IN` env var)
- **Refresh Tokens**: Valid for 90 days (configurable via `JWT_REFRESH_EXPIRES_IN` env var, defaults to `'90d'`)

### Session Persistence
- Sessions are stored in the database and persist across app restarts
- Users can be logged in on multiple devices simultaneously (multi-device support)
- Use the `/auth/restore-session` endpoint on app startup to restore user sessions

### Environment Variables
Required authentication variables:
- `JWT_SECRET` - Secret for signing access tokens (required)
- `JWT_REFRESH_SECRET` - Secret for signing refresh tokens (required)

Optional authentication variables:
- `JWT_EXPIRES_IN` - Access token expiration time (default: `'7d'`)
- `JWT_REFRESH_EXPIRES_IN` - Refresh token expiration time (default: `'90d'`)

### API Documentation
For detailed implementation guide for mobile apps, see [Session Persistence API Documentation](./docs/SESSION_PERSISTENCE_API.md).

## Notes

This is a standalone version of the backend, previously part of a monorepo. All shared types have been integrated directly into `src/shared/`.
