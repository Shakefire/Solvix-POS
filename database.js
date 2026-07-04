// database.js
// SQLite3 database layer for Solvix POS - pharmacy edition
// Exports an async initializer and helper query functions.

const path = require('path');
const os = require('os');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Determine a safe, cross-platform app data folder for the DB file
function getAppDataPath() {
  const appName = 'Solvix POS';
  const platform = process.platform;
  let base;
  if (platform === 'win32') base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  else if (platform === 'darwin') base = path.join(os.homedir(), 'Library', 'Application Support');
  else base = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  const dir = path.join(base, appName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const DB_FILE = path.join(getAppDataPath(), 'kbpos.sqlite3');

// Open database connection (single instance)
let db;

function formatTimestamp(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (/^\d+$/.test(String(value))) return Number(value);
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

function formatExpiryDate(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return new Date(value * 1000).toISOString().split('T')[0];
  if (/^\d+$/.test(value)) return new Date(Number(value) * 1000).toISOString().split('T')[0];
  return value;
}

function normalizeSalesType(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('prescription') || text === 'rx') return 'Rx';
  return 'OTC';
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const sqlite = new sqlite3.Database(DB_FILE, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) return reject(err);
      // enforce foreign keys
      sqlite.serialize(() => {
        sqlite.run('PRAGMA foreign_keys = ON;', (fkErr) => {
          if (fkErr) return reject(fkErr);
          db = sqlite;
          resolve(db);
        });
      });
    });
  });
}

async function initialize() {
  await openDatabase();
  await runMigrations();
  await ensureSchemaColumns();
  await conditionalSeed();
  return db;
}

async function ensureSchemaColumns() {
  const columns = await all('PRAGMA table_info(products)');
  const existingColumns = new Set(columns.map((col) => col.name));
  const requiredColumns = [
    ['cost', 'REAL DEFAULT 0'],
    ['description', 'TEXT'],
    ['status', "TEXT DEFAULT 'Active'"],
    ['low_stock_alert', 'INTEGER DEFAULT 0'],
    ['expiry_date', 'TEXT'],
    ['manufacturing_date', 'TEXT'],
    ['cartons_received', 'INTEGER DEFAULT 0'],
    ['units_per_carton', 'INTEGER DEFAULT 0'],
    ['units_per_box', 'INTEGER DEFAULT 1'],
    ['pieces_per_box', 'INTEGER DEFAULT 1'],
    ['base_unit_name', 'TEXT DEFAULT "Piece"'],
  ];

  for (const [columnName, definition] of requiredColumns) {
    if (!existingColumns.has(columnName)) {
      await run(`ALTER TABLE products ADD COLUMN ${columnName} ${definition}`);
      existingColumns.add(columnName);
    }
  }
}

function run(sql, params=[]) {
  return new Promise((resolve, reject) => db.run(sql, params, function(err){ if(err) reject(err); else resolve(this); }));
}
function all(sql, params=[]) { return new Promise((resolve,reject)=> db.all(sql, params, (e,r)=> e?reject(e):resolve(r))); }
function get(sql, params=[]) { return new Promise((resolve,reject)=> db.get(sql, params, (e,r)=> e?reject(e):resolve(r))); }

async function runMigrations(){
  // Create tables with relational constraints
  const ddl = `
  BEGIN;

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    brand_name TEXT NOT NULL,
    generic_name TEXT,
    sku TEXT,
    barcode TEXT,
    category TEXT,
    units_per_carton INTEGER DEFAULT 0,
    units_per_box INTEGER DEFAULT 0,
    pieces_per_box INTEGER DEFAULT 1,
    base_unit_name TEXT DEFAULT 'Piece',
    cost REAL DEFAULT 0,
    price REAL DEFAULT 0,
    sales_type TEXT DEFAULT 'Everyday_Item',
    description TEXT,
    status TEXT DEFAULT 'Active',
    low_stock_alert INTEGER DEFAULT 0,
    expiry_date TEXT,
    manufacturing_date TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS inventory_batches (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    batch_number TEXT,
    quantity INTEGER NOT NULL,
    cost_price REAL DEFAULT 0,
    received_at INTEGER DEFAULT (strftime('%s','now')),
    expiry_date INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    receipt_number TEXT,
    customer_id TEXT,
    customer_name TEXT,
    payment_method TEXT DEFAULT 'Cash',
    subtotal REAL NOT NULL,
    tax REAL NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'Paid',
    patient_name TEXT,
    doctor_name TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT,
    unit TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    cost_price REAL NOT NULL,
    total_price REAL NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS inventory_history (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    product_name TEXT,
    action TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    note TEXT,
    related_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
  CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
  CREATE INDEX IF NOT EXISTS idx_batches_product ON inventory_batches(product_id);
  CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_inventory_history_product ON inventory_history(product_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_history_created_at ON inventory_history(created_at);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cost REAL DEFAULT 0,
    description TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
  CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);

  COMMIT;
  `;
  return new Promise((resolve,reject)=>{
    db.exec(ddl, async (err)=> {
      if (err) return reject(err);
      try {
        await addColumnIfNotExists('products', 'cost', 'REAL DEFAULT 0');
        await addColumnIfNotExists('products', 'description', 'TEXT');
        await addColumnIfNotExists('products', 'status', "TEXT DEFAULT 'Active'");
        await addColumnIfNotExists('products', 'low_stock_alert', 'INTEGER DEFAULT 0');
        await addColumnIfNotExists('orders', 'payment_method', "TEXT DEFAULT 'Cash'");
        await addColumnIfNotExists('orders', 'customer_name', 'TEXT');
        await addColumnIfNotExists('orders', 'status', "TEXT DEFAULT 'Paid'");
        await addColumnIfNotExists('order_items', 'cost_price', 'REAL DEFAULT 0');
        await addColumnIfNotExists('order_items', 'product_name', 'TEXT');
        await addColumnIfNotExists('products', 'expiry_date', 'TEXT');
        await addColumnIfNotExists('products', 'manufacturing_date', 'TEXT');
        await addColumnIfNotExists('orders', 'receipt_number', 'TEXT');
        await addColumnIfNotExists('products', 'cartons_received', 'INTEGER DEFAULT 0');
        await addColumnIfNotExists('products', 'pieces_per_box', 'INTEGER DEFAULT 1');
        await addColumnIfNotExists('customers', 'address', 'TEXT');
        resolve();
      } catch (alterErr) {
        reject(alterErr);
      }
    });
  });
}

async function addColumnIfNotExists(tableName, columnName, definition) {
  const columns = await all(`PRAGMA table_info(${tableName})`);
  if (!columns.some((col) => col.name === columnName)) {
    await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

// Seed data only if products table empty
async function conditionalSeed(){
  const row = await get('SELECT COUNT(1) as cnt FROM products');
  if (row && row.cnt > 0) return;

  const now = Math.floor(Date.now()/1000);
  // helper to insert uuid-like ids
  const uid = () => 'id-' + Math.random().toString(36).slice(2,11);

  // Product 1: Amoxil (Rx) - price per piece
  const p1 = {
    id: uid(), brand_name: 'Amoxil', generic_name: 'Amoxicillin', sku: 'AMX-100', barcode: 'AMX1000001', category: 'Antibiotics',
    units_per_carton: 24, units_per_box: 10, pieces_per_box: 3, base_unit_name: 'Tablet', price: 50.00, sales_type: 'Requires_Prescription'
  };

  // Product 2: Panadol Advance (OTC) - price per piece
  const p2 = {
    id: uid(), brand_name: 'Panadol Advance', generic_name: 'Paracetamol', sku: 'PAN-200', barcode: 'PAN2000001', category: 'Analgesics',
    units_per_carton: 40, units_per_box: 8, pieces_per_box: 6, base_unit_name: 'Tablet', price: 30.00, sales_type: 'Everyday_Item'
  };

  await run(`INSERT INTO products(id,brand_name,generic_name,sku,barcode,category,units_per_carton,units_per_box,pieces_per_box,base_unit_name,cost,price,sales_type,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [p1.id,p1.brand_name,p1.generic_name,p1.sku,p1.barcode,p1.category,p1.units_per_carton,p1.units_per_box,p1.pieces_per_box,p1.base_unit_name,26.67,p1.price,p1.sales_type,now]);

  await run(`INSERT INTO products(id,brand_name,generic_name,sku,barcode,category,units_per_carton,units_per_box,pieces_per_box,base_unit_name,cost,price,sales_type,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [p2.id,p2.brand_name,p2.generic_name,p2.sku,p2.barcode,p2.category,p2.units_per_carton,p2.units_per_box,p2.pieces_per_box,p2.base_unit_name,15.00,p2.price,p2.sales_type,now]);

  // Seed batches
  const longExpiry = Math.floor(Date.now()/1000) + 365*24*60*60; // +1 year
  const nearExpiry = Math.floor(Date.now()/1000) + 15*24*60*60; // +15 days

  await run(`INSERT INTO inventory_batches(id,product_id,batch_number,quantity,cost_price,expiry_date,received_at)
    VALUES(?,?,?,?,?,?,?)`, [uid(), p1.id, 'BATCH-AMX-001', 7200, 800.00, longExpiry, now]);

  await run(`INSERT INTO inventory_batches(id,product_id,batch_number,quantity,cost_price,expiry_date,received_at)
    VALUES(?,?,?,?,?,?,?)`, [uid(), p2.id, 'BATCH-PAN-001', 9600, 600.00, longExpiry, now]);

  await run(`INSERT INTO inventory_batches(id,product_id,batch_number,quantity,cost_price,expiry_date,received_at)
    VALUES(?,?,?,?,?,?,?)`, [uid(), p2.id, 'BATCH-PAN-002', 240, 600.00, nearExpiry, now]);
}

// Simple public query helpers used by main/preload
async function getProducts(){
  await ensureSchemaColumns();
  const rows = await all('SELECT * FROM products ORDER BY brand_name ASC');
  const products = [];
  for(const r of rows){
    const sum = await get('SELECT IFNULL(SUM(quantity),0) as total FROM inventory_batches WHERE product_id = ?', [r.id]);
    const batches = await all('SELECT * FROM inventory_batches WHERE product_id = ? ORDER BY expiry_date ASC', [r.id]);
    products.push({
      id: r.id,
      brand_name: r.brand_name,
      generic_name: r.generic_name,
      name: r.brand_name || r.generic_name || 'Unknown Product',
      code: r.sku || '',
      barcode: r.barcode || '',
      category: r.category || 'General',
      units_per_carton: r.units_per_carton || 0,
      units_per_box: r.units_per_box || 1,
      pieces_per_box: r.pieces_per_box || 1,
      base_unit_name: r.base_unit_name || 'Piece',
      cost: r.cost || 0,
      price: r.price || 0,
      sales_type: normalizeSalesType(r.sales_type),
      status: r.status || 'Active',
      description: r.description || '',
      lowStockAlert: r.low_stock_alert || 0,
      expiry_date: r.expiry_date || '',
      manufacturing_date: r.manufacturing_date || '',
      cartons_received: r.cartons_received || 0,
      stock: sum ? sum.total : 0,
      batches: batches.map((batch) => ({
        batch_number: batch.batch_number,
        expiry_date: formatExpiryDate(batch.expiry_date),
        quantity: batch.quantity,
        cost_price: batch.cost_price,
      })),
    });
  }
  return products;
}

async function saveProduct(product) {
  await ensureSchemaColumns();
  const now = Math.floor(Date.now()/1000);
  const id = product.id || 'prod-' + Math.random().toString(36).slice(2,11);
  const unitsPerCarton = product.units_per_carton || 0;
  const boxesPerUnit = product.units_per_box || 1;
  const piecesPerBox = product.pieces_per_box || 1;
  const cartonsReceived = product.cartons_received || 0;
  const existingProduct = product.id ? await get('SELECT cartons_received FROM products WHERE id = ?', [product.id]) : null;
  const previousCartonsReceived = existingProduct?.cartons_received || 0;
  const cartonsToAdd = Math.max(0, cartonsReceived - previousCartonsReceived);
  const stockToAdd = cartonsToAdd * Math.max(1, unitsPerCarton) * Math.max(1, boxesPerUnit) * Math.max(1, piecesPerBox);
  const data = {
    id,
    brand_name: product.name || product.brand_name || 'Unknown',
    generic_name: product.generic_name || '',
    sku: product.code || '',
    barcode: product.barcode || '',
    category: product.category || 'General',
    units_per_carton: unitsPerCarton,
    units_per_box: boxesPerUnit,
    pieces_per_box: piecesPerBox,
    base_unit_name: product.base_unit_name || 'Piece',
    cost: product.cost || 0,
    price: product.price || 0,
    sales_type: product.sales_type || 'OTC',
    description: product.description || '',
    status: product.status || 'Active',
    low_stock_alert: product.lowStockAlert || 0,
    expiry_date: product.expiry_date || null,
    manufacturing_date: product.manufacturing_date || null,
    cartons_received: cartonsReceived,
  };

  await run(`INSERT INTO products(id,brand_name,generic_name,sku,barcode,category,units_per_carton,units_per_box,pieces_per_box,base_unit_name,cost,price,sales_type,description,status,low_stock_alert,expiry_date,manufacturing_date,cartons_received,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      brand_name=excluded.brand_name,
      generic_name=excluded.generic_name,
      sku=excluded.sku,
      barcode=excluded.barcode,
      category=excluded.category,
      units_per_carton=excluded.units_per_carton,
      units_per_box=excluded.units_per_box,
      pieces_per_box=excluded.pieces_per_box,
      base_unit_name=excluded.base_unit_name,
      cost=excluded.cost,
      price=excluded.price,
      sales_type=excluded.sales_type,
      description=excluded.description,
      status=excluded.status,
      low_stock_alert=excluded.low_stock_alert,
      expiry_date=excluded.expiry_date,
      manufacturing_date=excluded.manufacturing_date,
      cartons_received=excluded.cartons_received,
      updated_at=excluded.updated_at`, [
        data.id,
        data.brand_name,
        data.generic_name,
        data.sku,
        data.barcode,
        data.category,
        data.units_per_carton,
        data.units_per_box,
        data.pieces_per_box,
        data.base_unit_name,
        data.cost,
        data.price,
        data.sales_type,
        data.description,
        data.status,
        data.low_stock_alert,
        data.expiry_date,
        data.manufacturing_date,
        data.cartons_received,
        now,
        now,
      ]);

  // Create or update inventory batch from newly-added cartons
  if (stockToAdd > 0) {
    const expiryTs = data.expiry_date ? formatTimestamp(data.expiry_date) : null;
    let existingBatch = null;
    if (expiryTs) {
      existingBatch = await get('SELECT id, quantity FROM inventory_batches WHERE product_id = ? AND expiry_date = ?', [id, expiryTs]);
    }
    if (!existingBatch) {
      existingBatch = await get('SELECT id, quantity FROM inventory_batches WHERE product_id = ? AND expiry_date IS NULL', [id]);
    }

    if (existingBatch) {
      await run('UPDATE inventory_batches SET quantity = quantity + ? WHERE id = ?', [stockToAdd, existingBatch.id]);
    } else {
      const batchId = 'batch-' + Math.random().toString(36).slice(2,11);
      const batchNumber = `BATCH-${data.sku || id.slice(-6).toUpperCase()}-${Date.now()}`;
      await run(`INSERT INTO inventory_batches(id,product_id,batch_number,quantity,cost_price,expiry_date,received_at,created_at) VALUES(?,?,?,?,?,?,?,?)`,
        [batchId, id, batchNumber, stockToAdd, data.cost, expiryTs, now, now]);
    }

    await run(`INSERT INTO inventory_history(id,product_id,product_name,action,quantity,note,related_id,created_at) VALUES(?,?,?,?,?,?,?,?)`, [
      'hist-' + Math.random().toString(36).slice(2,11),
      id,
      data.brand_name,
      'Added',
      stockToAdd,
      `Received ${cartonsToAdd} carton(s) = ${stockToAdd} ${data.base_unit_name}(s)`,
      id,
      now,
    ]);
  }

  return { id };
}

async function deleteProduct(productId) {
  await run('DELETE FROM inventory_batches WHERE product_id = ?', [productId]);
  await run('DELETE FROM inventory_history WHERE product_id = ?', [productId]);
  await run('DELETE FROM products WHERE id = ?', [productId]);
}

async function getCustomers(){
  const rows = await all('SELECT * FROM customers ORDER BY full_name ASC');
  return rows.map((row) => ({
    id: row.id,
    name: row.full_name,
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
  }));
}

async function saveCustomer(customer) {
  const now = Math.floor(Date.now()/1000);
  const id = customer.id || 'cust-' + Math.random().toString(36).slice(2,11);
  await run(`INSERT INTO customers(id,full_name,phone,email,address,created_at) VALUES(?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      full_name=excluded.full_name,
      phone=excluded.phone,
      email=excluded.email,
      address=excluded.address`, [id, customer.name, customer.phone, customer.email, customer.address, now]);
  return { id };
}

async function deleteCustomer(customerId) {
  await run('DELETE FROM customers WHERE id = ?', [customerId]);
}

async function getSettings(){
  // read settings table and return an object of known keys
  const rows = await all('SELECT key, value FROM settings');
  const out = {};
  for(const r of rows) {
    try { out[r.key] = JSON.parse(r.value); } catch(e) { out[r.key] = r.value; }
  }
  // provide sensible defaults
  return Object.assign({ taxRate: 8, currencySymbol: '₦' }, out);
}

async function setSetting(key, value){
  const now = Math.floor(Date.now()/1000);
  const v = (typeof value === 'string') ? value : JSON.stringify(value);
  return run(`INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`, [key, v, now]);
}

async function getOrders(){
  const orders = await all('SELECT * FROM orders ORDER BY created_at DESC');
  const mappedOrders = [];
  for(const o of orders){
    const items = await all('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
    const date = o.created_at ? new Date(o.created_at * 1000).toISOString().split('T')[0] : '';
    const time = o.created_at ? new Date(o.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    mappedOrders.push({
      id: o.id,
      receiptNumber: o.receipt_number || '',
      customer: o.customer_name || 'Walk-in',
      date,
      time,
      total: o.total || 0,
      status: o.status || 'Paid',
      paymentMethod: o.payment_method || 'Cash',
      patientName: o.patient_name || '',
      doctorName: o.doctor_name || '',
      items: items.map((item) => ({
        id: item.product_id,
        name: item.product_name || item.product_id,
        unit: item.unit,
        quantity: item.quantity,
        price: item.unit_price,
        costPrice: item.cost_price,
      })),
    });
  }
  return mappedOrders;
}

async function getBatches(productId){
  if(productId) return await all('SELECT * FROM inventory_batches WHERE product_id = ? ORDER BY expiry_date ASC', [productId]);
  return await all('SELECT * FROM inventory_batches ORDER BY product_id, expiry_date ASC');
}

async function addBatch({ productId, batchNumber, quantity, costPrice, expiryDate }){
  const id = 'batch-' + Math.random().toString(36).slice(2,11);
  const now = Math.floor(Date.now()/1000);
  const product = await get('SELECT brand_name FROM products WHERE id = ?', [productId]);
  await run(`INSERT INTO inventory_batches(id,product_id,batch_number,quantity,cost_price,expiry_date,received_at,created_at) VALUES(?,?,?,?,?,?,?,?)`, [id, productId, batchNumber, quantity, costPrice || 0, expiryDate || null, now, now]);
  await run(`INSERT INTO inventory_history(id,product_id,product_name,action,quantity,note,related_id,created_at) VALUES(?,?,?,?,?,?,?,?)`, [
    'hist-' + Math.random().toString(36).slice(2,11),
    productId,
    product ? product.brand_name : null,
    'Added',
    quantity,
    `Received batch ${batchNumber}`,
    id,
    now,
  ]);
  return { id };
}

async function getInventoryHistory(limit = 200){
  const rows = await all(`SELECT id, product_id, product_name, action, quantity, note, created_at FROM inventory_history ORDER BY created_at DESC LIMIT ?`, [limit]);
  return rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    action: row.action,
    quantity: row.quantity,
    note: row.note,
    date: row.created_at ? new Date(row.created_at * 1000).toISOString().split('T')[0] : '',
    time: row.created_at ? new Date(row.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
  }));
}

async function getProductUnitSize(productId, unit) {
  const product = await get('SELECT units_per_carton, units_per_box, pieces_per_box FROM products WHERE id = ?', [productId]);
  if (!product) return 1;
  const boxesPerUnit = Math.max(1, product.units_per_box || 1);
  const piecesPerBox = Math.max(1, product.pieces_per_box || 1);
  if (unit === 'Box') return piecesPerBox;
  if (unit === 'Carton') return Math.max(1, product.units_per_carton || 1) * boxesPerUnit * piecesPerBox;
  return 1;
}

async function computeCostPricePerUnit(productId, unit) {
  const product = await get('SELECT cost, units_per_carton, units_per_box, pieces_per_box FROM products WHERE id = ?', [productId]);
  if (!product) return 0;

  const pieceCost = product.cost || 0;
  const boxesPerUnit = Math.max(1, product.units_per_box || 1);
  const piecesPerBox = Math.max(1, product.pieces_per_box || 1);

  if (unit === 'Carton') {
    return pieceCost * Math.max(1, product.units_per_carton || 1) * boxesPerUnit * piecesPerBox;
  }
  if (unit === 'Box') {
    return pieceCost * piecesPerBox;
  }
  return pieceCost;
}

async function computeOrderItemCostPrice(productId, unit, quantity) {
  const unitCost = await computeCostPricePerUnit(productId, unit);
  return unitCost * Math.max(1, quantity || 1);
}

async function createOrder(order){
  // order: { items: [{productId,unit,quantity,price,costPrice}], total, patient, doctor, paymentMethod, customer }
  const oid = 'order-' + Math.random().toString(36).slice(2,11);
  const now = Math.floor(Date.now()/1000);
  const settings = await getSettings();
  const validItems = [];

  for (const item of order.items || []) {
    const product = await get('SELECT id, brand_name FROM products WHERE id = ?', [item.productId]);
    if (!product) {
      console.warn(`Skipping order item for missing product ${item.productId}`);
      continue;
    }
    validItems.push({ ...item, product });
  }

  if (validItems.length === 0) {
    throw new Error('No valid products available for checkout.');
  }

  const subtotal = validItems.reduce((s,i)=> s + (i.price * i.quantity), 0);
  const tax = Math.round((subtotal * (settings.taxRate/100)) * 100)/100;
  const total = order.total || (subtotal + tax);

  // Generate sequential receipt number: RCP-YYYYMMDD-NNN
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  const countRow = await get("SELECT COUNT(1) as cnt FROM orders WHERE receipt_number LIKE ?", [`RCP-${dateStr}-%`]);
  const seq = ((countRow?.cnt || 0) + 1).toString().padStart(3, '0');
  const receiptNumber = `RCP-${dateStr}-${seq}`;

  await run('BEGIN TRANSACTION');
  try{
    await run(`INSERT INTO orders(id,receipt_number,customer_id,customer_name,payment_method,subtotal,tax,total,status,patient_name,doctor_name,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, [
      oid,
      receiptNumber,
      null,
      order.customer || 'Walk-in',
      order.paymentMethod || 'Cash',
      subtotal,
      tax,
      total,
      'Paid',
      order.patient,
      order.doctor,
      now,
    ]);
    for(const it of validItems){
      const iid = 'oi-' + Math.random().toString(36).slice(2,11);
      const costPrice = typeof it.costPrice === 'number'
        ? it.costPrice
        : await computeOrderItemCostPrice(it.productId, it.unit, it.quantity);
      const product = it.product;
      const productName = product ? product.brand_name : null;
      const unitName = it.unit || 'Piece';
      await run(`INSERT INTO order_items(id,order_id,product_id,product_name,unit,quantity,unit_price,cost_price,total_price) VALUES(?,?,?,?,?,?,?,?,?)`, [
        iid,
        oid,
        it.productId,
        productName,
        unitName,
        it.quantity,
        it.price,
        costPrice,
        it.price * it.quantity,
      ]);
      const batchPieces = unitName === 'Carton'
        ? it.quantity * Math.max(1, await getProductUnitSize(it.productId, 'Carton'))
        : unitName === 'Box'
          ? it.quantity * Math.max(1, await getProductUnitSize(it.productId, 'Box'))
          : it.quantity;
      try {
        await deductFromBatches(it.productId, it.quantity, unitName);
      } catch (stockErr) {
        console.warn('Stock deduction failed for order item:', stockErr.message || stockErr);
      }
      await run(`INSERT INTO inventory_history(id,product_id,product_name,action,quantity,note,related_id,created_at) VALUES(?,?,?,?,?,?,?,?)`, [
        'hist-' + Math.random().toString(36).slice(2,11),
        it.productId,
        productName,
        'Removed',
        batchPieces,
        `Sold ${it.quantity} ${unitName}(s)`,
        iid,
        now,
      ]);
    }
    await run('COMMIT');
    return { id: oid, receiptNumber };
  }catch(err){
    await run('ROLLBACK');
    throw err;
  }
}

async function deductFromBatches(productId, soldQuantity, unit){
  // convert soldQuantity in given unit to pieces matching batch quantity (assumes batch.quantity stored in pieces)
  // Need product packaging to translate; fetch product
  const product = await get('SELECT * FROM products WHERE id = ?', [productId]);
  if(!product) throw new Error('Product not found');
  let pieces = soldQuantity;
  if(unit === 'Box') pieces = soldQuantity * Math.max(1, product.units_per_box || 1) * Math.max(1, product.pieces_per_box || 1);
  else if(unit === 'Carton') pieces = soldQuantity * Math.max(1, product.units_per_carton || 1) * Math.max(1, product.units_per_box || 1) * Math.max(1, product.pieces_per_box || 1);

  // fetch batches ordered by expiry ASC (FEFO)
  const batches = await all('SELECT * FROM inventory_batches WHERE product_id = ? AND quantity > 0 ORDER BY expiry_date ASC, received_at ASC', [productId]);
  let remaining = pieces;
  for(const b of batches){
    if(remaining <= 0) break;
    const take = Math.min(b.quantity, remaining);
    await run('UPDATE inventory_batches SET quantity = quantity - ? WHERE id = ?', [take, b.id]);
    remaining -= take;
  }
  if(remaining > 0){
    // not enough stock; you may choose to throw or allow negative; we throw to indicate failure
    throw new Error('Insufficient stock to fulfill order');
  }
}

async function resetDatabase() {
  await run('BEGIN');
  try {
    await run('DELETE FROM order_items');
    await run('DELETE FROM orders');
    await run('DELETE FROM inventory_batches');
    await run('DELETE FROM inventory_history');
    await run('DELETE FROM products');
    await run('DELETE FROM customers');
    await run('DELETE FROM settings');
    await run('DELETE FROM categories');
    await run('DELETE FROM expenses');
    await run('COMMIT');
  } catch (err) {
    await run('ROLLBACK');
    throw err;
  }
}

async function getCategories() {
  const rows = await all('SELECT id, name FROM categories ORDER BY name ASC');
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

async function saveCategory(category) {
  const id = category.id || 'cat-' + Math.random().toString(36).slice(2, 11);
  const name = (category.name || '').trim();
  if (!name) throw new Error('Category name is required');

  const existing = await get('SELECT id, name FROM categories WHERE lower(name) = lower(?)', [name]);
  if (existing) {
    if (existing.name !== name) {
      await run('UPDATE categories SET name = ? WHERE id = ?', [name, existing.id]);
    }
    return { id: existing.id, name };
  }

  await run(
    `INSERT INTO categories(id, name) VALUES(?, ?)`,
    [id, name]
  );
  return { id, name };
}

async function deleteCategory(categoryId) {
  await run('DELETE FROM categories WHERE id = ?', [categoryId]);
}

async function getNextReceiptNumber() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  const countRow = await get("SELECT COUNT(1) as cnt FROM orders WHERE receipt_number LIKE ?", [`RCP-${dateStr}-%`]);
  const seq = ((countRow?.cnt || 0) + 1).toString().padStart(3, '0');
  return `RCP-${dateStr}-${seq}`;
}

async function getExpenses() {
  const rows = await all('SELECT * FROM expenses ORDER BY created_at DESC');
  return rows.map((row) => {
    const date = row.created_at ? new Date(row.created_at * 1000).toISOString().split('T')[0] : '';
    const time = row.created_at ? new Date(row.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return {
      id: row.id,
      name: row.name,
      cost: row.cost || 0,
      description: row.description || '',
      date,
      time,
    };
  });
}

async function saveExpense(expense) {
  const now = Math.floor(Date.now() / 1000);
  const id = expense.id || 'exp-' + Math.random().toString(36).slice(2, 11);
  await run(`INSERT INTO expenses(id, name, cost, description, created_at) VALUES(?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      cost=excluded.cost,
      description=excluded.description`, [id, expense.name, expense.cost || 0, expense.description || '', now]);
  return { id };
}

async function deleteExpense(expenseId) {
  await run('DELETE FROM expenses WHERE id = ?', [expenseId]);
}

async function deleteOrder(orderId) {
  await run('DELETE FROM order_items WHERE order_id = ?', [orderId]);
  await run('DELETE FROM orders WHERE id = ?', [orderId]);
}

async function addInventoryHistory(entry) {
  const now = Math.floor(Date.now() / 1000);
  const id = entry.id || 'hist-' + Math.random().toString(36).slice(2, 11);
  await run(`INSERT INTO inventory_history(id, product_id, product_name, action, quantity, note, related_id, created_at) VALUES(?,?,?,?,?,?,?,?)`, [
    id,
    entry.productId || null,
    entry.productName || null,
    entry.action,
    entry.quantity,
    entry.note || '',
    entry.relatedId || null,
    now,
  ]);
  return { id };
}

module.exports = {
  initialize,
  getProducts,
  saveProduct,
  deleteProduct,
  getCustomers,
  saveCustomer,
  deleteCustomer,
  getSettings,
  setSetting,
  createOrder,
  getOrders,
  deleteOrder,
  getBatches,
  addBatch,
  getInventoryHistory,
  addInventoryHistory,
  getCategories,
  saveCategory,
  deleteCategory,
  getNextReceiptNumber,
  getExpenses,
  saveExpense,
  deleteExpense,
  resetDatabase,
  dbFile: DB_FILE,
};
