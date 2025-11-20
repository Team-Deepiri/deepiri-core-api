// Firebase config is optional - can be provided via environment variables or JSON file
interface FirebaseConfig {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  databaseURL: string;
}

let serviceAccount: any;

try {
  // Try to load from JSON file (if it exists)
  // @ts-ignore - JSON file may not exist, handled via try/catch
  serviceAccount = require('../config/tripblip-firebase-adminsdk-fbsvc-4461c645c4.json');
} catch (error) {
  // If file doesn't exist, create a default config from environment variables
  serviceAccount = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID || 'tripblip-mag',
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || '',
    private_key: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL || '',
    client_id: process.env.FIREBASE_CLIENT_ID || '',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: ''
  };
}

const firebaseConfig: FirebaseConfig = {
  type: serviceAccount.type || 'service_account',
  project_id: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || 'tripblip-mag',
  private_key_id: serviceAccount.private_key_id || process.env.FIREBASE_PRIVATE_KEY_ID || '',
  private_key: (serviceAccount.private_key || process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  client_email: serviceAccount.client_email || process.env.FIREBASE_CLIENT_EMAIL || '',
  client_id: serviceAccount.client_id || process.env.FIREBASE_CLIENT_ID || '',
  auth_uri: serviceAccount.auth_uri || 'https://accounts.google.com/o/oauth2/auth',
  token_uri: serviceAccount.token_uri || 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: serviceAccount.auth_provider_x509_cert_url || 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: serviceAccount.client_x509_cert_url || '',
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://tripblip-mag-default-rtdb.firebaseio.com'
};

export default firebaseConfig;

