"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const GameScreen = dynamic(() => import("@/components/GameScreen"), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-black" />,
});

export default function PlayPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-black" />}>
      <GameScreen />
    </Suspense>
  );
}
