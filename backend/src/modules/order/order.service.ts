import { prisma, checkDbAvailability, ensureAccountExists } from '../../lib/prisma.js';
import { getAccountId } from '../../lib/context.js';
import { env } from '../../config/env.js';
import { CreateOrderInput, OrderQueryInput, UpdateOrderStatusInput } from './order.schema.js';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

export interface InMemoryOrderItem {
  id?: string;
  orderId?: string;
  productId?: string | null;
  productName: string;
  productImage?: string | null;
  quantity: number;
  price: number;
  total: number;
}

export interface InMemoryOrder {
  id: string;
  accountId: string;
  code: string;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerNote?: string | null;
  paymentMethod: string;
  shippingFee: number;
  discount: number;
  subtotal: number;
  totalAmount: number;
  pancakeOrderId?: string | null;
  source: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  items: InMemoryOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PancakeRawVariationInfo {
  name?: string;
  retail_price?: number;
  images?: string[];
}

export interface PancakeRawItem {
  id?: string | number;
  product_name?: string;
  name?: string;
  avatar_url?: string;
  image_url?: string;
  quantity?: number;
  price?: number;
  retail_price?: number;
  variation_info?: PancakeRawVariationInfo;
}

export interface PancakeRawCustomer {
  name?: string;
  phone_number?: string;
  phone_numbers?: string[];
  address?: string;
  shop_customer_addresses?: Array<{ full_address?: string }>;
}

export interface PancakeRawOrder {
  id?: string | number;
  order_id?: string | number;
  bill_full_name?: string;
  customer?: PancakeRawCustomer;
  shipping_address?: { full_name?: string; phone_number?: string; full_address?: string; address?: string };
  bill_phone_number?: string;
  customer_note?: string;
  note?: string;
  items?: PancakeRawItem[];
  order_items?: PancakeRawItem[];
  variations?: PancakeRawItem[];
  shipping_fee?: number;
  discount?: number;
  bill_code?: string;
  status?: string | number;
  is_paid?: boolean;
  total_price?: number;
  total_price_after_sub_discount?: number;
}

export interface PancakeOrdersApiResponse {
  data?: PancakeRawOrder[];
  orders?: PancakeRawOrder[];
}


/**
 * Tính toán an toàn lại toàn bộ giá trị đơn hàng trên Backend
 */
function calculateOrderTotals(
  items: Array<{ quantity: number; price: number }>,
  shippingFee = 0,
  discount = 0
) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const totalAmount = Math.max(0, subtotal + shippingFee - discount);
  return { subtotal, totalAmount };
}

// Danh sách đơn hàng lưu trữ bộ nhớ khi chưa có DB
let inMemoryOrders: InMemoryOrder[] = [];

export function clearMockOrders() {
  inMemoryOrders = [];
  return inMemoryOrders;
}

function parseDateFilter(
  dateStr?: string,
  monthStr?: string,
  startDateStr?: string,
  endDateStr?: string
): { start?: Date; end?: Date } | null {
  if (dateStr?.trim()) {
    const d = dateStr.trim();
    const start = new Date(`${d}T00:00:00.000+07:00`);
    const end = new Date(`${d}T23:59:59.999+07:00`);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return { start, end };
    }
  }

  if (monthStr?.trim()) {
    const parts = monthStr.trim().split('-');
    if (parts.length === 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
        const start = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000+07:00`);
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const end = new Date(
          new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000+07:00`).getTime() - 1
        );
        return { start, end };
      }
    }
  }

  if (startDateStr?.trim() || endDateStr?.trim()) {
    const start = startDateStr?.trim() ? new Date(`${startDateStr.trim()}T00:00:00.000+07:00`) : undefined;
    const end = endDateStr?.trim() ? new Date(`${endDateStr.trim()}T23:59:59.999+07:00`) : undefined;
    return { start, end };
  }

  return null;
}

/**
 * Lấy danh sách đơn hàng (kèm bộ lọc trạng thái, tìm kiếm, ngày/tháng, thống kê)
 */
export async function listOrders(query: OrderQueryInput) {
  const accountId = getAccountId();
  const page = query.page || 1;
  const limit = query.limit || 50;
  const skip = (page - 1) * limit;
  const dateRange = parseDateFilter(query.date, query.month, query.startDate, query.endDate);

  try {
    const whereClause: Prisma.OrderWhereInput = { accountId };

    if (query.status && query.status !== 'ALL') {
      whereClause.status = query.status as OrderStatus;
    }

    if (query.phone?.trim()) {
      whereClause.customerPhone = { contains: query.phone.trim(), mode: 'insensitive' };
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      whereClause.OR = [
        { code: { contains: term, mode: 'insensitive' } },
        { customerName: { contains: term, mode: 'insensitive' } },
        { customerPhone: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (dateRange) {
      whereClause.createdAt = {};
      if (dateRange.start) whereClause.createdAt.gte = dateRange.start;
      if (dateRange.end) whereClause.createdAt.lte = dateRange.end;
    }

    const [total, orders, pendingCount, revenueAgg] = await Promise.all([
      prisma.order.count({ where: whereClause }),
      prisma.order.findMany({
        where: whereClause,
        include: {
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({
        where: { accountId, status: 'PENDING' },
      }),
      prisma.order.aggregate({
        where: { accountId, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true },
      }),
    ]);

    const totalRevenue = Number(revenueAgg._sum.totalAmount ?? 0);

    return {
      items: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      metrics: {
        pendingOrders: pendingCount,
        totalRevenue,
      },
    };
  } catch (_e) {
    console.warn('⚠️ CSDL chưa kết nối, sử dụng bộ nhớ dự phòng In-memory cho Đơn hàng.');

    // Nếu bộ nhớ đơn trống và đã cấu hình Pancake, tự động nạp đơn hàng thật về
    if (inMemoryOrders.length === 0 && env.PANCAKE_SHOP_ID && env.PANCAKE_API_TOKEN) {
      try {
        await syncOrdersFromPancake();
      } catch (syncErr) {
        console.warn('⚠️ Lỗi tự động kéo đơn thực từ Pancake POS:', syncErr);
      }
    }

    let filtered = inMemoryOrders.filter((o) => o.accountId === accountId || o.accountId === 'acc_default');

    if (query.status && query.status !== 'ALL') {
      filtered = filtered.filter((o) => o.status === query.status);
    }

    if (query.phone?.trim()) {
      const p = query.phone.trim();
      filtered = filtered.filter((o) => o.customerPhone && o.customerPhone.includes(p));
    }

    if (query.search?.trim()) {
      const t = query.search.trim().toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.code.toLowerCase().includes(t) ||
          o.customerName.toLowerCase().includes(t) ||
          (o.customerPhone && o.customerPhone.includes(t))
      );
    }

    if (dateRange) {
      filtered = filtered.filter((o) => {
        const orderTime = new Date(o.createdAt).getTime();
        if (dateRange.start && orderTime < dateRange.start.getTime()) return false;
        if (dateRange.end && orderTime > dateRange.end.getTime()) return false;
        return true;
      });
    }

    const pendingCount = inMemoryOrders.filter((o) => o.status === 'PENDING').length;
    const totalRevenue = inMemoryOrders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((s, o) => s + Number(o.totalAmount), 0);

    return {
      items: filtered,
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: 1,
      },
      metrics: {
        pendingOrders: pendingCount,
        totalRevenue,
      },
    };
  }
}

/**
 * Tra cứu danh sách đơn hàng theo số điện thoại (phục vụ khách tra cứu bill cá nhân)
 */
export async function lookupOrdersByPhone(phone: string) {
  const cleanPhone = phone.trim();
  const digitsOnly = cleanPhone.replace(/\D/g, '');
  const accountId = getAccountId();

  try {
    const orders = await prisma.order.findMany({
      where: {
        accountId,
        customerPhone: { contains: cleanPhone },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      phone: cleanPhone,
      totalOrders: orders.length,
      orders,
    };
  } catch (_e) {
    const filtered = inMemoryOrders.filter(
      (o) =>
        (o.accountId === accountId || o.accountId === 'acc_default') &&
        o.customerPhone &&
        (o.customerPhone.includes(cleanPhone) ||
          (digitsOnly.length >= 8 && o.customerPhone.replace(/\D/g, '').includes(digitsOnly)))
    );

    return {
      phone: cleanPhone,
      totalOrders: filtered.length,
      orders: filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    };
  }
}

/**
 * Lấy chi tiết một hóa đơn theo ID
 */
export async function getOrderById(id: string) {
  const accountId = getAccountId();

  try {
    const order = await prisma.order.findFirst({
      where: { id, accountId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (order) return order;
  } catch (_e) {}

  const mem = inMemoryOrders.find((o) => o.id === id);
  if (!mem) {
    throw new Error('Không tìm thấy đơn hàng / hóa đơn này');
  }

  return mem;
}

/**
 * Tạo mới đơn hàng (Chủ shop tạo trực tiếp hoặc qua giỏ hàng)
 */
export async function createOrder(data: CreateOrderInput) {
  const accountId = getAccountId();

  // BẢO MẬT: Không tin tưởng giá gửi từ client. Đối chiếu với CSDL nếu có productId
  let verifiedItems = data.items.map((it) => ({
    productId: it.productId || null,
    productName: it.productName,
    productImage: it.productImage || null,
    quantity: it.quantity,
    price: it.price,
    total: it.quantity * it.price,
  }));

  const productIds = data.items
    .map((i) => i.productId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  if (productIds.length > 0) {
    try {
      const dbProducts = await prisma.product.findMany({
        where: { id: { in: productIds }, accountId },
        select: { id: true, price: true, name: true, imageUrl: true },
      });
      const prodMap = new Map(dbProducts.map((p) => [p.id, p]));

      verifiedItems = data.items.map((item) => {
        if (item.productId && prodMap.has(item.productId)) {
          const p = prodMap.get(item.productId)!;
          const officialPrice = Number(p.price);
          return {
            productId: item.productId,
            productName: item.productName || p.name,
            productImage: item.productImage || p.imageUrl,
            quantity: item.quantity,
            price: officialPrice,
            total: item.quantity * officialPrice,
          };
        }
        return {
          productId: item.productId || null,
          productName: item.productName,
          productImage: item.productImage || null,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price,
        };
      });
    } catch (_dbErr) {
      // Fallback nếu DB offline
    }
  }

  // Tái tính toán an toàn từ các item đã xác thực
  const { subtotal, totalAmount } = calculateOrderTotals(
    verifiedItems,
    data.shippingFee,
    data.discount
  );

  const code = `DH-${Date.now().toString().slice(-6)}`;
  const isDbReady = await checkDbAvailability();

  if (isDbReady) {
    try {
      await ensureAccountExists(accountId);

      const order = await prisma.order.create({
        data: {
          accountId,
          code,
          customerName: data.customerName,
          customerPhone: data.customerPhone || null,
          customerAddress: data.customerAddress || null,
          customerNote: data.customerNote || null,
          paymentMethod: data.paymentMethod || 'COD',
          shippingFee: data.shippingFee || 0,
          discount: data.discount || 0,
          subtotal,
          totalAmount,
          pancakeOrderId: data.pancakeOrderId || null,
          source: data.source || 'MESSENGER',
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          items: {
            create: verifiedItems.map((it) => ({
              productId: it.productId,
              productName: it.productName,
              productImage: it.productImage,
              quantity: it.quantity,
              price: it.price,
              total: it.total,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      return order;
    } catch (_e) {
      // Fall through to in-memory fallback
    }
  }


  const newOrd = {
      id: `ord_${Date.now()}`,
      accountId,
      code,
      customerName: data.customerName,
      customerPhone: data.customerPhone || null,
      customerAddress: data.customerAddress || null,
      customerNote: data.customerNote || null,
      paymentMethod: data.paymentMethod || 'COD',
      shippingFee: data.shippingFee || 0,
      discount: data.discount || 0,
      subtotal,
      totalAmount,
      pancakeOrderId: data.pancakeOrderId || null,
      source: data.source || 'MESSENGER',
      status: 'PENDING' as OrderStatus,
      paymentStatus: 'UNPAID' as PaymentStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: data.items.map((it, idx) => ({
        id: `item_${Date.now()}_${idx}`,
        orderId: `ord_${Date.now()}`,
        productName: it.productName,
        productImage: it.productImage || null,
        quantity: it.quantity,
        price: it.price,
        total: it.quantity * it.price,
      })),
    };
    inMemoryOrders.unshift(newOrd);
    return newOrd;
  }

/**
 * Cập nhật trạng thái đơn hàng (Duyệt, Giao, Hoàn thành, Hủy)
 */
export async function updateOrderStatus(id: string, data: UpdateOrderStatusInput) {
  const accountId = getAccountId();

  try {
    const existing = await prisma.order.findFirst({
      where: { id, accountId },
    });

    if (existing) {
      return await prisma.order.update({
        where: { id, accountId },
        data: {
          status: data.status,
          ...(data.paymentStatus && { paymentStatus: data.paymentStatus }),
        },
        include: {
          items: true,
        },
      });
    }
  } catch (_e) {}

  const mem = inMemoryOrders.find((o) => o.id === id);
  if (!mem) {
    throw new Error('Đơn hàng không tồn tại');
  }

  mem.status = data.status;
  if (data.paymentStatus) {
    mem.paymentStatus = data.paymentStatus;
  }
  mem.updatedAt = new Date().toISOString();
  return mem;
}

/**
 * Tiếp nhận đơn hàng từ Pancake POS (qua Webhook hoặc kéo API)
 * Xử lý IDEMPOTENCY: Nếu đơn đã có pancakeOrderId trong CSDL thì cập nhật chứ không sinh đơn trùng
 */
export async function ingestPancakeOrder(rawOrder: PancakeRawOrder) {
  const accountId = getAccountId();

  if (!rawOrder) return null;

  const pancakeOrderId = String(rawOrder.id || rawOrder.order_id || '');
  if (!pancakeOrderId) return null;

  // Lấy thông tin khách hàng
  const customerName =
    rawOrder.bill_full_name ||
    rawOrder.customer?.name ||
    rawOrder.shipping_address?.full_name ||
    'Khách hàng Messenger';
  const customerPhone =
    rawOrder.bill_phone_number ||
    (rawOrder.customer?.phone_numbers && rawOrder.customer.phone_numbers[0]) ||
    rawOrder.customer?.phone_number ||
    rawOrder.shipping_address?.phone_number ||
    null;
  const customerAddress =
    rawOrder.shipping_address?.full_address ||
    (rawOrder.customer?.shop_customer_addresses && rawOrder.customer.shop_customer_addresses[0]?.full_address) ||
    rawOrder.shipping_address?.address ||
    rawOrder.customer?.address ||
    null;
  const customerNote = rawOrder.customer_note || rawOrder.note || null;

  // Lấy danh sách mặt hàng
  const rawItems: PancakeRawItem[] = rawOrder.items || rawOrder.order_items || rawOrder.variations || [];
  const items: InMemoryOrderItem[] = rawItems.map((item: PancakeRawItem) => {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const varInfo = item.variation_info || {};
    const price = Number(item.price || item.retail_price || varInfo.retail_price || 0);
    const productName = item.product_name || item.name || varInfo.name || 'Sản phẩm';
    const productImage = item.avatar_url || item.image_url || (varInfo.images && varInfo.images[0]) || null;
    return {
      productName,
      productImage,
      quantity,
      price,
      total: quantity * price,
    };
  });

  const shippingFee = Number(rawOrder.shipping_fee || 0);
  const discount = Number(rawOrder.discount || 0);
  const { subtotal } = calculateOrderTotals(items, shippingFee, discount);
  const totalAmount = Number(rawOrder.total_price ?? rawOrder.total_price_after_sub_discount ?? Math.max(0, subtotal + shippingFee - discount));


  const code = rawOrder.bill_code || (rawOrder.id ? `POS-${rawOrder.id}` : `POS-${pancakeOrderId.slice(-6)}`);

  // Ánh xạ trạng thái
  let status: OrderStatus = 'PENDING';
  const rawStatus = String(rawOrder.status || '').toLowerCase();
  if (rawStatus.includes('confirm') || rawStatus.includes('xac_nhan')) {
    status = 'CONFIRMED';
  } else if (rawStatus.includes('shipping') || rawStatus.includes('dang_giao')) {
    status = 'SHIPPING';
  } else if (rawStatus.includes('complete') || rawStatus.includes('thanh_cong')) {
    status = 'COMPLETED';
  } else if (rawStatus.includes('cancel') || rawStatus.includes('huy')) {
    status = 'CANCELLED';
  }

  const isDbReady = await checkDbAvailability();

  if (isDbReady) {
    try {
      const existing = await prisma.order.findFirst({
        where: { pancakeOrderId, accountId },
        include: { items: true },
      });

      if (existing) {
        return await prisma.order.update({
          where: { id: existing.id },
          data: {
            status,
            customerName,
            customerPhone,
            customerAddress,
            customerNote,
            shippingFee,
            discount,
            subtotal,
            totalAmount,
          },
          include: { items: true },
        });
      }

      return await prisma.order.create({
        data: {
          accountId,
          code,
          pancakeOrderId,
          customerName,
          customerPhone,
          customerAddress,
          customerNote,
          source: 'MESSENGER_POS',
          status,
          paymentStatus: rawOrder.is_paid ? 'PAID' : 'UNPAID',
          paymentMethod: 'COD',
          shippingFee,
          discount,
          subtotal,
          totalAmount,
          items: {
            create: items.map((it: InMemoryOrderItem) => ({
              productName: it.productName,
              productImage: it.productImage,
              quantity: it.quantity,
              price: it.price,
              total: it.total,
            })),
          },
        },
        include: { items: true },
      });
    } catch (_e) {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const existingMem = inMemoryOrders.find(
    (o) => o.pancakeOrderId === pancakeOrderId && o.accountId === accountId
  );

  if (existingMem) {
    existingMem.status = status;
    existingMem.customerName = customerName;
    existingMem.customerPhone = customerPhone;
    existingMem.customerAddress = customerAddress;
    existingMem.customerNote = customerNote;
    existingMem.totalAmount = totalAmount;
    existingMem.updatedAt = new Date().toISOString();
    return existingMem;
  }

  const newMemOrder: InMemoryOrder = {
    id: `ord_pos_${Date.now()}`,
    accountId,
    code,
    pancakeOrderId,
    customerName,
    customerPhone,
    customerAddress,
    customerNote,
    source: 'MESSENGER_POS',
    status,
    paymentStatus: rawOrder.is_paid ? 'PAID' : 'UNPAID',
    paymentMethod: 'COD',
    shippingFee,
    discount,
    subtotal,
    totalAmount,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: items.map((it: InMemoryOrderItem, idx: number) => ({
      id: `item_pos_${Date.now()}_${idx}`,
      orderId: `ord_pos_${Date.now()}`,
      productName: it.productName,
      productImage: it.productImage,
      quantity: it.quantity,
      price: it.price,
      total: it.total,
    })),
  };
  inMemoryOrders.unshift(newMemOrder);
  return newMemOrder;
}

/**
 * Kéo đơn hàng mới nhất trực tiếp từ Pancake POS API
 */
export async function syncOrdersFromPancake() {
  const shopId = env.PANCAKE_SHOP_ID;
  const token = env.PANCAKE_API_TOKEN;

  if (!shopId || !token) {
    return {
      success: false,
      totalFetched: 0,
      syncedCount: 0,
      message: 'Chưa cấu hình PANCAKE_SHOP_ID hoặc PANCAKE_API_TOKEN trong .env',
    };
  }

  const url = `https://pos.pancake.vn/api/v1/shops/${shopId}/orders?api_key=${token}&page_size=30`;

  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Lỗi kết nối Pancake POS: ${response.statusText}`);
  }

  const result = (await response.json()) as PancakeOrdersApiResponse;
  const rawOrders: PancakeRawOrder[] = result.data || result.orders || [];

  let syncedCount = 0;
  for (const raw of rawOrders) {
    try {
      await ingestPancakeOrder(raw);
      syncedCount++;
    } catch (e) {
      console.warn('⚠️ Lỗi khi nạp đơn từ Pancake:', e);
    }
  }

  return {
    success: true,
    totalFetched: rawOrders.length,
    syncedCount,
    message: `Đã đồng bộ thành công ${syncedCount} đơn hàng từ Pancake POS`,
  };
}
