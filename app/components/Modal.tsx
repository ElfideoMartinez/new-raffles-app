
import React from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, imageUrl }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50"
      onClick={onClose}
    >
      <div
        className="relative max-w-full max-h-full p-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()} 
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white text-2xl font-bold focus:outline-none p-1 m-1 rounded-full"
          style={{ backgroundColor: "var(--color-brand-700)"}}
        >
          &times;
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- may be a
            data:/blob: upload; next/image cannot optimise those. */}
        <img
          src={imageUrl}
          alt="Comprobante ampliado"
          className="w-auto h-auto max-w-[90vw] max-h-[90vh] object-contain rounded-card shadow-lg"
        />
      </div>
    </div>
  );
};

export default Modal;
