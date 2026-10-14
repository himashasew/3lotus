import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, addDoc, addDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from '../services/data';
import { db } from '../services/data';
import { useAuth } from '../context/AuthContext';
import { STARTER_CATEGORIES, STARTER_PRODUCTS } from '../data/starterStock';

// Helper for formatting
const formatQty = (qty, measureType) => {
  if (!qty) return '0';
  if (measureType === 'mass') {
    return qty >= 1000 ? `${(qty / 1000).toFixed(2)} kg` : `${qty} g`;
  }
  if (measureType === 'volume') {
    return qty >= 1000 ? `${(qty / 1000).toFixed(2)} L` : `${qty} ml`;
  }
  return `${qty} pcs`;
};

const getDisplayUnitOptions = (measureType) => {
  if (measureType === 'mass') return [{ val: 'g', label: 'g (Grams)' }, { val: 'kg', label: 'kg (Kilograms)' }];
  if (measureType === 'volume') return [{ val: 'ml', label: 'ml (Milliliters)' }, { val: 'L', label: 'L (Liters)' }];
  return [{ val: 'pcs', label: 'pcs (Pieces)' }];
};

// Convert input to base unit
const convertToBase = (value, unit) => {
  const num = Number(value);
  if (unit === 'kg' || unit === 'L') return num * 1000;
  return num;
};

export default function Stock() {
  const { t } = useTranslation();
  const { userProfile, hasAccess } = useAuth();
  const [seeding, setSeeding] = useState(false);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  
  const [modalType, setModalType] = useState(null); 
  const [editId, setEditId] = useState(null);
  
  const [catForm, setCatForm] = useState({ name: '' });
  
  // Unified Form state
  const [uForm, setUForm] = useState({
    productName: '',
    categoryId: '',
    measureType: 'mass',
    reorderLevel: '',
    txType: 'IN',
    displayQty: '',
    displayUnit: 'kg',
    date: '',
    note: ''
  });
  
  // Edit Form state
  const [editForm, setEditForm] = useState({});

  const [history, setHistory] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => { 
    loadCategories();
    loadProducts(); 
  }, []);

  const loadProducts = async () => {
    const snap = await getDocs(collection(db, 'products'));
    setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const loadCategories = async () => {
    const snap = await getDocs(collection(db, 'categories'));
    setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  // --- Category Management ---
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!catForm.name.trim()) return;
    await addDoc(collection(db, 'categories'), { name: catForm.name });
    setCatForm({ name: '' });
    loadCategories();
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm(t('confirmDelete'))) {
      await deleteDoc(doc(db, 'categories', id));
      loadCategories();
    }
  };

  // --- Starter catalogue (Sri Lankan restaurant & catering items) ---
  const handleLoadStarter = async () => {
    if (!window.confirm(`Add ${STARTER_CATEGORIES.length} categories and up to ${STARTER_PRODUCTS.length} starter items? Existing names are skipped.`)) return;
    setSeeding(true);
    try {
      const catSnap = await getDocs(collection(db, 'categories'));
      const catIds = {};
      catSnap.docs.forEach(d => { catIds[d.data().name] = d.id; });

      const missingCats = STARTER_CATEGORIES.filter(name => !catIds[name]);
      const created = await addDocs(collection(db, 'categories'), missingCats.map(name => ({ name })));
      missingCats.forEach((name, i) => { catIds[name] = created[i].id; });

      const prodSnap = await getDocs(collection(db, 'products'));
      const existing = new Set(prodSnap.docs.map(d => (d.data().name || '').toLowerCase()));
      const fresh = STARTER_PRODUCTS.filter(p => !existing.has(p.name.toLowerCase()));
      await addDocs(collection(db, 'products'), fresh.map(p => ({
        name: p.name,
        categoryId: catIds[p.category],
        measureType: p.measureType,
        reorderLevel: p.reorderLevel,
        quantity: 0,
      })));

      await loadCategories();
      await loadProducts();
      alert(`Done: ${missingCats.length} categories and ${fresh.length} items added.`);
    } catch (err) {
      alert('Could not load starter items: ' + err.message);
    }
    setSeeding(false);
  };

  // --- Unified Stock Entry ---
  const openUnifiedEntry = () => {
    setUForm({
      productName: '',
      categoryId: '',
      measureType: 'mass',
      reorderLevel: '1000',
      txType: 'IN',
      displayQty: '',
      displayUnit: 'kg',
      date: new Date().toISOString().split('T')[0],
      note: ''
    });
    setModalType('unified');
  };

  const handleProductNameChange = (val) => {
    const existing = products.find(p => p.name.toLowerCase() === val.toLowerCase().trim());
    if (existing) {
      setUForm(prev => ({
        ...prev,
        productName: val,
        categoryId: existing.categoryId || '',
        measureType: existing.measureType || 'mass',
        reorderLevel: existing.reorderLevel || '1000',
        displayUnit: existing.measureType === 'mass' ? 'kg' : (existing.measureType === 'volume' ? 'L' : 'pcs')
      }));
    } else {
      setUForm(prev => ({ ...prev, productName: val }));
    }
  };

  const handleMeasureTypeChange = (val) => {
    const unit = val === 'mass' ? 'kg' : (val === 'volume' ? 'L' : 'pcs');
    setUForm(prev => ({ ...prev, measureType: val, displayUnit: unit }));
  };

  const handleSaveUnified = async (e) => {
    e.preventDefault();
    
    const nameStr = uForm.productName.trim();
    if (!nameStr) return;

    let prod = products.find(p => p.name.toLowerCase() === nameStr.toLowerCase());
    
    // 1. If product doesn't exist, create it.
    if (!prod) {
      const prodData = {
        name: nameStr,
        categoryId: uForm.categoryId,
        measureType: uForm.measureType,
        reorderLevel: Number(uForm.reorderLevel),
        quantity: 0
      };
      const docRef = await addDoc(collection(db, 'products'), prodData);
      prod = { id: docRef.id, ...prodData };
      
      // Admin Alert for new item
      await addDoc(collection(db, 'notifications'), {
        title: 'New Item Added',
        message: `${nameStr} was added to the inventory by ${userProfile?.displayName || 'User'}.`,
        timestamp: serverTimestamp(),
        read: false
      });
    }

    // 2. Process Transaction
    const baseQty = convertToBase(uForm.displayQty, uForm.displayUnit);
    if (baseQty <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    const txData = {
      productId: prod.id,
      productName: prod.name,
      type: uForm.txType,
      quantity: baseQty,
      displayRecord: `${uForm.displayQty} ${uForm.displayUnit}`,
      date: uForm.date,
      note: uForm.note,
      recordedBy: userProfile?.displayName || userProfile?.email || 'Unknown',
      timestamp: serverTimestamp()
    };

    const currentBalance = prod.quantity || 0;
    const newBalance = uForm.txType === 'IN' ? currentBalance + baseQty : currentBalance - baseQty;

    await addDoc(collection(db, 'stock_transactions'), txData);
    await updateDoc(doc(db, 'products', prod.id), { quantity: newBalance });

    await addDoc(collection(db, 'notifications'), {
      title: `Stock ${uForm.txType}`,
      message: `${uForm.txType} ${txData.displayRecord} of ${prod.name}.`,
      timestamp: serverTimestamp(),
      read: false
    });

    setModalType(null);
    loadProducts();
  };

  // --- Edit Product Master Details ---
  const openEditProduct = (p) => {
    setEditId(p.id);
    setEditForm({
      name: p.name,
      categoryId: p.categoryId || '',
      measureType: p.measureType || 'mass',
      reorderLevel: String(p.reorderLevel || '')
    });
    setModalType('edit');
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    await updateDoc(doc(db, 'products', editId), {
      name: editForm.name,
      categoryId: editForm.categoryId,
      measureType: editForm.measureType,
      reorderLevel: Number(editForm.reorderLevel)
    });
    setModalType(null);
    loadProducts();
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm(t('confirmDelete'))) {
      await deleteDoc(doc(db, 'products', id));
      loadProducts();
    }
  };

  // --- History ---
  const openHistory = async (p) => {
    setSelectedProduct(p);
    setHistory([]);
    setModalType('history');
    
    const q = query(
      collection(db, 'stock_transactions'), 
      where('productId', '==', p.id)
    );
    
    const snap = await getDocs(q);
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    setHistory(records);
  };

  const getCategoryName = (id) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : '—';
  };

  const filtered = products.filter(p => (p.quantity || 0) > 0 && p.name?.toLowerCase().includes(search.toLowerCase()));
  const isExistingProduct = products.some(p => p.name.toLowerCase() === uForm.productName.trim().toLowerCase());

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1>{t('stock')}</h1>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {hasAccess('MANAGER') && (
            <button className="btn-add" style={{ background: 'var(--bg-input)', color: 'var(--text-main)' }} onClick={handleLoadStarter} disabled={seeding}>
              {seeding ? 'Loading…' : '📥 Load starter items'}
            </button>
          )}
          <button className="btn-add" style={{ background: 'var(--color-secondary)' }} onClick={() => setModalType('category')}>
            ⚙️ {t('manageCategories')}
          </button>
          <button className="btn-add" style={{ background: 'var(--color-primary)', padding: '0.6rem 1.5rem', fontSize: '1.05rem' }} onClick={openUnifiedEntry}>
            ➕ {t('addStock') || 'Add Stock'}
          </button>
        </div>
      </div>

      <div className="data-section">
        <div className="data-section-header">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {filtered.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('productName')}</th>
                <th>{t('category')}</th>
                <th>{t('currentBalance')}</th>
                <th style={{ textAlign: 'center' }}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const isLow = (p.quantity || 0) <= (p.reorderLevel || 0);
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{getCategoryName(p.categoryId)}</td>
                    <td style={{ color: isLow ? 'var(--color-danger)' : 'inherit', fontWeight: isLow ? '700' : '500', fontSize: '1.1rem' }}>
                      {formatQty(p.quantity, p.measureType)} {isLow ? '⚠️' : ''}
                    </td>
                    <td>
                      <div className="action-btns" style={{ justifyContent: 'center', gap: '0.5rem' }}>
                        <button className="action-btn" onClick={() => openHistory(p)} title={t('transactionHistory')}>📜</button>
                        <button className="action-btn" onClick={() => openEditProduct(p)}>✏️</button>
                        <button className="action-btn delete" onClick={() => handleDeleteProduct(p.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <p>{t('noProducts')}</p>
          </div>
        )}
      </div>

      {/* --- Unified Entry Modal --- */}
      {modalType === 'unified' && (
        <div className="modal-overlay" onClick={() => setModalType(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ color: uForm.txType === 'IN' ? 'var(--color-secondary)' : 'var(--color-danger)' }}>
              {t('addStock') || 'Add / Update Stock'}
            </h2>
            
            <form onSubmit={handleSaveUnified}>
              <div className="form-group">
                <label>Item Name</label>
                <input 
                  list="product-suggestions"
                  value={uForm.productName}
                  onChange={e => handleProductNameChange(e.target.value)}
                  placeholder="e.g. Basmati Rice"
                  required 
                  autoFocus
                />
                <datalist id="product-suggestions">
                  {products.map(p => <option key={p.id} value={p.name} />)}
                </datalist>
                {isExistingProduct && <span style={{ fontSize: '0.8rem', color: 'var(--color-secondary)' }}>✓ Existing item selected</span>}
              </div>

              {!isExistingProduct && (
                <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>{t('category')}</label>
                    <select value={uForm.categoryId} onChange={e => setUForm({...uForm, categoryId: e.target.value})} required>
                      <option value="">-- Select --</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>{t('measureType')}</label>
                    <select value={uForm.measureType} onChange={e => handleMeasureTypeChange(e.target.value)}>
                      <option value="mass">{t('mass')} (kg/g)</option>
                      <option value="volume">{t('volume')} (L/ml)</option>
                      <option value="count">{t('count')} (pcs)</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Type</label>
                  <select value={uForm.txType} onChange={e => setUForm({...uForm, txType: e.target.value})}>
                    <option value="IN">{t('in')} (Add Stock)</option>
                    <option value="OUT">{t('out')} (Use Stock)</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Date</label>
                  <input type="date" value={uForm.date} onChange={e => setUForm({...uForm, date: e.target.value})} required />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Amount</label>
                  <input type="number" step="any" min="0.01" value={uForm.displayQty} onChange={e => setUForm({...uForm, displayQty: e.target.value})} required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Unit</label>
                  <select value={uForm.displayUnit} onChange={e => setUForm({...uForm, displayUnit: e.target.value})} required>
                    {getDisplayUnitOptions(uForm.measureType).map(u => <option key={u.val} value={u.val}>{u.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>{t('note')}</label>
                <input value={uForm.note} onChange={e => setUForm({...uForm, note: e.target.value})} placeholder="e.g., For 400 lunch parcels" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setModalType(null)}>{t('cancel')}</button>
                <button type="submit" className="btn-save" style={{ background: uForm.txType === 'IN' ? 'var(--color-secondary)' : 'var(--color-danger)' }}>
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Edit Master Product Modal --- */}
      {modalType === 'edit' && (
        <div className="modal-overlay" onClick={() => setModalType(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{t('editProduct')}</h2>
            <form onSubmit={handleUpdateProduct}>
              <div className="form-group">
                <label>{t('productName')}</label>
                <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>{t('category')}</label>
                <select value={editForm.categoryId} onChange={e => setEditForm({...editForm, categoryId: e.target.value})} required>
                  <option value="">-- Select --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>{t('measureType')}</label>
                  <select value={editForm.measureType} onChange={e => setEditForm({...editForm, measureType: e.target.value})}>
                    <option value="mass">{t('mass')} (kg/g)</option>
                    <option value="volume">{t('volume')} (L/ml)</option>
                    <option value="count">{t('count')} (pcs)</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>{t('reorderLevel')} (base unit)</label>
                  <input type="number" value={editForm.reorderLevel} onChange={e => setEditForm({...editForm, reorderLevel: e.target.value})} placeholder="e.g. 5000 (for 5kg)" required />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setModalType(null)}>{t('cancel')}</button>
                <button type="submit" className="btn-save">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Categories Modal --- */}
      {modalType === 'category' && (
        <div className="modal-overlay" onClick={() => setModalType(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{t('manageCategories')}</h2>
            
            <form onSubmit={handleSaveCategory} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <input 
                placeholder={t('categoryName')} 
                value={catForm.name} 
                onChange={e => setCatForm({ name: e.target.value })} 
                style={{ flex: 1 }} 
              />
              <button type="submit" className="btn-save" style={{ width: 'auto', padding: '0 1.5rem' }}>{t('addCategory')}</button>
            </form>

            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table className="data-table">
                <tbody>
                  {categories.map(c => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td style={{ width: '50px' }}>
                        <button className="action-btn delete" onClick={() => handleDeleteCategory(c.id)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button className="btn-cancel" onClick={() => setModalType(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- History Modal --- */}
      {modalType === 'history' && (
        <div className="modal-overlay" onClick={() => setModalType(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <h2>{selectedProduct?.name} - {t('transactionHistory')}</h2>
            
            <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '1rem' }}>
              {history.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('date')}</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>{t('note')}</th>
                      <th>User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id}>
                        <td>{h.date}</td>
                        <td style={{ color: h.type === 'IN' ? 'var(--color-secondary)' : 'var(--color-danger)', fontWeight: 'bold' }}>
                          {h.type === 'IN' ? t('in') : t('out')}
                        </td>
                        <td>{h.displayRecord || `${h.quantity} ${selectedProduct?.measureType === 'mass' ? 'g' : 'pcs'}`}</td>
                        <td>{h.note || '-'}</td>
                        <td>{h.recordedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {t('noHistory')}
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button className="btn-cancel" onClick={() => setModalType(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
