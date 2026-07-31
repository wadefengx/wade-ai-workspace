import { Suspense } from "react";
import { AgentsPage } from "../../../components/agents-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AgentsPage />
    </Suspense>
  );
}
