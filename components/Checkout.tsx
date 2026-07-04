import { useState } from 'react';
import { AppSettings, CartItem, Product, formatCurrency } from '@/lib/pharmacy';

interface CheckoutPayload {
  paymentMethod: string;
  amountReceived?: number;
  items: CartItem[];
  total: number;
  patientName?: string;
  doctorName?: string;
  transactionType?: 'Prescription' | 'Retail';
}

interface CheckoutProps {
  items: CartItem[];
  products: Product[];
  settings: AppSettings;
  receiptNumber: string;
  onCheckout: (payload?: CheckoutPayload) => void;
}

export default function Checkout({ items, products, settings, receiptNumber, onCheckout }: CheckoutProps) {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank'>('cash');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptId, setReceiptId] = useState('');
  const [receiptDate, setReceiptDate] = useState('');
  const [receiptTime, setReceiptTime] = useState('');
  const [patientName, setPatientName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [rxNote, setRxNote] = useState('');
  const [pendingPayload, setPendingPayload] = useState<CheckoutPayload | null>(null);

  const taxRate = Math.max(0, settings.taxRate) / 100;
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * taxRate;
  const total = subtotal + tax;
  const amount = parseFloat(amountReceived) || 0;
  const change = amount - total;

  const hasRxItem = items.some((item) => item.salesType === 'Rx');
  const transactionType = hasRxItem ? 'Prescription' : 'Retail';
  const receiptItems = items.map((item) => {
    const product = products.find((p) => p.id === item.productId) ?? null;
    const baseUnitName = product?.base_unit_name ?? 'Unit';
    const genericName = product?.generic_name ?? product?.name ?? item.name;
    const batch = product?.batches?.find((b) => b.quantity > 0) ?? product?.batches?.[0];
    const expiryDate = batch?.expiry_date ?? 'N/A';
    const batchNumber = batch?.batch_number ?? 'N/A';
    const unitLabel = item.unit === 'Piece' ? baseUnitName : item.unit;
    const splitPack = product && item.unit === 'Box' && (product.units_per_box ?? 1) > 1
      ? `Split Pack: 1 Box = ${product.units_per_box ?? 1} ${baseUnitName}(s)`
      : product && item.unit === 'Carton' && (product.units_per_carton ?? 1) > 1
        ? `Split Pack: 1 Carton = ${product.units_per_carton ?? 1} Box(es) / ${(product.units_per_carton ?? 1) * (product.units_per_box ?? 1)} ${baseUnitName}(s)`
        : product && item.unit === 'Piece' && (product.units_per_box ?? 1) > 1
          ? `Split Pack: 1 Box = ${product.units_per_box ?? 1} ${baseUnitName}(s)`
          : null;
    return {
      ...item,
      product,
      genericName,
      batchNumber,
      expiryDate,
      unitLabel,
      splitPack,
      lineTotal: item.price * item.quantity,
    };
  });

  const handleComplete = () => {
    if (items.length === 0) {
      alert('Cart is empty!');
      return;
    }
    if (hasRxItem && (!patientName.trim() || !doctorName.trim())) {
      alert('Patient and doctor names are required for Rx items.');
      return;
    }
    const finalAmount = amount > 0 ? amount : total;
    const payload: CheckoutPayload = {
      paymentMethod,
      amountReceived: finalAmount,
      items,
      total,
      patientName: patientName.trim() || undefined,
      doctorName: doctorName.trim() || undefined,
      transactionType,
    };
    setPendingPayload(payload);
    setReceiptId(receiptNumber);
    setReceiptDate(new Date().toLocaleDateString());
    setReceiptTime(new Date().toLocaleTimeString());
    setShowReceipt(true);
  };

  const handlePrint = async () => {
    const printDiv = document.getElementById('printable-receipt');
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
  };

  const handleDone = async () => {
    setShowReceipt(false);
    if (pendingPayload) {
      const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
      if (settings.autoPrintReceipt) {
        try {
          if (electronApi?.printReceipt) {
            await electronApi.printReceipt();
          } else {
            window.print();
          }
        } catch (error) {
          console.error('Auto print failed:', error);
        }
      }
      onCheckout(pendingPayload);
      setPendingPayload(null);
    }
    setAmountReceived('');
    setPatientName('');
    setDoctorName('');
    setRxNote('');
    setPaymentMethod('cash');
  };

  const receiptModal = showReceipt ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="max-h-[80vh] overflow-y-auto p-5 font-sans">
          {/* Header */}
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-900">Sales Receipt</p>
            <h2 className="mt-1 text-2xl font-black text-gray-900">{settings.storeName}</h2>
            <p className="mt-0.5 text-sm font-bold text-gray-900">{settings.address}</p>
            <p className="text-sm font-bold text-gray-900">Tel: {settings.phone}</p>
          </div>

          <div className="my-3 border-t-2 border-dashed border-gray-400" />

          {/* Meta info */}
          <div className="grid grid-cols-2 gap-1.5 text-sm font-bold text-gray-900">
            <div>Receipt: {receiptId}</div>
            <div className="text-right">Type: {transactionType}</div>
            <div>{receiptDate}</div>
            <div className="text-right">{receiptTime}</div>
          </div>

          {/* Prescription */}
          {hasRxItem && (
            <div className="mt-3 rounded-lg border border-gray-400 bg-gray-50 p-2.5 text-sm">
              <div className="font-bold text-gray-900 uppercase text-xs tracking-wide">Prescription</div>
              <div className="mt-1 grid grid-cols-2 gap-1 font-bold text-gray-900">
                <div>Patient: {patientName || 'N/A'}</div>
                <div>Doctor: {doctorName || 'N/A'}</div>
              </div>
            </div>
          )}

          {/* Items */}
          <div className="mt-3 space-y-2">
            {receiptItems.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-gray-400 bg-gray-50 p-2.5">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-gray-900 text-sm">{index + 1}. {item.name}</span>
                  <span className="font-bold text-gray-900 text-sm whitespace-nowrap">{formatCurrency(item.lineTotal, settings)}</span>
                </div>
                <div className="mt-0.5 text-sm font-bold text-gray-900">
                  {item.quantity} {item.unitLabel}{item.quantity === 1 ? '' : 's'} x {formatCurrency(item.price, settings)}
                </div>
                <div className="mt-0.5 text-xs font-bold text-gray-900">Batch: {item.batchNumber} | Exp: {item.expiryDate}</div>
                {item.splitPack && <div className="mt-0.5 text-xs font-bold text-gray-900">{item.splitPack}</div>}
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between font-bold text-gray-900 border-b border-gray-300 pb-1">
              <span>Subtotal</span><span>{formatCurrency(subtotal, settings)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 border-b border-gray-300 pb-1">
              <span>Tax ({settings.taxRate}%)</span><span>{formatCurrency(tax, settings)}</span>
            </div>
            <div className="flex justify-between text-base font-black text-gray-900">
              <span>TOTAL</span><span>{formatCurrency(total, settings)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900">
              <span>Paid</span><span>{formatCurrency(amount > 0 ? amount : total, settings)}</span>
            </div>
            {change > 0 && (
              <div className="flex justify-between font-bold text-gray-900">
                <span>Change</span><span>{formatCurrency(change, settings)}</span>
              </div>
            )}
          </div>

          {/* Empty lines before footer */}
          <div className="mt-2 space-y-3">
            <div>&nbsp;</div>
            <div>&nbsp;</div>
            <div>&nbsp;</div>
            <div>&nbsp;</div>
          </div>

          {/* Footer */}
          <div className="mt-2 rounded-lg border border-gray-400 bg-gray-50 p-2.5 text-center">
            <p className="text-xs font-bold text-gray-900">{settings.receiptFooter}</p>
            <p className="mt-1 text-xs font-bold text-gray-900">Please verify all medications before leaving.</p>
          </div>
        </div>
        <div className="flex gap-2 border-t border-gray-200 bg-gray-50 p-3">
          <button onClick={handlePrint} className="flex-1 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition">
            Print Receipt
          </button>
          <button onClick={handleDone} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition">
            Done
          </button>
        </div>
      </div>

      {/* Hidden print-only receipt */}
      <div id="printable-receipt" style={{ display: 'none' }}>
        <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', lineHeight: '1.4', color: '#000', fontWeight: 'bold', maxWidth: '300px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', color: '#000' }}>Sales Receipt</div>
            <div style={{ fontSize: '20px', fontWeight: '900', marginTop: '4px', color: '#000' }}>{settings.storeName}</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#000' }}>{settings.address}</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#000' }}>Tel: {settings.phone}</div>
          </div>

          <div style={{ borderTop: '2px dashed #000', margin: '10px 0' }} />

          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '10px', color: '#000' }}>
            <div>Receipt: {receiptId}</div>
            <div>Type: {transactionType}</div>
            <div>{receiptDate} {receiptTime}</div>
          </div>

          {hasRxItem && (
            <div style={{ border: '2px solid #000', padding: '8px', marginBottom: '10px', fontSize: '12px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase' }}>Prescription</div>
              <div>Patient: {patientName || 'N/A'} | Doctor: {doctorName || 'N/A'}</div>
            </div>
          )}

          <div style={{ marginBottom: '10px' }}>
            {receiptItems.map((item, index) => (
              <div key={item.id} style={{ border: '2px solid #000', padding: '8px', marginBottom: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#000' }}>
                  <span>{index + 1}. {item.name}</span>
                  <span>{formatCurrency(item.lineTotal, settings)}</span>
                </div>
                <div style={{ fontWeight: 'bold', marginTop: '2px', color: '#000' }}>
                  {item.quantity} {item.unitLabel}{item.quantity === 1 ? '' : 's'} x {formatCurrency(item.price, settings)}
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '10px', marginTop: '2px', color: '#000' }}>Batch: {item.batchNumber} | Exp: {item.expiryDate}</div>
                {item.splitPack && <div style={{ fontWeight: 'bold', fontSize: '10px', color: '#000' }}>{item.splitPack}</div>}
              </div>
            ))}
          </div>

          <div style={{ borderTop: '2px solid #000', paddingTop: '8px', fontSize: '12px', fontWeight: 'bold' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', borderBottom: '1px solid #000', paddingBottom: '4px', color: '#000' }}>
              <span>Subtotal</span><span>{formatCurrency(subtotal, settings)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', borderBottom: '1px solid #000', paddingBottom: '4px', color: '#000' }}>
              <span>Tax ({settings.taxRate}%)</span><span>{formatCurrency(tax, settings)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '900', marginBottom: '4px', color: '#000' }}>
              <span>TOTAL</span><span>{formatCurrency(total, settings)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '4px', color: '#000' }}>
              <span>Paid</span><span>{formatCurrency(amount > 0 ? amount : total, settings)}</span>
            </div>
            {change > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#000' }}>
                <span>Change</span><span>{formatCurrency(change, settings)}</span>
              </div>
            )}
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
    </div>
  ) : null;

  return (
    <div className="space-y-1 border-t border-gray-200 bg-white p-1.5">
      {hasRxItem && (
        <div className="space-y-1 rounded border border-blue-100 bg-blue-50 p-1.5">
          <label className="block text-[9px] font-semibold uppercase tracking-wider text-gray-600">Patient Name</label>
          <input value={patientName} onChange={(e) => setPatientName(e.target.value)}  onKeyDown={(e) => { if (e.key === 'Escape') { setPatientName(''); e.currentTarget.blur(); } }} placeholder="Jane Doe" className="w-full rounded border border-blue-200 bg-white px-2 py-1 text-[10px] text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-blue-300 cursor-text" />
          <label className="block text-[9px] font-semibold uppercase tracking-wider text-gray-600">Doctor Name</label>
          <input value={doctorName} onChange={(e) => setDoctorName(e.target.value)}  onKeyDown={(e) => { if (e.key === 'Escape') { setDoctorName(''); e.currentTarget.blur(); } }} placeholder="Dr. Samuel Kolade" className="w-full rounded border border-blue-200 bg-white px-2 py-1 text-[10px] text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-blue-300 cursor-text" />
          <label className="block text-[9px] font-semibold uppercase tracking-wider text-gray-600">Prescription Note</label>
          <input value={rxNote} onChange={(e) => setRxNote(e.target.value)}  onKeyDown={(e) => { if (e.key === 'Escape') { setRxNote(''); e.currentTarget.blur(); } }} placeholder="Medication instructions" className="w-full rounded border border-blue-200 bg-white px-2 py-1 text-[10px] text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 hover:border-blue-300 cursor-text" />
        </div>
      )}

      <div>
        <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-600">Payment Method</label>
        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => setPaymentMethod('cash')} className={`flex flex-col items-center gap-0.5 rounded px-1 py-1.5 text-[10px] font-semibold transition cursor-pointer ${paymentMethod === 'cash' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><span className="text-sm">💵</span>Cash</button>
          <button onClick={() => setPaymentMethod('card')} className={`flex flex-col items-center gap-0.5 rounded px-1 py-1.5 text-[10px] font-semibold transition cursor-pointer ${paymentMethod === 'card' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><span className="text-sm">💳</span>Card</button>
          <button onClick={() => setPaymentMethod('bank')} className={`flex flex-col items-center gap-0.5 rounded px-1 py-1.5 text-[10px] font-semibold transition cursor-pointer ${paymentMethod === 'bank' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><span className="text-sm">🏦</span>Bank</button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-gray-600">Amount Received</label>
        <input type="number" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)}  onKeyDown={(e) => { if (e.key === 'Escape') { setAmountReceived(''); e.currentTarget.blur(); } if (e.key === 'Enter') handleComplete(); }} placeholder="0.00" className="w-full rounded border-2 border-blue-400 px-2 py-1 text-center text-sm font-bold text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 cursor-text" />
        {amount > 0 && change > 0 && <p className="mt-0.5 text-[10px] font-semibold text-green-600">Change: {formatCurrency(change, settings)}</p>}
        {amount > 0 && amount < total && <p className="mt-0.5 text-[10px] font-semibold text-red-500">Balance: {formatCurrency(total - amount, settings)}</p>}
      </div>

      <div className="space-y-0.5 rounded bg-gray-100 p-1.5">
        <div className="flex justify-between text-[10px] text-gray-600"><span>Subtotal</span><span className="font-semibold">{formatCurrency(subtotal, settings)}</span></div>
        <div className="flex justify-between border-t border-gray-300 pt-1 text-sm font-bold text-gray-900"><span>Total</span><span className="text-blue-600">{formatCurrency(total, settings)}</span></div>
      </div>

      <div className="flex gap-1.5">
        <button onClick={() => setAmountReceived('')} className="flex-1 rounded bg-gray-200 px-2 py-1.5 text-[10px] font-bold text-gray-900 transition hover:bg-gray-300 cursor-pointer">Cancel</button>
        <button onClick={handleComplete} disabled={items.length === 0 || (hasRxItem && (!patientName.trim() || !doctorName.trim()))} className={`flex-1 rounded px-2 py-1.5 text-[10px] font-bold text-white transition cursor-pointer ${items.length === 0 || (hasRxItem && (!patientName.trim() || !doctorName.trim())) ? 'cursor-not-allowed bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>Complete</button>
      </div>
      {receiptModal}
    </div>
  );
}
