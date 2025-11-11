# Deployment Documentation

This document provides instructions for deploying the Casino Research Assistant backend to production environments.

## Prerequisites

- Node.js (LTS version)
- PostgreSQL database (Neon, Supabase, Railway, or self-hosted)
- Environment variables configured
- Access to deployment platform (Railway, Render, Vercel, etc.)

## Environment Setup

### Required Environment Variables

Create a `.env` file or configure environment variables in your deployment platform:

```bash
# Application
NODE_ENV=production
PORT=3000

# PostgreSQL Database Configuration
DATABASE_URL=postgresql://user:password@host:5432/database

# Testing (for CI/CD)
DATABASE_URL_TEST=postgresql://user:password@host:5432/test_database

# Perplexity API
PERPLEXITY_API_KEY=pplx-xxxxx

# Reel Edge DB
REEL_EDGE_API_URL=https://xhks-nxia-vlqr.n7c.xano.io/api:1ZwRS-f0

# Research Settings
RESEARCH_SCHEDULE_CRON=0 0 * * *
PERPLEXITY_RATE_LIMIT_RPM=20
PROMOTION_BATCH_SIZE=7

# NextAuth (for session validation)
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=https://your-domain.com

# CORS
CORS_ORIGIN=https://your-frontend-domain.com
```

## Database Migrations

### Production Database

Before deploying, ensure your production database is set up and migrations are applied:

```bash
# Set production database URL
export DATABASE_URL=postgresql://user:password@host:5432/database

# Run migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

### Test Database

For CI/CD pipelines, set up a separate test database:

```bash
# Set test database URL
export DATABASE_URL_TEST=postgresql://user:password@host:5432/test_database

# Run migrations on test database
DATABASE_URL=$DATABASE_URL_TEST npx prisma migrate deploy
```

## Deployment Platforms

### Railway

1. **Create a new project** on Railway
2. **Connect your repository** (GitHub, GitLab, etc.)
3. **Add PostgreSQL service**:
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically set `DATABASE_URL`
4. **Configure environment variables**:
   - Go to your service → Variables
   - Add all required environment variables
5. **Deploy**:
   - Railway will automatically detect NestJS and run `npm install` and `npm run build`
   - Start command: `npm run start:prod`
6. **Run migrations**:
   - Use Railway CLI or add a one-time service to run migrations:
   ```bash
   railway run npx prisma migrate deploy
   ```

### Render

1. **Create a new Web Service** on Render
2. **Connect your repository**
3. **Configure build settings**:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:prod`
4. **Add PostgreSQL database**:
   - Create a new PostgreSQL database
   - Copy the internal database URL
5. **Set environment variables** in the Render dashboard
6. **Deploy**:
   - Render will automatically build and deploy
7. **Run migrations**:
   - Use Render Shell or add a one-time script:
   ```bash
   npx prisma migrate deploy
   ```

### Vercel (Serverless)

**Note**: Vercel is serverless and may have limitations with long-running processes like research jobs.

1. **Create a new project** on Vercel
2. **Import your repository**
3. **Configure build settings**:
   - Framework Preset: Other
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
4. **Add environment variables** in Vercel dashboard
5. **Deploy**

**Important**: For serverless deployments, consider:

- Using external job queue (BullMQ, AWS SQS)
- Moving scheduled jobs to a separate service
- Using Vercel Cron Jobs for scheduled tasks

## Post-Deployment Checklist

- [ ] Verify database migrations are applied
- [ ] Test API endpoints are accessible
- [ ] Verify Swagger documentation is available at `/api/docs`
- [ ] Test research workflow (start/stop research)
- [ ] Monitor logs for errors
- [ ] Verify environment variables are correctly set
- [ ] Test database connection
- [ ] Verify external API connections (Perplexity, Reel Edge)
- [ ] Set up monitoring and alerting (optional)
- [ ] Configure backup strategy for database

## Database Backup Strategy

### Automated Backups

Most PostgreSQL providers (Neon, Supabase, Railway) offer automated backups:

- **Neon**: Automatic point-in-time recovery
- **Supabase**: Daily backups with 7-day retention
- **Railway**: Manual backups via CLI

### Manual Backup

```bash
# Create backup
pg_dump $DATABASE_URL > backup.sql

# Restore backup
psql $DATABASE_URL < backup.sql
```

## Monitoring

### Health Checks

The API includes basic health endpoints. Set up monitoring to check:

- `GET /` - Basic health check
- `GET /dashboard/state-stats` - Verify API is responding

### Logging

- Application logs are output to stdout/stderr
- Use platform-specific log aggregation (Railway logs, Render logs, etc.)
- Consider integrating with external logging services (Logtail, Datadog, etc.)

### Error Tracking

Consider integrating error tracking:

- Sentry
- Rollbar
- Bugsnag

## Scaling Considerations

### Database Connection Pooling

For high-traffic deployments, configure connection pooling:

```typescript
// In Prisma schema or connection string
DATABASE_URL=postgresql://user:password@host:5432/database?connection_limit=10
```

### Rate Limiting

The application includes rate limiting for Perplexity API. Monitor usage and adjust:

- `PERPLEXITY_RATE_LIMIT_RPM`: Requests per minute
- `PROMOTION_BATCH_SIZE`: Casinos per batch

### Background Jobs

For production, consider:

- Moving scheduled jobs to a dedicated worker service
- Using a job queue (BullMQ, AWS SQS) for research jobs
- Implementing job retry logic

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Verify `DATABASE_URL` is correct
   - Check database is accessible from deployment platform
   - Verify firewall rules allow connections

2. **Migration Failures**:
   - Check database user has necessary permissions
   - Verify migrations are up to date
   - Check for conflicting migrations

3. **Environment Variable Issues**:
   - Verify all required variables are set
   - Check for typos in variable names
   - Ensure secrets are properly configured

4. **Build Failures**:
   - Check Node.js version matches `.nvmrc` or `package.json`
   - Verify all dependencies are installable
   - Check for TypeScript compilation errors

### Getting Help

- Check application logs in deployment platform
- Review error messages in Swagger UI
- Consult Prisma migration logs
- Check external API status (Perplexity, Reel Edge)

## Security Considerations

1. **Environment Variables**: Never commit secrets to version control
2. **Database Access**: Use strong passwords and restrict access
3. **API Keys**: Rotate API keys regularly
4. **CORS**: Configure `CORS_ORIGIN` to restrict access
5. **HTTPS**: Always use HTTPS in production
6. **Session Security**: Use secure, HTTP-only cookies for NextAuth

## Rollback Procedure

If deployment fails:

1. **Revert code** to previous working version
2. **Revert database migrations** (if needed):
   ```bash
   npx prisma migrate resolve --rolled-back <migration_name>
   ```
3. **Redeploy** previous version
4. **Verify** application is working

## Support

For deployment issues:

- Check platform-specific documentation
- Review application logs
- Consult team documentation
- Contact platform support if needed
