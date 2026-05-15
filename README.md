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

Jika n8n API menggunakan sertifikat self-signed (misalnya dev/staging internal), aktifkan mode bypass TLS backend:

```env
N8N_API_BASE_URL=https://n8n.internal/api/v1
N8N_API_KEY=your_api_key
N8N_ALLOW_SELF_SIGNED_TLS=true
```

> ⚠️ Gunakan `N8N_ALLOW_SELF_SIGNED_TLS=true` hanya untuk development/internal network. Untuk production, gunakan sertifikat CA yang valid.


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

## Auth (Keycloak Only)

Backend sekarang **hanya** menerima autentikasi via Keycloak Bearer token.
Header development (`x-user-email`, `x-user-role`) sudah tidak digunakan.

### Step-by-step setup SSO Keycloak + RBAC

1. **Buat Realm dan Client di Keycloak**
   - Realm contoh: `n8n-control-plane`
   - Client backend (confidential) contoh: `ccp-backend`
   - Aktifkan service account jika diperlukan untuk introspection.

2. **Buat role RBAC di Keycloak**
   - `ccp_editor`
   - `ccp_approver`
   - `ccp_admin`
   - User tanpa role di atas akan dianggap `viewer`.

3. **Assign role ke user/group**
   - Gunakan realm roles atau client roles pada client yang sesuai.

4. **Isi konfigurasi backend**
   - Tambahkan environment variables berikut:

```env
OIDC_ISSUER_URL=https://<keycloak-host>/realms/<realm-name>
OIDC_CLIENT_ID=ccp-backend
OIDC_CLIENT_SECRET=<client-secret>
OIDC_AUDIENCE=ccp-backend
```

> `AUTH_MODE` tidak lagi dipakai backend. Variable boleh dihapus dari environment.

5. **Jalankan backend**
   - `cd backend && npm run dev`
   - Backend akan menolak request tanpa `Authorization: Bearer <token>`.

6. **Integrasi frontend ke login Keycloak**
   - Frontend login ke Keycloak (Authorization Code + PKCE).
   - Kirim access token ke backend via header `Authorization`.

7. **Verifikasi RBAC**
   - Endpoint yang butuh `editor` seperti `/api/workflow-maps/commit` akan otomatis mengecek role lewat `requireRole`.
   - Mapping role internal:
     - `ccp_admin` -> `admin`
     - `ccp_approver` -> `approver`
     - `ccp_editor` -> `editor`
     - lainnya -> `viewer`
