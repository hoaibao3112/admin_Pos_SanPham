'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchApi, uploadImageFile } from '@/lib/api';
import { Product, ProductFormData } from '@/types/product';
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Package,
  X,
  Check,
  AlertCircle,
  Search,
  Camera,
  Image as ImageIcon,
  Sparkles,
  Minus,
  Store,
  ArrowUpDown,
} from 'lucide-react';

const DEFAULT_CATEGORIES = [
  'Trái Cây Tươi',
  'Rau Củ Đà Lạt',
  'Lạp Xưởng Cai Lậy',
  'Bánh Hạt & Sữa',
  'Đồ Khô Ăn Vặt',
  'Mặc định',
];

const initialForm: ProductFormData = {
  name: '',
  category: 'Trái Cây Tươi',
  price: 0,
  stock: 10,
  description: '',
  imageUrl: '',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Quản lý Dialog / Modal Thêm hoặc Sửa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(initialForm);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [syncingPos, setSyncingPos] = useState(false);

  // Quản lý Xóa
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Xem phóng to ảnh
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Toast thông báo
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  // Cập nhật danh sách nhóm sản phẩm từ DB + localStorage - các nhóm đã xóa
  const refreshCategories = (prods?: Product[]) => {
    try {
      const targetProds = prods || products;
      const shopCategories = targetProds
        ? Array.from(new Set(targetProds.map((p) => p.category).filter((c): c is string => Boolean(c?.trim()))))
        : [];

      const stored = typeof window !== 'undefined' ? localStorage.getItem('custom_categories') : null;
      const savedCategories: string[] = stored ? JSON.parse(stored) : [];

      const storedDeleted = typeof window !== 'undefined' ? localStorage.getItem('deleted_categories') : null;
      const deletedList: string[] = storedDeleted ? JSON.parse(storedDeleted) : [];

      const combined = Array.from(
        new Set([...shopCategories, ...savedCategories, ...DEFAULT_CATEGORIES])
      ).filter((c) => !deletedList.includes(c));

      setCategories(combined.length > 0 ? combined : ['Mặc định']);
    } catch {}
  };

  // 1. Tải danh sách sản phẩm
  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetchApi<{ success: boolean; data: Product[] }>('/api/products');
      const data = res.data || [];
      setProducts(data);
      refreshCategories(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách sản phẩm';
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    refreshCategories();
  }, []);

  // Thêm nhóm mới tại modal
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

        const storedDeleted = typeof window !== 'undefined' ? localStorage.getItem('deleted_categories') : null;
        if (storedDeleted) {
          const deletedList: string[] = JSON.parse(storedDeleted);
          localStorage.setItem('deleted_categories', JSON.stringify(deletedList.filter((c) => c !== trimmed)));
        }
      } catch {}
    }

    setFormData((prev) => ({ ...prev, category: trimmed }));
    setCustomCategoryInput('');
    setNewCategoryInput('');
    showToast('success', `Đã thêm và chọn nhóm: "${trimmed}"`);
  };

  // Xóa nhóm khỏi danh sách
  const handleDeleteCategory = (catToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (catToDelete === 'Mặc định') return;

    const updated = categories.filter((c) => c !== catToDelete);
    setCategories(updated);

    if (formData.category === catToDelete) {
      setFormData((prev) => ({ ...prev, category: updated[0] || 'Mặc định' }));
    }
    if (selectedCategory === catToDelete) {
      setSelectedCategory('Tất cả');
    }

    try {
      const storedDeleted = typeof window !== 'undefined' ? localStorage.getItem('deleted_categories') : null;
      const deletedList: string[] = storedDeleted ? JSON.parse(storedDeleted) : [];
      if (!deletedList.includes(catToDelete)) {
        localStorage.setItem('deleted_categories', JSON.stringify([...deletedList, catToDelete]));
      }

      const storedCustom = typeof window !== 'undefined' ? localStorage.getItem('custom_categories') : null;
      if (storedCustom) {
        const customList: string[] = JSON.parse(storedCustom);
        localStorage.setItem('custom_categories', JSON.stringify(customList.filter((c) => c !== catToDelete)));
      }
    } catch {}

    showToast('success', `Đã xóa nhóm: "${catToDelete}"`);
  };

  // 2. Kéo danh sách sản phẩm trực tiếp từ Pancake POS
  const handleSyncFromPancake = async () => {
    setSyncingPos(true);
    try {
      const res = await fetchApi<{ success: boolean; message: string; count: number }>(
        '/api/products/sync-pancake',
        { method: 'POST' }
      );
      showToast('success', res.message || 'Đã đồng bộ sản phẩm từ Pancake POS!');
      await loadProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Chưa cấu hình Pancake Token trong .env';
      showToast('error', msg);
    } finally {
      setSyncingPos(false);
    }
  };

  // Mở modal thêm mới
  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData(initialForm);
    setCustomCategoryInput('');
    setNewCategoryInput('');
    setIsModalOpen(true);
  };

  // Mở modal sửa sản phẩm
  const handleOpenEdit = (p: Product) => {
    setEditingId(p.id);
    setFormData({
      name: p.name,
      category: p.category || 'Trái Cây Tươi',
      price: Number(p.price) || 0,
      stock: Number(p.stock) || 0,
      description: p.description || '',
      imageUrl: p.imageUrl || '',
    });
    setCustomCategoryInput('');
    setNewCategoryInput('');
    setIsModalOpen(true);
  };

  // Xử lý nén và tải ảnh từ máy / điện thoại qua Backend Sharp
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    try {
      // Gửi ảnh gốc sang Backend để Sharp tự động cắt vuông 1:1 và nén WebP siêu nhẹ
      const res = await uploadImageFile(file);
      setFormData((prev) => ({ ...prev, imageUrl: res.url }));
      showToast('success', `Đã tối ưu ảnh trên máy chủ (${res.sizeKb} KB, vuông 800x800)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi xử lý ảnh, vui lòng thử lại';
      showToast('error', msg);
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Submit Lưu sản phẩm (Thêm hoặc Sửa)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('error', 'Vui lòng nhập tên sản phẩm');
      return;
    }

    setSubmitting(true);
    try {
      const finalCategory = customCategoryInput.trim() ? customCategoryInput.trim() : formData.category;
      const payload = {
        ...formData,
        category: finalCategory,
        name: formData.name.trim(),
        price: Number(formData.price) || 0,
        stock: Number(formData.stock) || 0,
        description: formData.description.trim(),
      };

      if (editingId) {
        // CẬP NHẬT
        await fetchApi(`/api/products/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('success', 'Đã cập nhật sản phẩm thành công!');
      } else {
        // THÊM MỚI
        await fetchApi('/api/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('success', 'Đã thêm sản phẩm mới thành công!');
      }

      setIsModalOpen(false);
      await loadProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi lưu sản phẩm';
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Xác nhận Xóa sản phẩm
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetchApi(`/api/products/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      showToast('success', `Đã xóa "${deleteTarget.name}"`);
      setDeleteTarget(null);
      await loadProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể xóa sản phẩm';
      showToast('error', msg);
    } finally {
      setDeleting(false);
    }
  };

  // Lọc sản phẩm
  const filteredProducts = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = selectedCategory === 'Tất cả' || p.category === selectedCategory;
    return matchSearch && matchCat;
  });

  // Format tiền tệ VNĐ
  const formatMoney = (val: number | string) => {
    const num = typeof val === 'string' ? Number(val.replace(/\D/g, '')) : val;
    if (isNaN(num)) return '0';
    return num.toLocaleString('vi-VN');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans pb-24">
      {/* Toast phản hồi nhanh */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[999] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <Check className="h-4 w-4 stroke-[3]" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {toast.text}
        </div>
      )}

      {/* Main Container */}
      <main className="mx-auto max-w-4xl px-4 pt-4 space-y-3.5">
        {/* Thanh tìm kiếm & Thống kê */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc nhóm món..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm font-medium shadow-2xs focus:border-emerald-500 outline-hidden dark:border-slate-800 dark:bg-slate-900"
              style={{ fontSize: '15px' }}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSyncFromPancake}
              disabled={syncingPos}
              title="Đọc kéo danh sách sản phẩm từ Pancake POS"
              className="h-11 px-3.5 rounded-xl border border-blue-200 bg-blue-50/90 hover:bg-blue-100 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition active:scale-95"
            >
              <RefreshCw className={`h-4 w-4 ${syncingPos ? 'animate-spin text-blue-600' : ''}`} />
              <span>{syncingPos ? 'Đang kéo...' : 'Kéo từ POS'}</span>
            </button>

            <button
              onClick={loadProducts}
              disabled={loading}
              title="Làm mới danh sách"
              className="h-11 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition active:scale-95"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
              <span className="hidden sm:inline">Tải lại</span>
            </button>

            <span className="h-11 px-3 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center">
              {filteredProducts.length} món
            </span>
          </div>
        </div>

        {/* Lọc nhanh theo nhóm sản phẩm (Horizontal chips) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {['Tất cả', ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* DANH SÁCH SẢN PHẨM (CARD LIST HIỆN ĐẠI CHO CẢ ĐIỆN THOẠI & MÁY TÍNH) */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-slate-200/90 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-3.5">
                  <div className="h-18 w-18 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-4 w-44 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-3.5 w-28 rounded bg-slate-200 dark:bg-slate-700" />
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <div className="h-10 w-16 rounded-xl bg-slate-200 dark:bg-slate-700" />
                    <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center dark:bg-emerald-950/40">
              <Package className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
              {searchTerm ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm nào'}
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              {searchTerm
                ? 'Thử tìm với tên hoặc nhóm khác.'
                : 'Bấm nút "Thêm sản phẩm" ở góc trên để tạo sản phẩm đầu tiên cho shop.'}
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-5 inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-sm hover:bg-emerald-500 transition"
            >
              <Plus className="h-4 w-4" />
              Thêm sản phẩm ngay
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                className="group rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs transition hover:border-slate-300 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center gap-3.5">
                  {/* Ảnh đại diện vuông 1:1 */}
                  <div
                    onClick={() => p.imageUrl && setPreviewImage(p.imageUrl)}
                    className="h-18 w-18 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200/80 dark:border-slate-700/80 cursor-pointer relative flex items-center justify-center"
                    title="Bấm để xem to ảnh"
                  >
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        loading="lazy"
                        decoding="async"
                        width={72}
                        height={72}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Package className="h-7 w-7 text-slate-400" />
                    )}
                  </div>

                  {/* Thông tin chính */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60">
                        {p.category || 'Mặc định'}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate mt-1">
                      {p.name}
                    </h3>

                    {p.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {p.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400">
                        {formatMoney(p.price)} đ
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Kho: <b className="text-slate-900 dark:text-white">{p.stock}</b> cái
                      </span>
                    </div>
                  </div>

                  {/* Cụm 2 nút Thao Tác (Sửa & Xóa) to bản dễ chạm bằng ngón tay */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(p)}
                      title="Chỉnh sửa sản phẩm"
                      className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 text-slate-700 text-xs font-bold flex items-center gap-1 active:scale-95 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Sửa</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
                      title="Xóa sản phẩm"
                      className="h-10 w-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-500 flex items-center justify-center active:scale-95 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL THÊM & CHỈNH SỬA SẢN PHẨM (TỐI ƯU CỰC KỲ DỄ DÙNG) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-5 duration-200">
            {/* iOS Sheet Drag Handle (cho điện thoại) */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800 shrink-0">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {editingId ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editingId ? 'Cập nhật lại giá, kho, ảnh hoặc tên' : 'Điền thông tin và lưu vào kho hàng'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center dark:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* PHẦN ẢNH SẢN PHẨM: Bấm vào là mở trực tiếp Thư viện ảnh / Camera trên điện thoại */}
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Camera className="h-4 w-4 text-emerald-600" />
                    Ảnh sản phẩm (Chọn từ điện thoại)
                  </label>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60">
                    Tự cắt vuông 800x800
                  </span>
                </div>

                {/* Ẩn input file thực tế */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="flex items-center gap-3">
                  {/* Khung ảnh vuông: Chạm vào là mở ngay thư viện ảnh */}
                  <div
                    onClick={() => !compressing && fileInputRef.current?.click()}
                    className="h-24 w-24 shrink-0 rounded-2xl border-2 border-dashed border-emerald-300 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden flex items-center justify-center relative cursor-pointer active:scale-95 transition shadow-2xs group"
                    title="Chạm để chọn hoặc đổi ảnh"
                  >
                    {compressing ? (
                      <div className="flex flex-col items-center justify-center p-2 text-center">
                        <RefreshCw className="h-6 w-6 animate-spin text-emerald-600 mb-1" />
                        <span className="text-[9px] font-bold text-emerald-600">Đang nén...</span>
                      </div>
                    ) : formData.imageUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={formData.imageUrl}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition">
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

                  {/* Nút thao tác to rõ cho ngón tay */}
                  <div className="flex-1 space-y-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={compressing}
                      className="w-full h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
                    >
                      <Camera className="h-4 w-4 stroke-[2.5]" />
                      <span>{formData.imageUrl ? 'Đổi ảnh khác từ máy' : 'Chọn ảnh / Chụp ảnh ngay'}</span>
                    </button>

                    {formData.imageUrl ? (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                          <Check className="h-3 w-3 stroke-[3]" /> Ảnh đã sẵn sàng
                        </span>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, imageUrl: '' })}
                          className="text-[11px] font-bold text-rose-500 hover:underline flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" /> Gỡ ảnh
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 leading-tight">
                        Chạm vào để mở Album ảnh trên điện thoại. Ảnh nặng mấy chục MB cũng tự được máy chủ nén nhẹ tênh!
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 1. TÊN SẢN PHẨM */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1">
                  Tên sản phẩm <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Lạp Xưởng Tôm Cai Lậy / Hồng Mật Fuji..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold shadow-2xs focus:border-emerald-500 outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  style={{ fontSize: '16px' }}
                />
              </div>

              {/* 2. NHÓM SẢN PHẨM */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Nhóm sản phẩm
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Đang chọn: <b className="text-emerald-600 dark:text-emerald-400">{customCategoryInput || formData.category}</b>
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {categories.map((cat) => {
                    const isSelected = formData.category === cat && !customCategoryInput;
                    return (
                      <div
                        key={cat}
                        onClick={() => {
                          setFormData({ ...formData, category: cat });
                          setCustomCategoryInput('');
                        }}
                        className={`h-8 pl-3 pr-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs select-none ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <span>{cat}</span>
                        {cat !== 'Mặc định' && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCategory(cat, e)}
                            title={`Xóa nhóm ${cat}`}
                            className={`h-4 w-4 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                              isSelected
                                ? 'bg-white/25 hover:bg-rose-500 hover:text-white text-white'
                                : 'bg-slate-200 hover:bg-rose-500 hover:text-white text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <X className="h-2.5 w-2.5 stroke-[3]" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Thêm nhóm mới tại modal */}
                <div className="pt-1">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Gõ tên nhóm mới cần thêm..."
                      value={newCategoryInput}
                      onChange={(e) => {
                        setNewCategoryInput(e.target.value);
                        setCustomCategoryInput(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCategory();
                        }
                      }}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-medium outline-hidden focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800"
                      style={{ fontSize: '14px' }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      disabled={!newCategoryInput.trim()}
                      className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shrink-0 shadow-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Thêm</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 pl-0.5 italic">
                    💡 Gõ tên và bấm <b>Thêm</b> (hoặc Enter) để tạo nhóm mới. Bấm <b>✕</b> để xóa nhóm.
                  </p>
                </div>
              </div>

              {/* 3 & 4. GIÁ BÁN & TỒN KHO */}
              <div className="grid grid-cols-2 gap-3">
                {/* Giá bán */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1">
                    Giá bán (VNĐ) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      placeholder="0"
                      value={formData.price ? formatMoney(formData.price) : ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setFormData({ ...formData, price: raw ? Number(raw) : 0 });
                      }}
                      className="w-full h-11 px-3.5 pr-8 rounded-xl border border-slate-300 bg-white text-base font-bold shadow-2xs focus:border-emerald-500 outline-hidden dark:border-slate-700 dark:bg-slate-800"
                      style={{ fontSize: '16px' }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      đ
                    </span>
                  </div>
                </div>

                {/* Tồn kho */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-1">
                    Tồn kho <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, stock: Math.max(0, formData.stock - 1) })
                      }
                      className="h-11 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold dark:bg-slate-800 dark:text-slate-200 active:scale-90"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={formData.stock}
                      onChange={(e) =>
                        setFormData({ ...formData, stock: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full h-11 text-center rounded-xl border border-slate-300 bg-white text-sm font-bold focus:border-emerald-500 outline-hidden dark:border-slate-700 dark:bg-slate-800"
                      style={{ fontSize: '16px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, stock: formData.stock + 1 })}
                      className="h-11 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold dark:bg-slate-800 dark:text-slate-200 active:scale-90"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* 5. MÔ TẢ */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Mô tả sản phẩm
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.name) {
                        setFormData({
                          ...formData,
                          description: `${formData.name} tươi sạch đặc sản Cẩm Tuyền House, đóng gói kỹ càng, giao hàng nhanh toàn quốc.`,
                        });
                      }
                    }}
                    className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    Gợi ý câu mô tả
                  </button>
                </div>
                <textarea
                  rows={2}
                  placeholder="Ghi chú quy cách đóng gói (VD: Hút chân không 1KG, quả giòn ngọt...)"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-300 bg-white text-sm font-medium shadow-2xs focus:border-emerald-500 outline-hidden dark:border-slate-700 dark:bg-slate-800 resize-none"
                  style={{ fontSize: '15px' }}
                />
              </div>

              {/* Nút hành động */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-12 flex-1 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-12 flex-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 stroke-[3]" />
                  )}
                  <span>{editingId ? 'Lưu cập nhật' : 'Thêm vào kho hàng'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP PHÓNG TO ẢNH KHI BẤM VÀO ẢNH BẤT KỲ */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-pointer"
        >
          <div className="relative max-w-sm w-full bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewImage} alt="Large preview" className="w-full aspect-square object-cover rounded-2xl" />
            <div className="text-center py-2 text-xs font-semibold text-slate-500">Chạm để đóng</div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA SẢN PHẨM */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Xóa món này khỏi kho?
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Bạn có chắc chắn muốn xóa{' '}
              <b className="text-slate-900 dark:text-white">"{deleteTarget.name}"</b>? Thao tác này sẽ xóa món này khỏi danh sách.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="h-10 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm active:scale-95 disabled:opacity-50"
              >
                {deleting ? 'Đang xóa...' : 'Xóa ngay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
