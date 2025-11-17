import { WelcomeHero } from "../WelcomeHero";

export default function WelcomeHeroExample() {
  return <WelcomeHero onStartPractice={() => console.log("Start practice clicked")} />;
}
