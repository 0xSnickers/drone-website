export type StoreCategoryId = 'all' | 'battery' | 'gimbal' | 'controller' | 'bag' | 'care';

export type HardwareVariant = 'battery' | 'controller' | 'hub' | 'filter' | 'case';

export interface AccessoryItem {
  id: string;
  category: Exclude<StoreCategoryId, 'all'>;
  titleKey: string;
  descKey: string;
  chipKey: string;
  promoKey?: string;
  promoTone?: 'primary' | 'secondary';
  price: number;
  originalPrice?: number;
  art: HardwareVariant;
}

export interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
}
