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

## Notes

This is a standalone version of the backend, previously part of a monorepo. All shared types have been integrated directly into `src/shared/`.
