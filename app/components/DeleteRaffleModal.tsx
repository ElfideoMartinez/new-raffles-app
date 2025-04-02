import { useState } from "react";

const DeleteRaffleModal = ({ idRaffle, onDelete }: { idRaffle: string; onDelete: (id: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      {/* Botón para abrir el modal */}
      <button 
        type="button"
        className='bg-red-500 p-2 h-12 w-12 rounded-lg flex items-center justify-center hover:bg-red-600'
        onClick={() => setIsOpen(true)}
      >
        <img src="/trash.png" className="filter invert" alt="Eliminar"/>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-80 text-center">
            <h2 className="text-xl font-bold mb-4 text-gray-950">¿Eliminar rifa?</h2>
            <p className="text-gray-600 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex justify-center gap-4">
              <button 
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </button>
              <button 
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
                onClick={() => {
                  onDelete(idRaffle);
                  setIsOpen(false);
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DeleteRaffleModal;
