import { Suspense } from "react";
import { KnowledgePage } from "../../../components/knowledge-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <KnowledgePage />
    </Suspense>
  );
}
