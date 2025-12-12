import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import process from 'node:process';
import admin from 'firebase-admin';

// Usage:
// 1) Place your service account JSON at scripts/serviceAccountKey.json
// 2) Run: node scripts/set-admin.mjs --email="gestor.frota@xingumaquinas.com" --password="xingu2025"
//    or set env EMAIL/PASSWORD

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

function getArg(name, fallback) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (arg) return arg.split('=')[1];
  return process.env[name.toUpperCase()] || fallback;
}

const email = getArg('email', 'gestor.frota@xingumaquinas.com');
const password = getArg('password', 'xingu2025');

const keyPath = getArg('key', path.join(__dirname, 'serviceAccountKey.json'));
if (!fs.existsSync(keyPath)) {
  console.error(`Service account not found at: ${keyPath}\n` +
    'Download it from Firebase Console > Project Settings > Service Accounts, then save as scripts/serviceAccountKey.json or pass --key=path');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function ensureAdminUser(email, password) {
  try {
    let user;
    try {
      user = await admin.auth().getUserByEmail(email);
    } catch (e) {
      if (e.errorInfo?.code === 'auth/user-not-found') {
        user = await admin.auth().createUser({ email, password, emailVerified: true, disabled: false });
      } else {
        throw e;
      }
    }

    // Ensure password (optional update)
    if (password) {
      await admin.auth().updateUser(user.uid, { password });
    }

    // Merge existing claims with role=admin
    const currentClaims = user.customClaims || {};
    if (currentClaims.role !== 'admin') {
      await admin.auth().setCustomUserClaims(user.uid, { ...currentClaims, role: 'admin' });
    }

    // Force token refresh on next sign-in
    await admin.auth().revokeRefreshTokens(user.uid);

    return user.uid;
  } catch (err) {
    console.error('Failed to set admin claim:', err);
    process.exit(1);
  }
}

ensureAdminUser(email, password).then((uid) => {
  console.log('Admin configured successfully');
  console.log('Email:', email);
  console.log('UID:', uid);
  console.log('The user must sign out and sign in again to receive the new token with role=admin.');
});
