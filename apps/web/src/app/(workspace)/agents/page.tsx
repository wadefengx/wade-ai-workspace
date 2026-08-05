import dynamic from "next/dynamic";
import { Suspense } from "react";

const AgentsPage = dynamic(() => import("../../../components/agents-page").then((mod) => mod.AgentsPage));

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AgentsPage />
    </Suspense>
  );
}
