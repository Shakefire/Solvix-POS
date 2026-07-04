const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const db = require('./database');

let win = null;

function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const hasIcon = fs.existsSync(iconPath);

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: hasIcon ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, 'out', 'index.html')}`;
  win.loadURL(startUrl);

  if (isDev) win.webContents.openDevTools();
}

app.whenReady().then(async () => {
  try {
    await db.initialize();
    console.log('Database initialized at', db.dbFile);
  } catch (err) {
    console.error('Failed to initialize DB', err);
  }

  // register ipc handlers
  ipcMain.handle('kbpos-get-products', async () => db.getProducts());
  ipcMain.handle('kbpos-save-product', async (_, product) => db.saveProduct(product));
  ipcMain.handle('kbpos-delete-product', async (_, productId) => db.deleteProduct(productId));
  ipcMain.handle('kbpos-get-settings', async () => db.getSettings());
  ipcMain.handle('kbpos-set-setting', async (_, key, value) => db.setSetting(key, value));
  ipcMain.handle('kbpos-create-order', async (_, order) => db.createOrder(order));
  ipcMain.handle('kbpos-get-orders', async () => db.getOrders());
  ipcMain.handle('kbpos-get-batches', async (_, productId) => db.getBatches(productId));
  ipcMain.handle('kbpos-add-batch', async (_, batch) => db.addBatch(batch));
  ipcMain.handle('kbpos-get-inventory-history', async (_, limit) => db.getInventoryHistory(limit));
  ipcMain.handle('kbpos-get-customers', async () => db.getCustomers());
  ipcMain.handle('kbpos-reset-database', async () => db.resetDatabase());
  ipcMain.handle('kbpos-get-categories', async () => db.getCategories());
  ipcMain.handle('kbpos-save-category', async (_, category) => db.saveCategory(category));
  ipcMain.handle('kbpos-delete-category', async (_, categoryId) => db.deleteCategory(categoryId));
  ipcMain.handle('kbpos-get-next-receipt-number', async () => db.getNextReceiptNumber());
  ipcMain.handle('kbpos-print-receipt', async () => {
    return new Promise((resolve) => {
      if (!win) return resolve(false);
      win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        if (success) resolve(true);
        else if (failureReason && /canceled|cancelled/i.test(failureReason)) resolve(false);
        else resolve(false);
      });
    });
  });
  ipcMain.handle('kbpos-save-customer', async (_, customer) => db.saveCustomer(customer));
  ipcMain.handle('kbpos-delete-customer', async (_, customerId) => db.deleteCustomer(customerId));
  ipcMain.handle('kbpos-get-expenses', async () => db.getExpenses());
  ipcMain.handle('kbpos-save-expense', async (_, expense) => db.saveExpense(expense));
  ipcMain.handle('kbpos-delete-expense', async (_, expenseId) => db.deleteExpense(expenseId));
  ipcMain.handle('kbpos-delete-order', async (_, orderId) => db.deleteOrder(orderId));
  ipcMain.handle('kbpos-add-inventory-history', async (_, entry) => db.addInventoryHistory(entry));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
