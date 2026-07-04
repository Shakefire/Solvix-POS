import { useState, useEffect, useRef, useCallback } from 'react';
import { Product, UnitType, getAvailableStock } from '@/lib/pharmacy';

interface ProductCatalogProps {
  products: Product[];
  onAddToCart: (product: Product, unit: UnitType, quantity: number) => void;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Electronics':
      return '💻';
    case 'Groceries':
      return '🛒';
    case 'Clothing':
      return '👕';
    default:
      return '📦';
  }
};

export default function ProductCatalog({ products, onAddToCart }: ProductCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [unitSelections, setUnitSelections] = useState<Record<string, UnitType>>({});
  const [quantitySelections, setQuantitySelections] = useState<Record<string, number>>({});
  const [lastScanResult, setLastScanResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeBufferRef = useRef('');
  const barcodeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const categories = [...new Set(products.map((p) => p.category))];
  let filteredProducts = selectedCategory
    ? products.filter((p) => p.category === selectedCategory)
    : products;

  filteredProducts = filteredProducts.filter((product) => getAvailableStock(product) > 0);

  if (searchQuery) {
    filteredProducts = filteredProducts.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  const handleBarcodeScan = useCallback((barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;

    const matchedProduct = products.find(
      (p) => p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()
    );

    if (matchedProduct) {
      const unit = unitSelections[matchedProduct.id] ?? 'Piece';
      const qty = quantitySelections[matchedProduct.id] ?? 1;
      const available = getAvailableStock(matchedProduct);
      if (available <= 0) {
        setLastScanResult({ type: 'error', message: `${matchedProduct.name} - Out of stock` });
      } else {
        onAddToCart(matchedProduct, unit, qty);
        setLastScanResult({ type: 'success', message: `Added: ${matchedProduct.name}` });
      }
    } else {
      setSearchQuery(trimmed);
      setLastScanResult({ type: 'error', message: `No product found for: ${trimmed}` });
    }

    setTimeout(() => setLastScanResult(null), 3000);
  }, [products, unitSelections, quantitySelections, onAddToCart]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';

      if (isInput) {
        if (target !== searchInputRef.current) {
          return;
        }
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const buf = barcodeBufferRef.current;
        if (buf.length > 0) {
          handleBarcodeScan(buf);
          barcodeBufferRef.current = '';
        }
        if (barcodeTimerRef.current) {
          clearTimeout(barcodeTimerRef.current);
          barcodeTimerRef.current = null;
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        barcodeBufferRef.current += e.key;

        if (barcodeTimerRef.current) {
          clearTimeout(barcodeTimerRef.current);
        }
        barcodeTimerRef.current = setTimeout(() => {
          barcodeBufferRef.current = '';
          barcodeTimerRef.current = null;
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
    };
  }, [handleBarcodeScan]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Search Bar */}
      <div className="mb-1.5">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Scan barcode or search by name, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            
            onKeyDown={(e) => { if (e.key === 'Escape') { setSearchQuery(''); e.currentTarget.blur(); } }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 pl-8 pr-8 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-400 cursor-text"
          />
          <span className="absolute left-2.5 top-1.5 text-gray-400 text-sm pointer-events-none">🔍</span>
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
              className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600 text-sm cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Barcode scan feedback */}
      {lastScanResult && (
        <div className={`mb-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition ${
          lastScanResult.type === 'success'
            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            : 'bg-red-100 text-red-700 border border-red-200'
        }`}>
          {lastScanResult.type === 'success' ? '✓ ' : '✗ '}{lastScanResult.message}
        </div>
      )}

      {/* Category Filter */}
      <div className="mb-1.5 flex gap-1 overflow-x-auto pb-0.5">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition whitespace-nowrap cursor-pointer ${
            selectedCategory === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition whitespace-nowrap cursor-pointer ${
              selectedCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <span>{getCategoryIcon(category)}</span>
            {category}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="min-h-0 flex-1 overflow-auto">
        {filteredProducts.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-gray-200 bg-white p-6 text-xs text-gray-500">
            No products available. Add products from the Products page.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4 lg:grid-cols-5">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="flex flex-col rounded-lg border border-gray-200 bg-white p-1.5 transition hover:shadow-md"
              >
                <div className="mb-1 flex h-5 w-5 items-center justify-center rounded bg-blue-100 text-[9px]">
                  {getCategoryIcon(product.category)}
                </div>
                <h3 className="mb-0.5 truncate text-[10px] font-semibold text-gray-900 leading-tight">
                  {product.name}
                </h3>
                <p className="mb-0.5 truncate text-[8px] text-gray-500">{product.code}</p>
                <p className="mb-1 text-[10px] font-bold text-blue-600">{product.price.toFixed(2)}</p>
                <div className="space-y-1 border-t border-gray-100 pt-1">
                  <div className="grid gap-1 sm:grid-cols-2">
                    <select
                      value={unitSelections[product.id] ?? 'Box'}
                      onChange={(e) => setUnitSelections((prev) => ({ ...prev, [product.id]: e.target.value as UnitType }))}
                      className="rounded border border-gray-300 bg-white px-1 py-0.5 text-[8px] text-slate-900 outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="Carton">Carton</option>
                      <option value="Box">Box</option>
                      <option value="Piece">Piece</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={quantitySelections[product.id] ?? 1}
                      onChange={(e) => setQuantitySelections((prev) => ({ ...prev, [product.id]: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                      className="rounded border border-gray-300 bg-white px-1 py-0.5 text-[8px] text-slate-900 outline-none focus:border-blue-500 cursor-text"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="rounded bg-gray-100 px-1 py-0.5 text-[7px] text-gray-500">
                      {product.stock} in stock
                    </span>
                    <button
                      onClick={() => onAddToCart(product, unitSelections[product.id] ?? 'Box', quantitySelections[product.id] ?? 1)}
                      disabled={product.stock <= 0}
                      className={`rounded px-1.5 py-0.5 text-[8px] font-semibold transition cursor-pointer ${product.stock <= 0 ? 'cursor-not-allowed bg-gray-300 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
