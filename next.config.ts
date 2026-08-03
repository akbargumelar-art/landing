import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: "20mb",
        },
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**",
            },
        ],
    },
    async redirects() {
        return [
            {
                source: "/belanja/:path*",
                destination: "/",
                permanent: false,
            },
        ];
    },
};

export default nextConfig;
