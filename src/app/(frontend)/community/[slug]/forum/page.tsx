import { CommunitySection } from "@/components/CommunitySection";
export default function Page(props: { params: Promise<{ slug: string }>; searchParams: Promise<{ message?: string }> }) { return <CommunitySection {...props} section="forum" />; }
