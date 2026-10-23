
import React from "react";
import Dialog from "./Dialog";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, imageUrl }) => {
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <div
        className="relative max-w-full max-h-full p-4 overflow-hidden"
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 text-white text-2xl font-bold p-1 m-1 rounded-pill"
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
    </Dialog>
  );
};

export default Modal;
