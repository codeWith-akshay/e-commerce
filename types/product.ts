export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  rating: number;
  images: string[];
  createdAt: Date;
}
