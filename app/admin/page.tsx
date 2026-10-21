"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../firebaseconfig";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<String | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/admin/dashboard"); // Redirect to the admin dashboard
    } catch (err) {
      setError(
        "Correo electrónico o contraseña no válidos. Por favor, inténtalo de nuevo."
      );
      console.error(err);
    }
  };

  return (
    <div className='flex justify-center items-center min-h-screen bg-gray-100'>
      <div className='w-full max-w-md p-8 space-y-6 bg-white rounded shadow-lg'>
        <h2 className='text-black text-2xl font-bold text-center'>
          Iniciar sesión
        </h2>
        {error && <p className='text-red-500 text-center'>{error}</p>}
        <form onSubmit={handleLogin} className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700'>
              Correo electrónico
            </label>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className='w-full px-4 py-2 border rounded-lg text-black focus:outline-none focus:border-blue-500 bg-white '
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700'>
              Contraseña
            </label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className='w-full px-4 py-2 border rounded-lg text-black focus:outline-none focus:border-blue-500 bg-white'
            />
          </div>
          <button
            type='submit'
            className='w-full bg-brand-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300'
          >
            Iniciar sesión
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
