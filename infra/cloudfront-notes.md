# CloudFront Distribution — Manual Setup Checklist

These steps must be completed once in the AWS Console before `infra/deploy.sh`
can perform invalidations. Replace placeholders in angle brackets.

---

## 1. S3 Bucket

- [ ] Create bucket: `<your-bucket-name>` in `us-east-1` (recommended; no transfer cost to CF)
- [ ] **Block all public access** — CloudFront uses OAC, not a public bucket
- [ ] Enable versioning (optional but recommended for rollback)

## 2. CloudFront Distribution

- [ ] Create distribution → **Origin: S3**
- [ ] **Origin access**: Create new OAC → select it
- [ ] After creation, copy the **generated bucket policy** from the CF console
      and apply it to the S3 bucket (it matches `infra/s3-bucket-policy.json`
      but with your actual account/distribution IDs filled in)
- [ ] **Default root object**: `index.html`
- [ ] **Viewer protocol policy**: Redirect HTTP to HTTPS
- [ ] **Price class**: `PriceClass_100` — US, Canada, Europe, Israel
      (covers the expected player base at lowest cost; upgrade to
      `PriceClass_200` if Asia-Pacific adoption warrants it)

## 3. Cache Behaviors

### Default behavior (`/*`)

| Setting | Value |
|---|---|
| Cache policy | `CachingDisabled` (SPA entry point must always be fresh) |
| Origin request policy | None |
| Compress objects | Yes |

### Assets behavior (`/assets/*`) — add this second behavior

| Setting | Value |
|---|---|
| Cache policy | `CachingOptimized` (Vite hashes all asset filenames) |
| TTL | Default (max-age=31536000 from `deploy.sh` cache-control header) |
| Compress objects | Yes |

## 4. Custom Error Responses — CRITICAL for SPA routing

Client-side routing (React Router, etc.) requires that 403/404 from S3
be rewritten to serve `index.html` with a 200 status.

Add both of these error responses:

| HTTP error code | Response page path | HTTP response code |
|---|---|---|
| 403 | `/index.html` | 200 |
| 404 | `/index.html` | 200 |

Without this, any direct URL navigation or page refresh on a non-root
route will show a CloudFront error page.

## 5. HTTPS / TLS

- [ ] Request a certificate in **ACM (us-east-1)** for your domain
- [ ] Attach it to the distribution under **Custom SSL certificate**
- [ ] Add a CNAME record in your DNS pointing to the CF distribution domain

## 6. Environment variables for deploy.sh

Set these in your shell or CI environment:

```bash
export S3_BUCKET=your-bucket-name
export CF_DIST_ID=EXXXXXXXXXXXX
```

## 7. First deploy

```bash
bash infra/deploy.sh
```

The deploy script builds the app, syncs to S3, and issues a `/*` invalidation.
First invalidation is free; subsequent ones are $0.005/path after 1000/month.
