import { Suspense } from "react";
import { SpecsPage } from "../../../components/specs-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SpecsPage />
    </Suspense>
  );
}
