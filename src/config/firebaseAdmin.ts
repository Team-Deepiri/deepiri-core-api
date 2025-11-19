import admin from 'firebase-admin';
import serviceAccount from './tripblip-mag-firebase-adminsdk-fbsvc-4461c645c4.json';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    databaseURL: 'tripblip-mag-default-rtdb.firebaseio.com'
  });
}

const auth = admin.auth();
const firestore = admin.firestore();
const realtimeDB = admin.database();

export { admin, auth, firestore, realtimeDB };

