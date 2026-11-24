import { create } from 'zustand';
import type { CartItem } from '../types';

interface CartState {
  items: CartItem[];
  toastMessage: string | null;
  addItem: (item: Omit<CartItem, 'quantity'>, toastText?: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  showToast: (message: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

const defaultInitialItems: CartItem[] = [
  {
    id: 'v8-pro-battery',
    title: 'V8 Pro 智能飞行电池',
    price: 899,
    quantity: 1,
  },
];

export const useCartStore = create<CartState>((set) => ({
  items: defaultInitialItems,
  toastMessage: null,
  addItem: (incoming, toastText) => {
    set((state) => {
      const existing = state.items.find((entry) => entry.id === incoming.id);
      const nextItems = existing
        ? state.items.map((entry) =>
            entry.id === incoming.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
          )
        : [...state.items, { ...incoming, quantity: 1 }];
      return {
        items: nextItems,
        toastMessage: toastText ?? state.toastMessage,
      };
    });

    if (toastText) {
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        set({ toastMessage: null });
      }, 2200);
    }
  },
  updateQuantity: (id, delta) =>
    set((state) => ({
      items: state.items
        .map((entry) => (entry.id === id ? { ...entry, quantity: entry.quantity + delta } : entry))
        .filter((entry) => entry.quantity > 0),
    })),
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((entry) => entry.id !== id),
    })),
  clearCart: () => set({ items: [] }),
  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastMessage: message });
    toastTimer = setTimeout(() => {
      set({ toastMessage: null });
    }, 2200);
  },
}));

export function resetCartStoreForTests(): void {
  if (toastTimer) clearTimeout(toastTimer);
  useCartStore.setState({ items: defaultInitialItems, toastMessage: null });
}
