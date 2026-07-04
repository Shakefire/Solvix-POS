import React, { useEffect, useState } from 'react';
import CategoryManager from '@/components/CategoryManager';
import { Product, InventoryHistoryItem, SalesType, cleanText, titleCaseText, normalizeBarcode } from '@/lib/pharmacy';

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

interface ProductManagerProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  addHistory?: (entry: InventoryHistoryItem) => void;
  refreshProducts?: () => Promise<void>;
  refreshCategories?: () => Promise<void>;
}

export default function ProductManager({ products, setProducts, categories, setCategories, addHistory, refreshProducts, refreshCategories }: ProductManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [code, setCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('No Category');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [unitsPerCarton, setUnitsPerCarton] = useState('1');
  const [boxesPerUnit, setBoxesPerUnit] = useState('1');
  const [piecesPerBox, setPiecesPerBox] = useState('1');
  const [baseUnitName, setBaseUnitName] = useState('Tablet');
  const [cartonsReceived, setCartonsReceived] = useState('0');
  const [salesType, setSalesType] = useState<SalesType>('OTC');
  const [lowStockAlert, setLowStockAlert] = useState('5');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [expiryDate, setExpiryDate] = useState('');
  const [manufacturingDate, setManufacturingDate] = useState('');
  const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;

  const BASE_UNIT_OPTIONS = ['Tablet', 'Capsule', 'Syrup', 'Ointment', 'Injection', 'Bottle', 'Strip', 'Piece', 'Inhaler', 'Drop'];

  const computedTotalStock = (() => {
    const cartons = parseInt(cartonsReceived, 10) || 0;
    const previousCartons = editingProduct?.cartons_received ?? 0;
    const deltaCartons = Math.max(0, cartons - previousCartons);
    const upc = Math.max(1, parseInt(unitsPerCarton, 10) || 1);
    const bpu = Math.max(1, parseInt(boxesPerUnit, 10) || 1);
    const ppb = Math.max(1, parseInt(piecesPerBox, 10) || 1);
    const existingStock = editingProduct?.stock ?? 0;
    return existingStock + deltaCartons * upc * bpu * ppb;
  })();

  const categoryOptions = ['All Categories', ...categories];

  const filteredProducts = products.filter((product) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      product.name.toLowerCase().includes(query) ||
      product.code.toLowerCase().includes(query) ||
      product.barcode.toLowerCase().includes(query);
    const matchesCategory = selectedCategory === 'All Categories' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const resetForm = () => {
    setName('');
    setGenericName('');
    setCode('');
    setBarcode('');
    setCategory('No Category');
    setCost('');
    setPrice('');
    setUnitsPerCarton('1');
    setBoxesPerUnit('1');
    setPiecesPerBox('1');
    setBaseUnitName('Tablet');
    setCartonsReceived('0');
    setSalesType('OTC');
    setLowStockAlert('5');
    setDescription('');
    setStatus('Active');
    setExpiryDate('');
    setManufacturingDate('');
    setEditingProduct(null);
  };

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name);
      setCode(editingProduct.code);
      setGenericName(editingProduct.generic_name ?? '');
      setBarcode(editingProduct.barcode);
      setCategory(editingProduct.category);
      setCost(editingProduct.cost.toString());
      setPrice(editingProduct.price.toString());
      setUnitsPerCarton(editingProduct.units_per_carton?.toString() ?? '1');
      setBoxesPerUnit(editingProduct.units_per_box?.toString() ?? '1');
      setPiecesPerBox(editingProduct.pieces_per_box?.toString() ?? '1');
      setBaseUnitName(editingProduct.base_unit_name ?? 'Tablet');
      setCartonsReceived(editingProduct.cartons_received?.toString() ?? '0');
      setSalesType(editingProduct.sales_type ?? 'OTC');
      setDescription(editingProduct.description ?? '');
      setStatus(editingProduct.status);
      setLowStockAlert(editingProduct.lowStockAlert?.toString() ?? '5');
      setExpiryDate(editingProduct.expiry_date ?? '');
      setManufacturingDate(editingProduct.manufacturing_date ?? '');
    }
  }, [editingProduct]);

  const openAddModal = () => {
    resetForm();
    const prefix = 'PRD';
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    setCode(`${prefix}-${random}`);
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const saveProduct = async () => {
    const priceValue = parseFloat(price) || 0;
    const costValue = parseFloat(cost) || 0;
    const lowStockValue = parseInt(lowStockAlert, 10) || 5;
    const unitsPerCartonValue = Math.max(1, parseInt(unitsPerCarton, 10) || 1);
    const boxesPerUnitValue = Math.max(1, parseInt(boxesPerUnit, 10) || 1);
    const piecesPerBoxValue = Math.max(1, parseInt(piecesPerBox, 10) || 1);
    const cartonsReceivedValue = parseInt(cartonsReceived, 10) || 0;
    const cleanedName = titleCaseText(cleanText(name));
    const cleanedGenericName = titleCaseText(cleanText(genericName));
    const cleanedCode = cleanText(code);
    const cleanedBarcode = normalizeBarcode(barcode);
    const cleanedCategory = titleCaseText(cleanText(category));
    const cleanedBaseUnitName = titleCaseText(cleanText(baseUnitName));

    if (!cleanedName || !cleanedCode) {
      alert('Name and code are required.');
      return;
    }

    if (!Number.isInteger(unitsPerCartonValue) || !Number.isInteger(boxesPerUnitValue) || !Number.isInteger(piecesPerBoxValue)) {
      alert('Pack sizes must be whole integers.');
      return;
    }

    if (cleanedBarcode && /[A-Za-z]/.test(cleanedBarcode)) {
      alert('Barcode must be numeric.');
      return;
    }

    const ensureCategoryExists = (categoryName: string) => {
      const normalizedCategoryName = normalizeCategoryName(categoryName);
      if (!categories.some((categoryItem) => categoryItem.toLowerCase() === normalizedCategoryName.toLowerCase()) && normalizedCategoryName.length > 0) {
        setCategories((prev) => dedupeCategories([...prev, normalizedCategoryName]));
      }
    };

    ensureCategoryExists(cleanedCategory);

    const productPayload = {
      id: editingProduct?.id,
      name: cleanedName,
      brand_name: cleanedName,
      generic_name: cleanedGenericName,
      code: cleanedCode,
      barcode: cleanedBarcode,
      category: cleanedCategory,
      cost: costValue,
      price: priceValue,
      stock: computedTotalStock,
      status,
      description,
      lowStockAlert: lowStockValue,
      units_per_carton: unitsPerCartonValue,
      units_per_box: boxesPerUnitValue,
      pieces_per_box: piecesPerBoxValue,
      base_unit_name: cleanedBaseUnitName,
      cartons_received: cartonsReceivedValue,
      sales_type: salesType,
      expiry_date: expiryDate || undefined,
      manufacturing_date: manufacturingDate || undefined,
      batches: editingProduct?.batches ?? [],
    };

    if (electronApi?.saveProduct) {
      try {
        const result = await electronApi.saveProduct(productPayload);
        const savedId = result?.id || productPayload.id || Date.now().toString();
        const savedProduct = { ...productPayload, id: savedId };

        setProducts((prev) =>
          editingProduct
            ? prev.map((item) => (item.id === editingProduct.id ? savedProduct : item))
            : [...prev, savedProduct]
        );
        if (refreshProducts) await refreshProducts();
        setShowModal(false);
        resetForm();
        return;
      } catch (error) {
        console.error('Failed to save product:', error);
        alert('Could not save product. Please try again.');
        return;
      }
    }

    if (editingProduct) {
      setProducts((prev) =>
        prev.map((item) =>
          item.id === editingProduct.id
            ? {
                ...item,
                name: cleanedName,
                generic_name: cleanedGenericName,
                barcode: cleanedBarcode,
                category: cleanedCategory,
                code: cleanedCode,
                cost: costValue,
                price: priceValue,
                stock: computedTotalStock,
                status,
                description,
                lowStockAlert: lowStockValue,
                units_per_carton: unitsPerCartonValue,
                units_per_box: boxesPerUnitValue,
                pieces_per_box: piecesPerBoxValue,
                base_unit_name: cleanedBaseUnitName,
                sales_type: salesType,
                cartons_received: cartonsReceivedValue,
                expiry_date: expiryDate || '',
                manufacturing_date: manufacturingDate || '',
              }
            : item
        )
      );
    } else {
      setProducts((prev) => [
        ...prev,
        {
          ...productPayload,
          id: productPayload.id || Date.now().toString(),
        },
      ]);
    }

    setShowModal(false);
    resetForm();
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm('Delete this product?')) {
      return;
    }
    const toDelete = products.find((p) => p.id === productId);
    if (toDelete) {
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      addHistory?.({
        id: `HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: toDelete.id,
        productName: toDelete.name,
        action: 'Removed',
        quantity: toDelete.stock,
        note: 'Product deleted',
        date,
        time,
      });
    }

    if (electronApi?.deleteProduct) {
      try {
        await electronApi.deleteProduct(productId);
        setProducts((prev) => prev.filter((product) => product.id !== productId));
        if (refreshProducts) await refreshProducts();
        return;
      } catch (error) {
        console.error('Failed to delete product:', error);
        alert('Could not delete product. Please try again.');
        return;
      }
    }

    setProducts((prev) => prev.filter((product) => product.id !== productId));
  };

  const statusClasses = (statusValue: 'Active' | 'Inactive') =>
    statusValue === 'Active'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-slate-100 text-slate-700';

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Products</h2>
            <p className="mt-2 text-sm text-gray-500">Manage your product catalogue and inventory.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setShowCategoryModal(true)} className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition">
              Categories
            </button>
            <button onClick={openAddModal} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition">
              + Add Product
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1.8fr_1fr_1fr]">
          <div className="relative">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
               
              onKeyDown={(e) => { if (e.key === 'Escape') { setSearchQuery(''); e.currentTarget.blur(); } }}
              placeholder="Search name, SKU, barcode..."
              className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 pr-9 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">✕</button>
            )}
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {categoryOptions.map((categoryOption) => (
              <option key={categoryOption} value={categoryOption}>
                {categoryOption}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <select className="flex-1 rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option>Show 25</option>
              <option>Show 10</option>
              <option>Show 50</option>
            </select>
            <button className="rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-100">
              ↻
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 text-sm text-slate-600">Showing {filteredProducts.length} products</div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-[0.16em] text-xs">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">SKU</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Cost</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{product.name}</div>
                    <div className="text-xs text-gray-500">{product.barcode}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-900">{product.code}</td>
                  <td className="px-6 py-4 text-gray-600">{product.category}</td>
                  <td className="px-6 py-4 text-gray-600">₦{product.cost.toFixed(2)}</td>
                  <td className="px-6 py-4 text-blue-600 font-semibold">₦{product.price.toFixed(2)}</td>
                  <td className={`px-6 py-4 ${product.stock === 0 ? 'text-red-600' : 'text-slate-900'}`}>{product.stock}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(product.status)}`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditModal(product)} className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200 transition">
                        ✎
                      </button>
                      <button onClick={() => deleteProduct(product.id)} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600 hover:bg-red-100 transition">
                        🗑
                      </button>
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
          <div className="max-h-[85vh] w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
                <p className="text-xs text-gray-500">Fill in product details and save.</p>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-500 hover:text-slate-900 text-sm">✕</button>
            </div>
            <div className="max-h-[calc(85vh-8rem)] overflow-y-auto p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Product Name *</label>
                  <input value={name} onChange={(e) => setName(e.target.value)}  onKeyDown={(e) => { if (e.key === 'Escape') { setShowModal(false); resetForm(); } }} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Generic Name</label>
                  <input value={genericName} onChange={(e) => setGenericName(e.target.value)}  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">SKU *</label>
                  <input value={code} onChange={(e) => setCode(e.target.value)}  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Barcode</label>
                  <input value={barcode} onChange={(e) => setBarcode(e.target.value)}  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-pointer">
                    <option value="No Category">No Category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Purchase Price (per piece) *</label>
                  <input value={cost} onChange={(e) => setCost(e.target.value)}  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Sale Price (per piece) *</label>
                  <input value={price} onChange={(e) => setPrice(e.target.value)}  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Sales Type</label>
                  <select value={salesType} onChange={(e) => setSalesType(e.target.value as SalesType)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-pointer">
                    <option value="OTC">OTC</option>
                    <option value="Rx">Rx</option>
                  </select>
                </div>
              </div>

              <div className="mt-1 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-blue-700">Inventory & Packaging</p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Units Per Carton</label>
                    <input value={unitsPerCarton} onChange={(e) => setUnitsPerCarton(e.target.value)}  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Boxes Per Unit</label>
                    <input value={boxesPerUnit} onChange={(e) => setBoxesPerUnit(e.target.value)}  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Pieces Per Box</label>
                    <input value={piecesPerBox} onChange={(e) => setPiecesPerBox(e.target.value)}  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Base Unit Name</label>
                    <select value={baseUnitName} onChange={(e) => setBaseUnitName(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-pointer">
                      {BASE_UNIT_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Cartons Received</label>
                    <input type="number" min="0" value={cartonsReceived} onChange={(e) => setCartonsReceived(e.target.value)}  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Total Stock ({baseUnitName || 'Piece'}s)</label>
                    <div className="w-full rounded-lg border border-blue-300 bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-800">{computedTotalStock.toLocaleString()}</div>
                  </div>
                </div>
                <p className="mt-1.5 text-[9px] text-gray-500">Formula: Cartons x Units Per Carton x Boxes Per Unit x Pieces Per Box = Total {baseUnitName || 'Piece'}(s)</p>
              </div>

              <div className="mt-1 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Low Stock Alert</label>
                  <input value={lowStockAlert} onChange={(e) => setLowStockAlert(e.target.value)}  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)}  rows={2} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Expiry Date</label>
                  <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500">Manufacturing Date</label>
                  <input type="date" value={manufacturingDate} onChange={(e) => setManufacturingDate(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text" />
                </div>
                <div className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-slate-50 px-3 py-2">
                  <input id="activeToggle" type="checkbox" checked={status === 'Active'} onChange={(e) => setStatus(e.target.checked ? 'Active' : 'Inactive')} className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <label htmlFor="activeToggle" className="text-xs font-medium text-slate-800">Active (visible in POS)</label>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-slate-50 px-4 py-2.5">
              <button onClick={() => { setShowModal(false); resetForm(); }} className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition">
                Cancel
              </button>
              <button onClick={saveProduct} className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition">
                {editingProduct ? 'Save Product' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Manage Categories</h3>
                <p className="mt-1 text-sm text-gray-500">Add, edit, or remove product categories.</p>
              </div>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-500 hover:text-slate-900">✕</button>
            </div>
            <div className="space-y-4 p-6">
              <CategoryManager products={products} setProducts={setProducts} categories={categories} setCategories={setCategories} refreshCategories={refreshCategories} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
