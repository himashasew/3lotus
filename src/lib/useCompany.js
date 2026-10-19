import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, db } from '../services/data';
import { COMPANY_DEFAULTS } from './documents';
import { DEFAULT_RATES } from './payroll';

/** Company details, invoice defaults and payroll rates, stored as one settings document. */
export function useCompany() {
  const [company, setCompany] = useState({ ...COMPANY_DEFAULTS });
  const [docId, setDocId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'settings'), where('key', '==', 'company')));
      if (snap.docs.length > 0) {
        setDocId(snap.docs[0].id);
        setCompany({ ...COMPANY_DEFAULTS, ...snap.docs[0].data() });
      }
      setError(null);
    } catch (err) {
      setError(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (next) => {
    const data = { ...next, key: 'company' };
    if (docId) {
      await updateDoc(doc(db, 'settings', docId), data);
    } else {
      const ref = await addDoc(collection(db, 'settings'), data);
      setDocId(ref.id);
    }
    setCompany({ ...COMPANY_DEFAULTS, ...data });
  };

  const rates = { ...DEFAULT_RATES, ...(company.payroll || {}) };

  return { company, rates, save, loading, error, reload: load };
}
