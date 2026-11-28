import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { CategoryDiscoverySection } from "@/components/landing/CategoryDiscoverySection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground font-sans selection:bg-emerald-500/25 selection:text-emerald-200">
      <Navbar activePath="/" />
      <main className="flex-1">
        <HeroSection />
        <CategoryDiscoverySection />
        <ProblemSection />
        <FeaturesSection />
        <HowItWorksSection />
      </main>
      <Footer />
    </div>
  );
}
