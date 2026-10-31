# Mobile Repair Project

A web-based mobile device repair management system built with Next.js, React, Prisma, and PostgreSQL.

## Main Features

- Customer registration and authentication.
- Device repair requests and service tracking.
- Technician and repair management.
- Spare parts and inventory management.
- Customer quotation approval.
- Orders, payments, and Stripe integration.
- Admin dashboard and reports.

## Technology Stack

- Next.js 16
- React 19
- TypeScript
- Prisma ORM 6
- PostgreSQL 17
- Neon PostgreSQL
- Redis
- SendGrid
- Twilio
- Stripe

## Requirements

- Node.js
- npm
- PostgreSQL-compatible database (Neon recommended)

## Local Setup

1. Clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create your environment file:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Configure the environment variables in `.env`.

5. Generate the Prisma Client:

   ```bash
   npx prisma generate
   ```

6. Start the development server:

   ```bash
   npm run dev
   ```

7. Open http://localhost:3000.

## Database

The project uses PostgreSQL through Prisma ORM.

- `DATABASE_URL`: pooled database connection for application runtime.
- `DIRECT_URL`: direct database connection for Prisma CLI operations.

For a new database, review the existing Prisma migrations before applying them:

```bash
npx prisma migrate deploy
```

## Production Build

```bash
npm run build
```

## Deployment

The application is intended for deployment on Vercel with a Neon PostgreSQL database.

Configure all required environment variables in the deployment platform before deploying.

## Security

- Never commit `.env` or other files containing secrets.
- Never publish database connection strings, API keys, or passwords.
- Keep the GitHub repository private.
- Use strong production secrets and rotate any credentials that may have been exposed.

## License

Private project. All rights reserved.
