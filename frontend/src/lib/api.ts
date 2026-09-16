const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const ACCOUNT_ID = process.env.NEXT_PUBLIC_ACCOUNT_ID || 'acc_default';

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-account-id': ACCOUNT_ID,
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg =
      data.message ||
      (Array.isArray(data.errors)
        ? data.errors.map((e: { message?: string }) => e.message || 'Lỗi không xác định').join(', ')
        : 'Lỗi kết nối máy chủ');
    throw new Error(errorMsg);
  }


  return data;
}

/**
 * Gửi ảnh từ điện thoại lên Backend để Sharp tự động cắt vuông 1:1 và nén WebP tối ưu
 */
export async function uploadImageFile(file: File): Promise<{ url: string; relativeUrl: string; sizeKb: string }> {
  const url = `${BASE_URL}/api/upload`;
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-account-id': ACCOUNT_ID,
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Lỗi khi tải và tối ưu ảnh trên máy chủ');
  }

  return data;
}
