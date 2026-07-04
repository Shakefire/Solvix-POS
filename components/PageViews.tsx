import React, { useEffect, useState } from 'react';
import ProductCatalog from '@/components/ProductCatalog';
import ProductManager from '@/components/ProductManager';
import CategoryManager from '@/components/CategoryManager';
import Cart from '@/components/Cart';
import Checkout from '@/components/Checkout';
import { AppSettings, CartItem, Product, getAvailableStock, isBatchExpired, InventoryHistoryItem, Order, Expense, totalInventoryValue, expiredItemsCount, nearExpiryAlertCount, lowStockTriggers, formatStockBreakdown, formatCurrency, getCostByUnit } from '@/lib/pharmacy';

interface POSPageProps {
  products: Product[];
  cartItems: CartItem[];
  addToCart: (product: Product, unit: import('@/lib/pharmacy').UnitType, quantity: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: (payload?: { paymentMethod: string; amountReceived?: number; items: CartItem[]; total: number; patientName?: string; doctorName?: string; transactionType?: 'Prescription' | 'Retail' } | false) => void;
  settings: AppSettings;
}

interface InventoryPageProps {
  products: Product[];
  history: InventoryHistoryItem[];
  setProducts?: React.Dispatch<React.SetStateAction<Product[]>>;
  addHistory?: (entry: InventoryHistoryItem) => void;
  refreshProducts?: () => Promise<void>;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
}

interface ProductsPageProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  addHistory?: (entry: InventoryHistoryItem) => void;
  refreshProducts?: () => Promise<void>;
  refreshCategories?: () => Promise<void>;
}

function StatsCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-3">{title}</p>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-gray-500 mt-2">{subtitle}</p>
    </div>
  );
}

const normalizeDate = (value: string) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getExpiryStatus = (product: Product) => {
  if (product.batches.length === 0) return 'No Data';

  const validBatches = product.batches
    .filter((batch) => batch.quantity > 0 && !isBatchExpired(batch.expiry_date))
    .sort((a, b) => normalizeDate(a.expiry_date).getTime() - normalizeDate(b.expiry_date).getTime());

  if (validBatches.length === 0) return 'Expired';

  const today = normalizeDate(new Date().toISOString().split('T')[0]);
  const nextExpiry = normalizeDate(validBatches[0].expiry_date);
  const daysUntil = Math.ceil((nextExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil <= 0) return 'Expired';
  if (daysUntil <= 30) return 'About to expire';
  return 'Good';
};

const getExpiryBadgeClass = (status: string) => {
  switch (status) {
    case 'Expired':
      return 'bg-rose-100 text-rose-700';
    case 'About to expire':
      return 'bg-amber-100 text-amber-700';
    case 'No Data':
      return 'bg-gray-100 text-gray-500';
    default:
      return 'bg-emerald-100 text-emerald-700';
  }
};

const getNextExpiryDate = (product: Product) => {
  if (product.batches.length === 0) return 'N/A';
  const batches = product.batches
    .filter((batch) => batch.quantity > 0 && !isBatchExpired(batch.expiry_date))
    .sort((a, b) => normalizeDate(a.expiry_date).getTime() - normalizeDate(b.expiry_date).getTime());

  return batches.length > 0 ? batches[0].expiry_date : 'All expired';
};

export function DashboardPage({
  products,
  orders,
  expenses,
  settings,
}: {
  products: Product[];
  orders: Order[];
  expenses: Expense[];
  settings: AppSettings;
}) {
  const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
  const totalOrders = orders.length;
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.cost, 0);
  const profit = orders.reduce((sum, order) => {
    const orderProfit = order.items.reduce((itemSum, item) => {
      const product = products.find((p) => p.id === item.id);
      const pricePerUnit = typeof item.price === 'number' ? item.price : 0;
      const costPerUnit = product
        ? getCostByUnit(product, item.unit)
        : (typeof item.costPrice === 'number' && item.costPrice > 0 ? item.costPrice / Math.max(1, item.quantity || 1) : 0);
      return itemSum + (pricePerUnit - costPerUnit) * Math.max(1, item.quantity || 1);
    }, 0);
    return sum + orderProfit;
  }, 0);
  const inventoryValue = totalInventoryValue(products);
  const expiredCount = expiredItemsCount(products);
  const nearExpiryCount = nearExpiryAlertCount(products);
  const lowStockCount = lowStockTriggers(products, settings.lowStockThreshold);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Today's Sales" value={formatCurrency(totalSales, settings)} subtitle={`${totalOrders} order${totalOrders === 1 ? '' : 's'}`} />
        <StatsCard title="Today's Profit" value={formatCurrency(profit, settings)} subtitle={`Expenses: ${formatCurrency(totalExpenses, settings)}`} />
        <StatsCard title="Inventory Value" value={formatCurrency(inventoryValue, settings)} subtitle={`${expiredCount} expired batch${expiredCount === 1 ? '' : 'es'}`} />
        <StatsCard title="Inventory Alerts" value={`${lowStockCount}`} subtitle={`${nearExpiryCount} near expiry`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Transactions</h2>
          {orders.length === 0 ? (
            <div className="text-sm text-gray-500">No transactions yet.</div>
          ) : (
            <div className="space-y-4">
              {orders.slice(0, 4).map((order) => (
                <div key={order.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">Order {order.id}</p>
                      <p className="text-xs text-gray-500">{order.date} • {order.time}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(order.total, settings)}</p>
                      <p className="text-xs text-gray-500">{order.paymentMethod}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Inventory Alerts</h2>
          <div className="space-y-4 text-sm text-gray-600">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">Low stock products</p>
              <p>{lowStockCount} product{lowStockCount === 1 ? '' : 's'} under threshold</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">Near expiry</p>
              <p>{nearExpiryCount} batch{nearExpiryCount === 1 ? '' : 'es'} within 30 days</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">Expired inventory</p>
              <p>{expiredCount} expired batch{expiredCount === 1 ? '' : 'es'}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Expense Summary</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FeatureCard title="Total Orders">₦ {totalOrders.toFixed(0)}</FeatureCard>
          <FeatureCard title="Total Expenses">₦ {totalExpenses.toFixed(2)}</FeatureCard>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900 mb-3">{title}</h2>
      <div className="space-y-2 text-sm text-gray-600">{children}</div>
    </div>
  );
}

export function ProductsPage({ products, setProducts, categories, setCategories, addHistory, refreshProducts, refreshCategories }: ProductsPageProps) {
  return (
    <div className="space-y-6">
      <ProductManager
        products={products}
        setProducts={setProducts}
        categories={categories}
        setCategories={setCategories}
        addHistory={addHistory}
        refreshProducts={refreshProducts}
        refreshCategories={refreshCategories}
      />
    </div>
  );
}

export function CategoriesPage({ categories, setCategories, products, setProducts, refreshCategories }: { categories: string[]; setCategories: React.Dispatch<React.SetStateAction<string[]>>; products: Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>; refreshCategories?: () => Promise<void> }) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Categories</h2>
            <p className="mt-2 text-sm text-gray-500">Organize products by category and keep inventory simple.</p>
          </div>
          <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {categories.length} categories
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Category List</h3>
          <CategoryManager products={products} setProducts={setProducts} categories={categories} setCategories={setCategories} refreshCategories={refreshCategories} />
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Category Overview</h3>
          <div className="space-y-4">
            {categories.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">No categories yet.</div>
            ) : (
              categories.map((categoryItem) => {
                const productsInCategory = products.filter((product) => product.category === categoryItem);
                const isOpen = openCategory === categoryItem;
                return (
                  <div key={categoryItem} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{categoryItem}</p>
                        <p className="text-xs text-gray-500">{productsInCategory.length} product{productsInCategory.length === 1 ? '' : 's'}</p>
                      </div>
                      <button
                        onClick={() => setOpenCategory(isOpen ? null : categoryItem)}
                        className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition"
                      >
                        {isOpen ? 'Hide products' : 'View products'}
                      </button>
                    </div>
                    {isOpen && (
                      <div className="mt-4 space-y-3">
                        {productsInCategory.length === 0 ? (
                          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">No products assigned to this category.</div>
                        ) : (
                          productsInCategory.map((product) => (
                            <div key={product.id} className="rounded-3xl border border-gray-200 bg-white p-4">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="font-semibold text-slate-900">{product.name}</p>
                                  <p className="text-xs text-gray-500">SKU: {product.code} • Barcode: {product.barcode}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-slate-900 font-semibold">₦{product.price.toFixed(2)}</p>
                                  <p className="text-xs text-gray-500">Stock: {product.stock}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  const filteredCustomers = customers.filter((customer) => {
    const query = search.toLowerCase();
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.phone.toLowerCase().includes(query) ||
      customer.email.toLowerCase().includes(query)
    );
  });

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
  };

  useEffect(() => {
    const loadCustomers = async () => {
      const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
      if (!electronApi?.getCustomers) return;
      try {
        const list = await electronApi.getCustomers();
        setCustomers(list || []);
      } catch (error) {
        console.error('Failed to load customers:', error);
      }
    };
    loadCustomers();
  }, []);

  const addCustomer = async () => {
    if (!name.trim() || !phone.trim()) {
      alert('Name and phone are required.');
      return;
    }

    const newCustomer = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
    };
    const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (electronApi?.saveCustomer) {
      try {
        await electronApi.saveCustomer(newCustomer);
        const updated = await electronApi.getCustomers();
        setCustomers(updated || []);
        resetForm();
        setShowForm(false);
        return;
      } catch (error) {
        console.error('Failed to save customer:', error);
      }
    }

    setCustomers((prev) => [
      ...prev,
      { id: Date.now().toString(), name: newCustomer.name, phone: newCustomer.phone, email: newCustomer.email, address: newCustomer.address },
    ]);
    resetForm();
    setShowForm(false);
  };

  const deleteCustomer = async (customerId: string) => {
    if (!confirm('Delete this customer?')) return;
    const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (electronApi?.deleteCustomer) {
      try {
        await electronApi.deleteCustomer(customerId);
        const updated = await electronApi.getCustomers();
        setCustomers(updated || []);
        return;
      } catch (error) {
        console.error('Failed to delete customer:', error);
      }
    }
    setCustomers((prev) => prev.filter((customer) => customer.id !== customerId));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Customers</h2>
            <p className="mt-2 text-sm text-gray-500">Manage customer records, contact details, and customer history.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                
                onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); e.currentTarget.blur(); } }}
                placeholder="Search customers..."
                className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 pr-9 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">✕</button>
              )}
            </div>
            <button onClick={() => setShowForm((value) => !value)} className="rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer">
              {showForm ? 'Cancel' : '+ New Customer'}
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)}  onKeyDown={(e) => { if (e.key === 'Escape') { setShowForm(false); } }} placeholder="Name" className="rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)}  onKeyDown={(e) => { if (e.key === 'Tab' || e.key === 'Enter') return; if (e.key === 'Escape') { setShowForm(false); } }} placeholder="Phone" className="rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
            <input value={email} onChange={(e) => setEmail(e.target.value)}  onKeyDown={(e) => { if (e.key === 'Tab' || e.key === 'Enter') return; if (e.key === 'Escape') { setShowForm(false); } }} placeholder="Email" className="rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
            <input value={address} onChange={(e) => setAddress(e.target.value)}  onKeyDown={(e) => { if (e.key === 'Tab' || e.key === 'Enter') return; if (e.key === 'Escape') { setShowForm(false); } }} placeholder="Address" className="rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
          </div>
          <div className="mt-5 flex justify-end">
            <button onClick={addCustomer} className="rounded-3xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer">
              Save Customer
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 text-sm text-slate-600">Showing {filteredCustomers.length} customers</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.16em] text-xs">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-6 py-4 text-slate-900">{customer.name}</td>
                  <td className="px-6 py-4 text-slate-600">{customer.phone}</td>
                  <td className="px-6 py-4 text-slate-600">{customer.email}</td>
                  <td className="px-6 py-4 text-slate-600">{customer.address}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => deleteCustomer(customer.id)} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



export function OrdersPage({ orders, setOrders, settings }: { orders: Order[]; setOrders: React.Dispatch<React.SetStateAction<Order[]>>; settings: AppSettings }) {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Pending' | 'Cancelled'>('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [reprintOrder, setReprintOrder] = useState<Order | null>(null);

  const filteredOrders = orders.filter((order) => {
    const query = search.toLowerCase();
    const orderDate = new Date(order.date);
    const fromDate = startDate ? new Date(startDate) : null;
    const toDate = endDate ? new Date(endDate) : null;

    if (startDate && orderDate < fromDate!) return false;
    if (endDate && orderDate > toDate!) return false;
    if (statusFilter !== 'All' && order.status !== statusFilter) return false;

    return (
      order.id.toLowerCase().includes(query) ||
      (order.receiptNumber || '').toLowerCase().includes(query) ||
      order.customer.toLowerCase().includes(query) ||
      order.status.toLowerCase().includes(query) ||
      order.paymentMethod.toLowerCase().includes(query)
    );
  });

  const deleteOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    const label = order?.receiptNumber || orderId;
    if (!confirm(`Delete receipt ${label} from history?`)) return;
    const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
    if (electronApi?.deleteOrder) {
      try {
        await electronApi.deleteOrder(orderId);
      } catch (error) {
        console.error('Failed to delete order from DB:', error);
      }
    }
    setOrders((prev) => prev.filter((order) => order.id !== orderId));
  };

  const reprintReceipt = async (order: Order) => {
    setReprintOrder(order);
    setTimeout(async () => {
      const printDiv = document.getElementById('printable-receipt-reprint');
      if (printDiv) printDiv.style.display = 'block';
      const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
      try {
        if (electronApi?.printReceipt) {
          await electronApi.printReceipt();
        } else {
          window.print();
        }
      } catch (error) {
        console.error('Print failed:', error);
        window.print();
      }
      if (printDiv) printDiv.style.display = 'none';
    }, 100);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Orders</h2>
            <p className="mt-2 text-sm text-gray-500">View order history, search orders, and inspect/order details.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                
                onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); e.currentTarget.blur(); } }}
                placeholder="Search orders by ID, customer, status, payment..."
                className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 pr-9 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">✕</button>
              )}
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Paid' | 'Pending' | 'Cancelled')}
              className="rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{orders.length} total orders</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 text-sm text-slate-600">Showing {filteredOrders.length} order history records</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.16em] text-xs">
              <tr>
                <th className="px-6 py-4">Receipt #</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Date / Time</th>
                <th className="px-6 py-4">Items</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 text-slate-900 font-semibold">{order.receiptNumber || order.id}</td>
                  <td className="px-6 py-4 text-slate-900">{order.customer}</td>
                  <td className="px-6 py-4 text-slate-600">
                    <div>{order.date}</div>
                    <div className="text-xs text-slate-400">{order.time}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{order.items.length}</td>
                  <td className="px-6 py-4 text-blue-600 font-semibold">₦{order.total.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${order.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : order.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                      >
                        View
                      </button>
                      <button
                        onClick={() => reprintReceipt(order)}
                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition"
                      >
                        Reprint
                      </button>
                      <button
                        onClick={() => deleteOrder(order.id)}
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Order Details</h3>
                <p className="mt-1 text-sm text-gray-500">Order {selectedOrder.id} details and receipt preview.</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-500 hover:text-slate-900">✕</button>
            </div>
            <div className="space-y-6 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Receipt Number</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedOrder.receiptNumber || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Order ID</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedOrder.id}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Customer</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedOrder.customer}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Date</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedOrder.date}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Time</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedOrder.time}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Payment</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedOrder.paymentMethod}</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-3xl border border-gray-200 bg-slate-50 p-4">
                <div className="space-y-3">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-semibold text-slate-900">₦{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-slate-200 pt-4 text-right">
                  <p className="text-sm text-gray-500">Total items: {selectedOrder.items.length}</p>
                  <p className="text-2xl font-bold text-slate-900">₦{selectedOrder.total.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-3xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Close
                </button>
                <button
                  onClick={() => reprintReceipt(selectedOrder)}
                  className="rounded-3xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition"
                >
                  Reprint Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden printable receipt for reprint */}
      {reprintOrder && (
        <div id="printable-receipt-reprint" style={{ display: 'none' }}>
          <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', lineHeight: '1.4', color: '#000', fontWeight: 'bold', maxWidth: '300px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', color: '#000' }}>Sales Receipt</div>
              <div style={{ fontSize: '20px', fontWeight: '900', marginTop: '4px', color: '#000' }}>{settings.storeName}</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#000' }}>{settings.address}</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#000' }}>Tel: {settings.phone}</div>
            </div>

            <div style={{ borderTop: '2px dashed #000', margin: '10px 0' }} />

            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '10px', color: '#000' }}>
              <div>Receipt: {reprintOrder.receiptNumber || reprintOrder.id}</div>
              <div>{reprintOrder.date} {reprintOrder.time}</div>
            </div>

            {reprintOrder.patientName && (
              <div style={{ border: '2px solid #000', padding: '8px', marginBottom: '10px', fontSize: '12px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase' }}>Prescription</div>
                <div>Patient: {reprintOrder.patientName || 'N/A'} | Doctor: {reprintOrder.doctorName || 'N/A'}</div>
              </div>
            )}

            <div style={{ marginBottom: '10px' }}>
              {reprintOrder.items.map((item: any, index: number) => (
                <div key={index} style={{ border: '2px solid #000', padding: '8px', marginBottom: '6px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#000' }}>
                    <span>{index + 1}. {item.name}</span>
                    <span>{formatCurrency(item.price * item.quantity, settings)}</span>
                  </div>
                  <div style={{ fontWeight: 'bold', marginTop: '2px', color: '#000' }}>
                    {item.quantity} {item.unit}{item.quantity === 1 ? '' : 's'} x {formatCurrency(item.price, settings)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '2px solid #000', paddingTop: '8px', fontSize: '12px', fontWeight: 'bold' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '900', marginBottom: '4px', color: '#000' }}>
                <span>TOTAL</span><span>{formatCurrency(reprintOrder.total, settings)}</span>
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>&nbsp;</div>
            <div style={{ marginTop: '10px' }}>&nbsp;</div>
            <div style={{ marginTop: '10px' }}>&nbsp;</div>
            <div style={{ marginTop: '10px' }}>&nbsp;</div>

            <div style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', marginTop: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#000' }}>{settings.receiptFooter}</div>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#000', marginTop: '4px' }}>Please verify all medications before leaving.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function InventoryPage({ products, history }: InventoryPageProps) {
  const [view, setView] = useState<'inventory' | 'history'>('inventory');
  const [inventoryFilter, setInventoryFilter] = useState<'All' | 'Expired' | 'About to expire' | 'Good' | 'No Data'>('All');

  const filteredProducts = products.filter((product) => {
    const status = getExpiryStatus(product);
    return inventoryFilter === 'All' || status === inventoryFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Inventory</h2>
          <p className="mt-2 text-sm text-gray-500">View inventory stock, expiry status, and item movement history.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setView('inventory')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${view === 'inventory' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}
          >
            Inventory
          </button>
          <button
            onClick={() => setView('history')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${view === 'history' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}
          >
            Inventory History
          </button>
        </div>
      </div>

      {view === 'inventory' ? (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <StatsCard title="Total Products" value={`${products.length}`} subtitle="All tracked inventory items" />
            <StatsCard title="Expired Items" value={`${products.filter((product) => getExpiryStatus(product) === 'Expired').length}`} subtitle="Products with expired stock" />
            <StatsCard title="About to Expire" value={`${products.filter((product) => getExpiryStatus(product) === 'About to expire').length}`} subtitle="Expiring within 30 days" />
            <StatsCard title="Available Stock" value={`${products.reduce((sum, product) => sum + getAvailableStock(product), 0)}`} subtitle="Total available quantity" />
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Expiry Filter</p>
                <p className="text-sm text-gray-500">Filter the inventory list by expiry status.</p>
              </div>
              <select
                value={inventoryFilter}
                onChange={(e) => setInventoryFilter(e.target.value as 'All' | 'Expired' | 'About to expire' | 'Good' | 'No Data')}
                className="rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-pointer"
              >
                <option value="All">All Products</option>
                <option value="Expired">Expired</option>
                <option value="About to expire">About to expire</option>
                <option value="Good">Good</option>
                <option value="No Data">No Data</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 text-sm text-slate-600">Displaying {filteredProducts.length} products</div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.16em] text-xs">
                  <tr>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Stock</th>
                    <th className="px-6 py-4">Expiry Status</th>
                    <th className="px-6 py-4">Next Expiry</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredProducts.map((product) => {
                    const status = getExpiryStatus(product);
                    return (
                      <tr key={product.id}>
                        <td className="px-6 py-4 text-slate-900">{product.name}</td>
                        <td className="px-6 py-4 text-gray-600">{product.category}</td>
                        <td className="px-6 py-4 text-slate-900">
                          <div>{getAvailableStock(product)}</div>
                          <div className="text-xs text-gray-500">{formatStockBreakdown(product).label}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getExpiryBadgeClass(status)}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{getNextExpiryDate(product)}</td>
                        <td className="px-6 py-4">
                          <button className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition">
                            View Batches
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 text-sm text-slate-600">Inventory History</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.16em] text-xs">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Quantity</th>
                  <th className="px-6 py-4">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-6 py-4 text-slate-900">{entry.date}</td>
                    <td className="px-6 py-4 text-slate-900">{entry.time}</td>
                    <td className="px-6 py-4 text-slate-900">{entry.productName}</td>
                    <td className="px-6 py-4 text-slate-900">{entry.action}</td>
                    <td className="px-6 py-4 text-slate-900">{entry.quantity}</td>
                    <td className="px-6 py-4 text-gray-600">{entry.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

interface ExpensesPageProps {
  expenses: import('@/lib/pharmacy').Expense[];
  addExpense: (payload: { name: string; cost: number; description?: string }) => void;
  updateExpense: (expense: import('@/lib/pharmacy').Expense) => void;
  deleteExpense: (id: string) => void;
}

export function ExpensesPage({ expenses, addExpense, updateExpense, deleteExpense }: ExpensesPageProps) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<import('@/lib/pharmacy').Expense | null>(null);
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [description, setDescription] = useState('');

  const resetForm = () => {
    setEditing(null);
    setName('');
    setCost('');
    setDescription('');
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (e: import('@/lib/pharmacy').Expense) => {
    setEditing(e);
    setName(e.name);
    setCost(e.cost.toString());
    setDescription(e.description ?? '');
    setShowModal(true);
  };

  const save = () => {
    const costValue = parseFloat(cost) || 0;
    if (!name) { alert('Name required'); return; }
    if (editing) {
      updateExpense({ ...editing, name, cost: costValue, description });
    } else {
      addExpense({ name, cost: costValue, description });
    }
    setShowModal(false);
    resetForm();
  };

  const filtered = expenses.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q) ||
      (e.description ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Expenses</h2>
            <p className="mt-1 text-sm text-gray-500">Create, edit, delete and search expenses.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input value={search} onChange={(e)=>setSearch(e.target.value)}  onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); e.currentTarget.blur(); } }} placeholder="Search expenses..." className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-2 pr-8 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer">✕</button>
              )}
            </div>
            <button onClick={openAdd} className="rounded-3xl bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 transition cursor-pointer">+ New Expense</button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 text-sm text-slate-600">Showing {filtered.length} expenses</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.16em] text-xs">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Cost</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Date / Time</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td className="px-6 py-4">{e.id}</td>
                  <td className="px-6 py-4">{e.name}</td>
                  <td className="px-6 py-4">₦{e.cost.toFixed(2)}</td>
                  <td className="px-6 py-4 text-gray-600">{e.description}</td>
                  <td className="px-6 py-4">{e.date} <div className="text-xs text-slate-400">{e.time}</div></td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={()=>openEdit(e)} className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-700">✎</button>
                      <button onClick={()=>deleteExpense(e.id)} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-[20px] bg-white shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">{editing ? 'Edit Expense' : 'New Expense'}</h3>
              <button onClick={()=>{setShowModal(false); resetForm();}} className="text-gray-500 hover:text-gray-700 cursor-pointer">Close</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold">Name</label>
                <input value={name} onChange={(e)=>setName(e.target.value)}  onKeyDown={(e) => { if (e.key === 'Escape') { setShowModal(false); resetForm(); } }} className="w-full mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
              </div>
              <div>
                <label className="text-sm font-semibold">Cost</label>
                <input type="number" value={cost} onChange={(e)=>setCost(e.target.value)}  onKeyDown={(e) => { if (e.key === 'Escape') { setShowModal(false); resetForm(); } }} className="w-full mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
              </div>
              <div>
                <label className="text-sm font-semibold">Description</label>
                <textarea value={description} onChange={(e)=>setDescription(e.target.value)}  onKeyDown={(e) => { if (e.key === 'Escape') { setShowModal(false); resetForm(); } }} className="w-full mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={()=>{setShowModal(false); resetForm();}} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition cursor-pointer">Cancel</button>
                <button onClick={save} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportsPage({ products, history, orders, settings }: { products: Product[]; history: InventoryHistoryItem[]; orders: Order[]; settings: AppSettings }) {
  const [tab, setTab] = useState<'sales' | 'products' | 'customers' | 'inventory'>('sales');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  const formatAmount = (v: number) => formatCurrency(v, settings);

  const exportCSV = (filename: string, headers: string[], rows: Array<string[]>) => {
    const lines = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportXLSX = async (filename: string, headers: string[], rows: Array<string[]>) => {
    const XLSX = await import('xlsx');
    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa as any);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, filename);
  };

  const exportPDF = async (filename: string, headers: string[], rows: Array<string[]>, title = '') => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();
    if (title) doc.text(title, 14, 16);
    autoTable(doc as any, { head: [headers], body: rows, startY: 20 });
    doc.save(filename);
  };

  const allOrders: Order[] = orders ?? [];

  const filterByDate = <T,>(items: T[], getDate: (t: T) => string) => {
    if (!startDate && !endDate) return items;
    const from = startDate ? new Date(startDate) : null;
    const to = endDate ? new Date(endDate) : null;
    return items.filter((it) => {
      const d = new Date(getDate(it));
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  };

  const salesFiltered = filterByDate(allOrders, (o) => o.date);
  const totalRevenue = salesFiltered.reduce((s, o) => s + o.total, 0);
  const totalOrders = salesFiltered.length;
  const avgOrder = totalOrders ? totalRevenue / totalOrders : 0;
  const totalProfit = salesFiltered.reduce((s, o) => {
    const itemsProfit = o.items.reduce((is, it) => {
      const product = products.find((p) => p.id === it.id);
      const costPerUnit = product
        ? getCostByUnit(product, it.unit)
        : (typeof it.costPrice === 'number' && it.costPrice > 0 ? it.costPrice / Math.max(1, it.quantity || 1) : 0);
      return is + (it.price - costPerUnit) * it.quantity;
    }, 0);
    return s + itemsProfit;
  }, 0);

  const salesRows = salesFiltered.map((o) => [o.id, o.customer, `${o.date} ${o.time}`, o.items.map((it) => `${it.name} x${it.quantity}`).join('; '), formatAmount(o.total), o.status, o.paymentMethod]);

  // productsRows computed on demand for exports if needed

  const customers = Array.from(new Set(allOrders.map((o) => o.customer))).map((name) => {
    const ordersBy = allOrders.filter((o) => o.customer === name);
    const total = ordersBy.reduce((s, o) => s + o.total, 0);
    return { name, orders: ordersBy.length, total };
  });

  // customersRows computed on demand for export if needed

  // inventoryRows computed on demand for export if needed

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="text-2xl font-semibold text-slate-900">Reports & Analytics</div>
            <div className="text-sm text-gray-500">Business performance insights and exports</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-3xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{totalOrders} orders</div>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}  className="rounded-3xl border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
            <span>to</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}  className="rounded-3xl border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
            <button onClick={refresh} className="rounded-3xl border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 transition cursor-pointer">Refresh</button>
            <button onClick={() => exportPDF('sales-report.pdf', ['Order ID','Customer','Date/Time','Items','Total','Status','Payment'], salesRows, 'Sales Report') } className="rounded-3xl bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 transition cursor-pointer">Export PDF</button>
            <button onClick={() => exportXLSX('sales-report.xlsx', ['Order ID','Customer','Date/Time','Items','Total','Status','Payment'], salesRows) } className="rounded-3xl bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700 transition cursor-pointer">Export Excel</button>
            <button onClick={() => exportCSV('sales-report.csv', ['Order ID','Customer','Date/Time','Items','Total','Status','Payment'], salesRows) } className="rounded-3xl border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50 transition cursor-pointer">Export CSV</button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setTab('sales')} className={`px-4 py-2 rounded-full ${tab === 'sales' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Sales Report</button>
          <button onClick={() => setTab('products')} className={`px-4 py-2 rounded-full ${tab === 'products' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Products</button>
          <button onClick={() => setTab('customers')} className={`px-4 py-2 rounded-full ${tab === 'customers' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Customers</button>
          <button onClick={() => setTab('inventory')} className={`px-4 py-2 rounded-full ${tab === 'inventory' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>Inventory</button>
        </div>

        {tab === 'sales' && (
          <div>
            <div className="grid gap-4 sm:grid-cols-4 mb-4">
              <StatsCard title="Total Revenue" value={formatAmount(totalRevenue)} subtitle={`${totalOrders} orders`} />
              <StatsCard title="Total Orders" value={`${totalOrders}`} subtitle="Orders in selected range" />
              <StatsCard title="Total Profit" value={formatAmount(totalProfit)} subtitle="Revenue - Cost of goods" />
              <StatsCard title="Avg Order Value" value={formatAmount(avgOrder)} subtitle="Average order total" />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.16em] text-xs">
                  <tr>
                    <th className="px-6 py-4">Order ID</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Date / Time</th>
                    <th className="px-6 py-4">Items</th>
                    <th className="px-6 py-4">Total</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {salesFiltered.map((o) => (
                    <tr key={o.id}>
                      <td className="px-6 py-4">{o.id}</td>
                      <td className="px-6 py-4">{o.customer}</td>
                      <td className="px-6 py-4">{o.date} <div className="text-xs text-slate-400">{o.time}</div></td>
                      <td className="px-6 py-4">{o.items.map(i=>`${i.name} x${i.quantity}`).join(', ')}</td>
                      <td className="px-6 py-4 text-blue-600 font-semibold">{formatAmount(o.total)}</td>
                      <td className="px-6 py-4">{o.status}</td>
                      <td className="px-6 py-4">{o.paymentMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'products' && (
          <div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.16em] text-xs">
                  <tr>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">SKU</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Batches</th>
                    <th className="px-6 py-4">Stock</th>
                    <th className="px-6 py-4">Cost</th>
                    <th className="px-6 py-4">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="px-6 py-4">{p.id}</td>
                      <td className="px-6 py-4">{p.name}</td>
                      <td className="px-6 py-4">{p.code}</td>
                      <td className="px-6 py-4">{p.category}</td>
                      <td className="px-6 py-4">{p.batches.map(b=>`${b.batch_number}(${b.quantity})`).join(', ')}</td>
                      <td className="px-6 py-4">{p.stock}</td>
                      <td className="px-6 py-4">{formatAmount(p.cost)}</td>
                      <td className="px-6 py-4">{formatAmount(p.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'customers' && (
          <div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.16em] text-xs">
                  <tr>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Orders</th>
                    <th className="px-6 py-4">Total Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {customers.map((c) => (
                    <tr key={c.name}>
                      <td className="px-6 py-4">{c.name}</td>
                      <td className="px-6 py-4">{c.orders}</td>
                      <td className="px-6 py-4">{formatAmount(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'inventory' && (
          <div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.16em] text-xs">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Qty</th>
                    <th className="px-6 py-4">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="px-6 py-4">{h.date}</td>
                      <td className="px-6 py-4">{h.time}</td>
                      <td className="px-6 py-4">{h.productName}</td>
                      <td className="px-6 py-4">{h.action}</td>
                      <td className="px-6 py-4">{h.quantity}</td>
                      <td className="px-6 py-4">{h.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsPage({ settings, onSave, onReset }: { settings: AppSettings; onSave: (value: AppSettings) => void; onReset: () => Promise<void> }) {
  const [form, setForm] = useState(settings);

  React.useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSave = () => {
    const normalized = {
      ...form,
      taxRate: Math.max(0, Math.min(100, Number(form.taxRate) || 0)),
      lowStockThreshold: Math.max(0, Number(form.lowStockThreshold) || 0),
    };
    onSave(normalized);
  };

  const handleReset = async () => {
    if (!confirm('Resetting the database will remove all products, customers, orders, inventory, and settings. This cannot be undone. Continue?')) {
      return;
    }
    await onReset();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Settings</h2>
            <p className="mt-2 text-sm text-gray-500">Configure your store profile, tax handling, currency format, and receipt preferences.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button onClick={handleSave} className="rounded-3xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition">Save settings</button>
            <button onClick={handleReset} className="rounded-3xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 transition">Reset database</button>
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Store profile</h3>
          <label className="block text-sm text-gray-600">
            <span className="mb-2 block font-medium">Store name</span>
            <input value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })}  className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
          </label>
          <label className="block text-sm text-gray-600">
            <span className="mb-2 block font-medium">Address</span>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}  className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
          </label>
          <label className="block text-sm text-gray-600">
            <span className="mb-2 block font-medium">Phone</span>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}  className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
          </label>
          <label className="block text-sm text-gray-600">
            <span className="mb-2 block font-medium">Receipt footer</span>
            <textarea value={form.receiptFooter} onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}  rows={3} className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
          </label>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Payments & pricing</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-gray-600">
              <span className="mb-2 block font-medium">Currency symbol</span>
              <input value={form.currencySymbol} onChange={(e) => setForm({ ...form, currencySymbol: e.target.value.slice(0, 3) })}  className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
            </label>
            <label className="block text-sm text-gray-600">
              <span className="mb-2 block font-medium">Currency code</span>
              <input value={form.currencyCode} onChange={(e) => setForm({ ...form, currencyCode: e.target.value.toUpperCase() })}  className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
            </label>
          </div>
          <label className="block text-sm text-gray-600">
            <span className="mb-2 block font-medium">Tax rate (%)</span>
            <input type="number" min="0" max="100" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })}  className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
          </label>
          <label className="block text-sm text-gray-600">
            <span className="mb-2 block font-medium">Low stock threshold</span>
            <input type="number" min="0" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })}  className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
          </label>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Experience</h3>
          <label className="block text-sm text-gray-600">
            <span className="mb-2 block font-medium">Theme</span>
            <select value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value as 'light' | 'dark' })} className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-pointer">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="flex items-center justify-between rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <span>Auto print receipt after checkout</span>
            <input type="checkbox" checked={form.autoPrintReceipt} onChange={(e) => setForm({ ...form, autoPrintReceipt: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          </label>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Live preview</h3>
          <p className="mt-3 text-sm text-gray-500">Your store name and currency will appear in checkout receipts, reports, and the app header.</p>
          <div className="mt-4 rounded-3xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-semibold">{form.storeName}</p>
            <p className="mt-1">Tax rate: {form.taxRate}%</p>
            <p className="mt-1">Currency: {form.currencySymbol} ({form.currencyCode})</p>
            <p className="mt-1">Address: {form.address}</p>
            <p className="mt-1">Phone: {form.phone}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AboutPage() {
  return (
    <FeatureCard title="About Timeline POS">
      <p>Offline first POS application built for local operations.</p>
      <p>All sales, products, inventory, and reports work without internet.</p>
    </FeatureCard>
  );
}

export function POSPage({ products, cartItems, addToCart, removeFromCart, clearCart, settings }: POSPageProps) {
  const [receiptNumber, setReceiptNumber] = useState('');

  useEffect(() => {
    const fetchReceiptNumber = async () => {
      const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
      if (electronApi?.getNextReceiptNumber) {
        try {
          const num = await electronApi.getNextReceiptNumber();
          setReceiptNumber(num);
        } catch (error) {
          setReceiptNumber(`RCP-${Date.now()}`);
        }
      } else {
        setReceiptNumber(`RCP-${Date.now()}`);
      }
    };
    fetchReceiptNumber();
  }, [cartItems.length]);

  return (
    <div className="flex h-full max-h-[calc(100vh-5.5rem)] gap-2 overflow-hidden">
      <main className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm">
        <ProductCatalog products={products} onAddToCart={addToCart} />
      </main>

      <aside className="sticky right-0 flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-slate-50 p-1.5 shadow-sm">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto">
            <Cart items={cartItems} onRemove={removeFromCart} onClear={() => clearCart(false)} />
          </div>
          <div className="mt-1 flex-none overflow-auto">
            <Checkout items={cartItems} products={products} settings={settings} receiptNumber={receiptNumber} onCheckout={clearCart} />
          </div>
        </div>
      </aside>
    </div>
  );
}
