// store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface IUserCartStore {
  raffleId: string;
  ticketNumbers: number[];
  raffleTotalPrice?: number;
}

interface ITikets {
  [key: string]: {
    ticketNumbers: number[];
  };
}

interface TicketStoreState {
  tickets: ITikets;
  userCartStore: IUserCartStore[];
  addTicket: (ticketNumber: number, raffleId: string) => void;
  removeTicket: (ticketNumber: number, raffleId: string) => void;
  getSelectedTickets: (raffleId: string) => number[];
  getTotalTickets?: () => number[];
  addTicketsToCart: (raffleId: string, price: number) => void;
  getItemsFromCart: () => IUserCartStore[];
  cleanCart: () => void;
  removeItemFromCart: (raffleId: string) => void;
  clearSelectedTickets: () => void;
}

// Define the state type
interface TicketState {
  tickets: Record<string, { ticketNumbers: number[] }>;
  userCartStore: Array<{
    raffleId: string;
    ticketNumbers: number[];
    raffleTotalPrice: number;
  }>;
  paymentMethod: string;
  addTicket: (ticketNumber: number, raffleId: string) => void;
  removeTicket: (ticketNumber: number, raffleId: string) => void;
  addTicketsToCart: (raffleId: string, price: number) => void;
  cleanCart: () => void;
  getItemsFromCart: () => Array<{
    raffleId: string;
    ticketNumbers: number[];
    raffleTotalPrice: number;
  }>;
  removeItemFromCart: (raffleId: string) => void;
  getSelectedTickets: (raffleId: string) => number[];
  clearSelectedTickets: () => void;
  getTicketsInCartByRaffleId: (raffleId: string) => number[];
  setPaymentMethod: (method: string) => void;
}

// Create the store with proper typing
const useTicketStore = create<TicketState>()(
  persist<TicketState>(
    (set, get) => ({
      tickets: {},
      userCartStore: [],
      paymentMethod: "",

      addTicket: (ticketNumber, raffleId) =>
        set((state) => {
          const currentTickets = state.tickets[raffleId]?.ticketNumbers || [];
          if (currentTickets.includes(ticketNumber)) {
            return state;
          }
          return {
            tickets: {
              ...state.tickets,
              [raffleId]: {
                ticketNumbers: [...currentTickets, ticketNumber],
              },
            },
          };
        }),

      removeTicket: (ticketNumber, raffleId) =>
        set((state) => ({
          tickets: {
            ...state.tickets,
            [raffleId]: {
              ticketNumbers: state.tickets[raffleId]?.ticketNumbers?.filter(
                (number) => number !== ticketNumber
              ),
            },
          },
        })),

      addTicketsToCart: (raffleId, price) => {
        const ticketNumbers = get().tickets[raffleId]?.ticketNumbers || [];
        set((state) => {
          const existingCartIndex = state.userCartStore.findIndex(
            (item) => item.raffleId === raffleId
          );
      
          if (existingCartIndex !== -1) {
            const updatedCart = [...state.userCartStore];
            const combinedTickets = [
              ...new Set([...updatedCart[existingCartIndex].ticketNumbers, ...ticketNumbers]),
            ];
            updatedCart[existingCartIndex] = {
              ...updatedCart[existingCartIndex],
              ticketNumbers: combinedTickets,
              raffleTotalPrice: combinedTickets.length * price,
            };
            return {
              userCartStore: updatedCart,
              tickets: {
                ...state.tickets,
                [raffleId]: { ticketNumbers: [] },
              },
            };
          }
      
          return {
            userCartStore: [
              ...state.userCartStore,
              { raffleId, ticketNumbers, raffleTotalPrice: ticketNumbers.length * price },
            ],
            tickets: {
              ...state.tickets,
              [raffleId]: { ticketNumbers: [] },
            },
          };
        });
      },
        
      cleanCart: () => set({ userCartStore: [] }),

      getItemsFromCart: () => get().userCartStore,

      removeItemFromCart: (raffleId) =>
        set((state) => ({
          userCartStore: state.userCartStore.filter(
            (cartItem) => cartItem.raffleId !== raffleId
          ),
        })),

      getSelectedTickets: (raffleId) =>
        get().tickets[raffleId]?.ticketNumbers || [],

      clearSelectedTickets: () => set({ tickets: {} }),

      getTicketsInCartByRaffleId: (raffleId: string) => {
        const cartItems = get().userCartStore;
        const ticketsForRaffle = cartItems.filter(
          (item) => item.raffleId === raffleId
        );
        const ticketNumbers = ticketsForRaffle.flatMap(
          (item) => item.ticketNumbers
        );
        return ticketNumbers;
      },
      setPaymentMethod: (method) => set({ paymentMethod: method }),
      
    }),
    {
      name: "ticket-store",
      getStorage: () => localStorage,
    }
  )
);

export default useTicketStore;
