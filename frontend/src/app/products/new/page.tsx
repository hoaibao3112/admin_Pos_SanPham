'use client';

import { useState, useEffect, useTransition, useRef } from 'react';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchApi, uploadImageFile } from '@/lib/api';
import {
  ChevronLeft,
  Check,
  Sparkles,
  RefreshCw,
  Camera,
  Trash2,
  Package,
  Store,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';


const DEFAULT_CATEGORIES = [
  'Trái Cây Tươi',
  'Rau Củ Đà Lạt',
  'Lạp Xưởng Cai Lậy',
  'Bánh Hạt & Sữa',
  'Đồ Khô Ăn Vặt',
  'Mặc định',
];


export default function NewProductPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [category, setCategory] = useState('Trái Cây Tươi');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [customCat, setCustomCat] = useState('');
  const [price, setPrice] = useState<number | string>(150000);
  const [stock, setStock] = useState<number>(10);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [saving, setSaving] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const formatMoney = (val: number | string) => {
    const num = typeof val === 'string' ? Number(val.replace(/\D/g, '')) : val;
    if (isNaN(num)) return '0';
    return num.toLocaleString('vi-VN');
  };

  // Tải danh sách nhóm sản phẩm đã có của shop + nhóm người dùng tự lưu
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetchApi<{ success: boolean; data: Array<{ category?: string }> }>('/api/products');
        const shopCategories = res.data
          ? Array.from(new Set(res.data.map((p) => p.category).filter((c): c is string => Boolean(c?.trim()))))
          : [];

        const stored = typeof window !== 'undefined' ? localStorage.getItem('custom_categories') : null;
        const savedCategories: string[] = stored ? JSON.parse(stored) : [];

        const combined = Array.from(
          new Set([...shopCategories, ...savedCategories, ...DEFAULT_CATEGORIES])
        );
        setCategories(combined);
      } catch {
        try {
          const stored = typeof window !== 'undefined' ? localStorage.getItem('custom_categories') : null;
          if (stored) {
            const saved: string[] = JSON.parse(stored);
            setCategories(Array.from(new Set([...saved, ...DEFAULT_CATEGORIES])));
          }
        } catch {}
      }
    };

    loadCategories();
  }, []);

  // Thêm nhóm mới tại chỗ
  const handleAddCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;

    if (!categories.includes(trimmed)) {
      const updated = [trimmed, ...categories];
      setCategories(updated);
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('custom_categories') : null;
        const saved: string[] = stored ? JSON.parse(stored) : [];
        if (!saved.includes(trimmed)) {
          localStorage.setItem('custom_categories', JSON.stringify([trimmed, ...saved]));
        }
      } catch {}
    }

    setCategory(trimmed);
    setCustomCat('');
    setNewCategoryInput('');
    showToast('success', `Đã thêm và chọn nhóm: "${trimmed}"`);
  };


  // Chọn ảnh trực tiếp từ Camera / Thư viện ảnh trên iPhone
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    try {
      const res = await uploadImageFile(file);
      setImageUrl(res.url);
      showToast('success', `Đã nén ảnh WebP (${res.sizeKb} KB, vuông 800x800)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải ảnh, vui lòng thử lại';
      showToast('error', msg);
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!name.trim()) {
      showToast('error', 'Vui lòng nhập tên sản phẩm');
      return;
    }

    setSaving(true);
    try {
      const finalCategory = customCat.trim() ? customCat.trim() : category;

      await fetchApi('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          category: finalCategory,
          price: Number(price) || 0,
          stock: Number(stock) || 0,
          description: description.trim(),
          imageUrl: imageUrl.trim() || null,
        }),
      });

      showToast('success', 'Đã lưu & đồng bộ sang Pancake POS!');
      setTimeout(() => {
        startTransition(() => {
          router.push('/products');
        });
      }, 1000);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi khi lưu sản phẩm';
      showToast('error', errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans pb-32">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-2xl backdrop-blur-md transition-all ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-xl px-4 h-14 flex items-center justify-between">
          <Link
            href="/products"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
            <span>Kho hàng</span>
          </Link>

          <div className="flex flex-col items-center">
            <span className="text-sm font-extrabold tracking-tight">Thêm Món Mới</span>
            <span className="text-[10px] text-emerald-600 font-bold">Cẩm Tuyền House</span>
          </div>

          <div className="w-16 flex justify-end">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60">
              Đồng bộ POS
            </span>
          </div>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="mx-auto max-w-xl px-4 pt-4 space-y-4">
        {/* Form Nhập liệu */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* 1. CHỌN ẢNH TỪ ĐIỆN THOẠI (CAMERA / ALBUM) */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-emerald-600" />
                Ảnh sản phẩm (Chụp hoặc Chọn từ máy)
              </label>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60">
                Tự cắt vuông 1:1
              </span>
            </div>

            {/* Input file ẩn */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="flex items-center gap-3.5">
              {/* Khung ảnh vuông chạm vào là mở camera/album */}
              <div
                onClick={() => !compressing && fileInputRef.current?.click()}
                className="h-24 w-24 shrink-0 rounded-2xl border-2 border-dashed border-emerald-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden flex items-center justify-center relative cursor-pointer active:scale-95 transition shadow-2xs"
              >
                {compressing ? (
                  <div className="flex flex-col items-center justify-center p-2 text-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-emerald-600 mb-1" />
                    <span className="text-[9px] font-bold text-emerald-600">Đang nén...</span>
                  </div>
                ) : imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="Preview" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-[10px] font-bold opacity-0 hover:opacity-100 transition">
                      Đổi ảnh
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-2 text-center text-slate-400">
                    <Camera className="h-7 w-7 text-emerald-500 mb-1" />
                    <span className="text-[10px] font-bold text-slate-500">Chạm chọn ảnh</span>
                  </div>
                )}
              </div>

              {/* Nút hành động */}
              <div className="flex-1 space-y-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={compressing}
                  className="w-full h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <Camera className="h-4 w-4 stroke-[2.5]" />
                  <span>{imageUrl ? 'Đổi ảnh khác từ máy' : 'Chọn ảnh / Chụp ảnh'}</span>
                </button>

                {imageUrl ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <Check className="h-3 w-3 stroke-[3]" /> Đã sẵn sàng
                    </span>
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-[11px] font-bold text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" /> Gỡ ảnh
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Chụp trực tiếp bằng camera hoặc chọn từ album ảnh. Ảnh nặng máy chủ tự động nén nhẹ tênh!
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 2. TÊN SẢN PHẨM */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1.5">
              Tên sản phẩm <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="VD: Lạp Xưởng Tôm Cai Lậy / Hồng Mật Fuji..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-hidden focus:border-emerald-500"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* 3. NHÓM SẢN PHẨM */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Nhóm sản phẩm
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                Đang chọn: <b className="text-emerald-600 dark:text-emerald-400">{customCat || category}</b>
              </span>
            </div>

            {/* Danh sách các nút nhóm sản phẩm */}
            <div className="flex items-center gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategory(cat);
                    setCustomCat('');
                  }}
                  className={`h-9 px-3.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                    category === cat && !customCat
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Khung gõ thêm nhóm mới tại đây */}
            <div className="pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Gõ tên nhóm mới cần thêm (VD: Đồ Ăn Vặt, Bánh Tráng...)"
                  value={newCategoryInput}
                  onChange={(e) => {
                    setNewCategoryInput(e.target.value);
                    setCustomCat(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCategory();
                    }
                  }}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 text-sm font-medium outline-hidden focus:border-emerald-500 transition"
                  style={{ fontSize: '15px' }}
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={!newCategoryInput.trim()}
                  className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>+ Thêm</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 pl-1 italic">
                💡 Bạn chỉ cần gõ tên và bấm nút <b>+ Thêm</b> (hoặc bấm Enter) để tạo nhóm mới ngay lập tức.
              </p>
            </div>
          </div>


          {/* 4 & 5. GIÁ BÁN & TỒN KHO */}
          <div className="grid grid-cols-2 gap-3">
            {/* Giá bán */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1.5">
                Giá bán (VNĐ) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="0"
                  value={price ? formatMoney(price) : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setPrice(raw ? Number(raw) : 0);
                  }}
                  className="w-full h-12 px-3.5 pr-8 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 font-extrabold text-slate-900 dark:text-white outline-hidden focus:border-emerald-500"
                  style={{ fontSize: '16px' }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  đ
                </span>
              </div>
            </div>

            {/* Tồn kho */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1.5">
                Tồn kho <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setStock(Math.max(0, stock - 1))}
                  className="h-12 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black dark:bg-slate-800 dark:text-slate-200 active:scale-90"
                >
                  -
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full h-12 text-center rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 font-extrabold text-slate-900 dark:text-white outline-hidden focus:border-emerald-500"
                  style={{ fontSize: '16px' }}
                />
                <button
                  type="button"
                  onClick={() => setStock(stock + 1)}
                  className="h-12 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black dark:bg-slate-800 dark:text-slate-200 active:scale-90"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* 6. MÔ TẢ */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Mô tả sản phẩm
              </label>
              <button
                type="button"
                onClick={() => {
                  if (name) {
                    setDescription(
                      `${name} tươi sạch đặc sản Cẩm Tuyền House, đóng gói kỹ càng, giao nhanh.`
                    );
                  }
                }}
                className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="h-3 w-3" />
                Gợi ý nhanh
              </button>
            </div>
            <textarea
              rows={3}
              placeholder="Quy cách đóng gói, hương vị đặc sản..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium outline-hidden focus:border-emerald-500 resize-none"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Nút Submit to bản, dễ bấm ngay ngón cái */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-base shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <Check className="h-5 w-5 stroke-[3]" />
              )}
              <span>{saving ? 'Đang lưu & đồng bộ...' : 'Lưu Vào Kho & Đồng Bộ POS'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
