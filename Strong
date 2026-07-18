/* ===================================================================
   storage.js — طبقة تخزين البيانات (Shaysta Wood Manager)
   يعتمد بالكامل على localStorage ليعمل بدون إنترنت.
   =================================================================== */

const SWM_PREFIX = 'swm_';

const SWM_KEYS = {
  customers: SWM_PREFIX + 'customers',
  sales: SWM_PREFIX + 'sales',
  purchases: SWM_PREFIX + 'purchases',
  inventory: SWM_PREFIX + 'inventory',
  settings: SWM_PREFIX + 'settings',
};

const SWM_DEFAULT_SETTINGS = {
  shopName: 'Shaysta Wood Manager',
  currency: 'د.ع', // قابل للتعديل من الإعدادات لاحقًا
  lastBackupAt: null,
};

function swmUUID() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function swmReadRaw(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error('SWM storage read error for', key, e);
    return fallback;
  }
}

function swmWriteRaw(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('SWM storage write error for', key, e);
    return false;
  }
}

/* ---------- واجهة عامة لأي مجموعة بيانات (customers/sales/purchases/inventory) ---------- */

const Store = {
  init() {
    Object.values(SWM_KEYS).forEach((key) => {
      if (localStorage.getItem(key) === null) {
        if (key === SWM_KEYS.settings) {
          swmWriteRaw(key, SWM_DEFAULT_SETTINGS);
        } else {
          swmWriteRaw(key, []);
        }
      }
    });
  },

  getAll(collection) {
    return swmReadRaw(SWM_KEYS[collection], []);
  },

  getById(collection, id) {
    return this.getAll(collection).find((item) => item.id === id) || null;
  },

  add(collection, item) {
    const list = this.getAll(collection);
    const record = Object.assign({ id: swmUUID(), createdAt: new Date().toISOString() }, item);
    list.push(record);
    swmWriteRaw(SWM_KEYS[collection], list);
    return record;
  },

  update(collection, id, patch) {
    const list = this.getAll(collection);
    const idx = list.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    list[idx] = Object.assign({}, list[idx], patch, { updatedAt: new Date().toISOString() });
    swmWriteRaw(SWM_KEYS[collection], list);
    return list[idx];
  },

  remove(collection, id) {
    const list = this.getAll(collection);
    const next = list.filter((item) => item.id !== id);
    swmWriteRaw(SWM_KEYS[collection], next);
    return next.length !== list.length;
  },

  clearCollection(collection) {
    swmWriteRaw(SWM_KEYS[collection], []);
  },

  getSettings() {
    return Object.assign({}, SWM_DEFAULT_SETTINGS, swmReadRaw(SWM_KEYS.settings, {}));
  },

  updateSettings(patch) {
    const current = this.getSettings();
    const next = Object.assign({}, current, patch);
    swmWriteRaw(SWM_KEYS.settings, next);
    return next;
  },

  /* ---------- النسخ الاحتياطي ---------- */

  exportBackup() {
    const payload = {
      app: 'Shaysta Wood Manager',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        customers: this.getAll('customers'),
        sales: this.getAll('sales'),
        purchases: this.getAll('purchases'),
        inventory: this.getAll('inventory'),
        settings: this.getSettings(),
      },
    };
    return payload;
  },

  // mode: 'replace' يستبدل كل البيانات، 'merge' يضيف السجلات الجديدة فقط دون تكرار المعرّفات
  importBackup(payload, mode) {
    if (!payload || !payload.data) {
      throw new Error('ملف النسخة الاحتياطية غير صالح');
    }
    const { customers = [], sales = [], purchases = [], inventory = [], settings = {} } = payload.data;

    if (mode === 'merge') {
      ['customers', 'sales', 'purchases', 'inventory'].forEach((collection) => {
        const incoming = payload.data[collection] || [];
        const existing = this.getAll(collection);
        const existingIds = new Set(existing.map((i) => i.id));
        const merged = existing.concat(incoming.filter((i) => !existingIds.has(i.id)));
        swmWriteRaw(SWM_KEYS[collection], merged);
      });
      this.updateSettings(settings);
    } else {
      swmWriteRaw(SWM_KEYS.customers, customers);
      swmWriteRaw(SWM_KEYS.sales, sales);
      swmWriteRaw(SWM_KEYS.purchases, purchases);
      swmWriteRaw(SWM_KEYS.inventory, inventory);
      swmWriteRaw(SWM_KEYS.settings, Object.assign({}, SWM_DEFAULT_SETTINGS, settings));
    }
    this.updateSettings({ lastBackupAt: new Date().toISOString() });
    return true;
  },

  wipeAll() {
    Object.values(SWM_KEYS).forEach((key) => localStorage.removeItem(key));
    this.init();
  },
};

Store.init();
