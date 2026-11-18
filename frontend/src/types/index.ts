export type Role = 'STUDENT' | 'ADMIN';

export type ProductType = 'CHAPTER' | 'SUBJECT_PACK' | 'MONTHLY_PASS' | 'ANNUAL_PASS';

export type EntitlementScope = 'CHAPTER' | 'SUBJECT' | 'CLASS_PASS';

export type ProductState = 'OWNED' | 'UPGRADE' | 'BUY';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
}

export interface Material {
  id: string;
  title: string;
  chapterId: string;
}

export interface Chapter {
  id: string;
  title: string;
  orderIndex: number;
  isFree: boolean;
  subjectId: string;
  materials?: Material[];
  product?: ProductInfo | null;
  state?: ProductState;
}

export interface Subject {
  id: string;
  name: string;
  classId: string;
  chapters?: Chapter[];
  product?: ProductInfo | null;
  state?: ProductState;
}

export interface ClassLevel {
  id: string;
  name: string;
  boardId: string;
  subjects?: Subject[];
  passes?: ProductInfo[];
}

export interface Board {
  id: string;
  name: string;
  classes?: ClassLevel[];
}

export interface ProductInfo {
  id: string;
  title: string;
  description?: string | null;
  type: ProductType;
  targetId: string;
  pricePaise: number;
  state?: ProductState;
  finalPricePaise?: number;
  upgradeCreditPaise?: number;
  isOffered?: boolean;
}

export interface CartProduct {
  productId: string;
  title: string;
  type: ProductType;
  pricePaise: number;
  originalPricePaise?: number;
  targetId?: string;
}

export interface CartCalculationLine {
  item: {
    id: string;
    productId: string;
    title: string;
    type: ProductType;
    pricePaise: number;
  };
  originalPricePaise: number;
  upgradeCreditPaise: number;
  finalPricePaise: number;
}

export interface CartCalculation {
  lines: CartCalculationLine[];
  subtotalPaise: number;
  discountPaise: number;
  totalPaise: number;
  basePaise: number;
  gstPaise: number;
}

export interface OrderItemSummary {
  id: string;
  productId: string;
  productTitle: string;
  productType: ProductType;
  targetId: string;
  pricePaise: number;
}

export interface OrderDetails {
  id: string;
  status: 'CREATED' | 'PAID' | 'FAILED';
  amountPaise: number;
  razorpayOrderId: string;
  createdAt: string;
  items: OrderItemSummary[];
}

export interface LibraryItem {
  id: string;
  scope: EntitlementScope;
  refId: string;
  title: string;
  expiresAt: string | null;
  isLifetime: boolean;
  materials?: {
    id: string;
    title: string;
  }[];
}
