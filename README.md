# Credential Control Panel / Manager

Implementasi fullstack untuk mengelola credential mapping n8n workflow branch-based deployment.

## Struktur

```txt
backend/   Fastify TypeScript API, Git integration, validation, draft, audit
frontend/  React + Vite + Tailwind UI
prisma/    PostgreSQL schema opsional untuk production
scripts/   contoh curl
```

## Constraint yang dijaga

- Repo workflow tetap memakai struktur:
  - `workflows/<workflowId>.json`
  - `workflows/credential-maps/<workflowId>.credentials.json`
- Deployment tetap mapping-only.
- Tidak menyimpan raw credential secret.
- Output JSON final tetap:

```json
{
  "entries": [
    {
      "nodeName": "...",
      "credentialName": "...",
      "credentialId": "..."
    }
  ]
}
```

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Edit `.env`:

```env
REPO_PATH=/absolute/path/to/n8n-workflow-repo
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Buka:

```txt
http://localhost:5173
```

## Dev Auth

Untuk development, frontend mengirim header:

```txt
x-user-email: operator@example.com
x-user-role: editor
```

Production: ganti `backend/src/plugins/auth.ts` ke OIDC/JWT/SSO.
