import { QuizTool } from "@/components/quiz/QuizTool";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("竞猜与抽奖", "Quiz & prize draw") };
}

export default function QuizPage() { return <QuizTool />; }
