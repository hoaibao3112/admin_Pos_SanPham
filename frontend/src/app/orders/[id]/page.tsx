'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { Order, OrderStatus } from '@/types/order';
import {
  ArrowLeft,
  Printer,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  AlertCircle,
  Store,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const formatMoney = (val: number | string) => {
    const num = typeof val === 'string' ? Number(val.replace(/\D/g, '')) : val;
    if (isNaN(num)) return '0';
    return num.toLocaleString('vi-VN');
  };

  const loadOrder = async () => {
    setLoading(true);
    try {
      const res = await fetchApi<{ success: boolean; data: Order }>(`/api/orders/${id}`);
      if (res && res.data) {
        setOrder(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không tìm thấy hóa đơn này';
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadOrder();
    }
  }, [id]);

  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    setUpdating(true);
    try {
      const res = await fetchApi<{ success: boolean; data: Order }>(`/api/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res && res.data) {
        setOrder(res.data);
      }
      showToast('success', 'Đã cập nhật trạng thái đơn thành công!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi cập nhật trạng thái';
      showToast('error', msg);
    } finally {
      setUpdating(false);
    }
  };

  const handleCopyAddress = () => {
    if (order?.customerAddress) {
      navigator.clipboard.writeText(order.customerAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="mt-3 text-sm font-medium text-slate-500">Đang tải hóa đơn...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-center">
        <AlertCircle className="h-12 w-12 text-rose-500 mb-3" />
        <h2 className="text-lg font-bold">Không tìm thấy đơn hàng</h2>
        <p className="text-xs text-slate-500 mt-1">Đơn hàng có thể đã bị xóa hoặc không tồn tại.</p>
        <Link
          href="/orders"
          className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
        >
          Về danh sách đơn
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans pb-24 print:bg-white print:p-0">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl transition-all ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Top action bar (Ẩn khi in) */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 dark:bg-slate-900/95 dark:border-slate-800 print:hidden">
        <div className="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between">
          <Link
            href="/orders"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>In Hóa Đơn</span>
            </button>
          </div>
        </div>
      </div>

      {/* CSS chuyên dụng cho máy in nhiệt (Khổ K80 80mm & K58 58mm) */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: 80mm auto;
            margin: 2mm 3mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .thermal-bill {
            width: 100% !important;
            max-width: 76mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}} />

      {/* TỜ HÓA ĐƠN BÁN LẺ (RETAIL INVOICE CONTAINER) */}
      <main className="mx-auto max-w-2xl px-4 pt-5 print:p-0 print:m-0">
        <div className="thermal-bill bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm print:border-none print:shadow-none print:p-0">
          {/* 1. Header Bill */}
          <div className="text-center border-b border-dashed border-slate-200 dark:border-slate-800 pb-5">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs mb-2 print:hidden">
              <Store className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
              CẨM TUYỀN HOUSE
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Đặc Sản &amp; Trái Cây Tươi Sạch • Cai Lậy, Tiền Giang
            </p>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
              Hotline: 0987.xxx.xxx • Đơn từ Giỏ hàng Messenger
            </p>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-extrabold text-slate-900 dark:text-white">
                Mã HĐ: <span className="text-emerald-600 dark:text-emerald-400">{order.code}</span>
              </span>
              <span className="text-slate-400 font-medium">
                {new Date(order.createdAt).toLocaleString('vi-VN')}
              </span>
            </div>
          </div>

          {/* 2. Thông tin khách hàng */}
          <div className="py-4 border-b border-dashed border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Khách hàng:</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {order.customerName}
              </span>
            </div>

            {order.customerPhone && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Số điện thoại:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {order.customerPhone}
                  </span>
                  <a
                    href={`tel:${order.customerPhone}`}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline print:hidden"
                  >
                    <Phone className="h-3 w-3" /> Gọi
                  </a>
                  <Link
                    href={`/tra-cuu?phone=${encodeURIComponent(order.customerPhone)}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:underline print:hidden ml-1"
                  >
                    Lịch sử bill ↗
                  </Link>
                </div>
              </div>
            )}

            {order.customerAddress && (
              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-400 font-medium shrink-0">Địa chỉ giao:</span>
                <div className="text-right">
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    {order.customerAddress}
                  </span>
                  <button
                    onClick={handleCopyAddress}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-emerald-600 mt-0.5 print:hidden"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? 'Đã chép' : 'Sao chép địa chỉ'}</span>
                  </button>
                </div>
              </div>
            )}

            {order.customerNote && (
              <div className="flex items-start justify-between gap-3 pt-1">
                <span className="text-slate-400 font-medium shrink-0">Ghi chú:</span>
                <span className="font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md text-right">
                  "{order.customerNote}"
                </span>
              </div>
            )}
          </div>

          {/* 3. Danh sách món hàng */}
          <div className="py-4 border-b border-dashed border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Chi tiết mặt hàng
            </h3>

            <div className="space-y-3">
              {order.items?.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {item.productImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        className="h-10 w-10 shrink-0 rounded-lg object-cover border border-slate-200 dark:border-slate-800"
                      />
                    )}
                    <div className="truncate">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {item.productName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {formatMoney(item.price)} đ x <b className="text-slate-900 dark:text-white">{item.quantity}</b>
                      </div>
                    </div>
                  </div>

                  <div className="font-bold text-slate-900 dark:text-white text-right shrink-0">
                    {formatMoney(item.total)} đ
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Tổng kết thanh toán */}
          <div className="py-4 space-y-2 text-xs border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span>Tiền hàng:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {formatMoney(order.subtotal)} đ
              </span>
            </div>

            {Number(order.shippingFee) > 0 && (
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Phí vận chuyển:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  +{formatMoney(order.shippingFee)} đ
                </span>
              </div>
            )}

            {Number(order.discount) > 0 && (
              <div className="flex items-center justify-between text-emerald-600">
                <span>Giảm giá khuyến mãi:</span>
                <span className="font-semibold">-{formatMoney(order.discount)} đ</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between text-sm">
              <span className="font-extrabold text-slate-900 dark:text-white uppercase">
                Tổng thanh toán:
              </span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {formatMoney(order.totalAmount)} đ
              </span>
            </div>

            <div className="text-right text-[11px] font-semibold text-slate-500">
              Hình thức: <span className="text-slate-900 dark:text-white uppercase font-bold">{order.paymentMethod || 'COD - Thu tiền khi nhận'}</span>
            </div>
          </div>

          {/* 5. Chân hóa đơn */}
          <div className="text-center pt-5 text-xs text-slate-400">
            <p className="font-medium">Cảm ơn Quý khách đã ủng hộ Cẩm Tuyền House!</p>
            <p className="text-[10px] mt-0.5">Chúc Quý khách luôn dồi dào sức khỏe và ngon miệng ❤️</p>
          </div>
        </div>

        {/* CỤM NÚT CẬP NHẬT TRẠNG THÁI (ẨN KHI IN) */}
        <div className="mt-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 print:hidden">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Trạng thái đơn hàng: <b className="text-emerald-600">{order.status}</b>
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => handleUpdateStatus('CONFIRMED')}
              disabled={updating || order.status === 'CONFIRMED'}
              className="h-10 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Đã duyệt</span>
            </button>

            <button
              onClick={() => handleUpdateStatus('SHIPPING')}
              disabled={updating || order.status === 'SHIPPING'}
              className="h-10 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
            >
              <Truck className="h-3.5 w-3.5" />
              <span>Đang giao</span>
            </button>

            <button
              onClick={() => handleUpdateStatus('COMPLETED')}
              disabled={updating || order.status === 'COMPLETED'}
              className="h-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 shadow-xs disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5 stroke-[3]" />
              <span>Hoàn thành</span>
            </button>

            <button
              onClick={() => handleUpdateStatus('CANCELLED')}
              disabled={updating || order.status === 'CANCELLED'}
              className="h-10 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Hủy đơn</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
