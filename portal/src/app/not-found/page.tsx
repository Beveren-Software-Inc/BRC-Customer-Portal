"use client";

import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  // We can keep the useNavigate hook for other potential uses
  const navigate = useNavigate();
  
  const goToHome = () => {
    window.location.href = '/app';
  };
  
  const goToLogin = () => {
    window.location.href = '/app/login';
  };
  
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="relative">
            <h1 className="text-9xl font-extrabold text-blue-600 dark:text-blue-500">404</h1>
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <svg className="w-64 h-64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.172 16.172L12 13.344L14.828 16.172M12 13.344L14.828 10.516M12 13.344L9.172 10.516M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" 
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-gray-100">Page Not Found</h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            The page you are looking for doesn't exist or you don't have permission to access it.
          </p>
        </div>
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={goToHome}
            className="px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            Return to Home
          </button>
          <button
            onClick={goToLogin}
            className="px-6 py-3 border border-blue-600 text-base font-medium rounded-md text-blue-600 bg-transparent hover:bg-blue-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            Go to Login
          </button>
        </div>
      </div>
    </div>
  );
}