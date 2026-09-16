import { env } from '../../config/env.js';

export interface SyncProductToPancakeInput {
  name: string;
  sku?: string;
  category?: string;
  price: number;
  costPrice?: number;
  stock: number;
  imageUrl?: string;
  description?: string;
}

export interface PancakeSyncResult {
  pancakeProductId: string;
  pancakeVariationId: string;
}

/**
 * Hàm gọi API với cơ chế Retry & Timeout an toàn (Circuit Breaker pattern)
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = 2, timeoutMs = 8000): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok || i === retries) return res;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (i === retries) throw err;
      // Chờ tăng dần theo lũy thừa: 500ms, 1000ms
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw new Error('Đã thử gọi API Pancake POS nhiều lần nhưng không thành công');
}

export interface PancakeVariation {
  id?: string | number;
  name?: string;
  title?: string;
  sku?: string;
  display_id?: string;
  custom_id?: string;
  retail_price?: number;
  price_at_counter?: number;
  original_price?: number;
  remain_quantity?: number;
  total_quantity?: number;
  stock?: number;
  images?: string[];
  image?: string;
  warehouse_stocks?: Array<{ warehouse_id: number; quantity: number }>;
}

export interface PancakeRawProduct {
  id?: string | number;
  name?: string;
  title?: string;
  description?: string;
  note_product?: string;
  category_name?: string;
  category?: { name?: string };
  categories?: Array<{ name?: string }>;
  display_id?: string;
  sku?: string;
  retail_price?: number;
  price?: number;
  stock?: number;
  image?: string;
  images?: string[];
  variations?: PancakeVariation[];
}


export interface PancakePushResponse {
  message?: string;
  product?: {
    id?: string | number;
    variations?: Array<{ id?: string | number }>;
  };
}

export interface PancakeProductListApiResponse {
  data?: PancakeRawProduct[];
  products?: PancakeRawProduct[];
}

/**
 * Đẩy tạo sản phẩm mới sang Pancake POS
 */
export async function pushProductToPancake(product: SyncProductToPancakeInput): Promise<PancakeSyncResult> {
  const shopId = env.PANCAKE_SHOP_ID;
  const token = env.PANCAKE_API_TOKEN;
  const warehouseId = env.PANCAKE_WAREHOUSE_ID;

  if (!shopId || !token) {
    throw new Error('Chưa cấu hình PANCAKE_SHOP_ID hoặc PANCAKE_API_TOKEN trong file .env');
  }

  const endpoint = `https://pos.pancake.vn/api/v1/shops/${shopId}/products`;
  const sku = product.sku || `CTH-${Date.now().toString().slice(-6)}`;

  // Chỉ gửi mảng ảnh nếu là URL trực tuyến (http/https), nếu là base64 thì lưu cục bộ
  const validImages: string[] = [];
  if (product.imageUrl && (product.imageUrl.startsWith('http://') || product.imageUrl.startsWith('https://'))) {
    validImages.push(product.imageUrl);
  }

  const payload = {
    product: {
      name: product.name,
      description: product.description || product.name,
      images: validImages,
      category_name: product.category || 'Mặc định',
      variations: [
        {
          sku: sku,
          retail_price: product.price,
          original_price: product.costPrice || product.price,
          warehouse_stocks: warehouseId
            ? [
                {
                  warehouse_id: isNaN(Number(warehouseId)) ? warehouseId : Number(warehouseId),
                  quantity: product.stock,
                },
              ]
            : [],
        },
      ],
    },
  };

  const response = await fetchWithRetry(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const responseData = (await response.json()) as PancakePushResponse;

  if (!response.ok) {
    const errorDetail = responseData?.message || JSON.stringify(responseData);
    throw new Error(`Pancake POS API Error: ${errorDetail}`);
  }

  const pancakeProductId = responseData?.product?.id?.toString() || '';
  const pancakeVariationId = responseData?.product?.variations?.[0]?.id?.toString() || '';

  return {
    pancakeProductId,
    pancakeVariationId,
  };
}

/**
 * Cập nhật thông tin / giá / tồn kho của sản phẩm đã liên kết trên Pancake POS
 */
export async function updateProductOnPancake(
  pancakeProductId: string,
  pancakeVariationId: string | undefined,
  product: Partial<SyncProductToPancakeInput>
): Promise<boolean> {
  const shopId = env.PANCAKE_SHOP_ID;
  const token = env.PANCAKE_API_TOKEN;
  const warehouseId = env.PANCAKE_WAREHOUSE_ID;

  if (!shopId || !token || !pancakeProductId) {
    console.warn('⚠️ Thiếu thông tin kết nối Pancake POS hoặc thiếu pancakeProductId:', { shopId, pancakeProductId });
    return false;
  }

  try {
    const endpoint = `https://pos.pancake.vn/api/v1/shops/${shopId}/products/${pancakeProductId}?api_key=${token}`;

    const updateProductData: Record<string, unknown> = {
      ...(product.name && { name: product.name }),
      ...(product.description !== undefined && {
        note_product: product.description,
        description: product.description,
      }),
    };

    // Nếu có biến thể & giá/kho cập nhật
    if (pancakeVariationId && (product.price !== undefined || product.stock !== undefined)) {
      updateProductData.variations = [
        {
          id: pancakeVariationId,
          ...(product.price !== undefined && {
            retail_price: product.price,
            retail_price_after_discount: product.price,
          }),
          ...(product.stock !== undefined && warehouseId && {
            variations_warehouses: [
              {
                warehouse_id: isNaN(Number(warehouseId)) ? warehouseId : Number(warehouseId),
                remain_quantity: product.stock,
              },
            ],
          }),
        },
      ];
    }

    const payload = {
      product: updateProductData,
    };

    console.log(`📤 [Pancake POS] Đang cập nhật sản phẩm ${pancakeProductId}:`, JSON.stringify(payload));

    const response = await fetchWithRetry(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const resJson = await response.json();
    console.log(`📥 [Pancake POS] Kết quả cập nhật (${response.status}):`, JSON.stringify(resJson).slice(0, 200));

    // Nếu có cập nhật tồn kho, gọi thêm endpoint chuyên dụng update_quantity của Pancake để đảm bảo 100% ăn vào kho POS
    if (pancakeVariationId && product.stock !== undefined && warehouseId) {
      try {
        const stockEndpoint = `https://pos.pancake.vn/api/v1/shops/${shopId}/variations/${pancakeVariationId}/update_quantity?api_key=${token}`;
        const stockPayload = {
          variations_warehouses: [
            {
              warehouse_id: isNaN(Number(warehouseId)) ? warehouseId : Number(warehouseId),
              remain_quantity: product.stock,
            },
          ],
        };
        const stockRes = await fetchWithRetry(stockEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(stockPayload),
        });
        const stockJson = await stockRes.json();
        console.log(`✅ [Pancake POS] Đã cập nhật tồn kho biến thể ${pancakeVariationId} thành ${product.stock}:`, stockJson);
      } catch (stockErr) {
        console.warn('⚠️ Lỗi gọi update_quantity bổ trợ:', stockErr);
      }
    }

    return response.ok;
  } catch (err) {
    console.warn('⚠️ Lỗi cập nhật sang Pancake POS:', err);
    return false;
  }
}

/**
 * Đọc (kéo) danh sách sản phẩm từ Pancake POS về hệ thống
 */
export async function pullProductsFromPancake(): Promise<PancakeRawProduct[]> {
  const shopId = env.PANCAKE_SHOP_ID;
  const token = env.PANCAKE_API_TOKEN;

  if (!shopId || !token) {
    throw new Error('Chưa cấu hình PANCAKE_SHOP_ID hoặc PANCAKE_API_TOKEN trong .env');
  }

  // Hỗ trợ cả 2 dạng truyền auth: qua query param api_key và qua Header Bearer
  const endpoint = `https://pos.pancake.vn/api/v1/shops/${shopId}/products?api_key=${token}&page_size=50`;

  const response = await fetchWithRetry(endpoint, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lỗi kết nối Pancake POS (${response.status}): ${errorText}`);
  }

  const resJson = (await response.json()) as PancakeProductListApiResponse;
  // Pancake có thể trả data dạng { data: [...] } hoặc { products: [...] }
  return resJson.data || resJson.products || [];
}

export interface ConfigureWebhookInput {
  webhookUrl: string;
  webhookEmail?: string;
  webhookTypes?: string[];
  apiKeyHeader?: string;
}

/**
 * Cấu hình Webhook Pancake POS theo chuẩn OpenAPI 3.1 (PUT /shops/{SHOP_ID})
 * Docs: https://docs.pancake.biz/pos/api/#tag/webhook/put/shopsshop_id
 */
export async function configurePancakeWebhook(input: ConfigureWebhookInput) {
  const shopId = env.PANCAKE_SHOP_ID;
  const token = env.PANCAKE_API_TOKEN;

  if (!shopId || !token) {
    throw new Error('Chưa cấu hình PANCAKE_SHOP_ID hoặc PANCAKE_API_TOKEN trong .env');
  }

  const endpoint = `https://pos.pancake.vn/api/v1/shops/${shopId}?api_key=${token}`;

  const payload = {
    shop: {
      webhook_enable: true,
      webhook_url: input.webhookUrl,
      webhook_email: input.webhookEmail || 'support@camtuyen.vn',
      webhook_types: input.webhookTypes || ['orders', 'products', 'variations_warehouses'],
      webhook_partner: '',
      ...(input.apiKeyHeader
        ? {
            webhook_headers: {
              'X-API-KEY': input.apiKeyHeader,
            },
          }
        : {}),
    },
  };

  const response = await fetchWithRetry(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const resJson = await response.json();
  if (!response.ok) {
    throw new Error(`Lỗi cấu hình Webhook Pancake (${response.status}): ${JSON.stringify(resJson)}`);
  }

  return resJson;
}

/**
 * Lấy thông tin Shop và trạng thái cấu hình từ Pancake POS
 */
export async function getPancakeShopInfo() {
  const shopId = env.PANCAKE_SHOP_ID;
  const token = env.PANCAKE_API_TOKEN;

  if (!shopId || !token) {
    return { configured: false, error: 'Chưa cấu hình PANCAKE_SHOP_ID hoặc PANCAKE_API_TOKEN' };
  }

  const endpoint = `https://pos.pancake.vn/api/v1/shops/${shopId}?api_key=${token}`;
  try {
    const res = await fetchWithRetry(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return { configured: true, ok: false, status: res.status };
    }
    const data = await res.json();
    return { configured: true, ok: true, data };
  } catch (err: unknown) {
    return { configured: true, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
