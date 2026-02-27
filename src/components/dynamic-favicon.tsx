"use client";

import { useEffect, useState } from "react";

export function DynamicFavicon() {
    const [faviconUrl, setFaviconUrl] = useState("");

    useEffect(() => {
        fetch("/api/public/settings")
            .then((r) => r.json())
            .then((data) => {
                if (data.favicon_url) {
                    setFaviconUrl(data.favicon_url);
                }
            })
            .catch(() => { });
    }, []);

    if (!faviconUrl) return null;

    return (
        <>
            <link rel="icon" href={faviconUrl} />
            <link rel="shortcut icon" href={faviconUrl} />
            <link rel="apple-touch-icon" href={faviconUrl} />
        </>
    );
}
