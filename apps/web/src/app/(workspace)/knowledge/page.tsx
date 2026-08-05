import dynamic from "next/dynamic";
import { Suspense } from "react";

const KnowledgePage = dynamic(() =>
  import("../../../components/knowledge-page").then((mod) => mod.KnowledgePage)
);

export default function Page() {
  return (
    <Suspense fallback={null}>
      <KnowledgePage />
    </Suspense>
  );
}
