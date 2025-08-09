"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthProvider";
import { listProducts, upsertProduct, removeProduct, Product, getProductByCode, normalizeCode } from "../utils/products";

export default function ProductsPage() {
  const { userProfile } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const isSuperAdmin = userProfile?.role === 'superAdmin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;
  const isEmployee = userProfile?.role === 'Employee';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setItems(await listProducts());
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(p => (p.catClass||'').toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q));
  }, [query, items]);

  const save = async () => {
    if (!editing) return;
    const id = await upsertProduct(editing);
    const refreshed = await listProducts();
    setItems(refreshed);
    setEditing(null);
  };

  const del = async (id?: string) => {
    if (!id) return;
    if (!confirm('Delete this product?')) return;
    await removeProduct(id);
    setItems(await listProducts());
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Products</h1>
        <button onClick={()=>setEditing({ catClass:'', description:'', active:true } as Product)} className="px-3 py-2 bg-[#e40115] text-white rounded">Add Product</button>
      </div>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by code or description" className="w-full border rounded px-3 py-2 mb-3" />
      <div className="bg-white rounded shadow overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 px-3">Cat-Class</th>
              <th className="py-2 px-3">Description</th>
              <th className="py-2 px-3">Active</th>
              <th className="py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="py-2 px-3 font-mono">{p.catClass}</td>
                <td className="py-2 px-3">{p.description}</td>
                <td className="py-2 px-3">{p.active===false? 'No' : 'Yes'}</td>
                <td className="py-2 px-3 space-x-2">
                  <button onClick={()=>setEditing(p)} className="px-2 py-1 border rounded">Edit</button>
                  {(isAdmin) && (
                    <button onClick={()=>del(p.id)} className="px-2 py-1 border rounded text-red-600">Delete</button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && filtered.length===0 && (
              <tr><td colSpan={4} className="py-3 text-gray-500">No products found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center p-4">
          <div className="bg-white rounded p-4 w-full max-w-lg space-y-3">
            <h2 className="text-lg font-semibold">{editing.id? 'Edit Product':'Add Product'}</h2>
            <div>
              <label className="block text-sm mb-1">Cat-Class</label>
              <input value={editing.catClass} onChange={e=>setEditing({ ...editing, catClass: e.target.value })} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Description</label>
              <input value={editing.description} onChange={e=>setEditing({ ...editing, description: e.target.value })} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="flex items-center gap-2">
              <input id="active" type="checkbox" checked={editing.active !== false} onChange={e=>setEditing({ ...editing, active: e.target.checked })} disabled={isEmployee} />
              <label htmlFor="active">Active</label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setEditing(null)} className="px-3 py-2 border rounded">Cancel</button>
              <button onClick={async ()=>{
                if (!editing) return;
                const dup = await getProductByCode(normalizeCode(editing.catClass));
                if (!editing.id && dup) {
                  alert(`Duplicate: ${dup.catClass} already exists.`);
                  return;
                }
                await save();
              }} className="px-3 py-2 bg-[#e40115] text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



