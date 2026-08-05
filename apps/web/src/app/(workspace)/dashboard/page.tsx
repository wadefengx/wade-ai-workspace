import dynamic from "next/dynamic";
import { Suspense } from "react";

const DashboardPage = dynamic(() =>
  import("../../../components/dashboard-page").then((mod) => mod.DashboardPage)
);

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DashboardPage />
    </Suspense>
  );
}
