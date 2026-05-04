import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-black dark:text-white">404</h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          This auction house could not be found.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
        >
          Go to Live Auctions
        </Link>
      </div>
    </div>
  );
}
