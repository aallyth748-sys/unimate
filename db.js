/* ===================================================
   db.js - طبقة التخزين (IndexedDB)
   كل البيانات محفوظة على جهاز المستخدم فقط.
=================================================== */
const DB_NAME = 'unimate';
const DB_VERSION = 1;
const STORES = ['profile','settings','subjects','lectures','attendance','tasks','sessions','notes','exams','notifications','fired'];

let _db = null;

function openDB(){
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      });
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

// تنفيذ عملية واحدة على مخزن واحد وإرجاع نتيجتها
function runTx(store, mode, makeRequest){
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = makeRequest(tx.objectStore(store));
    let result;
    if (req) req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

const DB = {
  all:     (s)      => runTx(s, 'readonly',  st => st.getAll()).then(r => r || []),
  put:     (s, obj) => runTx(s, 'readwrite', st => st.put(obj)),
  del:     (s, id)  => runTx(s, 'readwrite', st => st.delete(id)),

  // استبدال كل البيانات دفعة واحدة (للاستيراد)
  replaceAll(data){
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORES, 'readwrite');
      STORES.forEach(name => {
        const st = tx.objectStore(name);
        st.clear();
        (data[name] || []).forEach(item => st.put(item));
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  },

  async exportAll(){
    const out = {};
    for (const s of STORES) out[s] = await DB.all(s);
    return out;
  },

  async clearAll(){
    for (const s of STORES) await runTx(s, 'readwrite', st => st.clear());
  }
};
