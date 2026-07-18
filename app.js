/* ===================================================================
   app.js — منطق التطبيق: التنقل بين الصفحات، النماذج، والحسابات
   =================================================================== */

const PURCHASE_CATEGORIES = [
  'خشب', 'صبغة', 'ورنيش', 'إسفنج', 'حواف', 'براغي',
  'سكة', 'بورد', 'نايلون تغليف', 'شريط لاصق', 'بروفايل L', 'سيليكون', 'أخرى',
];

const MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const PAGE_TITLES = {
  dashboard: 'لوحة التحكم',
  sales: 'المبيعات',
  purchases: 'المشتريات',
  customers: 'العملاء',
  inventory: 'المخزون',
  reports: 'التقارير',
  backup: 'النسخ الاحتياطي',
};

let currentPage = 'dashboard';

/* ---------------------------- أدوات مساعدة عامة ---------------------------- */

function fmtMoney(n) {
  const settings = Store.getSettings();
  const val = Number(n) || 0;
  return val.toLocaleString('ar', { maximumFractionDigits: 2 }) + ' ' + settings.currency;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function todayISODate() {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d - tzOffset).toISOString().slice(0, 10);
}

function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('is-visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function confirmAction(message) {
  return window.confirm(message);
}

/* ---------------------------- Modal ---------------------------- */

function openModal(title, bodyHTML, onMount) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  document.getElementById('modalBackdrop').classList.add('is-open');
  if (typeof onMount === 'function') onMount(document.getElementById('modalBody'));
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('is-open');
  document.getElementById('modalBody').innerHTML = '';
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalBackdrop').addEventListener('click', (e) => {
  if (e.target.id === 'modalBackdrop') closeModal();
});

/* ---------------------------- التنقّل بين الصفحات ---------------------------- */

const renderers = {
  dashboard: renderDashboard,
  sales: renderSales,
  purchases: renderPurchases,
  customers: renderCustomers,
  inventory: renderInventory,
  reports: renderReports,
  backup: renderBackup,
};

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.page === page);
  });
  document.getElementById('topbarPageTitle').textContent = PAGE_TITLES[page] || '';
  closeSidebar();
  renderers[page]();
  document.getElementById('pageContent').scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}

document.getElementById('mainNav').addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-item');
  if (!btn) return;
  navigateTo(btn.dataset.page);
});

/* ---------------------------- قائمة الجوال ---------------------------- */

function openSidebar() { document.body.classList.add('sidebar-open'); }
function closeSidebar() { document.body.classList.remove('sidebar-open'); }

document.getElementById('menuToggle').addEventListener('click', openSidebar);
document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

/* ---------------------------- حالة الاتصال ---------------------------- */

function updateOnlineStatus() {
  document.getElementById('offlinePill').hidden = navigator.onLine;
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

/* =====================================================================
   لوحة التحكم
   ===================================================================== */

function getMonthRange(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  return { start, end };
}

function filterByMonth(list, dateField, year, month) {
  const { start, end } = getMonthRange(year, month);
  return list.filter((item) => {
    const d = new Date(item[dateField]);
    return d >= start && d < end;
  });
}

function computeMonthTotals(year, month) {
  const sales = filterByMonth(Store.getAll('sales'), 'date', year, month);
  const purchases = filterByMonth(Store.getAll('purchases'), 'date', year, month);
  const totalSales = sales.reduce((s, r) => s + (Number(r.salePrice) || 0), 0);
  const totalCost = sales.reduce((s, r) => s + (Number(r.cost) || 0), 0);
  const totalDelivery = sales.reduce((s, r) => s + (Number(r.deliveryFee) || 0), 0);
  const totalPurchases = purchases.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const netProfit = totalSales - totalCost - totalDelivery;
  return { sales, purchases, totalSales, totalCost, totalDelivery, totalPurchases, netProfit };
}

function renderDashboard() {
  const now = new Date();
  const { sales, totalSales, totalCost, totalDelivery, netProfit } = computeMonthTotals(now.getFullYear(), now.getMonth());
  const customers = Store.getAll('customers');
  const inventory = Store.getAll('inventory');
  const lowStock = inventory.filter((i) => Number(i.quantity) <= Number(i.minQuantity ?? 0));
  const recentSales = [...Store.getAll('sales')].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  const html = `
    <div class="page-head">
      <div>
        <span class="eyebrow">${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}</span>
        <h1>لوحة التحكم</h1>
        <p>نظرة سريعة على أداء الورشة هذا الشهر.</p>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">إجمالي المبيعات</div>
        <div class="stat-value">${fmtMoney(totalSales)}</div>
        <div class="stat-sub">${sales.length} عملية بيع هذا الشهر</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">إجمالي التكلفة + التوصيل</div>
        <div class="stat-value">${fmtMoney(totalCost + totalDelivery)}</div>
        <div class="stat-sub">تكلفة: ${fmtMoney(totalCost)} · توصيل: ${fmtMoney(totalDelivery)}</div>
      </div>
      <div class="stat-card ${netProfit >= 0 ? 'is-positive' : 'is-negative'}">
        <div class="stat-label">صافي الربح الشهري</div>
        <div class="stat-value ${netProfit >= 0 ? 'is-positive' : 'is-negative'}">${fmtMoney(netProfit)}</div>
        <div class="stat-sub">المبيعات − التكلفة − التوصيل</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">عدد العملاء</div>
        <div class="stat-value">${customers.length}</div>
        <div class="stat-sub">عميل مسجّل</div>
      </div>
    </div>

    ${lowStock.length ? `
    <div class="card">
      <div class="card-header"><h2>تنبيه: مواد منخفضة في المخزون</h2><span class="tag is-low">${lowStock.length} صنف</span></div>
      <div class="card-body">
        ${lowStock.map((i) => `<span class="tag is-low" style="margin:3px">${escapeHTML(i.name)} — الكمية: ${i.quantity} ${escapeHTML(i.unit || '')}</span>`).join('')}
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-header"><h2>أحدث عمليات البيع</h2></div>
      <div class="card-body no-pad">
        ${recentSales.length ? `
        <div class="table-wrap">
          <table class="ledger">
            <thead><tr><th>التاريخ</th><th>المنتج</th><th>العميل</th><th>سعر البيع</th></tr></thead>
            <tbody>
              ${recentSales.map((s) => `
                <tr>
                  <td>${fmtDate(s.date)}</td>
                  <td>${escapeHTML(s.productName)}</td>
                  <td>${escapeHTML(s.customerName || '—')}</td>
                  <td>${fmtMoney(s.salePrice)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : emptyState('لا توجد عمليات بيع بعد', 'ابدأ بإضافة أول عملية بيع من صفحة المبيعات.')}
      </div>
    </div>
  `;
  document.getElementById('pageContent').innerHTML = html;
}

function emptyState(title, sub) {
  return `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" width="40" height="40"><path d="M4 7.5 12 3l8 4.5M4 7.5V16l8 4.5 8-4.5V7.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/></svg>
      <p><strong>${title}</strong></p>
      <p>${sub}</p>
    </div>`;
}

/* =====================================================================
   المبيعات
   ===================================================================== */

function renderSales() {
  const all = [...Store.getAll('sales')].sort((a, b) => new Date(b.date) - new Date(a.date));
  const content = document.getElementById('pageContent');

  content.innerHTML = `
    <div class="page-head">
      <div>
        <h1>المبيعات</h1>
        <p>سجل كل عمليات البيع مع التكلفة وسعر البيع وأجور التوصيل.</p>
      </div>
      <button class="btn btn-brass" id="addSaleBtn">+ عملية بيع جديدة</button>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>السجل (${all.length})</h2>
        <div class="filter-bar">
          <input type="month" id="saleMonthFilter" />
          <input type="search" id="saleSearch" placeholder="بحث بالمنتج أو العميل" />
        </div>
      </div>
      <div class="card-body no-pad" id="salesTableWrap"></div>
    </div>
  `;

  function draw() {
    const monthVal = document.getElementById('saleMonthFilter').value;
    const q = document.getElementById('saleSearch').value.trim().toLowerCase();
    let list = all;
    if (monthVal) {
      const [y, m] = monthVal.split('-').map(Number);
      list = filterByMonth(list, 'date', y, m - 1);
    }
    if (q) {
      list = list.filter((s) =>
        (s.productName || '').toLowerCase().includes(q) ||
        (s.customerName || '').toLowerCase().includes(q));
    }
    document.getElementById('salesTableWrap').innerHTML = list.length ? `
      <div class="table-wrap">
        <table class="ledger">
          <thead><tr>
            <th>التاريخ</th><th>المنتج</th><th>العميل</th><th>التكلفة</th><th>سعر البيع</th><th>التوصيل</th><th>الربح</th><th></th>
          </tr></thead>
          <tbody>
            ${list.map((s) => {
              const profit = (Number(s.salePrice) || 0) - (Number(s.cost) || 0) - (Number(s.deliveryFee) || 0);
              return `
              <tr data-id="${s.id}">
                <td>${fmtDate(s.date)}</td>
                <td>${escapeHTML(s.productName)}</td>
                <td>${escapeHTML(s.customerName || '—')}</td>
                <td>${fmtMoney(s.cost)}</td>
                <td>${fmtMoney(s.salePrice)}</td>
                <td>${fmtMoney(s.deliveryFee)}</td>
                <td class="${profit >= 0 ? 'is-positive' : 'is-negative'}" style="font-weight:700">${fmtMoney(profit)}</td>
                <td class="row-actions">
                  <button class="btn btn-ghost btn-sm" data-edit="${s.id}">تعديل</button>
                  <button class="btn btn-danger btn-sm" data-del="${s.id}">حذف</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : emptyState('لا توجد نتائج', 'جرّب تغيير الفلتر أو أضف عملية بيع جديدة.');
  }

  draw();

  document.getElementById('saleMonthFilter').addEventListener('change', draw);
  document.getElementById('saleSearch').addEventListener('input', draw);

  document.getElementById('salesTableWrap').addEventListener('click', (e) => {
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    const delId = e.target.closest('[data-del]')?.dataset.del;
    if (editId) openSaleForm(Store.getById('sales', editId), draw);
    if (delId) {
      if (confirmAction('هل تريد حذف عملية البيع هذه؟')) {
        Store.remove('sales', delId);
        all.splice(all.findIndex((s) => s.id === delId), 1);
        showToast('تم حذف عملية البيع');
        draw();
      }
    }
  });

  document.getElementById('addSaleBtn').addEventListener('click', () => openSaleForm(null, () => renderSales()));
}

function openSaleForm(existing, onSaved) {
  const customers = Store.getAll('customers');
  const isEdit = !!existing;
  const bodyHTML = `
    <form id="saleForm">
      <div class="form-grid">
        <div class="field">
          <label>التاريخ</label>
          <input type="date" name="date" value="${existing?.date || todayISODate()}" required />
        </div>
        <div class="field">
          <label>العميل</label>
          <select name="customerId">
            <option value="">بدون عميل محدد</option>
            ${customers.map((c) => `<option value="${c.id}" ${existing?.customerId === c.id ? 'selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field full">
          <label>اسم المنتج / الوصف</label>
          <input type="text" name="productName" value="${escapeHTML(existing?.productName || '')}" required placeholder="مثال: باب خشبي بتصميم كلاسيكي" />
        </div>
        <div class="field">
          <label>التكلفة</label>
          <input type="number" step="0.01" min="0" name="cost" value="${existing?.cost ?? ''}" required />
        </div>
        <div class="field">
          <label>سعر البيع</label>
          <input type="number" step="0.01" min="0" name="salePrice" value="${existing?.salePrice ?? ''}" required />
        </div>
        <div class="field">
          <label>أجور التوصيل</label>
          <input type="number" step="0.01" min="0" name="deliveryFee" value="${existing?.deliveryFee ?? 0}" />
        </div>
        <div class="field full">
          <label>ملاحظات</label>
          <textarea name="notes">${escapeHTML(existing?.notes || '')}</textarea>
        </div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-brass">${isEdit ? 'حفظ التعديلات' : 'إضافة عملية البيع'}</button>
        <button type="button" class="btn btn-ghost" id="cancelSaleForm">إلغاء</button>
      </div>
    </form>
  `;
  openModal(isEdit ? 'تعديل عملية بيع' : 'عملية بيع جديدة', bodyHTML, (root) => {
    root.querySelector('#cancelSaleForm').addEventListener('click', closeModal);
    root.querySelector('#saleForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const customerId = fd.get('customerId') || null;
      const customer = customerId ? Store.getById('customers', customerId) : null;
      const payload = {
        date: fd.get('date'),
        customerId,
        customerName: customer ? customer.name : '',
        productName: fd.get('productName').trim(),
        cost: parseFloat(fd.get('cost')) || 0,
        salePrice: parseFloat(fd.get('salePrice')) || 0,
        deliveryFee: parseFloat(fd.get('deliveryFee')) || 0,
        notes: fd.get('notes').trim(),
      };
      if (isEdit) {
        Store.update('sales', existing.id, payload);
        showToast('تم تحديث عملية البيع');
      } else {
        Store.add('sales', payload);
        showToast('تمت إضافة عملية البيع');
      }
      closeModal();
      onSaved?.();
    });
  });
}

/* =====================================================================
   المشتريات
   ===================================================================== */

function renderPurchases() {
  const all = [...Store.getAll('purchases')].sort((a, b) => new Date(b.date) - new Date(a.date));
  const content = document.getElementById('pageContent');

  content.innerHTML = `
    <div class="page-head">
      <div>
        <h1>المشتريات</h1>
        <p>تتبّع مشتريات المواد الخام: الخشب، الصبغة، الورنيش، البراغي، وغيرها.</p>
      </div>
      <button class="btn btn-brass" id="addPurchaseBtn">+ مشترى جديد</button>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>السجل (${all.length})</h2>
        <div class="filter-bar">
          <input type="month" id="purchaseMonthFilter" />
          <select id="purchaseCategoryFilter">
            <option value="">كل الفئات</option>
            ${PURCHASE_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="card-body no-pad" id="purchasesTableWrap"></div>
    </div>
  `;

  function draw() {
    const monthVal = document.getElementById('purchaseMonthFilter').value;
    const cat = document.getElementById('purchaseCategoryFilter').value;
    let list = all;
    if (monthVal) {
      const [y, m] = monthVal.split('-').map(Number);
      list = filterByMonth(list, 'date', y, m - 1);
    }
    if (cat) list = list.filter((p) => p.category === cat);

    const total = list.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    document.getElementById('purchasesTableWrap').innerHTML = list.length ? `
      <div class="table-wrap">
        <table class="ledger">
          <thead><tr><th>التاريخ</th><th>الصنف</th><th>الفئة</th><th>المبلغ</th><th></th></tr></thead>
          <tbody>
            ${list.map((p) => `
              <tr>
                <td>${fmtDate(p.date)}</td>
                <td>${escapeHTML(p.itemName)}</td>
                <td><span class="tag">${escapeHTML(p.category)}</span></td>
                <td>${fmtMoney(p.amount)}</td>
                <td class="row-actions">
                  <button class="btn btn-ghost btn-sm" data-edit="${p.id}">تعديل</button>
                  <button class="btn btn-danger btn-sm" data-del="${p.id}">حذف</button>
                </td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr><td colspan="3" style="font-weight:700">الإجمالي</td><td style="font-weight:700">${fmtMoney(total)}</td><td></td></tr>
          </tfoot>
        </table>
      </div>` : emptyState('لا توجد مشتريات', 'أضف أول عملية شراء لمواد الورشة.');
  }

  draw();
  document.getElementById('purchaseMonthFilter').addEventListener('change', draw);
  document.getElementById('purchaseCategoryFilter').addEventListener('change', draw);

  document.getElementById('purchasesTableWrap').addEventListener('click', (e) => {
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    const delId = e.target.closest('[data-del]')?.dataset.del;
    if (editId) openPurchaseForm(Store.getById('purchases', editId), draw);
    if (delId && confirmAction('هل تريد حذف هذا المشترى؟')) {
      Store.remove('purchases', delId);
      all.splice(all.findIndex((p) => p.id === delId), 1);
      showToast('تم حذف المشترى');
      draw();
    }
  });

  document.getElementById('addPurchaseBtn').addEventListener('click', () => openPurchaseForm(null, () => renderPurchases()));
}

function openPurchaseForm(existing, onSaved) {
  const isEdit = !!existing;
  const bodyHTML = `
    <form id="purchaseForm">
      <div class="form-grid">
        <div class="field">
          <label>التاريخ</label>
          <input type="date" name="date" value="${existing?.date || todayISODate()}" required />
        </div>
        <div class="field">
          <label>الفئة</label>
          <select name="category" required>
            ${PURCHASE_CATEGORIES.map((c) => `<option value="${c}" ${existing?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field full">
          <label>اسم الصنف</label>
          <input type="text" name="itemName" value="${escapeHTML(existing?.itemName || '')}" required placeholder="مثال: لوح MDF 18 مم" />
        </div>
        <div class="field">
          <label>المبلغ</label>
          <input type="number" step="0.01" min="0" name="amount" value="${existing?.amount ?? ''}" required />
        </div>
        <div class="field full">
          <label>ملاحظات</label>
          <textarea name="notes">${escapeHTML(existing?.notes || '')}</textarea>
        </div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-brass">${isEdit ? 'حفظ التعديلات' : 'إضافة المشترى'}</button>
        <button type="button" class="btn btn-ghost" id="cancelPurchaseForm">إلغاء</button>
      </div>
    </form>
  `;
  openModal(isEdit ? 'تعديل مشترى' : 'مشترى جديد', bodyHTML, (root) => {
    root.querySelector('#cancelPurchaseForm').addEventListener('click', closeModal);
    root.querySelector('#purchaseForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        date: fd.get('date'),
        category: fd.get('category'),
        itemName: fd.get('itemName').trim(),
        amount: parseFloat(fd.get('amount')) || 0,
        notes: fd.get('notes').trim(),
      };
      if (isEdit) {
        Store.update('purchases', existing.id, payload);
        showToast('تم تحديث المشترى');
      } else {
        Store.add('purchases', payload);
        showToast('تمت إضافة المشترى');
      }
      closeModal();
      onSaved?.();
    });
  });
}

/* =====================================================================
   العملاء
   ===================================================================== */

function renderCustomers() {
  const all = [...Store.getAll('customers')].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const sales = Store.getAll('sales');
  const content = document.getElementById('pageContent');

  content.innerHTML = `
    <div class="page-head">
      <div>
        <h1>العملاء</h1>
        <p>سجل بيانات العملاء وتواصل معهم بسهولة.</p>
      </div>
      <button class="btn btn-brass" id="addCustomerBtn">+ عميل جديد</button>
    </div>
    <div class="card">
      <div class="card-header">
        <h2>القائمة (${all.length})</h2>
        <div class="filter-bar"><input type="search" id="customerSearch" placeholder="بحث بالاسم أو الهاتف" /></div>
      </div>
      <div class="card-body no-pad" id="customersTableWrap"></div>
    </div>
  `;

  function draw() {
    const q = document.getElementById('customerSearch').value.trim().toLowerCase();
    let list = all;
    if (q) list = list.filter((c) => (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q));

    document.getElementById('customersTableWrap').innerHTML = list.length ? `
      <div class="table-wrap">
        <table class="ledger">
          <thead><tr><th>الاسم</th><th>الهاتف</th><th>العنوان</th><th>عدد الطلبات</th><th></th></tr></thead>
          <tbody>
            ${list.map((c) => {
              const orderCount = sales.filter((s) => s.customerId === c.id).length;
              return `
              <tr>
                <td>${escapeHTML(c.name)}</td>
                <td>${c.phone ? `<a href="tel:${escapeHTML(c.phone)}">${escapeHTML(c.phone)}</a>` : '—'}</td>
                <td>${escapeHTML(c.address || '—')}</td>
                <td>${orderCount}</td>
                <td class="row-actions">
                  <button class="btn btn-ghost btn-sm" data-edit="${c.id}">تعديل</button>
                  <button class="btn btn-danger btn-sm" data-del="${c.id}">حذف</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : emptyState('لا يوجد عملاء', 'أضف أول عميل لبدء تسجيل طلباته.');
  }

  draw();
  document.getElementById('customerSearch').addEventListener('input', draw);
  document.getElementById('customersTableWrap').addEventListener('click', (e) => {
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    const delId = e.target.closest('[data-del]')?.dataset.del;
    if (editId) openCustomerForm(Store.getById('customers', editId), draw);
    if (delId && confirmAction('هل تريد حذف هذا العميل؟ (لن يتم حذف سجلات مبيعاته)')) {
      Store.remove('customers', delId);
      all.splice(all.findIndex((c) => c.id === delId), 1);
      showToast('تم حذف العميل');
      draw();
    }
  });
  document.getElementById('addCustomerBtn').addEventListener('click', () => openCustomerForm(null, () => renderCustomers()));
}

function openCustomerForm(existing, onSaved) {
  const isEdit = !!existing;
  const bodyHTML = `
    <form id="customerForm">
      <div class="form-grid">
        <div class="field full">
          <label>الاسم</label>
          <input type="text" name="name" value="${escapeHTML(existing?.name || '')}" required />
        </div>
        <div class="field">
          <label>رقم الهاتف</label>
          <input type="tel" name="phone" value="${escapeHTML(existing?.phone || '')}" />
        </div>
        <div class="field">
          <label>العنوان</label>
          <input type="text" name="address" value="${escapeHTML(existing?.address || '')}" />
        </div>
        <div class="field full">
          <label>ملاحظات</label>
          <textarea name="notes">${escapeHTML(existing?.notes || '')}</textarea>
        </div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-brass">${isEdit ? 'حفظ التعديلات' : 'إضافة العميل'}</button>
        <button type="button" class="btn btn-ghost" id="cancelCustomerForm">إلغاء</button>
      </div>
    </form>
  `;
  openModal(isEdit ? 'تعديل بيانات العميل' : 'عميل جديد', bodyHTML, (root) => {
    root.querySelector('#cancelCustomerForm').addEventListener('click', closeModal);
    root.querySelector('#customerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        name: fd.get('name').trim(),
        phone: fd.get('phone').trim(),
        address: fd.get('address').trim(),
        notes: fd.get('notes').trim(),
      };
      if (isEdit) {
        Store.update('customers', existing.id, payload);
        showToast('تم تحديث بيانات العميل');
      } else {
        Store.add('customers', payload);
        showToast('تمت إضافة العميل');
      }
      closeModal();
      onSaved?.();
    });
  });
}

/* =====================================================================
   المخزون
   ===================================================================== */

function renderInventory() {
  const all = [...Store.getAll('inventory')].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const content = document.getElementById('pageContent');

  content.innerHTML = `
    <div class="page-head">
      <div>
        <h1>المخزون</h1>
        <p>راقب كميات المواد المتوفرة وتنبيهات النقص.</p>
      </div>
      <button class="btn btn-brass" id="addItemBtn">+ صنف جديد</button>
    </div>
    <div class="card">
      <div class="card-header"><h2>الأصناف (${all.length})</h2></div>
      <div class="card-body no-pad" id="inventoryTableWrap"></div>
    </div>
  `;

  function draw() {
    document.getElementById('inventoryTableWrap').innerHTML = all.length ? `
      <div class="table-wrap">
        <table class="ledger">
          <thead><tr><th>الصنف</th><th>الكمية</th><th>الحد الأدنى</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            ${all.map((i) => {
              const qty = Number(i.quantity) || 0;
              const min = Number(i.minQuantity) || 0;
              const isLow = qty <= min;
              const pct = min > 0 ? Math.min(100, (qty / (min * 2 || 1)) * 100) : 100;
              return `
              <tr>
                <td>${escapeHTML(i.name)}</td>
                <td>${qty} ${escapeHTML(i.unit || '')}</td>
                <td>${min} ${escapeHTML(i.unit || '')}</td>
                <td>
                  <span class="tag ${isLow ? 'is-low' : 'is-ok'}">${isLow ? 'منخفض' : 'جيد'}</span>
                  <div class="stock-bar ${isLow ? 'is-low' : ''}"><span style="width:${pct}%"></span></div>
                </td>
                <td class="row-actions">
                  <button class="btn btn-ghost btn-sm" data-edit="${i.id}">تعديل</button>
                  <button class="btn btn-danger btn-sm" data-del="${i.id}">حذف</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : emptyState('لا توجد أصناف', 'أضف أول صنف لمتابعة كميته في المخزون.');
  }

  draw();
  document.getElementById('inventoryTableWrap').addEventListener('click', (e) => {
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    const delId = e.target.closest('[data-del]')?.dataset.del;
    if (editId) openInventoryForm(Store.getById('inventory', editId), draw);
    if (delId && confirmAction('هل تريد حذف هذا الصنف من المخزون؟')) {
      Store.remove('inventory', delId);
      all.splice(all.findIndex((i) => i.id === delId), 1);
      showToast('تم حذف الصنف');
      draw();
    }
  });
  document.getElementById('addItemBtn').addEventListener('click', () => openInventoryForm(null, () => renderInventory()));
}

function openInventoryForm(existing, onSaved) {
  const isEdit = !!existing;
  const bodyHTML = `
    <form id="inventoryForm">
      <div class="form-grid">
        <div class="field full">
          <label>اسم الصنف</label>
          <input type="text" name="name" value="${escapeHTML(existing?.name || '')}" required placeholder="مثال: لوح خشب زان" />
        </div>
        <div class="field">
          <label>الوحدة</label>
          <input type="text" name="unit" value="${escapeHTML(existing?.unit || '')}" placeholder="قطعة / متر / كغم" />
        </div>
        <div class="field">
          <label>الكمية الحالية</label>
          <input type="number" step="0.01" min="0" name="quantity" value="${existing?.quantity ?? 0}" required />
        </div>
        <div class="field">
          <label>الحد الأدنى للتنبيه</label>
          <input type="number" step="0.01" min="0" name="minQuantity" value="${existing?.minQuantity ?? 0}" />
        </div>
        <div class="field full">
          <label>ملاحظات</label>
          <textarea name="notes">${escapeHTML(existing?.notes || '')}</textarea>
        </div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-brass">${isEdit ? 'حفظ التعديلات' : 'إضافة الصنف'}</button>
        <button type="button" class="btn btn-ghost" id="cancelInventoryForm">إلغاء</button>
      </div>
    </form>
  `;
  openModal(isEdit ? 'تعديل صنف' : 'صنف جديد في المخزون', bodyHTML, (root) => {
    root.querySelector('#cancelInventoryForm').addEventListener('click', closeModal);
    root.querySelector('#inventoryForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        name: fd.get('name').trim(),
        unit: fd.get('unit').trim(),
        quantity: parseFloat(fd.get('quantity')) || 0,
        minQuantity: parseFloat(fd.get('minQuantity')) || 0,
        notes: fd.get('notes').trim(),
      };
      if (isEdit) {
        Store.update('inventory', existing.id, payload);
        showToast('تم تحديث الصنف');
      } else {
        Store.add('inventory', payload);
        showToast('تمت إضافة الصنف');
      }
      closeModal();
      onSaved?.();
    });
  });
}

/* =====================================================================
   التقارير
   ===================================================================== */

function renderReports() {
  const now = new Date();
  const content = document.getElementById('pageContent');

  content.innerHTML = `
    <div class="page-head">
      <div>
        <h1>التقارير</h1>
        <p>ملخص شهري لأداء الورشة ومقارنة آخر 6 أشهر.</p>
      </div>
      <input type="month" id="reportMonth" value="${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}" />
    </div>
    <div class="stat-grid" id="reportStats"></div>
    <div class="card">
      <div class="card-header"><h2>مقارنة آخر 6 أشهر</h2></div>
      <div class="card-body">
        <div class="bars" id="reportBars"></div>
        <div class="legend">
          <span><span class="legend-dot" style="background:var(--brass)"></span>المبيعات</span>
          <span><span class="legend-dot" style="background:var(--ledger-red)"></span>التكلفة + التوصيل</span>
          <span><span class="legend-dot" style="background:var(--ledger-green)"></span>صافي الربح</span>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h2>تفاصيل الشهر المختار</h2></div>
      <div class="card-body">
        <div class="form-grid" id="reportDetail"></div>
      </div>
    </div>
  `;

  function draw() {
    const [y, m] = document.getElementById('reportMonth').value.split('-').map(Number);
    const t = computeMonthTotals(y, m - 1);

    document.getElementById('reportStats').innerHTML = `
      <div class="stat-card"><div class="stat-label">المبيعات</div><div class="stat-value">${fmtMoney(t.totalSales)}</div></div>
      <div class="stat-card"><div class="stat-label">التكلفة</div><div class="stat-value">${fmtMoney(t.totalCost)}</div></div>
      <div class="stat-card"><div class="stat-label">التوصيل</div><div class="stat-value">${fmtMoney(t.totalDelivery)}</div></div>
      <div class="stat-card"><div class="stat-label">المشتريات</div><div class="stat-value">${fmtMoney(t.totalPurchases)}</div></div>
      <div class="stat-card ${t.netProfit >= 0 ? 'is-positive' : 'is-negative'}"><div class="stat-label">صافي الربح</div><div class="stat-value ${t.netProfit >= 0 ? 'is-positive' : 'is-negative'}">${fmtMoney(t.netProfit)}</div></div>
    `;

    // آخر 6 أشهر بدءًا من الشهر المختار للخلف
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      months.push({ y: d.getFullYear(), m: d.getMonth() });
    }
    const monthTotals = months.map(({ y, m }) => ({ ...computeMonthTotals(y, m), y, m }));
    const maxVal = Math.max(1, ...monthTotals.map((mt) => Math.max(mt.totalSales, mt.totalCost + mt.totalDelivery, Math.abs(mt.netProfit))));

    document.getElementById('reportBars').innerHTML = monthTotals.map((mt) => `
      <div class="bar-col">
        <div style="display:flex; align-items:flex-end; gap:2px; height:100%; width:100%; justify-content:center;">
          <div class="bar" style="height:${(mt.totalSales / maxVal) * 100}%"></div>
          <div class="bar is-cost" style="height:${((mt.totalCost + mt.totalDelivery) / maxVal) * 100}%"></div>
          <div class="bar is-profit" style="height:${(Math.max(0, mt.netProfit) / maxVal) * 100}%"></div>
        </div>
        <span class="bar-label">${MONTH_NAMES[mt.m].slice(0, 3)}</span>
      </div>
    `).join('');

    document.getElementById('reportDetail').innerHTML = `
      <div class="field"><label>عدد عمليات البيع</label><input readonly value="${t.sales.length}" /></div>
      <div class="field"><label>عدد عمليات الشراء</label><input readonly value="${t.purchases.length}" /></div>
      <div class="field"><label>متوسط سعر البيع</label><input readonly value="${fmtMoney(t.sales.length ? t.totalSales / t.sales.length : 0)}" /></div>
      <div class="field"><label>هامش الربح</label><input readonly value="${t.totalSales ? ((t.netProfit / t.totalSales) * 100).toFixed(1) + '%' : '—'}" /></div>
    `;
  }

  draw();
  document.getElementById('reportMonth').addEventListener('change', draw);
}

/* =====================================================================
   النسخ الاحتياطي
   ===================================================================== */

function renderBackup() {
  const settings = Store.getSettings();
  const content = document.getElementById('pageContent');

  content.innerHTML = `
    <div class="page-head">
      <div>
        <h1>النسخ الاحتياطي</h1>
        <p>احفظ نسخة من بياناتك أو استعِد نسخة سابقة. آخر نسخة: ${settings.lastBackupAt ? fmtDate(settings.lastBackupAt) : 'لا يوجد'}</p>
      </div>
    </div>

    <div class="backup-grid">
      <div class="backup-card">
        <h3>تصدير نسخة احتياطية</h3>
        <p>يتم حفظ كل البيانات (المبيعات، المشتريات، العملاء، المخزون) في ملف JSON على جهازك.</p>
        <button class="btn btn-brass" id="exportBtn">تنزيل نسخة احتياطية</button>
      </div>
      <div class="backup-card">
        <h3>استيراد نسخة احتياطية</h3>
        <p>اختر ملف JSON تم تصديره مسبقًا لاستعادة البيانات.</p>
        <input type="file" id="importFile" accept="application/json" style="margin-bottom:10px; width:100%" />
        <div style="display:flex; gap:8px; flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" id="importMergeBtn">دمج مع البيانات الحالية</button>
          <button class="btn btn-danger btn-sm" id="importReplaceBtn">استبدال كل البيانات</button>
        </div>
      </div>
      <div class="backup-card">
        <h3>مسح جميع البيانات</h3>
        <p>سيتم حذف كل البيانات المخزّنة على هذا الجهاز نهائيًا. لا يمكن التراجع عن هذا الإجراء.</p>
        <button class="btn btn-danger" id="wipeBtn">مسح كل البيانات</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h2>ملخص البيانات الحالية</h2></div>
      <div class="card-body">
        <div class="form-grid">
          <div class="field"><label>عملاء</label><input readonly value="${Store.getAll('customers').length}" /></div>
          <div class="field"><label>عمليات بيع</label><input readonly value="${Store.getAll('sales').length}" /></div>
          <div class="field"><label>عمليات شراء</label><input readonly value="${Store.getAll('purchases').length}" /></div>
          <div class="field"><label>أصناف مخزون</label><input readonly value="${Store.getAll('inventory').length}" /></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('exportBtn').addEventListener('click', () => {
    const payload = Store.exportBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `shaysta-wood-manager-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    Store.updateSettings({ lastBackupAt: new Date().toISOString() });
    showToast('تم تنزيل النسخة الاحتياطية');
  });

  function doImport(mode) {
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];
    if (!file) { showToast('الرجاء اختيار ملف أولاً'); return; }
    if (mode === 'replace' && !confirmAction('سيتم استبدال كل البيانات الحالية بمحتوى الملف. هل أنت متأكد؟')) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        Store.importBackup(payload, mode);
        showToast('تم استيراد النسخة الاحتياطية بنجاح');
        renderBackup();
      } catch (err) {
        console.error(err);
        showToast('تعذّر قراءة الملف — تأكد أنه ملف نسخة احتياطية صالح');
      }
    };
    reader.readAsText(file);
  }

  document.getElementById('importMergeBtn').addEventListener('click', () => doImport('merge'));
  document.getElementById('importReplaceBtn').addEventListener('click', () => doImport('replace'));

  document.getElementById('wipeBtn').addEventListener('click', () => {
    if (confirmAction('تحذير: سيتم حذف كل البيانات نهائيًا من هذا الجهاز. هل تريد المتابعة؟')) {
      if (confirmAction('تأكيد أخير: هذا الإجراء لا يمكن التراجع عنه. متابعة الحذف؟')) {
        Store.wipeAll();
        showToast('تم مسح جميع البيانات');
        renderBackup();
      }
    }
  });
}

/* =====================================================================
   تثبيت التطبيق (PWA) + Service Worker
   ===================================================================== */

let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('installBtn');
  btn.hidden = false;
  btn.addEventListener('click', async () => {
    btn.hidden = true;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  });
});

window.addEventListener('appinstalled', () => {
  document.getElementById('installBtn').hidden = true;
  showToast('تم تثبيت التطبيق بنجاح');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((err) => {
      console.warn('تعذّر تسجيل service worker:', err);
    });
  });
}

/* =====================================================================
   بدء التشغيل
   ===================================================================== */

updateOnlineStatus();
navigateTo('dashboard');
