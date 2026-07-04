export interface Batch {
  batch_id?: number;
  batch_number: string;
  expiry_date: string; // YYYY-MM-DD
  quantity: number; // quantity in smallest sellable unit (pieces/tablets/strips)
  cost_price?: number; // per box cost or per-piece cost when quantity already in pieces
  retail_box_price?: number; // retail box price, if available
}

export type SalesType = 'OTC' | 'Rx';
export type UnitType = 'Carton' | 'Box' | 'Piece';

export interface Product {
  id: string; // string id used in UI; maps to product_id in DB
  product_id?: number;
  brand_name?: string;
  generic_name?: string;
  dosage_strength?: string;
  dosage_form?: string;
  units_per_carton?: number; // units per carton
  units_per_box?: number; // boxes per unit
  pieces_per_box?: number; // pieces per box
  base_unit_name?: string; // e.g. Tablet, Capsule, Bottle
  sales_type?: SalesType;
  name: string; // friendly display name (brand)
  code: string; // SKU
  barcode: string;
  category: string;
  cost: number; // purchase cost per piece
  price: number; // retail price per piece
  stock: number; // cached available stock in smallest unit
  status: 'Active' | 'Inactive';
  description?: string;
  lowStockAlert?: number;
  expiry_date?: string;
  manufacturing_date?: string;
  cartons_received?: number;
  batches: Batch[];
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  unit: UnitType;
  quantity: number; // number of selected units (cartons/boxes/pieces)
  pieces: number; // underlying smallest units
  price: number; // unit price for selected unit
  salesType?: SalesType;
}

export interface OrderItem {
  id: string;
  name: string;
  unit: UnitType;
  quantity: number;
  price: number;
  costPrice?: number;
  salesType?: SalesType;
}

export interface Order {
  id: string;
  receiptNumber: string;
  customer: string;
  date: string;
  time: string;
  total: number;
  status: 'Paid' | 'Pending' | 'Cancelled';
  paymentMethod: 'Cash' | 'Card' | 'Bank';
  patientName?: string;
  doctorName?: string;
  items: OrderItem[];
}

export interface Expense {
  id: string;
  name: string;
  cost: number;
  description?: string;
  date: string;
  time: string;
}

export interface InventoryHistoryItem {
  id: string;
  productId: string;
  productName: string;
  action: 'Added' | 'Removed' | 'Adjusted';
  quantity: number;
  note: string;
  date: string;
  time: string;
}

export interface AppSettings {
  storeName: string;
  address: string;
  phone: string;
  currencySymbol: string;
  currencyCode: string;
  taxRate: number;
  receiptFooter: string;
  theme: 'light' | 'dark';
  lowStockThreshold: number;
  autoPrintReceipt: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  storeName: 'HANAAN PATENT MEDICINE STORE',
  address: 'Plot 12, Garki II, Abuja',
  phone: '+234 803 123 4567',
  currencySymbol: '₦',
  currencyCode: 'NGN',
  taxRate: 8,
  receiptFooter: 'Thank you for shopping with HANAAN PATENT MEDICINE STORE.',
  theme: 'light',
  lowStockThreshold: 10,
  autoPrintReceipt: false,
};

export const formatCurrency = (value: number, settings: AppSettings) => `${settings.currencySymbol}${value.toFixed(2)}`;

const normalizeDate = (value: string) => {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const cleanText = (value: string) => value.trim().replace(/\s+/g, ' ');

export const titleCaseText = (value: string) =>
  cleanText(value)
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export const normalizeBarcode = (value: string) => cleanText(value).replace(/\s+/g, '');

export const normalizeDosageStrength = (value: string) => cleanText(value).replace(/\s+/g, '').toLowerCase();

export const normalizeBatchNumber = (value: string) => cleanText(value).replace(/\s+/g, '').toUpperCase();

export const sanitizeAlphaText = (value: string) => cleanText(value).replace(/[^A-Za-z\s-]/g, '');

export const isBatchExpired = (expiryDate: string) => {
  const today = normalizeDate(new Date().toISOString().split('T')[0]);
  return normalizeDate(expiryDate) <= today;
};

export const getUnitsPerCarton = (product: Product) => Math.max(1, product.units_per_carton ?? 1);
export const getBoxesPerUnit = (product: Product) => Math.max(1, product.units_per_box ?? 1);
export const getPiecesPerBox = (product: Product) => Math.max(1, product.pieces_per_box ?? 1);
export const getPiecesPerCarton = (product: Product) => getUnitsPerCarton(product) * getBoxesPerUnit(product) * getPiecesPerBox(product);

export const formatStockBreakdown = (product: Product, quantity = getAvailableStock(product)) => {
  const cartonSize = getPiecesPerCarton(product);
  const boxSize = getPiecesPerBox(product);
  const cartons = cartonSize > 0 ? Math.floor(quantity / cartonSize) : 0;
  const remainingAfterCartons = quantity - cartons * cartonSize;
  const boxes = boxSize > 0 ? Math.floor(remainingAfterCartons / boxSize) : 0;
  const pieces = remainingAfterCartons - boxes * boxSize;

  const labelParts = [];
  if (cartons > 0) labelParts.push(`${cartons} Carton${cartons === 1 ? '' : 's'}`);
  if (boxes > 0) labelParts.push(`${boxes} Box${boxes === 1 ? '' : 'es'}`);
  if (pieces > 0 || labelParts.length === 0) labelParts.push(`${pieces} ${product.base_unit_name ?? 'Piece'}${pieces === 1 ? '' : 's'}`);

  return {
    cartons,
    boxes,
    pieces,
    label: labelParts.join(', '),
  };
};

export const getAvailableStock = (product: Product) =>
  product.batches.reduce((sum, batch) => {
    if (batch.quantity <= 0 || isBatchExpired(batch.expiry_date)) return sum;
    return sum + batch.quantity;
  }, 0);

export const getUnitPrice = (product: Product, unit: UnitType) => {
  const piecePrice = product.price;
  const piecesPerBox = getPiecesPerBox(product);

  switch (unit) {
    case 'Carton':
      return piecePrice * getPiecesPerCarton(product);
    case 'Box':
      return piecePrice * piecesPerBox;
    case 'Piece':
      return piecePrice;
    default:
      return piecePrice;
  }
};

export const getCostByUnit = (product: Product, unit: UnitType) => {
  const pieceCost = product.cost || 0;

  switch (unit) {
    case 'Carton':
      return pieceCost * getPiecesPerCarton(product);
    case 'Box':
      return pieceCost * getPiecesPerBox(product);
    case 'Piece':
      return pieceCost;
    default:
      return pieceCost;
  }
};

export const convertToPieces = (product: Product, unit: UnitType, quantity: number) => {
  switch (unit) {
    case 'Carton':
      return quantity * getPiecesPerCarton(product);
    case 'Box':
      return quantity * getPiecesPerBox(product);
    case 'Piece':
      return quantity;
    default:
      return quantity;
  }
};

export const sortBatchesFEFO = (batches: Batch[]) =>
  [...batches].sort(
    (a, b) => normalizeDate(a.expiry_date).getTime() - normalizeDate(b.expiry_date).getTime()
  );

export const updateProductStock = (product: Product): Product => ({
  ...product,
  stock: getAvailableStock(product),
});

export const deductFromBatches = (product: Product, quantity: number): Product | null => {
  let remaining = quantity;
  const updatedBatches = sortBatchesFEFO(product.batches).map((batch) => {
    if (remaining <= 0 || batch.quantity <= 0 || isBatchExpired(batch.expiry_date)) {
      return batch;
    }

    const deducted = Math.min(batch.quantity, remaining);
    remaining -= deducted;
    return { ...batch, quantity: batch.quantity - deducted };
  });

  if (remaining > 0) {
    return null;
  }

  return updateProductStock({ ...product, batches: updatedBatches });
};

export const restoreToBatches = (product: Product, quantity: number): Product => {
  if (quantity <= 0) return product;

  const sorted = [...product.batches].sort(
    (a, b) => normalizeDate(b.expiry_date).getTime() - normalizeDate(a.expiry_date).getTime()
  );

  const targetIndex = sorted.findIndex((batch) => !isBatchExpired(batch.expiry_date));

  if (targetIndex >= 0) {
    sorted[targetIndex] = {
      ...sorted[targetIndex],
      quantity: sorted[targetIndex].quantity + quantity,
    };

    return updateProductStock({ ...product, batches: sorted });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const newBatch: Batch = {
    batch_number: `RETURN-${Date.now()}`,
    expiry_date: today.toISOString().split('T')[0],
    quantity,
  };

  return updateProductStock({
    ...product,
    batches: [...product.batches, newBatch],
  });
};

// Dashboard / Inventory metrics
export const totalInventoryValue = (products: Product[]) => {
  return products.reduce((acc, p) => {
    const value = p.batches.reduce((s, b) => {
      if (isBatchExpired(b.expiry_date)) return s;
      const costPerPiece = typeof b.cost_price === 'number' ? b.cost_price : p.cost || 0;
      return s + costPerPiece * b.quantity;
    }, 0);
    return acc + value;
  }, 0);
};

export const expiredItemsCount = (products: Product[]) => {
  const set = new Set<string>();
  products.forEach((p) => {
    p.batches.forEach((b) => {
      if (isBatchExpired(b.expiry_date)) set.add(`${p.id}::${b.batch_number}`);
    });
  });
  return set.size;
};

export const nearExpiryAlertCount = (products: Product[], days = 30) => {
  const now = new Date();
  const threshold = new Date();
  threshold.setDate(now.getDate() + days);
  const set = new Set<string>();
  products.forEach((p) => {
    p.batches.forEach((b) => {
      const d = normalizeDate(b.expiry_date);
      if (d >= normalizeDate(now.toISOString().split('T')[0]) && d <= normalizeDate(threshold.toISOString().split('T')[0])) {
        set.add(`${p.id}::${b.batch_number}`);
      }
    });
  });
  return set.size;
};

export const lowStockTriggers = (products: Product[], threshold = 10) => {
  return products.reduce((count, p) => {
    const total = getAvailableStock(p);
    return count + (total < threshold ? 1 : 0);
  }, 0);
};
