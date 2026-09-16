import { z } from 'zod';

export const OrderStatusEnum = z.enum([
  'PENDING',
  'CONFIRMED',
  'SHIPPING',
  'COMPLETED',
  'CANCELLED',
]);

export const PaymentStatusEnum = z.enum(['UNPAID', 'PAID']);

export const orderItemInputSchema = z.object({
  productId: z.string().optional().nullable(),
  productName: z.string().min(1, 'Tên món không được để trống'),
  productImage: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(1, 'Số lượng tối thiểu là 1'),
  price: z.coerce.number().min(0, 'Đơn giá không được âm'),
});

export const createOrderSchema = z.object({
  customerName: z.string().min(1, 'Tên khách hàng không được để trống'),
  customerPhone: z.string().optional().nullable(),
  customerAddress: z.string().optional().nullable(),
  customerNote: z.string().optional().nullable(),
  paymentMethod: z.string().optional().default('COD'),
  shippingFee: z.coerce.number().min(0).optional().default(0),
  discount: z.coerce.number().min(0).optional().default(0),
  items: z.array(orderItemInputSchema).min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm'),
  pancakeOrderId: z.string().optional().nullable(),
  source: z.string().optional().default('MESSENGER'),
});

export const updateOrderStatusSchema = z.object({
  status: OrderStatusEnum,
  paymentStatus: PaymentStatusEnum.optional(),
});

export const orderQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  date: z.string().optional(),
  month: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  phone: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const orderLookupSchema = z.object({
  phone: z.string().min(8, 'Số điện thoại cần có ít nhất 8 chữ số'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type OrderQueryInput = z.infer<typeof orderQuerySchema>;
export type OrderLookupInput = z.infer<typeof orderLookupSchema>;

