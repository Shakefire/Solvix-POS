// Electron renderer controller - uses window.electronAPI for all data interactions
const api = window.electronAPI;

// App state
let PRODUCTS = [];
let CART = [];
let SETTINGS = { taxRate: 8, currencySymbol: '₦' };

// Utilities
const el = (selector) => document.querySelector(selector);
const money = (v) => `${SETTINGS.currencySymbol}${Number(v).toFixed(2)}`;

// Fetch initial data from main process
async function bootstrap(){
  try{
    const [products, settings] = await Promise.all([
      api.getProducts(),
      api.getSettings(),
    ]);
    PRODUCTS = Array.isArray(products) ? products : [];
    SETTINGS = settings || SETTINGS;
    renderInitial();
  }catch(err){
    console.error('bootstrap failed', err);
  }
}

// Renderers
function renderInitial(){
  renderSidebar();
  renderProductsList();
  renderStockDashboard();
  attachNav();
}

function renderSidebar(){
  const footer = el('#footer-contact');
  footer.textContent = SETTINGS.phone || '';
}

function renderProductsList(){
  const container = el('#products-list');
  container.innerHTML = '';
  PRODUCTS.forEach((p)=>{
    const row = document.createElement('div');
    row.className = 'product-row';
    row.innerHTML = `<div class="card" style="margin-bottom:8px"><strong>${p.name}</strong><div class="muted">${p.category || ''}</div><div style="margin-top:6px"><button data-id="${p.id}" class="add-btn">Add</button></div></div>`;
    container.appendChild(row);
  });
  container.querySelectorAll('.add-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const id = btn.getAttribute('data-id');
    const product = PRODUCTS.find(x=>x.id==id);
    if(product) addToCart(product, 'Box', 1);
  }));
}

function renderStockDashboard(){
  const elDash = document.getElementById('stock-dashboard');
  elDash.innerHTML = '';
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  PRODUCTS.forEach(p=>{
    const tr = document.createElement('tr');
    const qty = p.batches ? p.batches.reduce((s,b)=>s + (b.quantity||0), 0) : (p.stock||0);
    const breakdown = breakdownString(p, qty);
    tr.innerHTML = `<td style="padding:6px;border-bottom:1px solid #eef2ff"><strong>${p.name}</strong><div style="font-size:12px;color:#6b7280">${breakdown}</div></td>`;
    table.appendChild(tr);
  });
  elDash.appendChild(table);
}

function breakdownString(product, pieces){
  const perBox = Math.max(1, product.units_per_box || 1);
  const perCarton = Math.max(1, product.units_per_carton || 1);
  const piecesPerCarton = perBox * perCarton;
  const cartons = Math.floor(pieces / piecesPerCarton);
  const afterCartons = pieces - cartons * piecesPerCarton;
  const boxes = Math.floor(afterCartons / perBox);
  const loose = afterCartons - boxes * perBox;
  return `${cartons} Carton${cartons!==1?'s':''}, ${boxes} Box${boxes!==1?'es':''}, ${loose} ${product.base_unit_name||'Pieces'}`;
}

function attachNav(){
  document.querySelectorAll('.nav-item').forEach(btn=>{
    btn.addEventListener('click',(e)=>{
      document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
      document.getElementById('view-'+view).classList.remove('hidden');
    });
  });
}

// Cart operations
function addToCart(product, unit='Box', qty=1){
  // find existing
  const existing = CART.find(c=>c.productId===product.id && c.unit===unit);
  const pieces = convertToPieces(product, unit, qty);
  if(existing){ existing.quantity += qty; existing.pieces += pieces; }
  else CART.push({ id:`${product.id}-${unit}`, productId:product.id, name:product.name, unit, quantity:qty, pieces, price: getUnitPrice(product,unit), salesType: product.sales_type });
  renderCart();
  checkPrescriptionInterceptor();
}

function removeFromCart(id){ CART = CART.filter(c=>c.id!==id); renderCart(); }

function updateCartQuantity(id, newQty){
  const item = CART.find(c=>c.id===id);
  if(!item) return;
  const product = PRODUCTS.find(p=>p.id===item.productId);
  if(!product) return;
  item.quantity = newQty;
  item.pieces = convertToPieces(product, item.unit, newQty);
  renderCart();
  checkPrescriptionInterceptor();
}

function renderCart(){
  const tbody = document.querySelector('#cart-table tbody');
  tbody.innerHTML='';
  CART.forEach(item=>{
    const tr = document.createElement('tr');
    // build unit select dynamically based on product packaging
    const product = PRODUCTS.find(p=>p.id===item.productId) || {};
    const units = [];
    if(product.units_per_carton && product.units_per_carton>0) units.push('Carton');
    if(product.units_per_box && product.units_per_box>0) units.push('Box');
    units.push('Piece');
    const unitSelect = `<select data-id="${item.id}" class="unit-select">${units.map(u=>`<option ${u===item.unit? 'selected': ''}>${u}</option>`).join('')}</select>`;
    tr.innerHTML = `<td>${item.name}</td><td>${unitSelect}</td><td><input class="qty-input" data-id="${item.id}" type="number" min="1" value="${item.quantity}" style="width:64px;padding:6px"/></td><td>${money(item.price)}</td><td>${money(item.price*item.quantity)}</td><td><button class="remove-btn" data-id="${item.id}">×</button></td>`;
    tbody.appendChild(tr);
  });
  // attach event handlers
  document.querySelectorAll('.remove-btn').forEach(b=>b.addEventListener('click',()=>removeFromCart(b.dataset.id)));
  document.querySelectorAll('.qty-input').forEach(i=>i.addEventListener('change',(e)=>updateCartQuantity(e.target.dataset.id, Number(e.target.value)||1)));
  document.querySelectorAll('.unit-select').forEach(s=>s.addEventListener('change',(e)=>{
    const id = e.target.dataset.id; const newUnit = e.target.value;
    const it = CART.find(x=>x.id===id); const prod = PRODUCTS.find(p=>p.id===it.productId);
    if(it && prod){ it.unit=newUnit; it.price=getUnitPrice(prod,newUnit); it.pieces=convertToPieces(prod,newUnit,it.quantity); renderCart(); }
  }));
  renderBilling();
}

function renderBilling(){
  const subtotal = CART.reduce((s,i)=>s + i.price*i.quantity,0);
  const tax = subtotal * (Math.max(0, SETTINGS.taxRate||0)/100);
  const total = subtotal + tax;
  el('#subtotal').textContent = money(subtotal);
  el('#tax').textContent = money(tax);
  el('#total').textContent = money(total);
}

function checkPrescriptionInterceptor(){
  const hasRx = CART.some(i=>i.salesType === 'Requires_Prescription' || i.salesType === 'Rx');
  const payBtn = el('#pay-btn');
  if(hasRx){ payBtn.setAttribute('disabled','true'); openPrescriptionModal(); }
  else { payBtn.removeAttribute('disabled'); }
}

// Modal handlers
function openPrescriptionModal(){ el('#prescription-modal').classList.remove('hidden'); }
function closePrescriptionModal(){ el('#prescription-modal').classList.add('hidden'); }

el('#modal-cancel').addEventListener('click',()=>{ closePrescriptionModal(); });
el('#modal-save').addEventListener('click',()=>{
  const patient = el('#modal-patient').value.trim();
  const doctor = el('#modal-doctor').value.trim();
  if(!patient || !doctor){ alert('Patient and doctor names are required'); return; }
  // attach patient/doctor to order context
  CART.patient = patient; CART.doctor = doctor;
  closePrescriptionModal();
  el('#pay-btn').removeAttribute('disabled');
});

// Conversion helpers that strictly follow product matrix
function getUnitPrice(product, unit){
  const boxPrice = product.price || 0;
  switch(unit){ case 'Carton': return boxPrice * Math.max(1, product.units_per_carton||1); case 'Box': return boxPrice; case 'Piece': return (product.units_per_box && product.units_per_box>0) ? boxPrice / product.units_per_box : boxPrice; default: return boxPrice; }
}

function convertToPieces(product, unit, quantity){
  switch(unit){ case 'Carton': return quantity * Math.max(1, product.units_per_carton||1) * Math.max(1, product.units_per_box||1); case 'Box': return quantity * Math.max(1, product.units_per_box||1); case 'Piece': return quantity; default: return quantity; }
}

// wire pay button to checkout via IPC
el('#pay-btn').addEventListener('click', async ()=>{
  // assemble payload
  const subtotal = CART.reduce((s,i)=>s + i.price*i.quantity,0);
  const tax = subtotal * (Math.max(0, SETTINGS.taxRate||0)/100);
  const total = subtotal + tax;
  const payload = { items: CART.map(i=>({ id:i.id, productId:i.productId, name:i.name, unit:i.unit, quantity:i.quantity, price:i.price })), total, patient: CART.patient, doctor: CART.doctor };
  try{
    await api.createOrder(payload);
    // clear cart
    CART = [];
    renderCart();
    alert('Sale completed');
  }catch(err){ console.error('checkout failed', err); alert('Failed to complete'); }
});

// Boot
bootstrap();
