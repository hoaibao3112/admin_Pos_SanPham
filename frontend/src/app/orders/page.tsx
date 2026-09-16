'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { Order, OrderListResponse, OrderStatus, TimeFilterType } from '@/types/order';
import {
  ReceiptText,
  Search,
  RefreshCw,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  AlertCircle,
  ChevronRight,
  ShoppingBag,
  Calendar,
  CalendarDays,
  Copy,
  Check,
  ExternalLink,
  Layers,
  ChevronDown,
  ChevronUp,
  LucideIcon,
} from 'lucide-react';

const STATUS_TABS: Array<{ id: string; label: string; icon: LucideIcon }> = [

  { id: 'ALL', label: 'Tất cả trạng thái', icon: ShoppingBag },
  { id: 'PENDING', label: 'Chờ duyệt', icon: AlertCircle },
  { id: 'CONFIRMED', label: 'Đã duyệt', icon: CheckCircle2 },
  { id: 'SHIPPING', label: 'Đang giao', icon: Truck },
  { id: 'COMPLETED', label: 'Hoàn thành', icon: CheckCircle2 },
  { id: 'CANCELLED', label: 'Đã hủy', icon: XCircle },
];

function getFormattedDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getFormattedMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('ALL');
  const [customDate, setCustomDate] = useState<string>('');
  const [customMonth, setCustomMonth] = useState<string>('');
  const [groupByDate, setGroupByDate] = useState<boolean>(true);
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [metrics, setMetrics] = useState({ pendingOrders: 0, totalRevenue: 0 });
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Toast
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

  // 1. Tải danh sách đơn hàng với bộ lọc ngày / tháng
  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== 'ALL') {
        params.set('status', activeTab);
      }

      const now = new Date();
      if (timeFilter === 'TODAY') {
        params.set('date', getFormattedDate(now));
      } else if (timeFilter === 'YESTERDAY') {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        params.set('date', getFormattedDate(yesterday));
      } else if (timeFilter === 'THIS_MONTH') {
        params.set('month', getFormattedMonth(now));
      } else if (timeFilter === 'LAST_MONTH') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        params.set('month', getFormattedMonth(lastMonth));
      } else if (timeFilter === 'CUSTOM') {
        if (customDate) params.set('date', customDate);
        else if (customMonth) params.set('month', customMonth);
      }

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await fetchApi<OrderListResponse>(`/api/orders${queryStr}`);
      if (res && res.items) {
        setOrders(res.items);
        if (res.metrics) {
          setMetrics(res.metrics);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách đơn hàng';
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [activeTab, timeFilter, customDate, customMonth]);

  // 2. Kéo đơn đồng bộ từ Pancake POS
  const handleSyncFromPancake = async () => {
    setSyncing(true);
    try {
      const res = await fetchApi<{ success: boolean; message: string; syncedCount: number }>(
        '/api/orders/sync-pancake',
        { method: 'POST' }
      );
      showToast('success', res.message || 'Đã đồng bộ đơn hàng từ Pancake POS');
      await loadOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Chưa cấu hình Pancake Token trong .env';
      showToast('error', msg);
    } finally {
      setSyncing(false);
    }
  };

  // 3. Đổi trạng thái đơn nhanh
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await fetchApi(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      showToast('success', 'Đã cập nhật trạng thái đơn');
      await loadOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi cập nhật trạng thái';
      showToast('error', msg);
    } finally {
      setUpdatingId(null);
    }
  };

  // 4. Sao chép nội dung Bill đẹp mắt gửi khách qua Messenger
  const handleCopyBill = (order: Order) => {
    const itemsText = order.items && order.items.length > 0
      ? order.items.map((i) => `  • ${i.quantity}x ${i.productName}: ${formatMoney(i.total)} đ`).join('\n')
      : '  • Không có sản phẩm';

    const billContent = `🧾 HÓA ĐƠN ĐẶT HÀNG - CẨM TUYỀN HOUSES
Mã đơn: #${order.code}
Thời gian: ${new Date(order.createdAt).toLocaleString('vi-VN')}
Khách hàng: ${order.customerName}
SĐT: ${order.customerPhone || 'Chưa cập nhật'}
Địa chỉ: ${order.customerAddress || 'Giao tại quán / Chưa ghi địa chỉ'}

📦 CHI TIẾT SẢN PHẨM:
${itemsText}
--------------------------------
💰 TỔNG CỘNG: ${formatMoney(order.totalAmount)} đ

Cảm ơn quý khách đã tin tưởng và ủng hộ Cẩm Tuyền Houses! ❤️`;


    navigator.clipboard.writeText(billContent);
    setCopiedId(order.id);
    showToast('success', 'Đã copy bill! Bạn có thể dán thẳng vào Messenger gửi khách');
    setTimeout(() => setCopiedId(null), 3000);
  };

  // Lọc theo từ khóa tìm kiếm
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const term = searchTerm.toLowerCase();
      const matchCode = o.code.toLowerCase().includes(term);
      const matchName = o.customerName.toLowerCase().includes(term);
      const matchPhone = o.customerPhone ? o.customerPhone.includes(term) : false;
      return matchCode || matchName || matchPhone;
    });
  }, [orders, searchTerm]);

  // Gom nhóm đơn hàng theo từng ngày
  const groupedOrders = useMemo(() => {
    const map = new Map<string, { dateKey: string; displayDate: string; orders: Order[]; totalRevenue: number }>();
    const todayStr = getFormattedDate(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getFormattedDate(yesterday);

    filteredOrders.forEach((order) => {
      const orderDate = new Date(order.createdAt);
      const dateKey = getFormattedDate(orderDate);

      let displayDate = orderDate.toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      if (dateKey === todayStr) {
        displayDate = `Hôm nay (${orderDate.toLocaleDateString('vi-VN')})`;
      } else if (dateKey === yesterdayStr) {
        displayDate = `Hôm qua (${orderDate.toLocaleDateString('vi-VN')})`;
      }

      if (!map.has(dateKey)) {
        map.set(dateKey, {
          dateKey,
          displayDate,
          orders: [],
          totalRevenue: 0,
        });
      }

      const group = map.get(dateKey)!;
      group.orders.push(order);
      if (order.status !== 'CANCELLED') {
        const amt = typeof order.totalAmount === 'string' ? Number(order.totalAmount.replace(/\D/g, '')) : order.totalAmount;
        group.totalRevenue += (amt || 0);
      }
    });

    return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filteredOrders]);

  const toggleCollapseDate = (dateKey: string) => {
    setCollapsedDates((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return {
          label: 'Chờ duyệt',
          classes: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300',
        };
      case 'CONFIRMED':
        return {
          label: 'Đã duyệt',
          classes: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300',
        };
      case 'SHIPPING':
        return {
          label: 'Đang giao',
          classes: 'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300',
        };
      case 'COMPLETED':
        return {
          label: 'Hoàn tất',
          classes: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300',
        };
      case 'CANCELLED':
        return {
          label: 'Đã hủy',
          classes: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300',
        };
      default:
        return {
          label: status,
          classes: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  // Card đơn hàng con tái sử dụng
  const renderOrderCard = (order: Order) => {
    const badge = getStatusBadge(order.status);
    const itemCount = order.items ? order.items.reduce((s, i) => s + i.quantity, 0) : 0;
    const isCopied = copiedId === order.id;

    return (
      <div
        key={order.id}
        className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition hover:border-slate-300 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Dòng 1: Mã đơn, Huy hiệu trạng thái, Giờ */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
              #{order.code}
            </span>
            <span
              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${badge.classes}`}
            >
              {badge.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
            <Clock className="h-3 w-3" />
            <span>
              {new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Dòng 2: Thông tin khách hàng & SĐT */}
        <div className="py-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {order.customerName}
              </span>
            </div>

            {order.customerPhone ? (
              <a
                href={`tel:${order.customerPhone}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200/60"
              >
                <Phone className="h-3 w-3" />
                <span>{order.customerPhone}</span>
              </a>
            ) : (
              <span className="text-[11px] text-slate-400 italic">Chưa có SĐT</span>
            )}
          </div>

          {order.customerAddress && (
            <div className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>{order.customerAddress}</span>
            </div>
          )}
        </div>

        {/* Dòng 3: Tóm tắt món hàng */}
        {order.items && order.items.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl text-xs space-y-1 mb-3">
            {order.items.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span className="truncate pr-2">
                  • <b className="text-slate-900 dark:text-white">{item.quantity}x</b> {item.productName}
                </span>
                <span className="shrink-0 font-medium">{formatMoney(item.total)} đ</span>
              </div>
            ))}
            {order.items.length > 3 && (
              <div className="text-[11px] font-semibold text-slate-400 pt-0.5 italic">
                + thêm {order.items.length - 3} món khác...
              </div>
            )}
          </div>
        )}

        {/* Dòng 4: Tổng tiền & Cụm nút hành động */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Tổng tiền ({itemCount} món)</span>
            <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
              {formatMoney(order.totalAmount)} đ
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Nút Sao chép Bill gửi Messenger */}
            <button
              type="button"
              onClick={() => handleCopyBill(order)}
              title="Sao chép tóm tắt hóa đơn gửi khách qua Messenger"
              className={`h-9 px-2.5 rounded-xl text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                isCopied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300'
              }`}
            >
              {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{isCopied ? 'Đã copy' : 'Copy Bill'}</span>
            </button>

            {/* Nút xem chi tiết Bill */}
            <Link
              href={`/orders/${order.id}`}
              className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1 active:scale-95 transition dark:bg-slate-800 dark:text-slate-200"
            >
              <ReceiptText className="h-3.5 w-3.5" />
              <span>Xem Bill</span>
              <ChevronRight className="h-3 w-3" />
            </Link>

            {/* Nút duyệt nhanh nếu đang là PENDING */}
            {order.status === 'PENDING' && (
              <button
                type="button"
                onClick={() => handleUpdateStatus(order.id, 'CONFIRMED')}
                disabled={updatingId === order.id}
                className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-xs shadow-emerald-600/20 active:scale-95 transition cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Duyệt</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans pb-24">
      {/* Toast thông báo */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl transition-all ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {toast.text}
        </div>
      )}

      {/* Main content container */}
      <main className="mx-auto max-w-4xl px-4 pt-5 space-y-4">
        {/* Tiêu đề & Thống kê nhanh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-emerald-600" />
                Hóa đơn &amp; Đơn hàng
              </h1>
              <Link
                href="/tra-cuu"
                target="_blank"
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
              >
                <span>Trang tra cứu khách</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Theo dõi hóa đơn theo ngày, theo tháng và sao chép gửi nhanh qua Messenger
            </p>
          </div>

          {/* Hai thẻ chỉ số nhanh */}
          <div className="flex items-center gap-2.5">
            <div className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/60">
              <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400 block">
                Chờ duyệt
              </span>
              <span className="text-base font-extrabold text-amber-800 dark:text-amber-300">
                {metrics.pendingOrders} đơn
              </span>
            </div>

            <div className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/60">
              <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">
                Doanh thu
              </span>
              <span className="text-base font-extrabold text-emerald-800 dark:text-emerald-300">
                {formatMoney(metrics.totalRevenue)} đ
              </span>
            </div>
          </div>
        </div>

        {/* Thanh lọc thời gian (Ngày / Tháng) */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Calendar className="h-4 w-4 text-emerald-600" />
              <span>Xem Bill theo thời gian:</span>
            </div>

            {/* Nút bật tắt chế độ gom nhóm theo ngày */}
            <button
              type="button"
              onClick={() => setGroupByDate(!groupByDate)}
              className={`h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                groupByDate
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Gom theo Ngày: {groupByDate ? 'BẬT' : 'TẮT'}</span>
            </button>
          </div>

          {/* Các nút bấm lọc nhanh thời gian */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'ALL', label: 'Tất cả thời gian' },
              { id: 'TODAY', label: '📅 Hôm nay' },
              { id: 'YESTERDAY', label: 'Hôm qua' },
              { id: 'THIS_MONTH', label: '🗓️ Tháng này' },
              { id: 'LAST_MONTH', label: 'Tháng trước' },
              { id: 'CUSTOM', label: 'Tùy chọn khác...' },
            ].map((item) => {
              const isActive = timeFilter === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setTimeFilter(item.id as TimeFilterType);
                    if (item.id !== 'CUSTOM') {
                      setCustomDate('');
                      setCustomMonth('');
                    }
                  }}
                  className={`h-8 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Khung chọn ngày/tháng cụ thể nếu chọn CUSTOM */}
          {timeFilter === 'CUSTOM' && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-medium">Chọn ngày:</span>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => {
                    setCustomDate(e.target.value);
                    setCustomMonth('');
                  }}
                  className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <span className="text-slate-400 text-xs">hoặc</span>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-medium">Chọn cả tháng:</span>
                <input
                  type="month"
                  value={customMonth}
                  onChange={(e) => {
                    setCustomMonth(e.target.value);
                    setCustomDate('');
                  }}
                  className="h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              {(customDate || customMonth) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomDate('');
                    setCustomMonth('');
                  }}
                  className="text-xs text-rose-600 hover:underline font-semibold ml-auto"
                >
                  Xóa lọc
                </button>
              )}
            </div>
          )}
        </div>

        {/* Thanh tìm kiếm & Nút đồng bộ */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo Tên khách, SĐT hoặc Mã đơn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm font-medium shadow-2xs focus:border-emerald-500 outline-hidden dark:border-slate-800 dark:bg-slate-900"
              style={{ fontSize: '15px' }}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSyncFromPancake}
              disabled={syncing}
              className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Đang kéo...' : 'Đồng bộ từ POS'}</span>
            </button>

            <button
              onClick={loadOrders}
              disabled={loading}
              title="Tải lại danh sách"
              className="h-11 w-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tabs lọc trạng thái cuộn ngang */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {STATUS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Danh sách đơn hàng */}
        {loading ? (
          <div className="space-y-3.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                  <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-3.5 w-14 rounded bg-slate-200 dark:bg-slate-700" />
                </div>
                <div className="py-3 space-y-2">
                  <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-3 w-48 rounded bg-slate-200 dark:bg-slate-700" />
                </div>
                <div className="h-8 w-full rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto h-14 w-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center dark:bg-slate-800">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
              {searchTerm ? 'Không tìm thấy hóa đơn nào phù hợp' : 'Chưa có hóa đơn nào trong khoảng thời gian này'}
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              Thử đổi bộ lọc thời gian sang "Tất cả thời gian" hoặc bấm Đồng bộ từ POS.
            </p>
            <button
              onClick={handleSyncFromPancake}
              disabled={syncing}
              className="mt-5 inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-sm hover:bg-emerald-500 transition"
            >
              <RefreshCw className="h-4 w-4" />
              Thử bấm đồng bộ từ POS
            </button>
          </div>
        ) : groupByDate ? (
          /* Chế độ Gom nhóm theo Ngày */
          <div className="space-y-5">
            {groupedOrders.map((group) => {
              const isCollapsed = collapsedDates[group.dateKey] || false;
              return (
                <div key={group.dateKey} className="space-y-3">
                  {/* Tiêu đề nhóm Ngày */}
                  <div
                    onClick={() => toggleCollapseDate(group.dateKey)}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-100/80 hover:bg-slate-200/70 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 cursor-pointer transition select-none"
                  >
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-emerald-600" />
                      <span className="font-extrabold text-sm capitalize text-slate-900 dark:text-white">
                        {group.displayDate}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                        {group.orders.length} bill
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-medium">Doanh thu ngày</span>
                        <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                          {formatMoney(group.totalRevenue)} đ
                        </span>
                      </div>
                      {isCollapsed ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Danh sách các hóa đơn trong ngày */}
                  {!isCollapsed && (
                    <div className="space-y-3 pl-1">
                      {group.orders.map((order) => renderOrderCard(order))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Chế độ Danh sách phẳng */
          <div className="space-y-3.5">
            {filteredOrders.map((order) => renderOrderCard(order))}
          </div>
        )}
      </main>
    </div>
  );
}
