import { MoveLearningSection } from "./docsComponents/move-learning/MoveLearningSection";

export function LearningPage() {
  return (
    <div className="h-full min-h-0 overflow-y-auto text-[#f0f0f5] skills-main-glow">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <MoveLearningSection />
      </div>
    </div>
  );
}

export default LearningPage;