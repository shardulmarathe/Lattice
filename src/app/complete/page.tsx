"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const CompleteScreen = dynamic(() => import("@/components/CompleteScreen"), {
  ssr: false,
});

export default function CompletePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-black" />}>
      <CompleteScreen />
    </Suspense>
  );
}
