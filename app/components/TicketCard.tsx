import React from "react";

interface TicketCardProps {
  activationCode: string;
  createdAt: string;
  symbols: string[];
  children?: React.ReactNode;
  isWinner?: boolean;
}

const TicketCard: React.FC<TicketCardProps> = ({
  activationCode,
  createdAt,
  symbols,
  children,
  isWinner = false,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-ink-100 bg-surface p-4 text-ink-900 shadow-card">
    <div>
      <div>
        <span className='text-3xl text-center ml-auto text-success-700 font-extrabold tracking-widest'>
          {activationCode}
        </span>
      </div>
      <div className='text-sm text-ink-500'>
        <strong>Creado:</strong> {createdAt}
      </div>
      <div className='text-sm'>
        <strong>Símbolos:</strong> {symbols?.join(", ")}
        {isWinner && (
          <span className='text-success-700 ml-2 font-bold'>Ganador</span>
        )}
      </div>
    </div>
    {children}
  </div>
);

export default TicketCard;
