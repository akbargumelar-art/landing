import { Suspense } from "react";

import { ProgramPublicView } from "@/components/mitra/program-public-view";

export default function MitraProgramOutletDetailPage() {
    return (
        <Suspense>
            <ProgramPublicView targetType="OUTLET" />
        </Suspense>
    );
}
