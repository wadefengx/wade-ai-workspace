import dynamic from "next/dynamic";
import { Suspense } from "react";

const SpecsPage = dynamic(() => import("../../../components/specs-page").then((mod) => mod.SpecsPage));

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SpecsPage />
    </Suspense>
  );
}
