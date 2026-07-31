import { Suspense } from "react";
import { MembersPage } from "../../../components/members-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MembersPage />
    </Suspense>
  );
}
