import type { Product } from "./product";

export interface CartItem {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  createdAt: Date;
  product: Product;
}
