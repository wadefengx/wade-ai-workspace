import dynamic from "next/dynamic";
import { Suspense } from "react";

const SettingsPage = dynamic(() => import("../../../components/settings-page").then((mod) => mod.SettingsPage));

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SettingsPage />
    </Suspense>
  );
}
