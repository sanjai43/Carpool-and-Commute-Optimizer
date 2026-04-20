# Salesforce JWT OAuth (Connected App) – click-by-click

## 0) Local keypair (required)

Run on your machine:

```bash
mkdir -p ~/carshary-sf-jwt
cd ~/carshary-sf-jwt
openssl genrsa -out server.key 2048
openssl req -new -x509 -key server.key -out server.crt -days 3650 -subj "/CN=carshary-jwt"
```

Keep `server.key` secret. Upload `server.crt` to the Connected App.

## 1) Create Connected App

1. Salesforce → **Setup**
2. Quick Find: **App Manager**
3. Click **New Connected App**
4. Fill:
   - Connected App Name: `CarShary JWT`
   - Contact Email: your email
5. In **API (Enable OAuth Settings)**:
   - Check **Enable OAuth Settings**
   - Callback URL: `http://localhost:5173/oauth/callback`
   - Selected OAuth Scopes:
     - `api`
     - `refresh_token, offline_access`
6. In **Use digital signatures**:
   - Check **Use digital signatures**
   - Upload `server.crt`
7. Click **Save**
8. Wait ~5–10 minutes (Connected App can take time to activate)

## 2) Connected App policies (must do)

1. Setup → App Manager → find `CarShary JWT`
2. Click the dropdown → **Manage**
3. Click **Edit Policies**
4. Set **Permitted Users** = **Admin approved users are pre-authorized**
5. Save

## 3) Pre-authorize via Permission Set

1. Setup → **Permission Sets**
2. Open `CarShary Integration Access`
3. **Manage Assignments** → **Add Assignments** → assign your Integration User
4. Setup → Quick Find: **Connected Apps OAuth Usage** (or “Connected Apps”)
5. Open `CarShary JWT` → **Manage Permission Sets**
6. Add `CarShary Integration Access`

## 4) Backend env (.env)

Create: `backend/.env`

```env
SF_LOGIN_URL=https://login.salesforce.com
SF_AUDIENCE=https://login.salesforce.com
SF_CLIENT_ID=PASTE_CONNECTED_APP_CONSUMER_KEY
SF_USERNAME=integration-user-username
SF_PRIVATE_KEY_PATH=/Users/<you>/carshary-sf-jwt/server.key
```

