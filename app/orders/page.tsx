import Link from "next/link";

export default function OrdersPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <h1 className="text-2xl tracking-[-0.02em] text-black">
        Your orders
      </h1>
      <p className="mt-3 max-w-md text-sm text-[#5e5e5e]">
        TODO: order history UI is stubbed. When a buyer wins a lot, the order will
        appear here with payment + shipping controls.
      </p>
      <Link
        href="/"
        className="mt-6 rounded bg-black px-4 py-2 text-xs uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90"
      >
        ← Back
      </Link>
    </div>
  );
}
