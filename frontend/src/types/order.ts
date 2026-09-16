export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SHIPPING'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus = 'UNPAID' | 'PAID';

export interface OrderItem {
  id: string;
  orderId: string;
  productId?: string | null;
  productName: string;
  productImage?: string | null;
  quantity: number;
  price: number | string;
  total: number | string;
  createdAt?: string;
}

export interface Order {
  id: string;
  accountId: string;
  code: string;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerNote?: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string | null;
  subtotal: number | string;
  shippingFee: number | string;
  discount: number | string;
  totalAmount: number | string;
  pancakeOrderId?: string | null;
  source: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderListResponse {
  success: boolean;
  items: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  metrics: {
    pendingOrders: number;
    totalRevenue: number;
  };
}

export interface OrderLookupResponse {
  success: boolean;
  phone: string;
  totalOrders: number;
  orders: Order[];
}

export type TimeFilterType = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

