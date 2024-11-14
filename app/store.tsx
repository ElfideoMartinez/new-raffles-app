// store.ts
import { create } from "zustand";

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

const useTicketStore = create<TicketStoreState>((set, get) => ({
  tickets: {},
  userCartStore: [],

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
    const raffleTotalPrice = ticketNumbers.length * price;
    set((state) => ({
      userCartStore: [
        ...state.userCartStore,
        { raffleId, ticketNumbers, raffleTotalPrice },
      ],
    }));
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
}));

export default useTicketStore;
