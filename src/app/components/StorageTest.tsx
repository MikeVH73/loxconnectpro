import React, { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebaseClient';

export default function StorageTest() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string>('');

  const testStorage = async () => {
    setTesting(true);
    setResult('Testing Firebase Storage connection...');

    try {
      // Create a simple test file
      const testContent = new Blob(['Hello Firebase Storage!'], { type: 'text/plain' });
      const testRef = ref(storage, `test-uploads/test-${Date.now()}.txt`);

      console.log('[StorageTest] Testing upload...');
      setResult('Uploading test file...');
      
      await uploadBytes(testRef, testContent);
      console.log('[StorageTest] Upload successful, getting URL...');
      setResult('Upload successful! Getting download URL...');
      
      const downloadURL = await getDownloadURL(testRef);
      console.log('[StorageTest] Download URL obtained:', downloadURL);
      setResult(`✅ Success! Storage is working. Test file URL: ${downloadURL}`);
      
    } catch (error) {
      console.error('[StorageTest] Error:', error);
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-4 border rounded bg-yellow-50">
      <h3 className="font-bold mb-2">🔧 Firebase Storage Test</h3>
      <button
        onClick={testStorage}
        disabled={testing}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {testing ? 'Testing...' : 'Test Storage Connection'}
      </button>
      {result && (
        <div className="mt-2 p-2 bg-white rounded border text-sm">
          {result}
        </div>
      )}
    </div>
  );
} 