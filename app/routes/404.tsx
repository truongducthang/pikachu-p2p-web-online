
import { useEffect } from 'react';

export default function NotFoundRoute() {
 
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      window.location.replace("/");
    }, 1000); 

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-6">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-2xl text-center border-t-4 border-red-500">
        <svg className="mx-auto h-16 w-16 text-red-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h1 className="mt-4 text-5xl font-extrabold tracking-tight text-gray-900">404</h1>
        <p className="mt-2 text-lg text-red-600 font-semibold">
          Page Not Found
        </p>
        <p className="mt-6 text-sm text-gray-600">
          Redirecting you to the home page now...
        </p>
      </div>
    </div>
  );
}