'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { Package, Image as ImageIcon, AlertCircle, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function ProductForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    price: 0,
    costPrice: 0,
    stock: 0,
    imageUrl: '',
    description: '',
    syncToPancake: true,
  });

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: 'idle' | 'success' | 'warning' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
      setFormData((prev) => ({ ...prev, [name]: value === '' ? 0 : Number(value) }));
    } else if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: 'idle', message: '' });

    try {
      const res = await fetchApi<{
        success: boolean;
        message: string;
        warning?: string;
        data?: unknown;
      }>('/api/products', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (res.warning) {
        setStatus({
          type: 'warning',
          message: `Sản phẩm đã tạo thành công, nhưng: ${res.warning}`,
        });
      } else {
        setStatus({
          type: 'success',
          message: res.message || 'Thêm sản phẩm và đồng bộ Pancake POS thành công!',
        });
        setTimeout(() => {
          router.push('/products');
        }, 1500);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo sản phẩm';
      setStatus({
        type: 'error',
        message: errorMsg,
      });
    } finally {

      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-8 border-b border-slate-100 pb-5 dark:border-slate-800">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Thêm sản phẩm mới
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Điền thông tin sản phẩm và tự động đẩy sang Pancake POS để quản lý kho tập trung.
          </p>
        </div>

        {status.message && (
          <div
            className={`mb-6 flex items-start gap-3 rounded-xl p-4 text-sm font-medium border ${
              status.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : status.type === 'warning'
                ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
            }`}
          >
            {status.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <div className="flex-1">{status.message}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Tên sản phẩm */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Tên sản phẩm <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="VD: Áo thun Polo Cotton thoáng khí"
                value={formData.name}
                onChange={handleChange}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Mã SKU */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Mã SKU <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="sku"
                required
                placeholder="VD: POLO-WHT-M"
                value={formData.sku}
                onChange={handleChange}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm uppercase text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Tồn kho */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Số lượng tồn kho ban đầu <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                name="stock"
                min="0"
                required
                value={formData.stock}
                onChange={handleChange}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Giá bán lẻ */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Giá bán lẻ (VNĐ) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                name="price"
                min="0"
                step="1000"
                required
                value={formData.price}
                onChange={handleChange}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Giá vốn */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Giá vốn / Giá nhập (VNĐ)
              </label>
              <input
                type="number"
                name="costPrice"
                min="0"
                step="1000"
                value={formData.costPrice}
                onChange={handleChange}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Link ảnh */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Đường dẫn ảnh sản phẩm (URL)
              </label>
              <div className="mt-1.5 flex gap-3">
                <input
                  type="url"
                  name="imageUrl"
                  placeholder="https://example.com/san-pham.jpg"
                  value={formData.imageUrl}
                  onChange={handleChange}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              {formData.imageUrl && (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 p-2 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    className="h-16 w-16 rounded object-cover border border-slate-200 dark:border-slate-800"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="text-xs text-slate-500">Xem trước ảnh sản phẩm</div>
                </div>
              )}
            </div>

            {/* Mô tả */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Mô tả sản phẩm
              </label>
              <textarea
                name="description"
                rows={3}
                placeholder="Thông tin chất liệu, xuất xứ, hướng dẫn sử dụng..."
                value={formData.description}
                onChange={handleChange}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Checkbox Đồng bộ Pancake POS */}
            <div className="md:col-span-2 rounded-xl bg-indigo-50/50 p-4 border border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/40">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="syncToPancake"
                  checked={formData.syncToPancake}
                  onChange={(e) => setFormData({ ...formData, syncToPancake: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-bold text-indigo-900 dark:text-indigo-300">
                    Tự động đồng bộ ngay sang Pancake POS (pos.pancake.vn)
                  </span>
                  <p className="text-xs text-indigo-700/80 dark:text-indigo-400/80">
                    Sản phẩm và tồn kho sẽ được khởi tạo trong kho hàng của Pancake POS theo cấu hình Token trong .env.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/products"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              Hủy
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 transition"
            >
              {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
              {loading ? 'Đang lưu & Đồng bộ...' : 'Lưu sản phẩm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
