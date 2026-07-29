import { BrandPromotionDetail } from "@/features/dashboard/BrandPromotionDetail";

export default async function Page({ params }: { params: Promise<{ promotionId: string }> }) {
  const { promotionId } = await params;
  return <BrandPromotionDetail promotionId={promotionId} />;
}
