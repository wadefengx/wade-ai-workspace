import dynamic from "next/dynamic";
import { Suspense } from "react";

const MemoryPage = dynamic(() => import("../../../components/memory-page").then((mod) => mod.MemoryPage));

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MemoryPage />
    </Suspense>
  );
}
