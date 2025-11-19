import serviceAccount from '../config/tripblip-firebase-adminsdk-fbsvc-4461c645c4.json';

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

const firebaseConfig: FirebaseConfig = {
  type: serviceAccount.type,
  project_id: serviceAccount.project_id,
  private_key_id: serviceAccount.private_key_id,
  private_key: serviceAccount.private_key.replace(/\\n/g, '\n'),
  client_email: serviceAccount.client_email,
  client_id: serviceAccount.client_id,
  auth_uri: serviceAccount.auth_uri,
  token_uri: serviceAccount.token_uri,
  auth_provider_x509_cert_url: serviceAccount.auth_provider_x509_cert_url,
  client_x509_cert_url: serviceAccount.client_x509_cert_url,
  databaseURL: 'https://tripblip-mag-default-rtdb.firebaseio.com'
};

export default firebaseConfig;

