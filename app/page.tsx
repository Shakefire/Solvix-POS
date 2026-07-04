'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { DashboardPage, ProductsPage, CategoriesPage, CustomersPage, OrdersPage, InventoryPage, ExpensesPage, ReportsPage, SettingsPage, AboutPage, POSPage } from '@/components/PageViews';
import { AppSettings, DEFAULT_SETTINGS, CartItem, Product, UnitType, convertToPieces, getUnitPrice, deductFromBatches, getAvailableStock, restoreToBatches, InventoryHistoryItem, Order, Expense, getCostByUnit } from '@/lib/pharmacy';

const normalizeCategoryName = (value: string) => (value || '').trim();
const dedupeCategories = (values: Array<string | undefined | null>) => {
  const seen = new Set<string>();
  return values.reduce<string[]>((acc, value) => {
    const normalized = normalizeCategoryName(value ?? '');
    if (!normalized) return acc;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return acc;
    seen.add(key);
    acc.push(normalized);
    return acc;
  }, []);
};

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'billing', label: 'POS / Billing', icon: '🛒' },
  { id: 'products', label: 'Products', icon: '📦' },
  { id: 'categories', label: 'Categories', icon: '🏷️' },
  { id: 'customers', label: 'Customers', icon: '👥' },
  { id: 'orders', label: 'Orders', icon: '📋' },
  { id: 'inventory', label: 'Inventory', icon: '📦' },
  { id: 'expenses', label: 'Expenses', icon: '💸' },
  { id: 'reports', label: 'Reports', icon: '📈' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'about', label: 'About', icon: 'ℹ️' },
];

export default function Home() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryHistory, setInventoryHistory] = useState<InventoryHistoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeMenu, setActiveMenu] = useState('billing');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const loadPersistedState = async () => {
    const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (!electronApi) return;

    try {
      const results = await Promise.allSettled([
        electronApi.getProducts(),
        electronApi.getSettings(),
        electronApi.getOrders(),
        electronApi.getInventoryHistory(200),
        electronApi.getCategories(),
        electronApi.getExpenses(),
      ]);

      const freshProducts = results[0].status === 'fulfilled' ? results[0].value : null;
      const loadedSettings = results[1].status === 'fulfilled' ? results[1].value : null;
      const loadedOrders = results[2].status === 'fulfilled' ? results[2].value : null;
      const loadedHistory = results[3].status === 'fulfilled' ? results[3].value : null;
      const loadedCategories = results[4].status === 'fulfilled' ? results[4].value : null;
      const loadedExpenses = results[5].status === 'fulfilled' ? results[5].value : null;

      if (freshProducts) {
        setProducts(freshProducts);
        const productCategories = dedupeCategories(freshProducts.map((product: Product) => product.category));
        const dbCategoryNames = loadedCategories ? dedupeCategories(loadedCategories.map((c: any) => c.name)) : [];
        const allCategories = dedupeCategories([...dbCategoryNames, ...productCategories]);
        setCategories(allCategories);
      } else if (loadedCategories) {
        setCategories(dedupeCategories(loadedCategories.map((c: any) => c.name)));
      }

      if (loadedSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...loadedSettings });
      }

      if (loadedOrders) {
        setOrders(loadedOrders);
      }

      if (loadedHistory) {
        setInventoryHistory(loadedHistory);
      }

      if (loadedExpenses) {
        setExpenses(loadedExpenses);
      }
    } catch (error) {
      console.error('DB load failed:', error);
    }

    setIsHydrated(true);
  };

  const saveSettingsToDb = async (newSettings: AppSettings) => {
    const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (!electronApi?.setSetting) return;

    try {
      await Promise.all([
        electronApi.setSetting('taxRate', newSettings.taxRate),
        electronApi.setSetting('currencySymbol', newSettings.currencySymbol),
        electronApi.setSetting('currencyCode', newSettings.currencyCode),
        electronApi.setSetting('storeName', newSettings.storeName),
        electronApi.setSetting('address', newSettings.address),
        electronApi.setSetting('phone', newSettings.phone),
        electronApi.setSetting('receiptFooter', newSettings.receiptFooter),
        electronApi.setSetting('theme', newSettings.theme),
        electronApi.setSetting('lowStockThreshold', newSettings.lowStockThreshold),
        electronApi.setSetting('autoPrintReceipt', newSettings.autoPrintReceipt),
      ]);
    } catch (error) {
      console.error('DB settings save failed:', error);
    }
  };

  useEffect(() => {
    loadPersistedState();
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    saveSettingsToDb(settings);
  }, [isHydrated, settings]);

  const addToCart = (product: Product, unit: UnitType = 'Box', quantity = 1) => {
    if (quantity <= 0) {
      return;
    }

    const pieces = convertToPieces(product, unit, quantity);
    if (pieces <= 0) {
      return;
    }

    if (getAvailableStock(product) < pieces) {
      alert('Insufficient stock for selected unit and quantity.');
      return;
    }

    const updatedProduct = deductFromBatches(product, pieces);
    if (!updatedProduct) {
      alert('Unable to reserve stock.');
      return;
    }

    setCartItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.productId === product.id && item.unit === unit);
      if (existingItem) {
        return prevItems.map((item) =>
          item.productId === product.id && item.unit === unit
            ? { ...item, quantity: item.quantity + quantity, pieces: item.pieces + pieces }
            : item
        );
      }
      return [
        ...prevItems,
        {
          id: `${product.id}-${unit}`,
          productId: product.id,
          name: product.name,
          unit,
          quantity,
          pieces,
          price: getUnitPrice(product, unit),
        },
      ];
    });

    setProducts((prevProducts) =>
      prevProducts.map((item) =>
        item.id === product.id ? updatedProduct : item
      )
    );
  };

  const removeFromCart = (cartItemId: string) => {
    const removedItem = cartItems.find((item) => item.id === cartItemId);
    const updatedItems = cartItems.filter((item) => item.id !== cartItemId);

    if (removedItem) {
      setProducts((prevProducts) =>
        prevProducts.map((item) =>
          item.id === removedItem.productId ? restoreToBatches(item, removedItem.pieces) : item
        )
      );
    }

    setCartItems(updatedItems);
  };

  const addInventoryHistory = async (entry: InventoryHistoryItem) => {
    const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (electronApi?.addInventoryHistory) {
      try {
        await electronApi.addInventoryHistory(entry);
      } catch (error) {
        console.error('Failed to save inventory history:', error);
      }
    }
    setInventoryHistory((prev) => [entry, ...prev]);
  };

  const refreshProducts = async () => {
    const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (!electronApi?.getProducts) return;
    try {
      const freshProducts = await electronApi.getProducts();
      if (freshProducts) {
        setProducts(freshProducts);
        setCategories(dedupeCategories(freshProducts.map((product: Product) => product.category)));
      }
    } catch (error) {
      console.error('Failed to refresh products:', error);
    }
  };

  const refreshCategories = async () => {
    const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (!electronApi?.getCategories) return;
    try {
      const loadedCategories = await electronApi.getCategories();
      if (loadedCategories) {
        const dbCategoryNames = loadedCategories.map((c: any) => c.name);
        setCategories(dedupeCategories(dbCategoryNames));
      }
    } catch (error) {
      console.error('Failed to refresh categories:', error);
    }
  };

  const resetDatabase = async () => {
    const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (!electronApi?.resetDatabase) return;

    try {
      await electronApi.resetDatabase();
      setCartItems([]);
      setProducts([]);
      setOrders([]);
      setInventoryHistory([]);
      setExpenses([]);
      setCategories([]);
      setSettings(DEFAULT_SETTINGS);
      await loadPersistedState();
    } catch (error) {
      console.error('Database reset failed:', error);
      alert('Could not reset the database. Please try again.');
    }
  };

  const addExpense = async (payload: { name: string; cost: number; description?: string }) => {
    const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (electronApi?.saveExpense) {
      try {
        await electronApi.saveExpense({ name: payload.name, cost: payload.cost, description: payload.description });
        await loadPersistedState();
        return;
      } catch (error) {
        console.error('Failed to save expense:', error);
      }
    }
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const expense: Expense = {
      id: `EXP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: payload.name,
      cost: payload.cost,
      description: payload.description ?? '',
      date,
      time,
    };
    setExpenses((prev) => [expense, ...prev]);
  };

  const updateExpense = async (updated: Expense) => {
    const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (electronApi?.saveExpense) {
      try {
        await electronApi.saveExpense({ id: updated.id, name: updated.name, cost: updated.cost, description: updated.description });
        await loadPersistedState();
        return;
      } catch (error) {
        console.error('Failed to update expense:', error);
      }
    }
    setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (electronApi?.deleteExpense) {
      try {
        await electronApi.deleteExpense(id);
        await loadPersistedState();
        return;
      } catch (error) {
        console.error('Failed to delete expense:', error);
      }
    }
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const clearCart = async (payload?: { paymentMethod: string; amountReceived?: number; items: CartItem[]; total: number; patientName?: string; doctorName?: string; transactionType?: 'Prescription' | 'Retail' } | boolean) => {
    if (payload && typeof payload !== 'boolean') {
      const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
      const validItems = payload.items.filter((it) => products.some((p) => p.id === it.productId));

      if (validItems.length === 0) {
        alert('No valid products are available for checkout.');
        return;
      }

      const subtotal = validItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
      const tax = Math.round((subtotal * (settings.taxRate / 100)) * 100) / 100;
      const total = subtotal + tax;

      const orderPayload = {
        customer: 'Walk-in',
        paymentMethod: payload.paymentMethod === 'cash' ? 'Cash' : payload.paymentMethod === 'card' ? 'Card' : 'Bank',
        items: validItems.map((it) => {
          const product = products.find((p) => p.id === it.productId);
          const costPrice = product ? getCostByUnit(product, it.unit) : 0;
          return {
            productId: it.productId,
            unit: it.unit,
            quantity: it.quantity,
            price: it.price,
            costPrice,
          };
        }),
        total,
        patient: payload.patientName,
        doctor: payload.doctorName,
      };

      if (electronApi?.createOrder) {
        try {
          await electronApi.createOrder(orderPayload);
          await loadPersistedState();
        } catch (error) {
          console.error('Order save failed:', error);
          alert('Could not save order to database. Please try again.');
        }
      } else {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newOrder: Order = {
          id: `ORD-${Date.now()}`,
          receiptNumber: `RCP-${date.replace(/-/g, '')}-${Date.now().toString().slice(-3)}`,
          customer: 'Walk-in',
          date,
          time,
          total: payload.total,
          status: 'Paid',
          paymentMethod: payload.paymentMethod === 'cash' ? 'Cash' : payload.paymentMethod === 'card' ? 'Card' : 'Bank',
          items: payload.items.map((it) => ({ id: it.id, name: it.name, unit: it.unit, quantity: it.quantity, price: it.price })),
        };

        setOrders((prev) => [newOrder, ...prev]);
        payload.items.forEach((item) => {
          const product = products.find((p) => p.id === item.productId);
          if (!product) return;
          const hist: InventoryHistoryItem = {
            id: `HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            productId: product.id,
            productName: product.name,
            action: 'Removed',
            quantity: item.pieces,
            note: `Sold ${item.quantity} ${item.unit}(s)`,
            date,
            time,
          };
          setInventoryHistory((prev) => [hist, ...prev]);
        });
      }

      setCartItems([]);
    } else {
      setProducts((prevProducts) =>
        prevProducts.map((product) => {
          const cartItem = cartItems.find((item) => item.productId === product.id);
          if (!cartItem) return product;
          return restoreToBatches(product, cartItem.pieces);
        })
      );
      setCartItems([]);
    }
  };

  const currentMenu = menuItems.find((item) => item.id === activeMenu) ?? menuItems[0];

  const renderPage = () => {
    switch (activeMenu) {
      case 'dashboard':
        return <DashboardPage products={products} orders={orders} expenses={expenses} settings={settings} />;
      case 'billing':
        return <POSPage products={products} cartItems={cartItems} addToCart={addToCart} removeFromCart={removeFromCart} clearCart={clearCart} settings={settings} />;
      case 'products':
        return <ProductsPage products={products} setProducts={setProducts} categories={categories} setCategories={setCategories} addHistory={addInventoryHistory} refreshProducts={refreshProducts} refreshCategories={refreshCategories} />;
      case 'categories':
        return <CategoriesPage categories={categories} setCategories={setCategories} products={products} setProducts={setProducts} refreshCategories={refreshCategories} />;
      case 'customers':
        return <CustomersPage />;
      case 'orders':
        return <OrdersPage orders={orders} setOrders={setOrders} settings={settings} />;
      case 'inventory':
        return <InventoryPage products={products} history={inventoryHistory} />;
      case 'reports':
        return <ReportsPage products={products} history={inventoryHistory} orders={orders} settings={settings} />;
      case 'settings':
        return <SettingsPage settings={settings} onSave={setSettings} onReset={resetDatabase} />;
      case 'about':
        return <AboutPage />;
      case 'expenses':
        return <ExpensesPage expenses={expenses} addExpense={addExpense} updateExpense={updateExpense} deleteExpense={deleteExpense} />;
      default:
        return <DashboardPage products={products} orders={orders} expenses={expenses} settings={settings} />;
    }
  };

  return (
    <div className={`flex h-screen overflow-hidden flex-col md:flex-row ${settings.theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-gray-50 text-slate-900'}`}>
      {/* Left Sidebar */}
      <Sidebar
        menuItems={menuItems}
        activeMenu={activeMenu}
        setActiveMenu={(menu) => {
          setActiveMenu(menu);
          setMobileSidebarOpen(false);
        }}
        storeName={settings.storeName}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white px-4 py-2 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen((prev) => !prev)}
                className="inline-flex rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 md:hidden"
              >
                ☰
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{currentMenu.label}</h1>
                <p className="text-gray-500 text-xs">{currentMenu.id === 'billing' ? `${settings.storeName} • Fast checkout interface` : `Manage ${currentMenu.label} • ${settings.storeName}`}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Support: 09122029904</p>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden bg-gray-50 p-1.5 sm:p-2 scroll-smooth-hidden">
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
