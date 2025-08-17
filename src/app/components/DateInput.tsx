"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  label?: string;
  value: string; // ISO yyyy-mm-dd or empty
  onChange: (iso: string) => void;
  required?: boolean;
  disabled?: boolean;
};

// Unified date input: segmented dd-mm-yyyy with optional native calendar
export default function DateInput({ label, value, onChange, required, disabled }: Props) {
  const parse = (iso: string) => {
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(iso || "");
    if (!m) return { d: "", m: "", y: "" };
    return { d: m[3], m: m[2], y: m[1] };
  };
  const [d, setD] = useState(parse(value).d);
  const [m, setM] = useState(parse(value).m);
  const [y, setY] = useState(parse(value).y);
  const mRef = useRef<HTMLInputElement>(null);
  const yRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = parse(value);
    setD(p.d); setM(p.m); setY(p.y);
  }, [value]);

  useEffect(() => {
    if (d && m && y && y.length === 4) onChange(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
  }, [d, m, y]);

  return (
    <div className="flex items-center gap-2">
      {label && <label className="text-sm text-gray-700">{label}{required && <span className="text-red-500"> *</span>}</label>}
      <div className="flex items-center gap-1">
        <input disabled={disabled} value={d} onChange={(e)=>{const v=e.target.value.replace(/\D/g,'').slice(0,2); setD(v); if(v.length===2) mRef.current?.focus();}} placeholder="dd" className="w-12 text-center rounded-md border border-gray-300 py-1"/>
        <span>-</span>
        <input ref={mRef} disabled={disabled} value={m} onChange={(e)=>{const v=e.target.value.replace(/\D/g,'').slice(0,2); setM(v); if(v.length===2) yRef.current?.focus();}} placeholder="mm" className="w-12 text-center rounded-md border border-gray-300 py-1"/>
        <span>-</span>
        <input ref={yRef} disabled={disabled} value={y} onChange={(e)=>{const v=e.target.value.replace(/\D/g,'').slice(0,4); setY(v);}} placeholder="yyyy" className="w-16 text-center rounded-md border border-gray-300 py-1"/>
        {/* Native calendar for convenience (keeps ISO) */}
        <input type="date" disabled={disabled} value={value} onChange={(e)=> onChange(e.target.value)} className="ml-2 rounded-md border border-gray-300 py-1 px-2"/>
      </div>
    </div>
  );
}


