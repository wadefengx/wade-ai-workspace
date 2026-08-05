import dynamic from "next/dynamic";
import { Suspense } from "react";

const MembersPage = dynamic(() => import("../../../components/members-page").then((mod) => mod.MembersPage));

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MembersPage />
    </Suspense>
  );
}
