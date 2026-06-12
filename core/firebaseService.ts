import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// Ensure you have the GOOGLE_APPLICATION_CREDENTIALS environment variable set
// or provide the service account credentials directly in initializeApp().
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Pushes test execution metadata to the 'test_reports' Firestore collection.
 * 
 * @param result The test result metadata object to log.
 */
export async function logTestResult(result: object): Promise<void> {
  try {
    const collectionRef = db.collection('test_reports');
    await collectionRef.add({
      ...result,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('Test result logged successfully to Firestore test_reports collection.');
  } catch (error) {
    console.error('Failed to log test result to Firestore:', error);
  }
}
