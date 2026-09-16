import { Request, Response, NextFunction } from 'express';
import {
  listOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  syncOrdersFromPancake,
  lookupOrdersByPhone,
} from './order.service.js';
import {
  createOrderSchema,
  updateOrderStatusSchema,
  orderQuerySchema,
  orderLookupSchema,
} from './order.schema.js';



export async function getOrdersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const query = orderQuerySchema.parse(req.query);
    const result = await listOrders(query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getOrderByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const order = await getOrderById(id);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function createOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createOrderSchema.parse(req.body);
    const order = await createOrder(data);
    res.status(201).json({
      success: true,
      data: order,
      message: 'Tạo đơn hàng thành công',
    });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data = updateOrderStatusSchema.parse(req.body);
    const order = await updateOrderStatus(id, data);
    res.json({
      success: true,
      data: order,
      message: 'Cập nhật trạng thái đơn hàng thành công',
    });
  } catch (err) {
    next(err);
  }
}

export async function syncPancakeOrdersHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await syncOrdersFromPancake();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function lookupOrdersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone } = orderLookupSchema.parse(req.query);
    const result = await lookupOrdersByPhone(phone);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

