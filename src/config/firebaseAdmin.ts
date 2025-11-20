import admin from 'firebase-admin';

// Firebase config is optional - can be provided via environment variables or JSON file
let serviceAccount: admin.ServiceAccount | undefined;

try {
  // Try to load from JSON file (if it exists)
  // @ts-ignore - JSON file may not exist, handled via try/catch
  const serviceAccountFile = require('./tripblip-mag-firebase-adminsdk-fbsvc-4461c645c4.json');
  serviceAccount = serviceAccountFile as admin.ServiceAccount;
} catch (error) {
  // If file doesn't exist, try to load from environment variables
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID || 'tripblip-mag',
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || '',
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID || '',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: ''
    } as admin.ServiceAccount;
  }
}

if (!admin.apps.length && serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'tripblip-mag-default-rtdb.firebaseio.com'
  });
}

const auth = admin.apps.length > 0 ? admin.auth() : null;
const firestore = admin.apps.length > 0 ? admin.firestore() : null;
const realtimeDB = admin.apps.length > 0 ? admin.database() : null;

export { admin, auth, firestore, realtimeDB };

