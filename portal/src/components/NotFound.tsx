import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-md">
        <div className="text-center">
          <h1 className="text-8xl font-bold text-blue-600">404</h1>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Page Not Found</h2>
          <p className="mt-4 text-lg text-gray-500">
            The page you are looking for might have been removed, had its name changed, 
            or is temporarily unavailable.
          </p>
        </div>
        <div className="mt-8 flex justify-center">
          <Link 
            to="/" 
            className="px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:text-lg md:px-8 transition-colors duration-200"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;