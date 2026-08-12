import { Suspense } from "react";

import { ProgramPublicView } from "@/components/mitra/program-public-view";

export default function MitraProgramSalesforceDetailPage() {
    return (
        <Suspense>
            <ProgramPublicView targetType="SALESFORCE" />
        </Suspense>
    );
}
