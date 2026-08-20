"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const TutorialScreen = dynamic(() => import("@/components/TutorialScreen"), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-black" />,
});

export default function TutorialPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-black" />}>
      <TutorialScreen />
    </Suspense>
  );
}
