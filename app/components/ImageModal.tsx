
import React, { useState } from "react";
import Modal from "./Modal";

interface Sale {
  paymentImage?: string;
}

const ImageWithModal: React.FC<{ sale: Sale }> = ({ sale }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");

  const handleImageClick = (url: string | undefined) => {
    if (url) {
      setImageUrl(url);
      setIsModalOpen(true);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setImageUrl(""); // Limpia la URL de la imagen
  };

  const imageToDisplay = sale.paymentImage ?? "/path/to/default-image.jpg"; 

  return (
    <div>
      {sale.paymentImage && (
        // eslint-disable-next-line @next/next/no-img-element -- source may be a
        // data:/blob: URL; next/image cannot optimise those.
        <img
          src={imageToDisplay}
          alt="payment"
          onClick={() => handleImageClick(sale.paymentImage)}
          className="cursor-pointer w-16 h-24 mb-2 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105"
        />
      )}
      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        imageUrl={imageUrl}
      />
    </div>
  );
};

export default ImageWithModal;
