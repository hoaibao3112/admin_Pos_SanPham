'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { Order, OrderLookupResponse, OrderStatus } from '@/types/order';
import {
  Search,
  Phone,
  ReceiptText,
  Clock,
  MapPin,
  Truck,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Store,
  Calendar,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

function OrderLookupContent() {
  const searchParams = useSearchParams();
  const phoneFromUrl = searchParams.get('phone') || '';

  const [phoneNumber, setPhoneNumber] = useState(phoneFromUrl);
  const [searchedPhone, setSearchedPhone] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const formatMoney = (val: number | string) => {
    const num = typeof val === 'string' ? Number(val.replace(/\D/g, '')) : val;
    if (isNaN(num)) return '0';
    return num.toLocaleString('vi-VN');
  };

  const handleLookup = async (phoneToSearch: string) => {
    const clean = phoneToSearch.trim();
    if (!clean || clean.length < 8) {
      setErrorMessage('Vui lòng nhập số điện thoại hợp lệ (ít nhất 8 chữ số)');
      return;
    }

    setErrorMessage('');
    setLoading(true);
    setHasSearched(true);
    setSearchedPhone(clean);

    try {
      const res = await fetchApi<OrderLookupResponse>(`/api/orders/lookup?phone=${encodeURIComponent(clean)}`);
      if (res && res.orders) {
        setOrders(res.orders);
      } else {
        setOrders([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi tra cứu hóa đơn';
      setErrorMessage(msg);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (phoneFromUrl && phoneFromUrl.length >= 8) {
      setPhoneNumber(phoneFromUrl);
      handleLookup(phoneFromUrl);
    }
  }, [phoneFromUrl]);

  // Gom nhóm đơn hàng theo Từng Tháng và Từng Ngày
  const monthlyGroups = useMemo(() => {
    interface DateSubGroup {
      dateKey: string;
      displayDate: string;
      orders: Order[];
      dailyTotal: number;
    }

    interface MonthGroup {
      monthKey: string; // e.g. "2026-09"
      displayMonth: string; // e.g. "Tháng 09/2026"
      totalAmount: number;
      orderCount: number;
      dates: DateSubGroup[];
    }

    const monthMap = new Map<string, MonthGroup>();

    orders.forEach((order) => {
      const orderDate = new Date(order.createdAt);
      const year = orderDate.getFullYear();
      const month = String(orderDate.getMonth() + 1).padStart(2, '0');
      const day = String(orderDate.getDate()).padStart(2, '0');

      const monthKey = `${year}-${month}`;
      const displayMonth = `Tháng ${month}/${year}`;
      const dateKey = `${year}-${month}-${day}`;
      const displayDate = orderDate.toLocaleDateString('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          monthKey,
          displayMonth,
          totalAmount: 0,
          orderCount: 0,
          dates: [],
        });
      }

      const mGroup = monthMap.get(monthKey)!;
      mGroup.orderCount += 1;

      const amt = typeof order.totalAmount === 'string' ? Number(order.totalAmount.replace(/\D/g, '')) : order.totalAmount;
      if (order.status !== 'CANCELLED') {
        mGroup.totalAmount += (amt || 0);
      }

      let dGroup = mGroup.dates.find((d) => d.dateKey === dateKey);
      if (!dGroup) {
        dGroup = {
          dateKey,
          displayDate,
          orders: [],
          dailyTotal: 0,
        };
        mGroup.dates.push(dGroup);
      }

      dGroup.orders.push(order);
      if (order.status !== 'CANCELLED') {
        dGroup.dailyTotal += (amt || 0);
      }
    });

    return Array.from(monthMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [orders]);

  const totalSpentAllTime = useMemo(() => {
    return orders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => {
        const amt = typeof o.totalAmount === 'string' ? Number(o.totalAmount.replace(/\D/g, '')) : o.totalAmount;
        return sum + (amt || 0);
      }, 0);
  }, [orders]);

  const getStatusDisplay = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return {
          label: 'Đang chuẩn bị hàng',
          icon: Clock,
          classes: 'bg-amber-50 text-amber-700 border-amber-200/80',
        };
      case 'CONFIRMED':
        return {
          label: 'Đã xác nhận đơn',
          icon: CheckCircle2,
          classes: 'bg-blue-50 text-blue-700 border-blue-200/80',
        };
      case 'SHIPPING':
        return {
          label: 'Đang giao hàng',
          icon: Truck,
          classes: 'bg-indigo-50 text-indigo-700 border-indigo-200/80 animate-pulse',
        };
      case 'COMPLETED':
        return {
          label: 'Giao hàng thành công',
          icon: CheckCircle2,
          classes: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        };
      case 'CANCELLED':
        return {
          label: 'Đơn đã hủy',
          icon: XCircle,
          classes: 'bg-rose-50 text-rose-700 border-rose-200/80',
        };
      default:
        return {
          label: status,
          icon: ReceiptText,
          classes: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-emerald-50/50 via-slate-50 to-slate-100 text-slate-900 font-sans pb-24">
      {/* Header thương hiệu sang trọng */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-slate-900">
                CẨM TUYỀN HOUSES
              </h1>
              <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                <span>Tra cứu Hóa đơn &amp; Đơn hàng</span>
              </p>
            </div>
          </div>

          <Link
            href="/orders"
            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 transition"
          >
            Dành cho Quản lý
          </Link>
        </div>
      </header>

      {/* Main container mobile-first */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Khung tìm kiếm bằng Số điện thoại */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <label className="block text-xs font-bold text-slate-700">
            Nhập số điện thoại để xem toàn bộ Bill của bạn:
          </label>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLookup(phoneNumber);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Ví dụ: 0901234567..."
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 outline-hidden transition"
                style={{ fontSize: '15px' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Search className="h-4 w-4" />
              <span>{loading ? 'Đang tìm...' : 'Tra cứu'}</span>
            </button>
          </form>

          {errorMessage && (
            <p className="text-xs font-semibold text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </p>
          )}

          <p className="text-[11px] text-slate-400 italic">
            💡 Gợi ý: Bạn có thể lưu lại link này để theo dõi tình trạng đơn hàng mọi lúc.
          </p>
        </div>

        {/* Thống kê chi tiêu nếu tìm thấy đơn */}
        {hasSearched && !loading && orders.length > 0 && (
          <div className="bg-linear-to-r from-emerald-600 to-teal-700 text-white p-4 rounded-2xl shadow-md space-y-2">
            <div className="flex items-center justify-between text-emerald-100 text-xs">
              <span className="font-semibold">Khách hàng: {orders[0]?.customerName}</span>
              <span className="font-bold">SĐT: {searchedPhone}</span>
            </div>
            <div className="flex items-baseline justify-between pt-1 border-t border-emerald-500/50">
              <div>
                <span className="text-[11px] text-emerald-100 block">Tổng đã mua sắm</span>
                <span className="text-xl font-black">{formatMoney(totalSpentAllTime)} đ</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-emerald-100 block">Tổng hóa đơn</span>
                <span className="text-sm font-extrabold">{orders.length} đơn hàng</span>
              </div>
            </div>
          </div>
        )}

        {/* Kết quả đơn hàng theo từng tháng, từng ngày */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-16 w-full bg-slate-100 rounded-xl" />
                <div className="h-4 w-24 bg-slate-200 rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : hasSearched && orders.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              Chưa tìm thấy hóa đơn nào cho số điện thoại này
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Vui lòng kiểm tra lại số điện thoại hoặc liên hệ với shop qua Messenger để được hỗ trợ nhanh nhất.
            </p>
          </div>
        ) : hasSearched && monthlyGroups.length > 0 ? (
          <div className="space-y-6">
            {monthlyGroups.map((mGroup) => (
              <div key={mGroup.monthKey} className="space-y-3">
                {/* Header Tháng */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-emerald-600" />
                    <h2 className="font-extrabold text-sm text-slate-900 uppercase tracking-tight">
                      {mGroup.displayMonth}
                    </h2>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60">
                    {mGroup.orderCount} đơn • {formatMoney(mGroup.totalAmount)} đ
                  </span>
                </div>

                {/* Danh sách các Ngày trong Tháng */}
                <div className="space-y-3">
                  {mGroup.dates.map((dGroup) => (
                    <div key={dGroup.dateKey} className="space-y-2">
                      {/* Subheader Ngày */}
                      <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-2">
                        <span className="capitalize">📅 {dGroup.displayDate}</span>
                        <span>{formatMoney(dGroup.dailyTotal)} đ</span>
                      </div>

                      {/* Các Bill trong Ngày */}
                      <div className="space-y-2.5">
                        {dGroup.orders.map((order) => {
                          const status = getStatusDisplay(order.status);
                          const StatusIcon = status.icon;

                          return (
                            <div
                              key={order.id}
                              className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5 transition hover:border-slate-300"
                            >
                              {/* Dòng mã đơn và trạng thái */}
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-xs text-slate-900">
                                    #{order.code}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>

                                <div
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${status.classes}`}
                                >
                                  <StatusIcon className="h-3 w-3" />
                                  <span>{status.label}</span>
                                </div>
                              </div>

                              {/* Danh sách món */}
                              {order.items && order.items.length > 0 && (
                                <div className="bg-slate-50 p-2 rounded-xl text-xs space-y-1">
                                  {order.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-slate-700">
                                      <span className="truncate pr-2">
                                        <b className="text-slate-900">{item.quantity}x</b> {item.productName}
                                      </span>
                                      <span className="shrink-0 font-medium">
                                        {formatMoney(item.total)} đ
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Địa chỉ giao */}
                              {order.customerAddress && (
                                <div className="flex items-start gap-1 text-[11px] text-slate-500">
                                  <MapPin className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                                  <span className="line-clamp-1">{order.customerAddress}</span>
                                </div>
                              )}

                              {/* Tổng tiền */}
                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                                <span className="text-slate-500 font-medium">Tổng thanh toán:</span>
                                <span className="text-sm font-black text-emerald-700">
                                  {formatMoney(order.totalAmount)} đ
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Chân trang hỗ trợ khách */}
        <div className="text-center pt-6 text-xs text-slate-400 space-y-1">
          <p>© Cẩm Tuyền Houses • Trân trọng từng trải nghiệm của quý khách</p>
          <p>Cần hỗ trợ đơn hàng? Hãy nhắn tin qua Messenger để được giải đáp ngay!</p>
        </div>
      </main>
    </div>
  );
}

export default function OrderLookupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm font-bold text-slate-500">
          Đang tải trang tra cứu...
        </div>
      }
    >
      <OrderLookupContent />
    </Suspense>
  );
}
