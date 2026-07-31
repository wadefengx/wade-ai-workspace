import { Suspense } from "react";
import { SkillsPage } from "../../../components/skills-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SkillsPage />
    </Suspense>
  );
}
