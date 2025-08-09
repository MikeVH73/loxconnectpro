import { collection, query, where, getDocs, addDoc, updateDoc, doc, Firestore, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseClient';

export type Product = {
  id?: string;
  catClass: string;
  description: string;
  active?: boolean;
  aliases?: string[];
  createdAt?: any;
  updatedAt?: any;
};

export const normalizeCode = (code: string): string => {
  return (code || '').trim().toUpperCase();
};

export async function getProductByCode(code: string): Promise<Product | null> {
  if (!db) return null;
  const cat = normalizeCode(code);
  const productsRef = collection(db as Firestore, 'products');
  const q1 = query(productsRef, where('catClass', '==', cat));
  const s1 = await getDocs(q1);
  if (!s1.empty) {
    const d = s1.docs[0];
    return { id: d.id, ...(d.data() as any) } as Product;
  }
  // try aliases
  const q2 = query(productsRef, where('aliases', 'array-contains', cat));
  const s2 = await getDocs(q2);
  if (!s2.empty) {
    const d = s2.docs[0];
    return { id: d.id, ...(d.data() as any) } as Product;
  }
  return null;
}

export async function findDuplicateByCode(code: string): Promise<Product | null> {
  const cat = normalizeCode(code);
  if (!cat) return null;
  return await getProductByCode(cat);
}

export async function listProducts(): Promise<Product[]> {
  if (!db) return [];
  const productsRef = collection(db as Firestore, 'products');
  const snap = await getDocs(productsRef);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Product));
}

export async function upsertProduct(p: Product): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');
  const productsRef = collection(db as Firestore, 'products');
  const payload = {
    catClass: normalizeCode(p.catClass),
    description: (p.description || '').trim(),
    active: p.active !== false,
    aliases: (p.aliases || []).map(normalizeCode),
    updatedAt: serverTimestamp(),
  } as any;
  // Duplicate protection
  const existing = await getProductByCode(payload.catClass);
  if (existing && existing.id !== p.id) {
    throw new Error(`Product with code ${payload.catClass} already exists`);
  }
  if (p.id) {
    await updateDoc(doc(db as Firestore, 'products', p.id), payload);
    return p.id;
  }
  payload.createdAt = serverTimestamp();
  const docRef = await addDoc(productsRef, payload);
  return docRef.id;
}

export async function removeProduct(id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  await deleteDoc(doc(db as Firestore, 'products', id));
}


