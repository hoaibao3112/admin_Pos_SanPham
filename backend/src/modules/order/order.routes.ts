import { Router } from 'express';
import {
  getOrdersHandler,
  getOrderByIdHandler,
  createOrderHandler,
  updateOrderStatusHandler,
  syncPancakeOrdersHandler,
  lookupOrdersHandler,
} from './order.controller.js';

const router = Router();

router.get('/', getOrdersHandler);
router.get('/lookup', lookupOrdersHandler);
router.post('/', createOrderHandler);
router.post('/sync-pancake', syncPancakeOrdersHandler);
router.get('/:id', getOrderByIdHandler);
router.patch('/:id/status', updateOrderStatusHandler);

export default router;

