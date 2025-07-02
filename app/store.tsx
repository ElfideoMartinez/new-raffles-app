// store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface IUserCartStore {
  raffleId: string;
  raffleName: string;
  ticketNumbers: number[];
  raffleTotalPrice?: number;
}

interface IUserCartBets {
  betId: string;
  betName: string;
  team: string;
  letterTeam: string;
  ticketNumbers: number;
  totalPrice: number;
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
    raffleName: string;
    ticketNumbers: number[];
    raffleTotalPrice: number;
  }>;
  paymentMethod: string;
  addTicket: (ticketNumber: number, raffleId: string) => void;
  removeTicket: (ticketNumber: number, raffleId: string) => void;
  addTicketsToCart: (raffleId: string, price: number, raffleName: string) => void;
  removeTicketFromCart: (raffleId: string, ticketNumber: number) => void;
  cleanCart: () => void;
  getItemsFromCart: () => Array<{
    raffleId: string;
    raffleName: string;
    ticketNumbers: number[];
    raffleTotalPrice: number;
  }>;
  removeItemFromCart: (raffleId: string) => void;
  getSelectedTickets: (raffleId: string) => number[];
  clearSelectedTickets: () => void;
  getTicketsInCartByRaffleId: (raffleId: string) => number[];
  setPaymentMethod: (method: string) => void;
  userCartBets: Array<{
    betId: string;
    betName: string;
    team: string;
    letterTeam: string;
    ticketNumbers: number;
    totalPrice: number;
  }>
  updateBet: (newBet: IUserCartBets) => void;
  getBetsFromCart: () => Array<{
    betId: string;
    betName: string;
    team: string;
    letterTeam: string;
    ticketNumbers: number;
    totalPrice: number;
  }>;
  removeBetById: (betId: string) => void;
  clearCartBets: () => void,
}

// Create the store with proper typing
const useTicketStore = create<TicketState>()(
  persist<TicketState>(
    (set, get) => ({
      tickets: {},
      userCartStore: [],
      paymentMethod: "",
      userCartBets: [],

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

      addTicketsToCart: (raffleId, price, raffleName) => {
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
              raffleName: updatedCart[existingCartIndex].raffleName || raffleName, 
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
              { raffleId, raffleName ,ticketNumbers, raffleTotalPrice: ticketNumbers.length * price },
            ],
            tickets: {
              ...state.tickets,
              [raffleId]: { ticketNumbers: [] },
            },
          };
        });
      },

      removeTicketFromCart: (raffleId, ticketNumber) => {
        set((state) => {
          const existingCartIndex = state.userCartStore.findIndex(
            (item) => item.raffleId === raffleId
          );
      
          if (existingCartIndex !== -1) {
            const updatedCart = [...state.userCartStore];
            const updatedTickets = updatedCart[existingCartIndex].ticketNumbers.filter(
              (num) => num !== ticketNumber
            );
      
            if (updatedTickets.length === 0) {
              // Si ya no quedan boletos, eliminar la rifa del carrito
              updatedCart.splice(existingCartIndex, 1);
            } else {
              updatedCart[existingCartIndex] = {
                ...updatedCart[existingCartIndex],
                ticketNumbers: updatedTickets,
                raffleTotalPrice: updatedTickets.length * (updatedCart[existingCartIndex].raffleTotalPrice / updatedCart[existingCartIndex].ticketNumbers.length),
              };
            }
      
            return { userCartStore: updatedCart };
          }
          return {};
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
      
      updateBet: (newBet) => {
        const currentBets = get().userCartBets;
        const existingIndex = currentBets.findIndex(b => b.betId === newBet.betId);
      
        if (newBet.ticketNumbers <= 0) {
          // Eliminar si no hay boletos
          return set({
            userCartBets: currentBets.filter(b => b.betId !== newBet.betId),
          });
        }
      
        if (existingIndex !== -1) {
          // Reemplazar toda la apuesta (incluye cambio de equipo)
          const updatedBets = [...currentBets];
          updatedBets[existingIndex] = newBet;
          set({ userCartBets: updatedBets });
        } else {
          // Agregar nueva apuesta
          set({ userCartBets: [...currentBets, newBet] });
        }
      },
      
      getBetsFromCart: () => get().userCartBets,

      removeBetById: (betId) => {
        set((state) => ({
          userCartBets: state.userCartBets.filter((bet) => bet.betId !== betId),
        }));
      },

      clearCartBets: () => set({ userCartBets: [] }),
    }),
    {
      name: "ticket-store",
      getStorage: () => localStorage,
    }
  )
);

export default useTicketStore;
