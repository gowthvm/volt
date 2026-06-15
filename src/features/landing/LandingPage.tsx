import { useEffect, useState } from 'react';
import Navbar from './Navbar';
import HeroSection from './HeroSection';
import DemoPreview from './DemoPreview';
import HowItWorksSection from './HowItWorksSection';
import FeaturesSection from './FeaturesSection';
import ComparisonSection from './ComparisonSection';
import CtaSection from './CtaSection';
import Footer from './Footer';
import GradualBlur from '@/components/ui/GradualBlur';

export default function LandingPage() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative bg-base text-text-primary antialiased selection:bg-accent/20">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.015]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      {/* Noise overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
        }}
      />
      <div
        className="fixed top-0 left-0 z-[60] h-0.5 bg-accent transition-all duration-100 ease-linear"
        style={{ width: `${scrollProgress}%` }}
      />
      <Navbar />
      <main className="relative z-10">
        <HeroSection />
        <div className="fixed bottom-0 left-0 right-0 pointer-events-none" style={{ height: '6rem', zIndex: 40 }}>
          <GradualBlur position="bottom" height="6rem" strength={2} divCount={6} curve="bezier" opacity={1} />
        </div>
        <DemoPreview />
        <HowItWorksSection />
        <FeaturesSection />
        <ComparisonSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
