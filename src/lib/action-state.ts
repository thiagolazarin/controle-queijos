export type OrderReceipt = {
  orderNumber: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  deliveryDate: string;
  deliveryAddress: string | null;
  deliveryEstimate: string | null;
};

export type ActionState = {
  error?: string;
  success?: string;
  orderId?: string;
  receipt?: OrderReceipt;
};
