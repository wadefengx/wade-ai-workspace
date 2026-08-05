import dynamic from "next/dynamic";
import { Suspense } from "react";

const SkillsPage = dynamic(() => import("../../../components/skills-page").then((mod) => mod.SkillsPage));

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SkillsPage />
    </Suspense>
  );
}
