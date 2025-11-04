'use client';

export default function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 to-blue-900 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-2xl text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Indicore</h2>
        <p className="text-gray-600">Please wait while we set up your experience...</p>
      </div>
    </div>
  );
}
