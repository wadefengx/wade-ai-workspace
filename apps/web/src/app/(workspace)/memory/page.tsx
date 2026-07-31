import { Suspense } from "react";
import { MemoryPage } from "../../../components/memory-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MemoryPage />
    </Suspense>
  );
}
