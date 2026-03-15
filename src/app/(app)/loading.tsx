import { PageSkeleton } from '@/components/LoadingSkeleton';

export default function AppLoading() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <PageSkeleton />
    </div>
  );
}
