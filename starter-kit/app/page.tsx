import { Hero } from "../components/Hero";
import { Features } from "../components/Features";
import { Pricing } from "../components/Pricing";
import { Faq } from "../components/FAQ";
import { Cta } from "../components/CTA";
import { Contact } from "../components/Contact";
import { Footer } from "../components/Footer";

export default function Page() {
  return (
    <>
      <Hero />
      <Features />
      <Pricing />
      <Faq />
      <Cta />
      <Contact />
      <Footer />
    </>
  );
}
