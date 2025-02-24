'use client';

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5">
      <h1 className="text-4xl md:text-6xl font-bold text-center mb-8">
        AI Image Enhancer
      </h1>
      <Link
        href="/get-started"
        className="bg-black text-white px-8 py-4 rounded-md text-lg font-medium hover:bg-gray-800 transition-colors"
      >
        Get Started
      </Link>
    </div>
  );
}
