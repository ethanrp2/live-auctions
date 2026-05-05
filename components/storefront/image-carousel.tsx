"use client";

import { useState, useRef, useCallback } from "react";

interface ImageCarouselProps {
  images: string[];
  alt: string;
  heightClass?: string;
}

const DEFAULT_HEIGHT_CLASS = "h-[300px] lg:h-[calc(100vh-110px)]";

function ArrowLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 lg:h-5 lg:w-5" aria-hidden="true">
      <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 lg:h-5 lg:w-5" aria-hidden="true">
      <path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ImageCarousel({ images, alt, heightClass = DEFAULT_HEIGHT_CLASS }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  const goTo = useCallback(
    (index: number) => {
      if (images.length === 0) return;
      setCurrentIndex((index + images.length) % images.length);
    },
    [images.length]
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    if (Math.abs(touchDeltaX.current) > 50) {
      if (touchDeltaX.current > 0) {
        goTo(currentIndex - 1);
      } else {
        goTo(currentIndex + 1);
      }
    }
    touchDeltaX.current = 0;
  };

  if (images.length === 0) {
    return (
      <div className={`flex w-full items-center justify-center bg-[#f8f8f8] ${heightClass}`}>
        <span
          className="text-[10px] uppercase tracking-widest text-[#c9c9c9]"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
        >
          No image
        </span>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-[#f8f8f8]">
      {/* Image viewport */}
      <div
        className={`relative ${heightClass} overflow-hidden`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {images.map((src, i) => (
            <div key={i} className="h-full w-full shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={i === 0 ? alt : `${alt} ${i + 1}`}
                className="h-full w-full object-contain"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation arrows — visible on both mobile and desktop */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(currentIndex - 1)}
            className="absolute left-4 top-1/2 flex -translate-y-1/2 h-6 w-6 lg:h-11 lg:w-11 items-center justify-center rounded-full bg-white/80 shadow-sm transition-shadow hover:shadow-md"
            aria-label="Previous image"
          >
            <ArrowLeft />
          </button>
          <button
            type="button"
            onClick={() => goTo(currentIndex + 1)}
            className="absolute right-4 top-1/2 flex -translate-y-1/2 h-6 w-6 lg:h-11 lg:w-11 items-center justify-center rounded-full bg-white/80 shadow-sm transition-shadow hover:shadow-md"
            aria-label="Next image"
          >
            <ArrowRight />
          </button>
        </>
      )}

      {/* Dot indicators — active dot is an elongated pill */}
      {images.length > 1 && (
        <div className="absolute bottom-3 lg:bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={`rounded-full transition-all ${
                i === currentIndex
                  ? "h-1 w-5 lg:h-2 lg:w-10 bg-black"
                  : "h-1 w-1 lg:h-2 lg:w-2 bg-black/20"
              }`}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
