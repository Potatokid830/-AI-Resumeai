import HeroBackground from "@/components/hero/HeroBackground";
import HeroContent from "@/components/hero/HeroContent";

export default function Home() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-zinc-950">
      <HeroBackground />
      <HeroContent />
    </main>
  );
}
