import { CartItem } from '@/lib/pharmacy';

interface CartProps {
  items: CartItem[];
  onRemove: (cartItemId: string) => void;
  onClear: () => void;
}

export default function Cart({ items, onRemove, onClear }: CartProps) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-50">
      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-gray-900">🛒 Cart</span>
          <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
            {items.length}
          </span>
        </div>
        <button onClick={onClear} className="text-[10px] font-semibold text-red-500 hover:text-red-700 transition cursor-pointer">
          Clear
        </button>
      </div>

      {/* Customer Info */}
      <div className="mb-1 border-b border-gray-200 pb-1">
        <p className="flex items-center gap-1 text-[10px] text-gray-600">
          👤 Walk-in Customer
        </p>
      </div>

      {/* Cart Items */}
      <div className="mb-1 min-h-0 flex-1 overflow-auto rounded border border-gray-200 bg-white p-1">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[10px] text-gray-400">
            <p>Cart is empty</p>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-1 rounded border border-gray-100 bg-gray-50 p-1.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-semibold text-gray-900">{item.name}</p>
                  <p className="mt-0.5 text-[8px] text-gray-500">
                    ₦{item.price.toFixed(2)} each
                  </p>
                  <select className="mt-0.5 w-full rounded border border-gray-300 bg-white px-1 py-0.5 text-[8px] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 cursor-pointer">
                    <option>No Discount</option>
                    <option>10% Off</option>
                    <option>20% Off</option>
                  </select>
                </div>
                <button
                  onClick={() => onRemove(item.id)}
                  className="text-[10px] text-gray-400 hover:text-red-500 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subtotal */}
      <div className="pb-1">
        <div className="flex justify-between text-[10px] text-gray-600">
          <span>Subtotal</span>
          <span className="font-semibold text-gray-900">₦{subtotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
