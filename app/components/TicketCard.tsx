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
  <div className='bg-surface text-ink-900 p-4 rounded-card mb-4 shadow flex justify-between items-center'>
    <div>
      <div>
        <span className='text-3xl text-center ml-auto text-success-700 font-extrabold tracking-widest'>
          {activationCode}
        </span>
      </div>
      <div className='text-sm text-ink-500'>
        <strong>Created:</strong> {createdAt}
      </div>
      <div className='text-sm'>
        <strong>Symbols:</strong> {symbols?.join(", ")}
        {isWinner && (
          <span className='text-success-700 ml-2 font-bold'>Winner</span>
        )}
      </div>
    </div>
    {children}
  </div>
);

export default TicketCard;
