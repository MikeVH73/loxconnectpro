const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin with your service account
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function backupAndDeleteGeneralMessages() {
  try {
    // First, get all documents from generalMessages
    const snapshot = await db.collection('generalMessages').get();
    
    // Create backup data
    const backupData = [];
    snapshot.forEach(doc => {
      backupData.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Save backup to file
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `generalMessages_backup_${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    
    console.log(`Backup created at: ${backupPath}`);
    console.log(`Found ${backupData.length} documents`);

    // Delete all documents
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    console.log('Successfully deleted all documents from generalMessages collection');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

backupAndDeleteGeneralMessages(); 