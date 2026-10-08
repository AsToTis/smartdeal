import React, { createContext, useState, useContext } from 'react';

export interface CartItem {
  product_id: number;
  name: string;
  price: number;
  original_price?: number;
  discount_price?: number;
  quantity: number;
  stock_quantity: number;
  image_url: string;
  description?: string;
  shop_id?: number;
  shop_name?: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: any, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  totalCount: number;
  totalAmount: number;
}

// ฟังก์ชันแปลงราคาสินค้าให้ปลอดภัยจาก NaN
export const parseItemPrice = (item: any): number => {
  if (!item) return 0;
  
  // ลำดับความสำคัญ: discount_price -> price -> original_price -> originalPrice
  let rawVal = item.discount_price !== undefined && item.discount_price !== null
    ? item.discount_price
    : item.price !== undefined && item.price !== null
    ? item.price
    : item.original_price !== undefined && item.original_price !== null
    ? item.original_price
    : item.originalPrice !== undefined && item.originalPrice !== null
    ? item.originalPrice
    : 0;

  if (typeof rawVal === 'number') {
    return isNaN(rawVal) ? 0 : rawVal;
  }

  if (typeof rawVal === 'string') {
    const cleaned = rawVal.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  return 0;
};

// ฟังก์ชันแปลงจำนวนสต็อกคงเหลือให้ปลอดภัย
export const parseItemStock = (item: any): number => {
  if (!item) return 5;
  const rawStock = item.stock_quantity !== undefined && item.stock_quantity !== null
    ? item.stock_quantity
    : item.stock !== undefined && item.stock !== null
    ? item.stock
    : item.quantity_in_stock !== undefined && item.quantity_in_stock !== null
    ? item.quantity_in_stock
    : 5;

  const num = parseInt(String(rawStock), 10);
  return isNaN(num) || num < 0 ? 5 : num;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  // เพิ่มสินค้าเข้าตะกร้า
  const addToCart = (product: any, requestedQty = 1) => {
    if (!product) return;

    const pId = Number(product.product_id || product.id || 1);
    const pPrice = parseItemPrice(product);
    const pStock = parseItemStock(product);
    const pName = product.name || product.product_name || product.title || 'อาหารส่วนเกินคุณภาพพรีเมียม';
    const pImage = product.image_url || product.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500';
    const pShopId = Number(product.shop_id || product.shopId || 1);
    const pShopName = product.shop_name || product.shop?.name || product.shop_title || '';
    const addQty = Math.max(1, parseInt(String(requestedQty), 10) || 1);

    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === pId);
      if (existing) {
        const maxStock = pStock > 0 ? pStock : (existing.stock_quantity || 99);
        const newQuantity = Math.min(maxStock, existing.quantity + addQty);

        return prev.map((item) =>
          item.product_id === pId
            ? { 
                ...item, 
                price: pPrice > 0 ? pPrice : (item.price || 0),
                stock_quantity: maxStock,
                quantity: newQuantity,
                shop_id: pShopId || item.shop_id,
                shop_name: pShopName || item.shop_name
              }
            : item
        );
      }

      return [
        ...prev,
        {
          product_id: pId,
          name: pName,
          price: pPrice,
          original_price: parseItemPrice({ price: product.original_price ?? product.originalPrice ?? pPrice }),
          quantity: Math.min(pStock > 0 ? pStock : 99, addQty),
          stock_quantity: pStock,
          image_url: pImage,
          description: product.description || '',
          shop_id: pShopId,
          shop_name: pShopName
        },
      ];
    });
  };

  // ลบสินค้าออกจากตะกร้า
  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  // ปรับจำนวนสินค้าในตะกร้า (ล็อกตาม stock_quantity)
  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id === productId) {
          const maxStock = item.stock_quantity > 0 ? item.stock_quantity : 99;
          const safeQty = Math.min(maxStock, Math.max(1, quantity));
          return { ...item, quantity: safeQty };
        }
        return item;
      })
    );
  };

  // ล้างตะกร้า
  const clearCart = () => setCart([]);

  // คำนวณจำนวนชิ้นรวม (ป้องกัน NaN)
  const totalCount = cart.reduce((sum, item) => {
    const q = Number(item.quantity) || 0;
    return sum + (isNaN(q) ? 0 : q);
  }, 0);

  // คำนวณราคารวม (ป้องกัน NaN)
  const totalAmount = cart.reduce((sum, item) => {
    const p = parseItemPrice(item);
    const q = Number(item.quantity) || 0;
    const itemTotal = p * q;
    return sum + (isNaN(itemTotal) ? 0 : itemTotal);
  }, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, totalCount, totalAmount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};