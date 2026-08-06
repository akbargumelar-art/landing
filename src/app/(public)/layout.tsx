import { Navbar } from "@/components/navbar";
import { BottomNav } from "@/components/bottom-nav";
import { Footer } from "@/components/footer";

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <Navbar />
            <main className="pt-16">{children}</main>
            <Footer />
            {/* Ruang untuk BottomNav yang melayang, supaya bagian bawah footer tidak
                tertutup. Hanya di ponsel; dari 768px ke atas bar-nya tidak dirender. */}
            <div aria-hidden className="h-24 md:hidden" />
            <BottomNav />
        </>
    );
}
