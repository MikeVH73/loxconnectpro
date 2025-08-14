'use client';
import { useState } from 'react';

export default function VerifyPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!email || !email.includes('@')) { setStatus('Enter a valid email'); return; }
    setLoading(true); setStatus(null);
    try {
      const res = await fetch('/api/admin/send-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      const link: string = data?.link;
      if (link) {
        window.location.href = link;
      } else {
        setStatus('Verification link created. Check your inbox.');
      }
    } catch (e: any) {
      setStatus(e?.message || 'Failed to send verification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
        <h1 className="text-xl font-semibold mb-4">Verify your email</h1>
        <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@company.com" className="w-full border px-3 py-2 rounded mb-3"/>
        <button onClick={handleSend} disabled={loading} className="w-full bg-[#e40115] text-white rounded py-2 disabled:opacity-50">{loading ? 'Sending…' : 'Send verification link'}</button>
        {status && <div className="mt-3 text-sm text-gray-700">{status}</div>}
      </div>
    </div>
  );
}


